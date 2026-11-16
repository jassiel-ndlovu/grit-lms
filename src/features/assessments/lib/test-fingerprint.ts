/**
 * Stale-save guard for the test editor.
 *
 * `updateTest` replaces the whole question tree and deletes every question
 * missing from the payload. A tab opened before someone else's save would
 * otherwise wipe the questions it never saw. The edit page sends the
 * fingerprint of the test as it loaded it; `updateTest` recomputes it inside
 * its transaction and refuses the save when they differ.
 *
 * A fingerprint, not a version column, so the guard needs no schema change.
 * `Test.version` can replace it when B2's schema work lands.
 */

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

const TEST_FIELDS = {
  title: true,
  description: true,
  preTestInstructions: true,
  courseId: true,
  dueDate: true,
  timeLimit: true,
  totalPoints: true,
  isActive: true,
  releaseAutoMarksToStudent: true,
  weight: true,
  memoFileUrls: true,
  labelScheme: true,
} as const;

const QUESTION_FIELDS = {
  id: true,
  parentId: true,
  order: true,
  question: true,
  type: true,
  points: true,
  options: true,
  answer: true,
  language: true,
  matchPairs: true,
  reorderItems: true,
  blankCount: true,
} as const;

/** Hash any JSON-able value with object keys sorted, so key order never matters. */
export function hashCanonical(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      );
    }
    return v;
  });
  return createHash("sha256").update(canonical).digest("base64url");
}

/** Fingerprint of a test's editable fields and its whole question tree, or null if missing. */
export async function loadTestFingerprint(db: Db, testId: string): Promise<string | null> {
  const [test, questions] = await Promise.all([
    db.test.findUnique({ where: { id: testId }, select: TEST_FIELDS }),
    db.testQuestion.findMany({
      where: { testId },
      select: QUESTION_FIELDS,
      orderBy: { id: "asc" },
    }),
  ]);
  if (!test) return null;
  return hashCanonical({ test, questions });
}

export const STALE_TEST_MESSAGE =
  "This test changed since you opened it (another tab or another person saved it). " +
  "Nothing was saved. Your edits are kept in this browser: reload the page, then restore them only if you mean to replace the newer version.";
