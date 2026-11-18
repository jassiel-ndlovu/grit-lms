/**
 * /api/cron/auto-submit — every five minutes (src/lib/jobs/registry.ts).
 * The logic lives in src/features/assessments/jobs.ts (Agent B's);
 * /api/auto-submit is an alias of this route.
 */

import { defineJob } from "@/lib/jobs/define";
import { runAutoSubmit } from "@/features/assessments/jobs";

export const dynamic = "force-dynamic";

const job = defineJob("auto-submit", runAutoSubmit);
export const GET = job.GET;
export const POST = job.POST;
