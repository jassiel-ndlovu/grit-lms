/**
 * /dashboard/settings/billing/payments/[id] — one invoice: what it covers,
 * its total and the payments made on it (a/ux/03-billing.md §6). An open
 * invoice has a Pay button for `billing.manage`. A download link shows once
 * A's invoice PDFs exist (`pdfUrl`).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { getPlatformInvoice } from "@/features/billing/queries";
import { requireBillingPage } from "@/features/courses/billing-page";
import { BillingFrame, billingRoutes } from "@/features/courses/components/billing-overview";
import { PaymentDetail } from "@/features/courses/components/billing-payments";
import { billingErrorMessage } from "@/features/courses/lib/billing-ui";

export const metadata = { title: "Payment · Billing" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BillingPaymentPage({ params }: PageProps) {
  const { ctx, canManage } = await requireBillingPage();
  const { id } = await params;

  let invoice;
  try {
    invoice = await getPlatformInvoice({ id });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") notFound();
    return (
      <BillingFrame page={[{ label: "Payments", href: billingRoutes.payments }, { label: "Payment" }]} title="Payment">
        <p role="alert" className="text-muted-foreground text-sm">
          We couldn&apos;t load this payment. {code ? billingErrorMessage(`${code}: `) : null}{" "}
          <Link href={billingRoutes.payment(id)} className="text-foreground underline underline-offset-2">
            Try again
          </Link>
        </p>
      </BillingFrame>
    );
  }

  return (
    <BillingFrame page={[{ label: "Payments", href: billingRoutes.payments }, { label: invoice.number }]} title={invoice.number}>
      <PaymentDetail invoice={invoice} ctx={ctx} canManage={canManage} />
    </BillingFrame>
  );
}
