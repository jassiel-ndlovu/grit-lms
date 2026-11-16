/**
 * /api/cron/notifications — hourly notification jobs (reminders and email
 * digests). Schedule: src/lib/jobs/registry.ts.
 */

import { defineJob } from "@/lib/jobs/define";
import { runNotificationJobs } from "@/features/notifications/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const job = defineJob("notifications", async () => ({ results: await runNotificationJobs() }));
export const GET = job.GET;
export const POST = job.POST;
