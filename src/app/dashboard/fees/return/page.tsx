/**
 * /dashboard/fees/return — Paystack sends a parent or adult student here
 * after paying fees, with `?reference=` (or `?trxref=`). The status is
 * checked on the page; arriving here doesn't mean it's paid.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { isBillingEnabled } from "@/features/billing/errors";
import { CheckoutReturn } from "@/features/courses/components/fee-checkout-return";
import { returnReference } from "@/features/courses/lib/fee-pay-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Payment · Fees" };

interface PageProps {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}

export default async function FeesReturnPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  if (!(await getViewer())) redirect("/auth");
  const reference = returnReference(await searchParams);
  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Fees", href: "/dashboard/fees" }, { label: "Payment" }]}>
      <PageTitle title="Payment" />
      <CheckoutReturn reference={reference} />
    </PageFrame>
  );
}
