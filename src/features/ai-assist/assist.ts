/**
 * AI help for tutors (#216 phase 2): question batches from a lesson or
 * topic, a course outline from a document, and tidying or simplifying lesson
 * text. A owns the service, context, plan gates and credits; B owns the
 * editor and test-designer screens that show the drafts and save what the
 * tutor keeps. Nothing here writes to courses, lessons or tests.
 * Actions: ./actions.ts. Contract: viewer.md, "AI help for tutors".
 */

import "server-only";

import { canSpend, spendCredits } from "@/features/ai-credits/credits";
import { creditsForCost } from "@/features/ai-credits/credits-math";
import { costMicroUsd } from "@/features/ai-marking/rules";
import { isBillingEnabled } from "@/features/billing/errors";
import { derivedTier } from "@/features/billing/pricing";
import { hasService } from "@/features/billing/services";
import { CURRICULUM_LABEL, subjectTitle, topicsFor } from "@/features/courses/lib/curriculum";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";

import { AI_ASSIST_INPUT, allowance, ASSIST_FEATURES, monthStart, plainText, refusal, type Allowance, type AssistFeature, type AssistTier } from "./limits";
import {
  aiAssistConfigured, ASSIST_MODEL, draftOutline, draftQuestions, tidyText,
  type CallResult, type CourseContext, type DraftOutline, type DraftQuestion, type DraftQuestionType,
} from "./model";

const ZAR_PER_USD = Number(process.env.AI_USD_TO_ZAR ?? 18.5);
/** Credits held back before a run (rand cents of cost), so a near-empty budget is refused up front. */
const ESTIMATE_CREDITS: Record<AssistFeature, number> = { QUESTIONS: 150, OUTLINE: 250, TIDY: 40, LESSONS: 600, FEEDBACK: 40, REPORT_COMMENTS: 300, GAPS: 150, NOTES: 400, DIAGRAM: 150 };

export type CourseRow = { id: string; name: string; workspaceId: string; curriculum: string | null; subject: string | null; gradeLevel: number | null };

/** The course's plan for AI help: from its switched-on services. Before billing is on, at least Plus. */
async function courseTier(courseId: string): Promise<AssistTier> {
  const rows = await prisma.courseService.findMany({ where: { courseId, enabled: true }, select: { serviceKey: true } });
  const tier = derivedTier(rows.map((r) => r.serviceKey)) as AssistTier;
  return !isBillingEnabled() && tier === "CORE" ? "PLUS" : tier;
}

async function usedThisMonth(workspaceId: string, feature: AssistFeature, now: Date): Promise<number> {
  return prisma.aiAssistRun.count({ where: { workspaceId, feature, status: "OK", createdAt: { gte: monthStart(now) } } });
}

/** Checks the tutor may use AI help on this course and has runs left; returns the course and allowance. */
export async function gate(viewer: Viewer, courseId: string, feature: AssistFeature, now: Date): Promise<{ course: CourseRow; allowance: Allowance }> {
  if (viewer.persona !== "staff" && viewer.persona !== "admin") throw new ViewerError("FORBIDDEN");
  if (!(await canIn(viewer, "courses.edit", { courseId }))) throw new ViewerError("FORBIDDEN");
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, workspaceId: true, curriculum: true, subject: true, gradeLevel: true } });
  if (!course?.workspaceId) throw new UserError("That course no longer exists.");
  if (!aiAssistConfigured()) throw new UserError("AI help isn't switched on yet.");
  if (!(await hasService(viewer, courseId, "ai-assist"))) throw new UserError("AI help is part of the Plus and Pro plans for this course.");
  const a = allowance(await courseTier(courseId), feature, await usedThisMonth(course.workspaceId, feature, now));
  const no = refusal(a, feature);
  if (no) throw new UserError(no);
  if (isBillingEnabled()) {
    const ok = await canSpend(course.workspaceId, viewer.user.id, ESTIMATE_CREDITS[feature], now);
    if (!ok.ok) throw new UserError(ok.message);
  }
  return { course: { ...course, workspaceId: course.workspaceId }, allowance: a };
}

