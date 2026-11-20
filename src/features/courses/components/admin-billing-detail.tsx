/**
 * Nexa admin billing, part 2 (contracts/billing.md section 4): one
 * workspace (its courses' tiers and invoices), one invoice (lines,
 * payments, refunds), the discount codes and the retention dry run. Pure
 * display of A's admin queries; the pages load them. Actions are in
 * admin-billing-dialogs.tsx and admin-workspace-actions.tsx.
 */

import Link from "next/link";

import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import type {
  adminGetPlatformInvoice,
  adminGetWorkspaceBilling,
  adminListDiscountCodes,
  adminRetentionPreview,
} from "@/features/admin/billing-queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { codeStatus, discountLabel, retentionSummary } from "../lib/admin-billing-ui";
import { STATE_CHIP, TIER_LABEL, formatRand, invoiceChip, paymentLabel, type InvoicePayment } from "../lib/billing-ui";
import { adminBillingRoutes } from "./admin-billing";
import { CourseTierOverride, DeactivateCodeButton, InvoiceActions, RefundButton } from "./admin-billing-dialogs";
import { WorkspaceActions } from "./admin-workspace-actions";
import { InvoiceLines } from "./billing-payments";

export type AdminWorkspace = Awaited<ReturnType<typeof adminGetWorkspaceBilling>>;
export type AdminInvoice = Awaited<ReturnType<typeof adminGetPlatformInvoice>>;
export type AdminCodeList = Awaited<ReturnType<typeof adminListDiscountCodes>>;
export type RetentionPreview = Awaited<ReturnType<typeof adminRetentionPreview>>;

function days(ctx: DateContext) {
  const short = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short" });
  const long = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });
  return { short, long, period: (a: string, b: string) => `${short(a)} – ${long(b)}` };
}

const muted = <span className="text-muted-foreground">—</span>;

/* ───── One workspace ───── */

