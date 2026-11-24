/**
 * A month's timesheet, and the managers' list of everyone's. Server
 * components; the buttons are in sheet-actions.tsx. Times are in the
 * organisation's time zone, which decides the month.
 */

import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import { PageSection } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRand } from "@/features/courses/lib/billing-ui";
import type { listTimesheets, TimesheetView } from "@/features/staff/timesheets";
import { formatDate, type DateContext } from "@/lib/datetime";

import { byDay } from "../../lib/booking-ui";
import { dayKeyOf, dayLabel } from "../../lib/calendar-ui";
import { duration, kindLabel, lastDayOf, monthLabel, sheetChip, splitSuggestions, timesheetRoutes, type SheetStatus } from "../../lib/staff-time-ui";
import { AddSuggestions, AddWorkButton, EntryButtons, PayRateButton } from "./sheet-actions";

type Ctx = DateContext & { timeZone: string; locale: string };

export function SheetTiles({ view: v }: { view: TimesheetView }) {
  return (
    <StatTiles>
      <StatTile label="Time" value={duration(v.totals.minutes)} />
      <StatTile label="Entries" value={String(v.entries.length)} />
      <StatTile label="Hourly rate" value={v.totals.hourlyCents === null ? "-" : formatRand(v.totals.hourlyCents)} />
      <StatTile label="Pay" value={v.totals.amountCents === null ? "-" : formatRand(v.totals.amountCents)} />
    </StatTiles>
  );
}

/** What was decided, with the manager's note. */
export function SheetDecision({ view: v, ctx }: { view: TimesheetView; ctx: Ctx }) {
  const { status, submittedAt, decidedAt, decisionNote } = v.sheet;
  const on = (d: Date | null) => (d ? ` on ${formatDate(d, ctx, { day: "numeric", month: "long" })}` : "");
  const line =
    status === "SUBMITTED"
      ? `Submitted${on(submittedAt)}. Waiting for approval.`
      : status === "APPROVED"
        ? `Approved${on(decidedAt)}.`
        : status === "REJECTED"
          ? `Sent back${on(decidedAt)}. Change it and submit it again.`
          : decidedAt && decisionNote
            ? `Reopened${on(decidedAt)}.`
            : null;
  if (!line) return null;
  return (
    <div role="note" className="border-border bg-muted/40 max-w-prose space-y-1 rounded-lg border p-4 text-sm">
      <p className="text-foreground font-medium">{line}</p>
      {decisionNote ? <p className="text-muted-foreground whitespace-pre-line">{decisionNote}</p> : null}
    </div>
  );
}

