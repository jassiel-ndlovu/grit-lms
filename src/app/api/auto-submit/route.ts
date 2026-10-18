/**
 * GET /api/auto-submit — every five minutes (see vercel.json), closes
 * IN_PROGRESS test submissions whose due date or time limit has passed.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set on the project; we require it in production so the endpoint can't be
 * triggered by anyone else.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

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

  // Find submissions that are still IN_PROGRESS but past their due time
  const overdueSubs = await prisma.testSubmission.findMany({
    where: {
      status: "IN_PROGRESS",
      OR: [
        {
          test: {
            dueDate: { lt: now }, // past due date
          },
        },
        {
          // past time limit since started
          AND: [
            { startedAt: { not: undefined } },
            {
              test: {
                timeLimit: { not: null },
              },
            },
            {
              startedAt: {
                lt: new Date(now.getTime() - 1000 * 60 * 60), // fallback 1h ago
              },
            },
          ],
        },
      ],
    },
    include: { test: true },
  });

  for (const sub of overdueSubs) {
    let endTime = sub.test.dueDate;

    if (sub.test.timeLimit && sub.startedAt) {
      const limitEnd = new Date(
        sub.startedAt.getTime() + sub.test.timeLimit * 60_000
      );
      // whichever is earlier: timeLimit vs dueDate
      endTime = new Date(Math.min(endTime.getTime(), limitEnd.getTime()));
    }

    if (now >= endTime) {
      await prisma.testSubmission.update({
        where: { id: sub.id },
        data: {
          status: "SUBMITTED",
          submittedAt: now,
        },
      });
    }
  }

  return new Response(
    JSON.stringify({ checked: overdueSubs.length, time: now }),
    { status: 200 }
  );
}