export function contextFor(course: CourseRow): CourseContext {
  const cc = { curriculum: course.curriculum as never, subject: course.subject, gradeLevel: course.gradeLevel };
  const topics = topicsFor(cc).slice(0, 200).map((t) => ({ code: t.code, title: t.title }));
  const level = [
    course.gradeLevel ? `Grade ${course.gradeLevel}` : null,
    course.curriculum ? CURRICULUM_LABEL[course.curriculum as keyof typeof CURRICULUM_LABEL] : null,
    subjectTitle(course.subject),
  ].filter(Boolean).join(", ");
  return { courseName: course.name, level: level || null, topics };
}

/** Records the run and spends credits for what it cost. */
export async function record<T>(viewer: Viewer, course: CourseRow, feature: AssistFeature, tier: AssistTier, runId: string, r: CallResult<T>, now: Date) {
  const micro = costMicroUsd(r.model, r.usage);
  const credits = micro > 0 ? creditsForCost(micro, ZAR_PER_USD) : 0;
  await prisma.aiAssistRun.create({
    data: {
      id: runId, workspaceId: course.workspaceId, courseId: course.id, userId: viewer.user.id, feature, tier,
      status: r.ok ? "OK" : r.refused ? "REFUSED" : "FAILED", model: r.model.slice(0, 64),
      inputTokens: r.usage.input + r.usage.cacheRead + r.usage.cacheWrite, outputTokens: r.usage.output, costMicroUsd: micro, credits,
    },
  });
  // The cost is real either way, so a failed run spends too (force: never refused after the fact).
  if (isBillingEnabled() && credits > 0) {
    await spendCredits({ workspaceId: course.workspaceId, userId: viewer.user.id, credits, feature: `ai-assist:${feature.toLowerCase()}`, ref: runId, force: true }, now);
  }
}