/** Entries and suggestions, by day. */
export function TimesheetBody({ view: v, ctx, now, courses }: {
  view: TimesheetView;
  ctx: Ctx;
  now: Date;
  courses: Array<{ id: string; name: string }>;
}) {
  const time = new Intl.DateTimeFormat(ctx.locale, { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone });
  const { taught, later } = splitSuggestions(v.suggestions, now);
  const today = dayKeyOf(now, ctx.timeZone);
  const last = lastDayOf(v.month);
  const defaultDay = today < `${v.month}-01` ? `${v.month}-01` : today > last ? last : today;
  const suggestion = (s: TimesheetView["suggestions"][number]) => (
    <li key={s.key} className="flex items-center gap-x-4 px-4 py-3">
      <span className="text-foreground min-w-0 flex-1 text-sm break-words">
        {s.label}
        <span className="text-muted-foreground block text-xs">
          {dayLabel(dayKeyOf(s.startsAt, ctx.timeZone), ctx.locale)} at {time.format(s.startsAt)} · {kindLabel(s.kind)} · {duration(s.minutes)}
        </span>
      </span>
      <AddSuggestions timesheetId={v.sheet.id} keys={[s.key]} label="Add" what={`${s.label}, ${dayLabel(dayKeyOf(s.startsAt, ctx.timeZone), ctx.locale)}`} />
    </li>
  );
  const LIST = "divide-border border-border divide-y rounded-lg border";

  return (
    <>
      {v.editable && taught.length > 0 ? (
        <PageSection
          id="suggestions"
          title={`${taught.length} to add`}
          description="Taught this month and not on the timesheet yet."
          actions={<AddSuggestions timesheetId={v.sheet.id} keys={taught.map((s) => s.key)} label={taught.length === 1 ? "Add it" : "Add all"} what="classes taught" />}
        >
          <ul className={LIST}>{taught.map(suggestion)}</ul>
        </PageSection>
      ) : null}

      <PageSection
        id="entries"
        title="On the timesheet"
        actions={v.editable ? <AddWorkButton timesheetId={v.sheet.id} month={v.month} timeZone={ctx.timeZone} courses={courses} defaultDay={defaultDay} /> : null}
      >
        {v.entries.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              compact
              illustration={<Scene name="calendar-empty" />}
              title="Nothing on it yet"
              description={!v.editable ? "This timesheet has no entries." : taught.length > 0 ? "Add the classes above, or other work such as marking." : "Classes and booked lessons show here to add once they've been taught. You can add other work, such as marking."}
            />
          </Card>
        ) : (
          <div className="space-y-5">
            {byDay(v.entries, (e) => e.startsAt, ctx.timeZone).map((d) => (
              <section key={d.day} aria-labelledby={`sheet-${d.day}`} className="space-y-2">
                <h3 id={`sheet-${d.day}`} className="text-foreground text-sm font-medium">
                  {dayLabel(d.day, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <ul className={LIST}>
                  {d.items.map((e) => (
                    <li key={e.id} className="flex items-start gap-x-4 px-4 py-3">
                      <span className="text-muted-foreground w-12 shrink-0 text-sm tabular-nums">{time.format(e.startsAt)}</span>
                      <span className="text-foreground min-w-0 flex-1 text-sm break-words">
                        {e.label}
                        <span className="text-muted-foreground block text-xs">
                          {kindLabel(e.kind)} · {duration(e.minutes)}
                        </span>
                        {e.note ? <span className="text-muted-foreground mt-1 block text-xs whitespace-pre-line">{e.note}</span> : null}
                      </span>
                      {v.editable ? <EntryButtons entry={e} /> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageSection>

      {v.editable && later.length > 0 ? (
        <PageSection id="later" title="Later this month" description="Not taught yet. Add these now only if your payroll closes before then.">
          <ul className={LIST}>{later.map(suggestion)}</ul>
        </PageSection>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* Managers                                                                  */
/* ------------------------------------------------------------------------- */

export type SheetRow = Awaited<ReturnType<typeof listTimesheets>>[number];

/** One row per member of staff, with their pay rate. */
export function StaffSheets({ rows, month }: { rows: readonly SheetRow[]; month: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Time</TableHead>
          <TableHead>Rate an hour</TableHead>
          <TableHead className="text-right">Pay</TableHead>
          <TableHead>
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const chip = sheetChip(r.status as SheetStatus);
          return (
            <TableRow key={r.membershipId}>
              <TableCell className="min-w-40">
                <Link href={timesheetRoutes.member(r.membershipId, month)} className="text-foreground font-medium underline-offset-4 hover:underline">
                  {r.name}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">{r.totalMinutes ? duration(r.totalMinutes) : "-"}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                <PayRateButton membershipId={r.membershipId} name={r.name} hourlyCents={r.hourlyCents} label={r.hourlyCents === null ? "Set a rate" : formatRand(r.hourlyCents)} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">{r.amountCents === null ? "-" : formatRand(r.amountCents)}</TableCell>
              <TableCell className="text-right">
                <Link href={timesheetRoutes.member(r.membershipId, month)} aria-label={`Open ${r.name}'s timesheet`} className="inline-flex p-1">
                  <ArrowRight aria-hidden className="text-muted-foreground size-4" />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** The payroll files: one row per person, or one per entry. */
export function PayrollDownloads({ month, locale, approved }: { month: string; locale: string; approved: number }) {
  return (
    <PageSection
      id="payroll"
      title="Payroll"
      description={
        approved === 0
          ? `No timesheets are approved for ${monthLabel(month, locale)} yet.`
          : `${approved} approved ${approved === 1 ? "timesheet" : "timesheets"} for ${monthLabel(month, locale)}, as spreadsheets (CSV).`
      }
    >
      {approved > 0 ? (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Totals", href: timesheetRoutes.payroll(month) },
            { label: "Every entry", href: timesheetRoutes.payroll(month, true) },
          ].map((d) => (
            <Button key={d.label} asChild size="sm" variant="outline">
              <a href={d.href} download>
                <Download aria-hidden className="size-4" />
                {d.label}
              </a>
            </Button>
          ))}
        </div>
      ) : null}
    </PageSection>
  );
}
