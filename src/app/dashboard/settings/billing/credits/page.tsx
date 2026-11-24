/**
 * /dashboard/settings/billing/credits — the organisation's AI credits
 * (billing.md "AI credit top-ups"): what's left, and packs to buy
 * (`billing.manage`). Behind BILLING=1 and `billing.view`.
 */

import { redirect } from "next/navigation";

import { creditReportFor } from "@/features/ai-credits/credits";
import { topupOffer } from "@/features/ai-credits/topups";
import { requireBillingPage } from "@/features/courses/billing-page";
import { BillingFrame } from "@/features/courses/components/billing-overview";
import { WorkspaceCredits } from "@/features/courses/components/study/workspace-credits";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "AI credits · Billing" };

export default async function BillingCreditsPage() {
  const { ctx, canManage } = await requireBillingPage();
  const viewer = await getViewer();
  if (!viewer?.workspace) redirect("/auth");
  const report = await creditReportFor(viewer.workspace.id);
  return (
    <BillingFrame page={[{ label: "AI credits" }]} title="AI credits">
      <WorkspaceCredits
        report={{
          included: report.included ? { left: report.included.left, credits: report.included.credits, renewsAt: report.included.renewsAt } : null,
          bought: report.bought,
          comped: report.comped,
          usedThisMonth: report.thisMonth.byFeature.reduce((n, f) => n + f.credits, 0),
        }}
        offer={canManage ? topupOffer("WORKSPACE") : null}
        ctx={ctx}
      />
    </BillingFrame>
  );
}
