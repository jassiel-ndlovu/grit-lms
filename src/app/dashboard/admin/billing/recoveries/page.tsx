/**
 * /dashboard/admin/billing/recoveries — Nexa admin: fee refunds and what
 * each payee still owes (adminListPayoutRecoveries), with hold, repaid
 * off-site and waive, and the form to refund a fee invoice
 * (adminRefundFeeInvoice). `?status=` filters.
 */

import Link from "next/link";

import { adminListPayoutRecoveries } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame, adminBillingRoutes } from "@/features/courses/components/admin-billing";
import { RecoveryTable } from "@/features/courses/components/admin-recoveries";
import { FeeRefundButton } from "@/features/courses/components/admin-recovery-dialogs";
import { RECOVERY_CHIP, RECOVERY_STATUSES, parseRecoveryStatus } from "@/features/courses/lib/recovery-ui";

export const metadata = { title: "Recoveries · Billing admin" };

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminRecoveriesPage({ searchParams }: PageProps) {
  const { ctx, canOverride } = await requireAdminBillingPage();
  const status = parseRecoveryStatus((await searchParams).status);
  const items = await adminListPayoutRecoveries(status ? { status } : {});
  const href = (s: string | null) => (s ? `${adminBillingRoutes.recoveries}?status=${s}` : adminBillingRoutes.recoveries);
  const tab = (active: boolean) =>
    active ? "bg-muted text-foreground rounded-md px-3 py-1.5 font-medium" : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5";

  return (
    <AdminBillingFrame page={[{ label: "Recoveries" }]} title="Refund recoveries">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Show recoveries" className="flex flex-wrap gap-1 text-sm">
          <Link href={href(null)} aria-current={status ? undefined : "page"} className={tab(!status)}>
            All
          </Link>
          {RECOVERY_STATUSES.map((s) => (
            <Link key={s} href={href(s)} aria-current={s === status ? "page" : undefined} className={tab(s === status)}>
              {RECOVERY_CHIP[s].label}
            </Link>
          ))}
        </nav>
        {canOverride ? <FeeRefundButton /> : null}
      </div>
      <p className="text-muted-foreground text-sm">
        A payee gets a notice of deduction when Paystack processes the refund. From 7 days later, at most half of each
        payout goes to what they owe; after 60 days with nothing recovered they&apos;re emailed a card invoice.
      </p>
      <RecoveryTable items={items} ctx={ctx} canOverride={canOverride} now={new Date().toISOString()} filtered={status != null} />
    </AdminBillingFrame>
  );
}
