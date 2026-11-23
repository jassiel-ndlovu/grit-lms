/**
 * Which marks a student (and so their parent) may see. Pure.
 *
 * A tutor can auto-mark a test before releasing it: the Grade row exists but
 * stays hidden until the submission is GRADED, unless the test releases
 * auto-marks at submit time. An assignment mark shows once the entry is
 * GRADED. A grade linked to neither is a manual entry, already released.
 *
 * `RELEASED_GRADE` is the same rule for a Prisma query. Change both together
 * (scripts/check-grade-release.ts compares them).
 */

import type { Prisma } from "@/generated/prisma";

export type GradeRelease = {
  testSubmission: { status: string; test: { releaseAutoMarksToStudent: boolean } } | null;
  submissionEntry: { status: string } | null;
};

/** A test's marks, whether or not a Grade row has been written yet. */
export function testMarksReleased(status: string, releaseAutoMarksToStudent: boolean): boolean {
  return status === "GRADED" || releaseAutoMarksToStudent;
}

/** An assignment entry's mark. */
export function entryMarkReleased(status: string): boolean {
  return status === "GRADED";
}

export function isReleased(g: GradeRelease): boolean {
  if (g.testSubmission) return testMarksReleased(g.testSubmission.status, g.testSubmission.test.releaseAutoMarksToStudent);
  if (g.submissionEntry) return entryMarkReleased(g.submissionEntry.status);
  return true;
}

export const RELEASED_GRADE = {
  OR: [
    { testSubmission: { is: { OR: [{ status: "GRADED" }, { test: { is: { releaseAutoMarksToStudent: true } } }] } } },
    { testSubmissionId: null, submissionEntry: { is: { status: "GRADED" } } },
    { testSubmissionId: null, submissionEntryId: null },
  ],
} satisfies Prisma.GradeWhereInput;
