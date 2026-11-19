/**
 * /api/cron/billing: hourly. Trials ending, renewals, dunning
 * (src/features/billing/daily.ts). Does nothing while BILLING is off.
 */

import { runBillingJob } from "@/features/billing/daily";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const job = defineJob("billing", () => runBillingJob());
export const GET = job.GET;
export const POST = job.POST;
