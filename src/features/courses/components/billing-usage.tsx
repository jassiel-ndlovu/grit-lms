/**
 * The usage page body (a/ux/03-billing.md §3): for one billing period, each
 * billed meter's total, what it adds to the bill so far, its limit and a
 * daily chart. Pure display of what getUsage returns; the page loads it.
 *
 * In the current period an owner (billing.manage) can set or remove their
 * own limit per meter (A's setUsageCap); it is shown, not yet enforced.
 */

import Link from "next/link";

import type { getUsage } from "@/features/billing/queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { USAGE_METERS, countLabel, formatRand, peakDay } from "../lib/billing-ui";
import { CapBar, billingRoutes } from "./billing-overview";
import { UsageChart } from "./usage-chart";
import { UsageLimit } from "./usage-limit";

export type UsageData = Awaited<ReturnType<typeof getUsage>>;
type Meter = (typeof USAGE_METERS)[number];

export function BillingUsage({
  usage,
  trial,
  ctx,
  periods,
  periodStart,
  canManage,
}: {
  /** One per USAGE_METERS entry, in that order. */
  usage: UsageData[];
  /** No paid period yet: the estimate is what the first 30 days would cost. */
  trial: boolean;
  ctx: DateContext;
  /** Earlier periods that can be picked, newest first (from paid invoices). */
  periods: string[];
  /** The period asked for, or null for the current one. */
  periodStart: string | null;
  /** Can set limits (billing.manage); only offered for the current period. */
  canManage: boolean;
}) {
  const day = (iso: string, year = true) =>
    formatDate(new Date(iso), ctx, year ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const period = usage[0]?.period;

  return (
    <div className="space-y-10">
      {period ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {trial ? "Trial" : "Period"} {day(period.start, false)} – {day(period.end)}
            {periodStart ? null : <span> · so far</span>}
          </p>
          {periods.length > 0 ? (
            <nav aria-label="Billing periods" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link
                href={billingRoutes.usage}
                aria-current={periodStart ? undefined : "page"}
                className={periodStart ? "text-muted-foreground hover:text-foreground underline underline-offset-2" : "text-foreground font-medium"}
              >
                Current
              </Link>
              {periods.map((p) => (
                <Link
                  key={p}
                  href={`${billingRoutes.usage}?period=${encodeURIComponent(p)}`}
                  aria-current={p === periodStart ? "page" : undefined}
                  className={p === periodStart ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground underline underline-offset-2"}
                >
                  {day(p, false)}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      ) : null}

      {USAGE_METERS.map((m, i) => (usage[i] ? <MeterSection key={m.meter} meter={m} usage={usage[i]} trial={trial} ctx={ctx} canSetLimit={canManage && !periodStart} /> : null))}

      <p className="text-muted-foreground text-xs">
        Each course is billed per active student for the period. On Pro courses, AI marking includes an allowance per
        student; answers above it are added to the next payment.
      </p>
    </div>
  );
}

function MeterSection({
  meter,
  usage: u,
  trial,
  ctx,
  canSetLimit,
}: {
  meter: Meter;
  usage: UsageData;
  trial: boolean;
  ctx: DateContext;
  canSetLimit: boolean;
}) {
  const id = `meter-${meter.meter}`;
  const days = u.days.map((d) => ({
    ...d,
    // `day` is a UTC calendar day; label it as such so it doesn't shift.
    label: formatDate(new Date(`${d.day}T00:00:00Z`), { ...ctx, timeZone: "UTC" }, { day: "numeric", month: "short" }),
  }));
  const peak = peakDay(days);
  const peakLabel = peak ? days.find((d) => d.day === peak.day)?.label : null;
  const summary = peak && peakLabel
    ? `${meter.title} per day. Busiest day ${peakLabel}, ${countLabel(peak.quantity, meter.unit)}.`
    : `${meter.title} per day.`;

  const money =
    meter.meter === "active-students"
      ? trial
        ? { label: "First 30 days would cost", cents: u.estimatedCents }
        : { label: "Charged for this period so far", cents: u.estimatedCents }
      : { label: "Above the allowance so far", cents: u.estimatedCents };

  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={id} className="text-foreground text-sm font-semibold">
          {meter.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {money.label} <span className="text-foreground font-medium tabular-nums">{formatRand(money.cents)}</span>
        </p>
      </div>
      <p className="text-foreground text-2xl font-semibold tabular-nums">
        {countLabel(u.totalQuantity, meter.unit)}
        <span className="text-muted-foreground ml-2 text-sm font-normal">
          {meter.meter === "active-students" ? "in the period" : "marked in the period"}
        </span>
      </p>
      {u.cap ? <CapBar cap={u.cap} label={u.cap.source === "TRIAL" ? "Trial limit" : "Limit this period"} /> : null}
      {canSetLimit ? (
        <UsageLimit
          meter={meter.meter}
          unit={meter.unit}
          current={u.cap?.source === "TUTOR" ? u.cap.limit : null}
        />
      ) : null}
      <UsageChart days={days} unit={meter.unit} summary={summary} />
    </section>
  );
}
