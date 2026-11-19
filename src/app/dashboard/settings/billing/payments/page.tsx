/**
 * /dashboard/settings/billing/payments — every invoice Nexa issued the
 * workspace, newest first (a/ux/03-billing.md §6). `?cursor=` pages through
 * A's listPlatformInvoices.
 */

import Link from "next/link";

import { getBillingOverview, listPlatformInvoices } from "@/features/billing/queries";
import { requireBillingPage } from "@/features/courses/billing-page";
import { BillingFrame, billingRoutes } from "@/features/courses/components/billing-overview";
import { PaymentsList } from "@/features/courses/components/billing-payments";
import { billingErrorMessage } from "@/features/courses/lib/billing-ui";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Payments · Billing" };

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function BillingPaymentsPage({ searchParams }: PageProps) {
  const { ctx, canManage } = await requireBillingPage();
  const sp = await searchParams;
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;

  try {
    const [list, overview] = await Promise.all([
      listPlatformInvoices({ cursor, limit: PAGE_SIZE }),
      getBillingOverview(),
    ]);
    const empty =
      overview.state === "TRIAL" && overview.trialEndsAt
        ? `Your first payment is due when your trial ends on ${formatDate(new Date(overview.trialEndsAt), ctx)}.`
        : overview.state === "COMPED"
          ? "Your workspace is complimentary, so there is nothing to pay."
          : "Payments show here once Nexa bills your workspace.";
    return (
      <BillingFrame page={[{ label: "Payments" }]} title="Payments">
        <PaymentsList
          list={list}
          ctx={ctx}
          canManage={canManage}
          olderHref={list.nextCursor ? `${billingRoutes.payments}?cursor=${encodeURIComponent(list.nextCursor)}` : null}
          newestHref={cursor ? billingRoutes.payments : null}
          empty={empty}
        />
      </BillingFrame>
    );
  } catch (e) {
    const code = (e as { code?: string }).code;
    return (
      <BillingFrame page={[{ label: "Payments" }]} title="Payments">
        <p role="alert" className="text-muted-foreground text-sm">
          We couldn&apos;t load your payments. {code ? billingErrorMessage(`${code}: `) : null}{" "}
          <Link href={billingRoutes.payments} className="text-foreground underline underline-offset-2">
            Try again
          </Link>
        </p>
      </BillingFrame>
    );
  }
}
