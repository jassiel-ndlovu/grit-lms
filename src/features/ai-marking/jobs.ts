/**
 * Queue and run AI-assisted marking (B research 09, "Recommendation").
 *
 *   queueAiMarkingFor  one QUEUED suggestion per written answer (short
 *                      answer, essay) of each handed-in submission
 *   runAiMarking       claims queued rows, ordered by question so a class
 *                      shares one cached memo, and for each: checks the AI
 *                      mark limit, scrubs identifiers, marks, post-checks,
 *                      escalates once when unsure, records usage
 *
 * The result is a suggestion only. Nothing here writes a QuestionGrade or
 * releases anything to the student. Server only; the marker is injectable
 * so scripts can test without calling the provider.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { AnthropicMarker, PROMPT_VERSION, type Marker } from "./marker";
import { costMicroUsd, injectionSignals, postCheck, rubricFor, scrubIdentifiers, shouldEscalate, type CheckedResult } from "./rules";

const WRITTEN = ["SHORT_ANSWER", "ESSAY"] as const;
const HANDED_IN = ["SUBMITTED", "GRADED", "LATE"] as const;
const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 10 * 60 * 1000;
/** Rand per US dollar, for the provider cost kept on usage rows. */
const ZAR_PER_USD = Number(process.env.AI_USD_TO_ZAR ?? 18.5);

function answerText(answers: unknown, questionId: string): string {
  const v = (answers as Record<string, unknown> | null)?.[questionId];
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && typeof (v as { text?: unknown }).text === "string") return String((v as { text: string }).text).trim();
  return "";
}

function memoText(answer: unknown): string {
  if (typeof answer === "string") return answer;
  if (answer == null) return "";
  return JSON.stringify(answer);
}

export async function queueAiMarkingFor(input: { testId: string; questionIds?: string[]; requestedByUserId: string }) {
  const test = await prisma.test.findUnique({
    where: { id: input.testId },
    select: { aiMarking: true, course: { select: { workspaceId: true } }, questions: { where: { type: { in: [...WRITTEN] } }, select: { id: true, points: true, rubric: true, answer: true } } },
  });
  if (!test) return { queued: 0, skipped: 0, reason: "NOT_FOUND" as const };
  if (!test.aiMarking) return { queued: 0, skipped: 0, reason: "OFF" as const };
  const questions = test.questions.filter((q) => !input.questionIds || input.questionIds.includes(q.id));
  const subs = await prisma.testSubmission.findMany({ where: { testId: input.testId, status: { in: [...HANDED_IN] } }, select: { id: true, answers: true } });
  const rows: Prisma.AiMarkSuggestionCreateManyInput[] = [];
  let skipped = 0;
  for (const s of subs) {
    for (const q of questions) {
      if (!answerText(s.answers, q.id) || !memoText(q.answer).trim()) {
        skipped++;
        continue;
      }
      rows.push({
        testSubmissionId: s.id, questionId: q.id, workspaceId: test.course.workspaceId, requestId: `m_${randomBytes(9).toString("hex")}`,
        outOf: rubricFor(q.rubric, q.points).criteria.reduce((n, c) => n + c.max, 0), requestedByUserId: input.requestedByUserId,
      });
    }
  }
  const r = rows.length ? await prisma.aiMarkSuggestion.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
  return { queued: r.count, skipped, reason: null };
}

/** Whether the workspace has used up its AI marks for the current period (a hard-stop cap). */
async function aiCapReached(workspaceId: string | null, now: Date): Promise<boolean> {
  if (!workspaceId) return false;
  const cap = await prisma.usageCap.findFirst({ where: { workspaceId, meter: "AI_MARKS", hardStop: true }, orderBy: { limitQuantity: "asc" } });
  if (!cap) return false;
  const period = await prisma.billingPeriod.findFirst({ where: { workspaceId, start: { lte: now }, end: { gt: now } }, select: { start: true } });
  const from = period?.start ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const used = await prisma.usageRecord.aggregate({ where: { workspaceId, meter: "AI_MARKS", day: { gte: from } }, _sum: { quantity: true } });
  return (used._sum.quantity ?? 0) >= cap.limitQuantity;
}

async function recordUsage(workspaceId: string | null, courseId: string, microUsd: number, now: Date) {
  if (!workspaceId) return;
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const milliCents = Math.round((microUsd * ZAR_PER_USD) / 10);
  await prisma.usageRecord.upsert({
    where: { workspaceId_meter_scopeKey_day: { workspaceId, meter: "AI_MARKS", scopeKey: courseId, day } },
    create: { workspaceId, meter: "AI_MARKS", scopeKey: courseId, day, quantity: 1, providerCostMilliCents: milliCents, source: "EVENT" },
    update: { quantity: { increment: 1 }, providerCostMilliCents: { increment: milliCents }, computedAt: now },
  });
}

export type RunResult = { claimed: number; done: number; failed: number; capped: number; escalated: number };

