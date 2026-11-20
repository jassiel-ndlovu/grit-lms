/**
 * Refund recovery on the fees page (contracts/billing.md section 3): the
 * message after the pay link, and each refund still being taken from the
 * viewer's payouts, with a Pay link once A offers one. Display only.
 */

import { StatusChip } from "@/components/shell/status-chip";
import type { listPayoutRecoveries } from "@/features/payments/fee-queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { formatRand } from "../lib/billing-ui";
import { RECOVERY_CHIP, deductionsStarted, recoveryReturn } from "../lib/recovery-ui";

export type PayoutRecovery = Awaited<ReturnType<typeof listPayoutRecoveries>>[number];

const BOX = {
  success: "border-success/40 bg-success/5",
  info: "border-border bg-muted/40",
  danger: "border-destructive/40 bg-destructive/5",
} as const;

export function RecoveryNotice({ state }: { state: string | undefined }) {
  const m = recoveryReturn(state);
  if (!m) return null;
  return (
    <p role={m.tone === "danger" ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${BOX[m.tone]}`}>
      {m.text}
    </p>
  );
}

export function PayoutRecoveries({ items, ctx, now }: { items: PayoutRecovery[]; ctx: DateContext; now: string }) {
  const active = items.filter((r) => r.status === "ACTIVE");
  if (active.length === 0) return null;
  const day = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });
  return (
    <section aria-labelledby="recoveries-heading" className="border-warning/40 space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 id="recoveries-heading" className="text-foreground text-sm font-semibold">
          Refunds being taken from your payouts
        </h2>
        <p className="text-muted-foreground text-sm">
          Nexa refunded these fees after looking into them and paid the parent. Your share is taken from your next
          payouts, at most half of each, until it&apos;s repaid.
        </p>
      </div>
      <ul className="divide-border divide-y text-sm">
        {active.map((r) => {
          const chip = RECOVERY_CHIP[r.status];
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground font-medium">{r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : "Fee refund"}</span>
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                </p>
                <p className="text-muted-foreground">
                  {formatRand(r.refundCents)} refunded. Reason: &ldquo;{r.reason}&rdquo;
                </p>
                <p>
                  <span className="font-medium tabular-nums">{formatRand(r.outstandingCents)}</span> still to repay of{" "}
                  <span className="tabular-nums">{formatRand(r.owedCents)}</span>.{" "}
                  {r.deductFrom
                    ? deductionsStarted(r.deductFrom, now)
                      ? `Taken from your payouts since ${day(r.deductFrom)}.`
                      : `Taken from your payouts from ${day(r.deductFrom)}.`
                    : null}
                </p>
              </div>
              {r.payPath && r.outstandingCents > 0 ? (
                // A plain link: the route starts a Paystack payment and redirects.
                <a
                  href={r.payPath}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium"
                >
                  Pay {formatRand(r.outstandingCents)} by card
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
