/**
 * The business dashboard's body (Plus and Pro; billing.md Draft 1.17),
 * display only. The page loads A's getBusinessDashboard;
 * /design-system/business passes samples. No figure is worked out here.
 */

import * as React from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { PageSection } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRand } from "@/features/courses/lib/billing-ui";
import type { businessDashboardFor } from "@/features/reports/business";
import { formatDate, type DateContext } from "@/lib/datetime";

import { MonthChart, type MonthPoint } from "./month-chart";
import { BUSINESS_PATH, monthLabel, periodHref, PERIODS, ratePercent, type Period } from "./period";

export type BusinessData = Awaited<ReturnType<typeof businessDashboardFor>>;

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-ZA")} ${n === 1 ? one : many}`;

/* ───── The period ───── */

export function PeriodPicker({ period, today }: { period: Period; today: string }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Period" className="flex flex-wrap gap-1 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={periodHref(p.key)}
            aria-current={p.key === period.key ? "page" : undefined}
            className={
              p.key === period.key
                ? "bg-muted text-foreground rounded-md px-3 py-1.5 font-medium"
                : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
            }
          >
            {p.label}
          </Link>
        ))}
      </nav>
      {/* Keyed, so the fields follow the period after a link is used. */}
      <form key={`${period.fromDay}:${period.toDay}`} method="get" action={BUSINESS_PATH} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="business-from" className="text-muted-foreground text-xs">
            First day
          </Label>
          <Input id="business-from" type="date" name="from" required max={today} defaultValue={period.fromDay} className="w-40 dark:[color-scheme:dark]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="business-to" className="text-muted-foreground text-xs">
            Last day
          </Label>
          <Input id="business-to" type="date" name="to" required max={today} defaultValue={period.toDay} className="w-40 dark:[color-scheme:dark]" />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          <CalendarRange aria-hidden className="size-4" /> Show
        </Button>
      </form>
      {period.error ? (
        <p role="alert" className="text-destructive text-sm">
          {period.error} Showing the last 30 days.
        </p>
      ) : null}
    </div>
  );
}

/* ───── Figures ───── */

