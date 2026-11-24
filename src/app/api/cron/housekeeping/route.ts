/**
 * /api/cron/housekeeping — daily. Prunes JobRun rows older than 30 days
 * (design 06 §5), and anonymises accounts whose 14-day deletion grace has
 * ended (design 02 §8; only with ACCOUNT_DELETIONS=1). On Mondays it
 * queues the weekly parent summaries (#216). Deletes landing-page
 * enquiries older than 12 months, and runs the at-risk rules (#216).
 */

import { pruneOldEnquiries } from "@/features/marketing/enquiries";
import { pruneOldQueries } from "@/features/support/support";
import { runRiskAlerts } from "@/features/risk/evaluate";
import { endCoverAccess } from "@/features/staff/cover";
import { pruneStudyChats } from "@/features/study/study";
import { expireCredits } from "@/features/ai-credits/topups";
import { pruneOldEnquiries as pruneOldWorkspaceEnquiries, remindEnquiryFollowUps } from "@/features/crm/enquiries";
import { pruneWebhookDeliveries } from "@/features/api/webhooks";
import { queueWeeklyParentSummaries } from "@/features/notifications/weekly-summary";
import { anonymiseDueAccounts } from "@/features/users/deletion";
import { prisma } from "@/lib/db";
import { defineJob } from "@/lib/jobs/define";

export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;

const job = defineJob("housekeeping", async () => {
  const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobRun.deleteMany({ where: { startedAt: { lt: before } } });
  return { prunedJobRuns: count, accountDeletions: await anonymiseDueAccounts(), parentSummaries: await queueWeeklyParentSummaries(), prunedEnquiries: await pruneOldEnquiries(), riskAlerts: await runRiskAlerts(), prunedWebhookDeliveries: await pruneWebhookDeliveries(), coverAccessEnded: await endCoverAccess(), enquiryFollowUps: await remindEnquiryFollowUps(), prunedWorkspaceEnquiries: await pruneOldWorkspaceEnquiries(), prunedStudyChats: await pruneStudyChats(), creditsExpired: await expireCredits(), prunedSupportQueries: await pruneOldQueries() };
});
export const GET = job.GET;
export const POST = job.POST;
