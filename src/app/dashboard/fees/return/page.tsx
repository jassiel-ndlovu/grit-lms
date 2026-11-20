/**
 * /dashboard/fees/return — Paystack sends a parent or adult student here
 * after paying fees, with `?reference=` (or `?trxref=`). The status is
 * checked on the page; arriving here doesn't mean it's paid.
 */

import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
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
    <>
      <PageHeader breadcrumb={[{ label: "Fees", href: "/dashboard/fees" }, { label: "Payment" }]} />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">Payment</h1>
        <CheckoutReturn reference={reference} />
      </div>
    </>
  );
}
