/**
 * Nexa admin: refunds being recovered from payees (adminListPayoutRecoveries,
 * contracts/billing.md section 4). Display plus the per-row actions.
 */

import Link from "next/link";

import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { adminListPayoutRecoveries } from "@/features/admin/billing-queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { formatRand } from "../lib/billing-ui";
import { RECOVERY_CHIP, deductionsStarted } from "../lib/recovery-ui";
import { adminBillingRoutes } from "./admin-billing";
import { RecoveryActions } from "./admin-recovery-dialogs";

export type AdminRecoveries = Awaited<ReturnType<typeof adminListPayoutRecoveries>>;

export function RecoveryTable({
  items,
  ctx,
  canOverride,
  now,
  filtered,
}: {
  items: AdminRecoveries;
  ctx: DateContext;
  canOverride: boolean;
  /** ISO instant the page was rendered at. */
  now: string;
  /** A status filter is on, so "none" means none of that kind. */
  filtered: boolean;
}) {
  const day = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });
  if (items.length === 0) {
    return filtered ? (
      <p className="text-muted-foreground text-sm">No recoveries with that status.</p>
    ) : (
      <EmptyState compact title="No refund recoveries" description="When a fee invoice is refunded, the payee's share shows here until it's repaid." />
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">Payee</th>
              <th className="py-2 pr-3 font-medium">Refund</th>
              <th className="py-2 pr-3 text-right font-medium">Still owed</th>
              <th className="py-2 pr-3 font-medium">Deductions</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y align-top">
            {items.map((r) => {
              const chip = RECOVERY_CHIP[r.status];
              return (
                <tr key={r.id}>
                  <td className="py-2 pr-3">
                    {r.workspaceId ? (
                      <Link href={adminBillingRoutes.workspace(r.workspaceId)} className="text-foreground underline-offset-2 hover:underline">
                        {r.payeeName || "Unnamed payee"}
                      </Link>
                    ) : (
                      r.payeeName || "Unnamed payee"
                    )}
                  </td>
                  <td className="max-w-xs py-2 pr-3">
                    <span className="tabular-nums">{formatRand(r.refundCents)}</span>
                    {r.invoiceNumber ? <span className="text-muted-foreground"> · {r.invoiceNumber}</span> : null}
                    <span className="text-muted-foreground block text-xs">&ldquo;{r.reason}&rdquo;</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.status === "ACTIVE" ? formatRand(r.outstandingCents) : <span className="text-muted-foreground">—</span>}
                    <span className="text-muted-foreground block text-xs">
                      of {formatRand(r.owedCents)}
                      {r.repaidCents > 0 ? `, ${formatRand(r.repaidCents)} repaid` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {r.status === "AWAITING_REFUND" ? (
                      <span className="text-muted-foreground">7 days after Paystack refunds</span>
                    ) : r.status !== "ACTIVE" ? (
                      <span className="text-muted-foreground">{r.closedAt ? `Closed ${day(r.closedAt)}` : "—"}</span>
                    ) : r.deductFrom ? (
                      deductionsStarted(r.deductFrom, now) ? `Since ${day(r.deductFrom)}` : `From ${day(r.deductFrom)}`
                    ) : (
                      <span className="text-muted-foreground">Notice not sent yet</span>
                    )}
                    {r.payPath ? <span className="text-muted-foreground block text-xs">Card invoice sent</span> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </td>
                  <td className="py-2 text-right">{canOverride ? <RecoveryActions recovery={r} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length >= 100 ? <p className="text-muted-foreground text-xs">Showing the 100 newest.</p> : null}
    </div>
  );
}
