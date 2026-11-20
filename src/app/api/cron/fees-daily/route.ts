/**
 * /api/cron/fees-daily: daily. Monthly fee invoices, overdue reminders
 * (src/features/payments/fees-daily.ts). Does nothing while BILLING is off.
 */

import { runFeesDaily } from "@/features/payments/fees-daily";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const job = defineJob("fees-daily", () => runFeesDaily());
export const GET = job.GET;
export const POST = job.POST;
