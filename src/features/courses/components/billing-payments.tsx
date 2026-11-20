/**
 * Payments history and one payment (a/ux/03-billing.md §6). Pure display of
 * what listPlatformInvoices and getPlatformInvoice return; the pages load
 * them. Every amount is A's and nothing is added up here: one payment
 * shows the invoice's lines in A's order, then its total.
 */

import Link from "next/link";

import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { getPlatformInvoice, listPlatformInvoices } from "@/features/billing/queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { formatRand, invoiceChip, paymentLabel } from "../lib/billing-ui";
import { billingRoutes } from "./billing-overview";
import { PayButton } from "./billing-pay";

export type InvoiceList = Awaited<ReturnType<typeof listPlatformInvoices>>;
export type InvoiceDetail = Awaited<ReturnType<typeof getPlatformInvoice>>;

function dates(ctx: DateContext) {
  const short = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short" });
  const long = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });
  return { short, long, period: (start: string, end: string) => `${short(start)} – ${long(end)}` };
}

export function PaymentsList({
  list,
  ctx,
  canManage,
  olderHref,
  newestHref,
  empty,
}: {
  list: InvoiceList;
  ctx: DateContext;
  canManage: boolean;
  /** The next page, when there is one. */
  olderHref: string | null;
  /** Back to the first page, when this isn't it. */
  newestHref: string | null;
  /** What to say when there are none, e.g. when the first payment is due. */
  empty: string;
}) {
  const d = dates(ctx);
  if (list.items.length === 0 && !newestHref) {
    return <EmptyState compact title="No payments yet" description={empty} />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">Period</th>
              <th className="py-2 pr-3 font-medium">Number</th>
              <th className="py-2 pr-3 text-right font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {list.items.map((inv) => {
              const chip = invoiceChip(inv.status, inv.paidAt ? d.short(inv.paidAt) : null);
              return (
                <tr key={inv.id}>
                  <td className="py-2 pr-3">{d.period(inv.periodStart, inv.periodEnd)}</td>
                  <td className="py-2 pr-3">
                    <Link href={billingRoutes.payment(inv.id)} className="text-foreground underline-offset-2 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRand(inv.totalCents)}</td>
                  <td className="py-2 pr-3">
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={billingRoutes.payment(inv.id)}
                      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                    >
                      {inv.status === "OPEN" && canManage ? "View and pay" : "View"}
                      <span className="sr-only"> {inv.number}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {olderHref || newestHref ? (
        <nav aria-label="Pages" className="flex gap-4 text-sm">
          {newestHref ? (
            <Link href={newestHref} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Newest
            </Link>
          ) : null}
          {olderHref ? (
            <Link href={olderHref} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Older
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export function PaymentDetail({ invoice: inv, ctx, canManage }: { invoice: InvoiceDetail; ctx: DateContext; canManage: boolean }) {
  const d = dates(ctx);
  const chip = invoiceChip(inv.status, inv.paidAt ? d.short(inv.paidAt) : null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {d.period(inv.periodStart, inv.periodEnd)} · issued {d.long(inv.issuedAt)}
        </p>
        <span className="flex items-center gap-3">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          {inv.pdfUrl ? (
            <a href={inv.pdfUrl} className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2">
              Download PDF
            </a>
          ) : null}
        </span>
      </div>

      {inv.status === "OPEN" && canManage ? <PayButton invoiceId={inv.id} label={`Pay ${formatRand(inv.totalCents)}`} /> : null}

      <InvoiceLines lines={inv.lines} totalCents={inv.totalCents} />

      <section aria-labelledby="payments-heading" className="space-y-2">
        <h2 id="payments-heading" className="text-foreground text-sm font-semibold">
          Payments
        </h2>
        {inv.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payment yet.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {inv.payments.map((p, i) => {
              const label = paymentLabel(p);
              return (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground tabular-nums">{d.long(p.at)}</span>
                    <StatusChip tone={label.tone}>{label.label}</StatusChip>
                  </span>
                  <span className="tabular-nums">{formatRand(p.amountCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p>
        <Link href={billingRoutes.payments} className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2">
          All payments
        </Link>
      </p>
    </div>
  );
}

/**
 * An invoice's lines in A's order, then its total. A writes discounts,
 * credit and VAT as lines of their own ("Discount LAUNCH10", "VAT 15%"),
 * after the charges, so nothing is added up here.
 */
export function InvoiceLines({ lines, totalCents }: { lines: InvoiceDetail["lines"]; totalCents: number }) {
  return (
    <section aria-labelledby="lines-heading" className="space-y-2">
      <h2 id="lines-heading" className="text-foreground text-sm font-semibold">
        What it covers
      </h2>
      <ul className="divide-border divide-y text-sm">
        {lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 py-2">
            <span className="text-muted-foreground">
              {l.description}
              {l.quantity > 1 && l.unitPriceCents ? (
                <span className="tabular-nums">
                  {" "}
                  · {l.quantity} × {formatRand(l.unitPriceCents)}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">{formatRand(l.amountCents)}</span>
          </li>
        ))}
        <li className="text-foreground flex items-baseline justify-between gap-4 py-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatRand(totalCents)}</span>
        </li>
      </ul>
    </section>
  );
}
