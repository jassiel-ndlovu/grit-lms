/**
 * /dashboard/credits/return — Paystack sends a buyer of credits here with
 * `?reference=` (or `?trxref=`). The status is checked on the page; arriving
 * here doesn't mean it's paid.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { isBillingEnabled } from "@/features/billing/errors";
import { TopupReturn } from "@/features/courses/components/study/topup-return";
import { returnReference } from "@/features/courses/lib/fee-pay-ui";
import { studyRoutes } from "@/features/courses/lib/study-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Payment · Credits" };

interface PageProps {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}

export default async function CreditsReturnPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const staff = viewer.persona === "staff";
  const back = staff
    ? { label: "AI credits", href: studyRoutes.workspaceCredits }
    : { label: "Study credits", href: studyRoutes.credits };
  return (
    <PageFrame type="settings" breadcrumb={[back, { label: "Payment" }]}>
      <PageTitle title="Payment" />
      <TopupReturn reference={returnReference(await searchParams)} staff={staff} />
    </PageFrame>
  );
}
