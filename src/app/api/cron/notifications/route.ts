/**
 * GET /api/cron/notifications — hourly notification jobs (reminders and
 * email digests). Scheduled hourly in .github/workflows/scheduled-jobs.yml.
 *
 * The scheduler sends `Authorization: Bearer $CRON_SECRET` (the same value
 * is set on the Vercel project and in the GitHub repo secrets); we require
 * it in production so no one else can trigger the endpoint.
 */

import { NextRequest, NextResponse } from "next/server";

import { runNotificationJobs } from "@/features/notifications/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const results = await runNotificationJobs();
  return NextResponse.json({ ok: true, results });
}
