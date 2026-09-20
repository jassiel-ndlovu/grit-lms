/**
 * Persisting an answer key.
 *
 * Split out of `saveTestAnswerKey` so the action stays a thin auth wrapper
 * and the part that actually touches the database can be exercised
 * directly — see scripts/check-answer-key-roundtrip.ts, which runs this
 * against a real test rather than a re-implementation of it.
 *
 * The mapping itself (which column holds which type's key) lives in
 * ./answer-key.ts and is pure; this file is the write side.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { answerToKeyPatch } from "./answer-key";

export interface ApplyAnswerKeyArgs {
  testId: string;
  /** questionId -> the answer the runner produced. */
  answers: Record<string, unknown>;
}

export interface ApplyAnswerKeyResult {
  updated: number;
}

/**
 * Thrown when one or more answers couldn't have come from their question.
 * Carries a per-question list so the caller can show all of them at once
 * instead of making the tutor fix them one save at a time.
 */
export class AnswerKeyRejected extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(" · "));
    this.name = "AnswerKeyRejected";
    this.problems = problems;
  }
}

/**
 * Write the tutor's preview answers onto the test's questions as its key.
 *
 * Questions absent from `answers` are left exactly as they were, so
 * opening the preview to check rendering and closing it again can never
 * clear a memo.
 *
 * Does NOT check ownership — the caller is responsible for that.
 */
export async function applyAnswerKey({
  testId,
  answers,
}: ApplyAnswerKeyArgs): Promise<ApplyAnswerKeyResult> {
  const questions = await prisma.testQuestion.findMany({
    where: { testId },
    select: {
      id: true,
      type: true,
      options: true,
      matchPairs: true,
      reorderItems: true,
      blankCount: true,
      order: true,
      parentId: true,
    },
    orderBy: { order: "asc" },
  });

  // Number questions the way the runner labels them, so a rejection points
  // at the card the tutor is looking at rather than a cuid.
  const position = new Map<string, number>();
  questions
    .filter((q) => q.parentId == null)
    .forEach((q, i) => position.set(q.id, i + 1));

  const updates: Array<{ id: string; data: Prisma.TestQuestionUpdateInput }> = [];
  const problems: string[] = [];

  for (const q of questions) {
    if (!(q.id in answers)) continue;

    const result = answerToKeyPatch(q, answers[q.id]);
    if (!result.ok) {
      const label = position.get(q.id);
      problems.push(
        `${label ? `Question ${label}` : "A sub-question"}: ${result.reason}`,
      );
      continue;
    }
    if (Object.keys(result.patch).length === 0) continue;

    const data: Prisma.TestQuestionUpdateInput = {};
    if ("answer" in result.patch) {
      data.answer =
        result.patch.answer === null
          ? Prisma.DbNull
          : (result.patch.answer as Prisma.InputJsonValue);
    }
    if ("matchPairs" in result.patch) {
      data.matchPairs = result.patch.matchPairs as Prisma.InputJsonValue;
    }
    if ("reorderItems" in result.patch) {
      data.reorderItems = { set: result.patch.reorderItems };
    }
    updates.push({ id: q.id, data });
  }

  if (problems.length > 0) throw new AnswerKeyRejected(problems);

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.testQuestion.update({ where: { id: u.id }, data: u.data }),
      ),
    );
  }

  return { updated: updates.length };
}
