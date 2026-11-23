/**
 * /api/cron/housekeeping — daily. Prunes JobRun rows older than 30 days
 * (design 06 §5), and anonymises accounts whose 14-day deletion grace has
 * ended (design 02 §8; only with ACCOUNT_DELETIONS=1). On Mondays it
 * queues the weekly parent summaries (#216).
 */

import { queueWeeklyParentSummaries } from "@/features/notifications/weekly-summary";
import { anonymiseDueAccounts } from "@/features/users/deletion";
import { prisma } from "@/lib/db";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;

const job = defineJob("housekeeping", async () => {
  const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobRun.deleteMany({ where: { startedAt: { lt: before } } });
  return { prunedJobRuns: count, accountDeletions: await anonymiseDueAccounts(), parentSummaries: await queueWeeklyParentSummaries() };
});
export const GET = job.GET;
export const POST = job.POST;
