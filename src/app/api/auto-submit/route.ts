/**
 * GET /api/auto-submit — every five minutes (see vercel.json), closes
 * IN_PROGRESS test submissions whose due date or time limit has passed
 * (whichever comes first, plus a short grace period).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set on the project; we require it in production so the endpoint can't be
 * triggered by anyone else.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  AUTO_SUBMIT_GRACE_MS,
  attemptDeadline,
} from "@/features/assessments/lib/attempt-deadline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const now = new Date();
  const cutoff = now.getTime() - AUTO_SUBMIT_GRACE_MS;

  // Candidates: open attempts on tests that are past due, or that have a
  // time limit at all. The exact end is computed below with the same rule
  // the runner's clock uses (lib/attempt-deadline.ts). The old query only
  // looked at timed attempts started over an hour ago, so a 30-minute test
  // could run on for another half hour.
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
  // runner submits at zero WITH the student's latest answers; the cron just
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

  return new Response(
    JSON.stringify({ checked: candidates.length, submitted: overdue.length, time: now }),
    { status: 200 }
  );
}
