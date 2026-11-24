import "server-only";

import { prisma } from "@/lib/db";

import { reusableComments } from "./lib/marking-flow";

/**
 * Comments already written on this test's questions, for one-click reuse in
 * the grading form. The caller has checked that the viewer may mark the
 * test. Never from another test, and none that names a student.
 */
export async function commentsUsedOnTest(testId: string, names: readonly string[]): Promise<Record<string, string[]>> {
  const rows = await prisma.questionGrade.findMany({
    where: { testSubmission: { testId }, questionId: { not: null }, feedback: { not: null } },
    select: { questionId: true, feedback: true },
    orderBy: { updatedAt: "desc" },
    take: 2000,
  });
  return reusableComments(rows, names);
}
