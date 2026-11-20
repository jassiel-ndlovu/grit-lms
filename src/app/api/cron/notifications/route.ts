/**
 * /api/cron/notifications — hourly notification jobs (reminders and email
 * digests), then any AI-marking suggestions still queued (most run straight
 * after the tutor asks). Schedule: src/lib/jobs/registry.ts.
 */

import { defineJob } from "@/lib/jobs/define";
import { runAiMarking } from "@/features/ai-marking/jobs";
import { aiMarkingConfigured } from "@/features/ai-marking/marker";
import { runNotificationJobs } from "@/features/notifications/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const job = defineJob("notifications", async () => ({
  results: await runNotificationJobs(),
  aiMarking: aiMarkingConfigured() ? await runAiMarking({ limit: 25 }) : "not configured",
}));
export const GET = job.GET;
export const POST = job.POST;