export function WorkspaceDetail({ ws, ctx, canOverride }: { ws: AdminWorkspace; ctx: DateContext; canOverride: boolean }) {
  const d = days(ctx);
  const chip = STATE_CHIP[ws.state];
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PropertyList className="min-w-0 flex-1">
          <PropertyRow label="State">
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          </PropertyRow>
          <PropertyRow label="Kind">{ws.kind === "SOLO" ? "Solo tutor" : "Organisation"}</PropertyRow>
          {ws.state === "TRIAL" && ws.trialEndsAt ? <PropertyRow label="Trial ends">{d.long(ws.trialEndsAt)}</PropertyRow> : null}
          {ws.renewsAt ? <PropertyRow label="Renews">{d.long(ws.renewsAt)}</PropertyRow> : null}
          {ws.deleteAfter && ws.state !== "COMPED" ? (
            <PropertyRow label="Data deleted on">
              <span className="text-destructive">{d.long(ws.deleteAfter)}</span>
            </PropertyRow>
          ) : null}
          <PropertyRow label="Last period">{ws.lastPeriodCents != null ? formatRand(ws.lastPeriodCents) : muted}</PropertyRow>
          <PropertyRow label="Overdue">
            {ws.overdueCents > 0 ? <span className="text-destructive font-medium">{formatRand(ws.overdueCents)}</span> : muted}
          </PropertyRow>
        </PropertyList>
        {canOverride ? <WorkspaceActions workspace={ws} /> : null}
      </div>

      <section aria-labelledby="courses-heading" className="space-y-3">
        <h2 id="courses-heading" className="text-foreground text-sm font-semibold">
          Courses
        </h2>
        {ws.courses.length === 0 ? (
          <p className="text-muted-foreground text-sm">No courses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-muted-foreground border-border border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Course</th>
                  <th className="py-2 pr-3 font-medium">Billed at</th>
                  <th className="py-2 pr-3 text-right font-medium">Seats</th>
                  <th className="py-2 pr-3 text-right font-medium">Per seat</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {ws.courses.map((c) => (
                  <tr key={c.courseId}>
                    <td className="text-foreground py-2 pr-3">{c.title}</td>
                    <td className="py-2 pr-3">
                      {TIER_LABEL[c.billedTierKey]}
                      {c.override ? (
                        <span className="text-muted-foreground block text-xs">
                          Override{c.override.until ? ` until ${d.long(c.override.until)}` : ""}; services need {TIER_LABEL[c.derivedTierKey]}
                        </span>
                      ) : c.billedTierKey !== c.derivedTierKey ? (
                        <span className="text-muted-foreground block text-xs">
                          Held{c.holdUntil ? ` until ${d.long(c.holdUntil)}` : ""}; services need {TIER_LABEL[c.derivedTierKey]}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {c.seatsThisPeriod}
                      {c.pendingCatchUpSeats > 0 ? <span className="text-muted-foreground"> +{c.pendingCatchUpSeats}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatRand(c.unitPriceCents)}</td>
                    <td className="py-2 text-right">{canOverride ? <CourseTierOverride course={c} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="invoices-heading" className="space-y-3">
        <h2 id="invoices-heading" className="text-foreground text-sm font-semibold">
          Invoices
        </h2>
        {ws.invoices.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-muted-foreground border-border border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 font-medium">Number</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {ws.invoices.items.map((inv) => {
                  const ic = invoiceChip(inv.status, inv.paidAt ? d.short(inv.paidAt) : null);
                  return (
                    <tr key={inv.id}>
                      <td className="py-2 pr-3">{d.period(inv.periodStart, inv.periodEnd)}</td>
                      <td className="py-2 pr-3">
                        <Link href={adminBillingRoutes.invoice(inv.id)} className="text-foreground underline-offset-2 hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatRand(inv.totalCents)}</td>
                      <td className="py-2">
                        <StatusChip tone={ic.tone}>{ic.label}</StatusChip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {ws.invoices.nextCursor ? <p className="text-muted-foreground text-xs">Showing the 20 newest invoices.</p> : null}
      </section>
    </div>
  );
}

/* ───── One invoice ───── */

export function AdminInvoiceDetail({
  invoice: inv,
  workspaceName,
  ctx,
  canOverride,
}: {
  invoice: AdminInvoice;
  workspaceName: string;
  ctx: DateContext;
  canOverride: boolean;
}) {
  const d = days(ctx);
  const chip = invoiceChip(inv.status, inv.paidAt ? d.short(inv.paidAt) : null);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <Link href={adminBillingRoutes.workspace(inv.workspaceId)} className="text-foreground underline-offset-2 hover:underline">
            {workspaceName}
          </Link>{" "}
          · {d.period(inv.periodStart, inv.periodEnd)} · issued {d.long(inv.issuedAt)}
        </p>
        <span className="flex items-center gap-3">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          {inv.pdfUrl ? (
            <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2">
              PDF
            </a>
          ) : null}
          {canOverride && inv.status === "OPEN" ? <InvoiceActions invoice={inv} /> : null}
        </span>
      </div>

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
              // A types the admin payment status as a string; the values are InvoicePayment's.
              const label = paymentLabel(p as InvoicePayment);
              const refunded = p.via === "CARD" && p.paymentId && p.refundableCents < p.amountCents && p.status !== "FAILED";
              return (
                <li key={p.paymentId ?? i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground tabular-nums">{d.long(p.at)}</span>
                    <StatusChip tone={label.tone}>{label.label}</StatusChip>
                    {refunded ? (
                      <span className="text-muted-foreground text-xs">{formatRand(p.amountCents - p.refundableCents)} refunded</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatRand(p.amountCents)}</span>
                    {canOverride && p.paymentId && p.refundableCents > 0 ? (
                      <RefundButton payment={{ paymentId: p.paymentId, refundableCents: p.refundableCents }} invoiceNumber={inv.number} />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ───── Discount codes ───── */

export function DiscountCodeTable({
  list,
  ctx,
  canOverride,
  now,
  olderHref,
  newestHref,
}: {
  list: AdminCodeList;
  ctx: DateContext;
  canOverride: boolean;
  /** ISO instant the page was rendered at, for the Live / Ended chips. */
  now: string;
  olderHref: string | null;
  newestHref: string | null;
}) {
  const d = days(ctx);
  if (list.items.length === 0 && !newestHref) {
    return <EmptyState compact title="No discount codes yet" description="Codes you create show here, with how often they've been used." />;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Discount</th>
              <th className="py-2 pr-3 font-medium">Dates</th>
              <th className="py-2 pr-3 text-right font-medium">Used</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {list.items.map((c) => {
              const st = codeStatus(c, now);
              return (
                <tr key={c.id}>
                  <td className="py-2 pr-3">
                    <span className="text-foreground font-mono text-xs">{c.code}</span>
                    <span className="text-muted-foreground block text-xs">{c.description}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {discountLabel(c, formatRand)}
                    <span className="text-muted-foreground block text-xs">
                      {c.scope === "WORKSPACE_BILL" ? "Whole bill" : c.scope === "TIER" ? "One tier" : "Add-on"}
                      {c.durationPeriods ? `, ${c.durationPeriods} period${c.durationPeriods === 1 ? "" : "s"}` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {d.short(c.startsAt)}
                    {c.endsAt ? ` – ${d.long(c.endsAt)}` : " onwards"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {c.redemptions}
                    {c.maxRedemptions != null ? <span className="text-muted-foreground"> of {c.maxRedemptions}</span> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusChip tone={st.tone}>{st.label}</StatusChip>
                  </td>
                  <td className="py-2 text-right">{canOverride && c.active ? <DeactivateCodeButton code={c} /> : null}</td>
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

/* ───── Retention dry run ───── */

export function RetentionTable({ preview, ctx }: { preview: RetentionPreview; ctx: DateContext }) {
  const d = days(ctx);
  return (
    <div className="space-y-4">
      <div
        role="status"
        className={`rounded-lg border p-4 text-sm ${preview.deletesEnabled ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"}`}
      >
        {preview.deletesEnabled ? (
          <>
            <strong>Deletes are on.</strong> The daily job deletes these workspaces&apos; data. What&apos;s listed is what
            the next run would remove.
          </>
        ) : (
          <>
            <strong>Deletes are off.</strong> Nothing is removed. This is what the daily job would delete if deletes were
            switched on (RETENTION_DELETES).
          </>
        )}
      </div>
      {preview.items.length === 0 ? (
        <EmptyState compact title="Nothing past its retention date" description="Workspaces show here once their data is due for deletion." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="py-2 pr-3 font-medium">Workspace</th>
                <th className="py-2 pr-3 font-medium">Due for deletion</th>
                <th className="py-2 pr-3 font-medium">Last paid</th>
                <th className="py-2 font-medium">Would remove</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {preview.items.map((w) => (
                <tr key={w.workspaceId}>
                  <td className="py-2 pr-3">
                    <Link href={adminBillingRoutes.workspace(w.workspaceId)} className="text-foreground underline-offset-2 hover:underline">
                      {w.name || "Unnamed workspace"}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{w.deleteAfter ? d.long(w.deleteAfter) : muted}</td>
                  <td className="py-2 pr-3">{w.lastPaidAt ? d.long(w.lastPaidAt) : <span className="text-muted-foreground">Never</span>}</td>
                  <td className="text-muted-foreground py-2">{retentionSummary(w.counts as unknown as Record<string, number>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Kept either way: the workspace row, invoices, payments and the audit log (tax law), and people&apos;s accounts.
      </p>
    </div>
  );
}

