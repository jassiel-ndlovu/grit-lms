/**
 * /api/cron/housekeeping — daily. Prunes JobRun rows older than 30 days
 * (design 06 §5). Retention deletes (design 06 §6.1) join this or their own
 * job once billing records the last payment (Phase 2).
 */

import { prisma } from "@/lib/db";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;

const job = defineJob("housekeeping", async () => {
  const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobRun.deleteMany({ where: { startedAt: { lt: before } } });
  return { prunedJobRuns: count };
});
export const GET = job.GET;
export const POST = job.POST;
