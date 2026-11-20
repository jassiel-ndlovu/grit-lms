/**
 * Scheduled jobs for assessments. Run by /api/cron/auto-submit
 * (src/lib/jobs/registry.ts); moved here from the route with Agent B's
 * agreement (b/HANDOFF.md, 2026-11-17). B owns this logic; A owns the route.
 */

import "server-only";

import { prisma } from "@/lib/db";

import { AUTO_SUBMIT_GRACE_MS, attemptDeadline } from "./lib/attempt-deadline";

/**
 * Closes IN_PROGRESS test submissions whose due date or time limit has
 * passed (whichever comes first, plus a short grace period). Idempotent: it
 * only flips rows that are still IN_PROGRESS.
 */
export async function runAutoSubmit() {
  const now = new Date();
  const cutoff = now.getTime() - AUTO_SUBMIT_GRACE_MS;

  // Candidates: open attempts on tests that are past due, or that have a
  // time limit at all. The exact end is computed below with the same rule
  // the runner's clock uses (lib/attempt-deadline.ts).
  const candidates = await prisma.testSubmission.findMany({
    where: {
      status: "IN_PROGRESS",
      OR: [
        { test: { dueDate: { lt: now } } },
        { test: { timeLimit: { not: null } } },
      ],
    },
    select: {
      id: true,
      startedAt: true,
      extraTimePercent: true,
      noTimeLimit: true,
      test: { select: { dueDate: true, timeLimit: true } },
    },
  });

  // Close an attempt only once its end plus a grace period has passed. The
  // runner submits at zero WITH the student's latest answers; the job just
  // flips the status on whatever was last autosaved, so the client should
  // win whenever it is online.
  const overdue = candidates.filter((sub) => {
    const { at } = attemptDeadline({
      startedAt: sub.startedAt,
      timeLimit: sub.test.timeLimit,
      dueDate: sub.test.dueDate,
      extraTimePercent: sub.extraTimePercent,
      noTimeLimit: sub.noTimeLimit,
    });
    return at != null && at <= cutoff;
  });

  if (overdue.length > 0) {
    await prisma.testSubmission.updateMany({
      where: { id: { in: overdue.map((s) => s.id) }, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: now },
    });
  }

  return { checked: candidates.length, submitted: overdue.length, time: now.toISOString() };
}
