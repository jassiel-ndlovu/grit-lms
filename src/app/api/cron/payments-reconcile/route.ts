/**
 * /api/cron/payments-reconcile: daily. Stale payments, failed webhook
 * events, unsent refunds, the Paystack lifetime limit
 * (src/features/payments/reconcile.ts).
 */

import { runReconcile } from "@/features/payments/reconcile";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const job = defineJob("payments-reconcile", () => runReconcile());
export const GET = job.GET;
export const POST = job.POST;
