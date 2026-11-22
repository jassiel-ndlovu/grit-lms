/**
 * The billing overview body (a/ux/03-billing.md §1): summary, courses and
 * their plans, the next payment line by line, and limits. Pure display of
 * what getBillingOverview and getCourseTiers return; the page loads them.
 */

import Link from "next/link";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { RibbonNav } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import type { getBillingOverview, getCourseTiers } from "@/features/billing/queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { STATE_CHIP, TIER_LABEL, capLabel, capTone, formatRand } from "../lib/billing-ui";
import { CardButton, PayButton, PaymentReturn } from "./billing-pay";
import { RestartPanel } from "./billing-restart";
import { courseRoutes } from "./course-frame";

export type BillingOverviewData = Awaited<ReturnType<typeof getBillingOverview>>;
export type CourseTierRow = Awaited<ReturnType<typeof getCourseTiers>>[number];

const BAR: Record<string, string> = {
  neutral: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export const billingRoutes = {
  overview: "/dashboard/settings/billing",
  usage: "/dashboard/settings/billing/usage",
  payments: "/dashboard/settings/billing/payments",
  payment: (id: string) => `/dashboard/settings/billing/payments/${id}`,
};

export function BillingOverview({
  overview: o,
  tiers,
  ctx,
  canManage,
  payment,
}: {
  overview: BillingOverviewData;
  tiers: CourseTierRow[];
  ctx: DateContext;
  /** billing.manage: may pay. */
  canManage: boolean;
  /** Back from Paystack (`reference`) or a saved-card charge (`paid`). */
  payment: { reference: string | null; paid: boolean } | null;
}) {
  const day = (iso: string | Date, year = true) =>
    formatDate(new Date(iso), ctx, year ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const chip = STATE_CHIP[o.state];
  const comped = o.state === "COMPED";
  // Cancelled: nothing renews; the paid period runs out, then read-only.
  const cancelled = o.state === "CANCELLED";
  const overdue = o.overdueInvoiceId != null && (o.state === "PAST_DUE" || o.state === "READ_ONLY");
  // Paying starts a period: an overdue invoice is paid as it is; otherwise a
  // trial, read-only or cancelled workspace starts its first payment.
  const firstPayment = !overdue && (o.state === "TRIAL" || o.state === "READ_ONLY" || o.state === "CANCELLED");
  // Cancelled, or read-only with nothing overdue: the restart flow (#191)
  // replaces the first-payment button, so a workspace with no students can
  // come back too.
  const restartable = canManage && (cancelled || (o.state === "READ_ONLY" && !overdue));

  return (
    <BillingFrame status={<StatusChip tone={chip.tone}>{chip.label}</StatusChip>}>
      {payment ? <PaymentReturn reference={payment.reference} /> : null}

      {overdue ? (
        <section role="alert" className="border-destructive/40 bg-destructive/5 space-y-1 rounded-lg border p-4 text-sm">
          <p className="text-foreground font-semibold">Unpaid renewal</p>
          <p className="text-muted-foreground">
            {o.state === "READ_ONLY"
              ? "Your workspace is read-only because the last renewal wasn't paid. Students can still see their work."
              : "We couldn't take the last renewal. Update your card or pay to avoid interruptions."}
            {o.deleteAfter ? ` If nothing is paid, all data is deleted on ${day(o.deleteAfter)}.` : ""}
          </p>
          {canManage ? (
            <div className="pt-2">
              <PayButton invoiceId={o.overdueInvoiceId} label="Pay now" />
            </div>
          ) : null}
        </section>
      ) : null}

      {o.state === "CANCELLED" && o.deleteAfter ? (
        <p className="text-muted-foreground text-sm">Cancelled. Data is deleted on {day(o.deleteAfter)}.</p>
      ) : null}

      <PropertyList>
        {o.state === "TRIAL" ? (
          <PropertyRow label="Free trial">
            {o.trialDaysLeft != null ? `${o.trialDaysLeft} day${o.trialDaysLeft === 1 ? "" : "s"} left` : "Active"}
            {o.trialEndsAt ? ` · ends ${day(o.trialEndsAt, false)}` : ""}
          </PropertyRow>
        ) : null}
        {o.period ? (
          <>
            <PropertyRow label="Current period">
              {day(o.period.start, false)} – {day(o.period.end)}
            </PropertyRow>
            {cancelled ? (
              <PropertyRow label="Access until">{day(o.period.end)}</PropertyRow>
            ) : (
              <PropertyRow label="Renews on">{day(o.period.renewsAt)}</PropertyRow>
            )}
          </>
        ) : null}
        <PropertyRow label={o.state === "TRIAL" ? "30 days cost" : "Next payment"}>
          {cancelled ? (
            "None"
          ) : (
            <span className={comped ? "line-through" : "text-foreground font-medium"}>{formatRand(o.nextRenewalEstimateCents)}</span>
          )}
        </PropertyRow>
        <PropertyRow label="Card">
          <span className="inline-flex flex-wrap items-center gap-3">
            <span>
              {o.card
                ? `${o.card.brand} •• ${o.card.last4} · expires ${String(o.card.expMonth).padStart(2, "0")}/${String(o.card.expYear).slice(-2)}`
                : "No card yet"}
            </span>
            {canManage && !comped ? <CardButton hasCard={o.card != null} /> : null}
          </span>
        </PropertyRow>
      </PropertyList>

      {restartable ? <RestartPanel cancelled={cancelled} firstPeriodCents={o.nextRenewalEstimateCents} /> : null}

      {firstPayment && !restartable && canManage && o.nextRenewalEstimateCents > 0 ? (
        <PayButton
          invoiceId={null}
          label={`Pay ${formatRand(o.nextRenewalEstimateCents)} for 30 days`}
        />
      ) : null}

      <section aria-labelledby="courses-heading" className="space-y-3">
        <h2 id="courses-heading" className="text-foreground text-sm font-semibold">
          Courses
        </h2>
        {tiers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No courses yet. Nothing to pay until a student joins a course.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-muted-foreground border-border border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Course</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 text-right font-medium">Active students</th>
                  <th className="py-2 pr-3 text-right font-medium">Per student</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Services</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {tiers.map((t) => (
                  <tr key={t.courseId}>
                    <td className="text-foreground py-2 pr-3">{t.title}</td>
                    <td className="py-2 pr-3">
                      <StatusChip tone={t.billedTierKey === "CORE" ? "neutral" : "info"}>{TIER_LABEL[t.billedTierKey]}</StatusChip>
                      {t.holdUntil ? (
                        <span className="text-muted-foreground ml-2 text-xs">until {day(t.holdUntil, false)}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {t.seatsThisPeriod}
                      {t.pendingCatchUpSeats > 0 ? (
                        <span className="text-muted-foreground"> (+{t.pendingCatchUpSeats} added)</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatRand(t.unitPriceCents)}</td>
                    <td className="py-2 text-right">
                      <Link
                        href={courseRoutes.services(t.courseId)}
                        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                      >
                        Services
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {o.estimate.length > 0 ? (
        <section aria-labelledby="estimate-heading" className="space-y-2">
          <h2 id="estimate-heading" className="text-foreground text-sm font-semibold">
            {o.period ? `Next payment on ${day(o.period.renewsAt, false)}` : "First payment"}
          </h2>
          <ul className="divide-border divide-y text-sm">
            {o.estimate.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-muted-foreground">{l.description}</span>
                <span className="tabular-nums">{formatRand(l.amountCents)}</span>
              </li>
            ))}
            <li className="text-foreground flex items-baseline justify-between gap-4 py-2 font-semibold">
              <span>Total</span>
              <span className={comped ? "line-through tabular-nums" : "tabular-nums"}>{formatRand(o.nextRenewalEstimateCents)}</span>
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">
            {o.vatRegistered ? "Prices include VAT." : "Prices exclude VAT."} Each payment covers 30 days.
          </p>
        </section>
      ) : null}

      {o.caps.length > 0 ? (
        <section aria-labelledby="caps-heading" className="space-y-3">
          <h2 id="caps-heading" className="text-foreground text-sm font-semibold">
            {o.state === "TRIAL" ? "Trial limits" : "Limits"}
          </h2>
          <ul className="space-y-3 text-sm">
            {o.caps.map((c) => (
              <li key={c.meter}>
                <CapBar cap={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </BillingFrame>
  );
}

/** One limit: its name, "used of limit", and a bar from 0 to 100%. */
export function CapBar({ cap, label }: { cap: BillingOverviewData["caps"][number]; /** Instead of the meter's name. */ label?: string }) {
  const { name: meterName, amount } = capLabel(cap);
  const name = label ?? meterName;
  const tone = capTone(cap.percent);
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-foreground">{name}</span>
        <span className="text-muted-foreground tabular-nums">{amount}</span>
      </div>
      {cap.percent != null ? (
        <div
          role="meter"
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(cap.percent, 100)}
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div className={`h-full ${BAR[tone] ?? BAR.neutral}`} style={{ width: `${Math.min(cap.percent, 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The billing pages' PageFrame (#205, a Settings page at Reading width):
 * Settings › Billing [› page], the Overview / Usage / Payments ribbon, and
 * the page's title (default "Billing").
 */
export function BillingFrame({
  status,
  page,
  title = "Billing",
  actions,
  children,
}: {
  status?: React.ReactNode;
  /** Crumbs after Billing, e.g. [{ label: "Payments", href }, { label: "NX-2026-0142" }]. */
  page?: Crumb[];
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Settings", href: "/dashboard/settings" },
    page?.length ? { label: "Billing", href: billingRoutes.overview } : { label: "Billing" },
    ...(page ?? []),
  ];
  return (
    <PageFrame
      type="settings"
      breadcrumb={crumbs}
      status={status}
      actions={actions}
      secondary={
        <RibbonNav
          label="Billing"
          links={[
            { label: "Overview", href: billingRoutes.overview },
            { label: "Usage", href: billingRoutes.usage },
            { label: "Payments", href: billingRoutes.payments },
          ]}
        />
      }
    >
      <PageTitle title={title} />
      {children}
    </PageFrame>
  );
}
