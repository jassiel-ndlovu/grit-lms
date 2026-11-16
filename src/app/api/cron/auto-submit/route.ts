/**
 * /api/cron/auto-submit — every five minutes (src/lib/jobs/registry.ts).
 * Closes IN_PROGRESS test submissions whose due date or time limit has
 * passed (whichever comes first, plus a short grace period).
 *
 * Idempotent: it only flips rows that are still IN_PROGRESS.
 *
 * The logic moves to src/features/assessments/jobs.ts (Agent B's folder)
 * once B agrees (design 07, Batch 5). It is unchanged from /api/auto-submit,
 * which is now an alias of this route.
 */

import { prisma } from "@/lib/db";
import { defineJob } from "@/lib/jobs/define";
import {
  AUTO_SUBMIT_GRACE_MS,
  attemptDeadline,
} from "@/features/assessments/lib/attempt-deadline";

export const dynamic = "force-dynamic";

async function runAutoSubmit() {
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

const job = defineJob("auto-submit", runAutoSubmit);
export const GET = job.GET;
export const POST = job.POST;