export async function runAiMarking(opts: { limit?: number; marker?: Marker; now?: Date } = {}): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const marker = opts.marker ?? new AnthropicMarker();
  const r: RunResult = { claimed: 0, done: 0, failed: 0, capped: 0, escalated: 0 };
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "AiMarkSuggestion" SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "AiMarkSuggestion"
      WHERE "status" = 'QUEUED' OR ("status" = 'RUNNING' AND "updatedAt" < ${new Date(now.getTime() - STALE_RUNNING_MS)})
      ORDER BY "questionId", "createdAt" LIMIT ${opts.limit ?? 30}
      FOR UPDATE SKIP LOCKED
    ) RETURNING "id"`;
  r.claimed = claimed.length;

  for (const { id } of claimed) {
    const s = await prisma.aiMarkSuggestion.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, requestId: true, attempts: true, workspaceId: true, questionId: true,
        testSubmission: { select: { answers: true, student: { select: { fullName: true } }, test: { select: { courseId: true } } } },
      },
    });
    try {
      if (await aiCapReached(s.workspaceId, now)) {
        await prisma.aiMarkSuggestion.update({ where: { id }, data: { status: "SKIPPED", error: "The workspace's AI mark limit for this period is reached" } });
        r.capped++;
        continue;
      }
      const q = await prisma.testQuestion.findUniqueOrThrow({ where: { id: s.questionId }, select: { question: true, answer: true, points: true, rubric: true } });
      const courseId = s.testSubmission.test.courseId;
      const roster = await prisma.enrollment.findMany({ where: { courseId }, select: { learner: { select: { user: { select: { name: true } } } } } });
      const staff = await prisma.courseStaff.findMany({ where: { courseId }, select: { membership: { select: { user: { select: { name: true } } } } } });
      const names = [s.testSubmission.student.fullName, ...roster.map((e) => e.learner.user.name), ...staff.map((c) => c.membership.user.name)];
      const raw = answerText(s.testSubmission.answers, s.questionId);
      const answer = scrubIdentifiers(raw, names);
      const rubric = rubricFor(q.rubric, q.points);
      const input = { requestId: s.requestId, question: scrubIdentifiers(q.question, names), memo: memoText(q.answer), rubric, answer };
      const injected = injectionSignals(raw);

      const usage = { micro: 0, input: 0, output: 0, cacheRead: 0 };
      const add = (o: { model: string; usage: { input: number; output: number; cacheRead: number; cacheWrite: number } }) => {
        usage.micro += costMicroUsd(o.model, o.usage);
        usage.input += o.usage.input + o.usage.cacheWrite;
        usage.output += o.usage.output;
        usage.cacheRead += o.usage.cacheRead;
      };
      let out = await marker.mark(input, { escalate: false });
      add(out);
      let checked: CheckedResult | null = out.result ? postCheck(out.result, rubric, answer) : null;
      if (checked && injected && !checked.flags.includes("possible_injection")) checked.flags = [...checked.flags, "possible_injection"].sort();
      let escalated = false;
      if (!checked || shouldEscalate(checked)) {
        escalated = true;
        out = await marker.mark(input, { escalate: true });
        add(out);
        const second = out.result ? postCheck(out.result, rubric, answer) : null;
        if (second) {
          if (injected && !second.flags.includes("possible_injection")) second.flags = [...second.flags, "possible_injection"].sort();
          checked = second;
        }
      }
      if (escalated) r.escalated++;
      await recordUsage(s.workspaceId, courseId, usage.micro, now);
      const common = { model: out.model, promptVersion: PROMPT_VERSION, escalated, inputTokens: usage.input, outputTokens: usage.output, cacheReadTokens: usage.cacheRead, costMicroUsd: usage.micro };
      if (!checked) {
        await prisma.aiMarkSuggestion.update({ where: { id }, data: { ...common, status: "FAILED", flags: ["needs_tutor"], error: out.refused ? "The model declined to mark this answer" : "No usable answer from the model" } });
        r.failed++;
        continue;
      }
      await prisma.aiMarkSuggestion.update({
        where: { id },
        data: {
          ...common, status: "DONE", error: null, criteria: checked.criteria as Prisma.InputJsonValue, totalAwarded: checked.total, outOf: checked.outOf,
          confidence: checked.confidence, flags: checked.flags, feedbackToStudent: checked.feedbackToStudent,
        },
      });
      r.done++;
    } catch (e) {
      const last = s.attempts >= MAX_ATTEMPTS;
      await prisma.aiMarkSuggestion.update({ where: { id }, data: { status: last ? "FAILED" : "QUEUED", error: String((e as Error).message).slice(0, 300) } });
      if (last) r.failed++;
      console.error("[ai-marking] failed:", id, (e as Error).message);
    }
  }
  return r;
}

/** For the grading form: the suggestions for one submission. */
export async function suggestionsFor(testSubmissionId: string) {
  const rows = await prisma.aiMarkSuggestion.findMany({ where: { testSubmissionId }, orderBy: { createdAt: "asc" } });
  return rows.map((s) => ({
    id: s.id, questionId: s.questionId, status: s.status, criteria: s.criteria, totalAwarded: s.totalAwarded, outOf: s.outOf,
    confidence: s.confidence, flags: s.flags, feedbackToStudent: s.feedbackToStudent, escalated: s.escalated, error: s.error,
    tutorAction: s.tutorAction, tutorScore: s.tutorScore, actedAt: s.actedAt?.toISOString() ?? null,
  }));
}

/** The tutor accepted, edited or rejected a suggestion (the audit trail; B saves the mark itself as today). */
export async function recordTutorActionFor(actorUserId: string, input: { suggestionId: string; action: "ACCEPTED" | "EDITED" | "REJECTED"; score?: number | null }) {
  return prisma.aiMarkSuggestion.update({
    where: { id: input.suggestionId },
    data: { tutorAction: input.action, tutorScore: input.score ?? null, actedByUserId: actorUserId, actedAt: new Date() },
    select: { id: true, tutorAction: true },
  });
}