export function newRunId(): string {
  return `aar_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function failed(r: { refused: boolean }): never {
  throw new UserError(r.refused ? "The AI couldn't help with this material. Try different wording or a smaller part." : "The AI didn't finish. Try again with less material or fewer questions.");
}

/* ------------------------------------------------------------------------- */

export type QuestionDrafts = { runId: string; questions: DraftQuestion[]; note: string; allowance: Allowance };

export async function generateQuestions(
  viewer: Viewer,
  input: { courseId: string; lessonId?: string; topic?: string; count: number; types: DraftQuestionType[]; difficulty: "easy" | "medium" | "hard" },
  now: Date = new Date(),
): Promise<QuestionDrafts> {
  if (!input.lessonId && !input.topic?.trim()) throw new UserError("Choose a lesson or describe a topic.");
  const count = Math.min(Math.max(Math.trunc(input.count), 1), AI_ASSIST_INPUT.maxQuestions);
  if (!input.types.length) throw new UserError("Choose at least one question type.");
  const { course, allowance: a } = await gate(viewer, input.courseId, "QUESTIONS", now);
  let lessonTitle: string | null = null;
  let material = "";
  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId }, select: { courseId: true, title: true, description: true } });
    if (!lesson || lesson.courseId !== course.id) throw new UserError("That lesson isn't in this course.");
    lessonTitle = lesson.title;
    material = plainText(lesson.description).slice(0, AI_ASSIST_INPUT.lessonChars);
  }
  const existing = await prisma.testQuestion.findMany({
    where: { test: { courseId: course.id }, ...(input.lessonId ? {} : {}) },
    orderBy: { createdAt: "desc" }, take: 30, select: { question: true },
  });
  const runId = newRunId();
  const r = await draftQuestions(runId, {
    context: contextFor(course), lessonTitle, material, topic: input.topic?.trim().slice(0, 300) || null,
    count, types: input.types, difficulty: input.difficulty, avoid: existing.map((q) => plainText(q.question).slice(0, 150)).filter(Boolean),
  });
  await record(viewer, course, "QUESTIONS", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const codes = new Set(contextFor(course).topics.map((t) => t.code));
  const questions = r.data.questions.slice(0, count).map((q) => ({
    ...q,
    points: Math.min(Math.max(Math.round(q.points), 1), 20),
    topicCodes: q.topicCodes.filter((c) => codes.has(c)),
    correctOptions: q.correctOptions.filter((i) => i >= 0 && i < q.options.length),
  }));
  return { runId, questions, note: r.data.note, allowance: { ...a, used: a.used + 1, left: Math.max(0, a.left - 1) } };
}

/** A file the tutor uploaded to Vercel Blob (B's uploader): a PDF, or plain text. */
export async function readUpload(url: string): Promise<{ pdfBase64: string | null; text: string | null }> {
  let u: URL;
  try { u = new URL(url); } catch { throw new UserError("That file link isn't valid."); }
  if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com")) throw new UserError("Upload the file to Nexa first.");
  const res = await fetch(u, { redirect: "error" });
  if (!res.ok) throw new UserError("Nexa couldn't open that file. Upload it again.");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (type === "application/pdf" || buf.subarray(0, 5).toString() === "%PDF-") {
    if (buf.length > AI_ASSIST_INPUT.pdfBytes) throw new UserError("That PDF is too big. Use one under 15 MB, or paste the part you need.");
    return { pdfBase64: buf.toString("base64"), text: null };
  }
  if (type.startsWith("text/")) return { pdfBase64: null, text: buf.toString("utf-8").slice(0, AI_ASSIST_INPUT.documentChars) };
  throw new UserError("Use a PDF or a text file, or paste the text.");
}

export type OutlineDraft = { runId: string; outline: DraftOutline; allowance: Allowance };

/** A course outline from pasted text or an uploaded PDF. Plus: outline only (lessons and tests from documents are Pro, phase 3). */
export async function outlineFromDocument(viewer: Viewer, input: { courseId: string; text?: string; fileUrl?: string }, now: Date = new Date()): Promise<OutlineDraft> {
  if (!input.text?.trim() && !input.fileUrl) throw new UserError("Paste the document's text or upload a PDF.");
  if (input.text && input.text.length > AI_ASSIST_INPUT.documentChars) throw new UserError("That's too much text for one outline. Use a shorter part.");
  const { course, allowance: a } = await gate(viewer, input.courseId, "OUTLINE", now);
  const file = input.fileUrl ? await readUpload(input.fileUrl) : { pdfBase64: null, text: null };
  const runId = newRunId();
  const r = await draftOutline(runId, { context: contextFor(course), text: [input.text?.trim(), file.text].filter(Boolean).join("\n\n") || null, pdfBase64: file.pdfBase64 });
  await record(viewer, course, "OUTLINE", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const codes = new Set(contextFor(course).topics.map((t) => t.code));
  const outline = { ...r.data, sections: r.data.sections.map((s) => ({ ...s, lessons: s.lessons.map((l) => ({ ...l, topicCodes: l.topicCodes.filter((c) => codes.has(c)) })) })) };
  return { runId, outline, allowance: { ...a, used: a.used + 1, left: Math.max(0, a.left - 1) } };
}

export type TidyDraft = { runId: string; text: string; changes: string[]; allowance: Allowance };

export async function tidyLessonText(viewer: Viewer, input: { courseId: string; text: string; mode: "tidy" | "simplify"; readingLevel?: string }, now: Date = new Date()): Promise<TidyDraft> {
  const text = input.text.trim();
  if (text.length < 20) throw new UserError("Select a bit more text to tidy.");
  if (text.length > AI_ASSIST_INPUT.tidyChars) throw new UserError("That's too much at once. Tidy a section at a time.");
  const { course, allowance: a } = await gate(viewer, input.courseId, "TIDY", now);
  const runId = newRunId();
  const r = await tidyText(runId, { context: contextFor(course), text, mode: input.mode, readingLevel: input.readingLevel?.trim().slice(0, 60) || null });
  await record(viewer, course, "TIDY", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  return { runId, text: r.data.text, changes: r.data.changes.slice(0, 5), allowance: { ...a, used: a.used + 1, left: Math.max(0, a.left - 1) } };
}

/** What the tutor has left this month on this course's plan, for the buttons. */
export async function assistStatus(viewer: Viewer, input: { courseId: string }, now: Date = new Date()) {
  if (!(await canIn(viewer, "courses.edit", { courseId: input.courseId }))) throw new ViewerError("FORBIDDEN");
  const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { workspaceId: true } });
  if (!course?.workspaceId) throw new UserError("That course no longer exists.");
  const available = aiAssistConfigured() && (await hasService(viewer, input.courseId, "ai-assist"));
  const tier = await courseTier(input.courseId);
  const out = {} as Record<AssistFeature, Allowance>;
  for (const f of ASSIST_FEATURES) out[f] = allowance(available ? tier : "CORE", f, await usedThisMonth(course.workspaceId, f, now));
  return { available, tier: available ? tier : ("CORE" as const), model: ASSIST_MODEL, features: out, resetsOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}
