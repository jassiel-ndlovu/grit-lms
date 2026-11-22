/**
 * Reads of A's AiMarkSuggestion rows (assessments.prisma, B's schema file)
 * for the tutor's test pages (#150). Server only; callers have already
 * checked the tutor may see the test.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

import { progressOf, type AiProgress } from "./lib/ai-marking-ui";

export type AiOverview = {
  progress: AiProgress;
  /** Per submission: suggestions waiting for the tutor, and any still being marked. */
  bySubmission: Record<string, { toReview: number; working: number }>;
};

export const getAiMarkingOverview = cache(async (testId: string): Promise<AiOverview> => {
  const rows = await prisma.aiMarkSuggestion.findMany({
    where: { testSubmission: { testId } },
    select: { testSubmissionId: true, status: true, tutorAction: true },
  });
  const bySubmission: AiOverview["bySubmission"] = {};
  for (const r of rows) {
    const b = (bySubmission[r.testSubmissionId] ??= { toReview: 0, working: 0 });
    if (r.status === "DONE" && !r.tutorAction) b.toReview++;
    if (r.status === "QUEUED" || r.status === "RUNNING") b.working++;
  }
  return { progress: progressOf(rows), bySubmission };
});
