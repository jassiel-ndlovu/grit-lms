/**
 * /dashboard/timesheets/[membershipId] — one person's timesheet for a month,
 * for the managers they're under: approve, send back, reopen, or fill it in
 * for them. Their pay rate is here too.
 */

import { notFound, redirect } from "next/navigation";

import { PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { TimesheetFrame } from "@/features/events/components/staff-time/frames";
import { DecideSheet, PayRateButton, SubmitSheet } from "@/features/events/components/staff-time/sheet-actions";
import { SheetDecision, SheetTiles, TimesheetBody } from "@/features/events/components/staff-time/sheet-views";
import { formatRand } from "@/features/courses/lib/billing-ui";
import { duration, monthLabel, parseMonth, sheetChip, splitSuggestions, timesheetRoutes } from "@/features/events/lib/staff-time-ui";
import { coursesTaughtBy, hasStaffTime, timesheetOr404 } from "@/features/events/staff-time";
import { monthOf } from "@/features/staff/timesheet-math";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Timesheet" };

interface PageProps {
  params: Promise<{ membershipId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}

export default async function StaffTimesheetPage({ params, searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!hasStaffTime(viewer)) notFound();
  const { membershipId } = await params;
  const now = new Date();
  const timeZone = viewer.workspace?.timezone ?? DEFAULT_TIME_ZONE;
  const thisMonth = monthOf(now, timeZone);
  const month = parseMonth((await searchParams).month, thisMonth);
  if (!can(viewer, "timesheets.manage")) notFound();
  const view = await timesheetOr404(viewer, { month, membershipId });
  const [prefs, courses, rate] = await Promise.all([
    getUserPreferences(viewer.user.id),
    coursesTaughtBy(membershipId),
    prisma.payRate.findUnique({ where: { membershipId }, select: { hourlyCents: true } }),
  ]);
  const ctx = { timeZone, locale: resolveLocale(prefs.preferredLanguage) };
  const own = membershipId === viewer.membership?.id;
  const { status } = view.sheet;
  const chip = sheetChip(status);
  const label = monthLabel(month, ctx.locale);
  const hourly = rate?.hourlyCents ?? null;
  const time = `${duration(view.totals.minutes)} in ${label}`;
  const pay = view.totals.amountCents === null ? "No pay rate is set, so no pay is worked out" : formatRand(view.totals.amountCents);

  return (
    <TimesheetFrame
      month={month}
      thisMonth={thisMonth}
      locale={ctx.locale}
      at={(m) => timesheetRoutes.member(membershipId, m)}
      tabs={viewer.membership !== null}
      current="staff"
      person={view.name}
      actions={
        own ? null : status === "SUBMITTED" || status === "APPROVED" ? (
          <DecideSheet timesheetId={view.sheet.id} status={status} name={view.name} summary={`${time}. ${pay}`} />
        ) : view.entries.length > 0 ? (
          <SubmitSheet timesheetId={view.sheet.id} summary={time} leftOut={splitSuggestions(view.suggestions, now).taught.length} forName={view.name} />
        ) : null
      }
    >
      <PageTitle
        title={view.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {label}
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          </span>
        }
        properties={<SheetTiles view={view} />}
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        Rate an hour
        <PayRateButton membershipId={membershipId} name={view.name} hourlyCents={hourly} label={hourly === null ? "Set a rate" : formatRand(hourly)} />
      </p>
      {own && status === "SUBMITTED" ? <p className="text-foreground text-sm">Someone else must approve your own timesheet.</p> : null}
      <SheetDecision view={view} ctx={ctx} />
      <TimesheetBody view={view} ctx={ctx} now={now} courses={courses} />
    </TimesheetFrame>
  );
}