function Figures({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">{children}</dl>;
}

function Figure({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="border-border flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-xl font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd>
      {note ? <dd className="text-muted-foreground text-xs">{note}</dd> : null}
    </div>
  );
}

/* ───── The dashboard ───── */

export function BusinessDashboard({
  data, period, ctx, showMoney, showTutors, feesHref,
}: {
  data: BusinessData;
  period: Period;
  ctx: DateContext;
  /** Billing is on: fees exist. */
  showMoney: boolean;
  /** An organisation: the money and students by tutor. */
  showTutors: boolean;
  /** The Fees page, for someone who can open it. */
  feesHref: string | null;
}) {
  const { money, students } = data;
  const day = (iso: string) => formatDate(iso, ctx);
  // Days, not instants: shown as written whatever the zone.
  const calendarDay = (d: string) => formatDate(`${d}T00:00:00Z`, { ...ctx, timeZone: "UTC" });
  const span = period.fromDay === period.toDay ? calendarDay(period.fromDay) : `${calendarDay(period.fromDay)} to ${calendarDay(period.toDay)}`;

  return (
    <>
      {showMoney ? (
        <PageSection id="fees" title="Fees" description={span}>
          <Figures>
            <Figure label="Invoiced" value={formatRand(money.invoicedCents)} />
            <Figure
              label="Collected"
              value={formatRand(money.collectedCents)}
              note={`Before refunds${money.collectedOffsiteCents > 0 ? `; ${formatRand(money.collectedOffsiteCents)} of it outside Nexa` : ""}`}
            />
            <Figure
              label="Collection rate"
              value={money.collectionRateBps === null ? "–" : ratePercent(money.collectionRateBps)}
              note={money.collectionRateBps === null ? "No fees were due" : "of the fees due are paid"}
            />
            {/* money.refundedCents isn't shown: A's query misses family refunds (b/HANDOFF.md, 23 Nov). */}
          </Figures>
        </PageSection>
      ) : null}

      {showMoney ? (
        <PageSection
          id="owed"
          title="Owed now"
          actions={
            feesHref ? (
              <Link href={feesHref} className="text-link text-sm underline underline-offset-2">
                Open fees
              </Link>
            ) : undefined
          }
        >
          <Figures>
            <Figure
              label="Overdue"
              value={formatRand(money.overdue.cents)}
              note={
                money.overdue.invoices === 0
                  ? "Nothing overdue"
                  : `${count(money.overdue.invoices, "invoice")}${money.overdue.oldestDueAt ? `, the oldest due ${day(money.overdue.oldestDueAt)}` : ""}`
              }
            />
            <Figure
              label="Due in the next 7 days"
              value={formatRand(money.dueNext7Days.cents)}
              note={money.dueNext7Days.invoices === 0 ? "Nothing due" : count(money.dueNext7Days.invoices, "invoice")}
            />
          </Figures>
        </PageSection>
      ) : null}

      <PageSection id="students" title="Students" description={span}>
        <Figures>
          <Figure label="Active now" value={students.active.toLocaleString("en-ZA")} note={`on ${count(students.courses, "course")}`} />
          <Figure label="Joined" value={students.joined.toLocaleString("en-ZA")} note="on their first course" />
          <Figure label="Left" value={students.left.toLocaleString("en-ZA")} note="ended their last course" />
          {data.aiCreditsUsed ? <Figure label="AI credits used" value={data.aiCreditsUsed.toLocaleString("en-ZA")} /> : null}
        </Figures>
      </PageSection>

      <Trend data={data} ctx={ctx} showMoney={showMoney} />

      {showTutors && data.tutors.length > 0 ? <Tutors data={data} span={span} showMoney={showMoney} /> : null}

      {data.notes.length > 0 ? <p className="text-muted-foreground text-xs">{data.notes.join(" ")}</p> : null}
    </>
  );
}

function Trend({ data, ctx, showMoney }: { data: BusinessData; ctx: DateContext; showMoney: boolean }) {
  const locale = ctx.locale ?? "en-ZA";
  if (data.trend.length === 0) return null;
  const points = (value: (t: BusinessData["trend"][number]) => number, text: (n: number) => string): MonthPoint[] =>
    data.trend.map((t) => ({ month: t.month, short: monthLabel(t.month, locale), long: monthLabel(t.month, locale, true), value: value(t), text: text(value(t)) }));
  const peak = (ps: MonthPoint[]) => ps.reduce((a, b) => (b.value > a.value ? b : a));
  const summary = (what: string, ps: MonthPoint[]) =>
    peak(ps).value <= 0 ? `${what}, six months: none.` : `${what}, six months. Highest in ${peak(ps).long}, ${peak(ps).text}. ${ps[ps.length - 1].long} so far, ${ps[ps.length - 1].text}.`;
  const collected = points((t) => t.collectedCents, formatRand);
  const joined = points((t) => t.newStudents, (n) => count(n, "student"));

  return (
    <div className={showMoney ? "grid gap-8 md:grid-cols-2" : "max-w-xl"}>
      {showMoney ? (
        <PageSection id="collected" title="Collected each month">
          <MonthChart points={collected} summary={summary("Fees collected", collected)} measure="Collected" max={peak(collected).text} />
        </PageSection>
      ) : null}
      <PageSection id="joined" title="New students each month">
        <MonthChart points={joined} summary={summary("New students", joined)} measure="New students" max={peak(joined).value.toLocaleString("en-ZA")} />
      </PageSection>
    </div>
  );
}

function Tutors({ data, span, showMoney }: { data: BusinessData; span: string; showMoney: boolean }) {
  return (
    <PageSection
      id="tutors"
      title="Tutors"
      description={
        showMoney
          ? `${span}. A course counts for its lead tutor. Two lead tutors share its fees, and invoice discounts aren't taken off.`
          : "A course counts for its lead tutor."
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tutor</TableHead>
            <TableHead className="text-right">Courses</TableHead>
            <TableHead className="text-right">Students now</TableHead>
            {showMoney ? (
              <>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Overdue now</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.tutors.map((t) => (
            <TableRow key={t.membershipId}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="text-right tabular-nums">{t.courses}</TableCell>
              <TableCell className="text-right tabular-nums">{t.activeStudents}</TableCell>
              {showMoney ? (
                <>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{formatRand(t.invoicedCents)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{formatRand(t.collectedCents)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{formatRand(t.overdueCents)}</TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageSection>
  );
}
