/**
 * /dashboard/timesheets/mine — the viewer's own timesheet for a month
 * (`?month=YYYY-MM`): what the calendar suggests, what's on it, the pay at
 * their rate, and Submit.
 */

import { notFound, redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { TimesheetFrame } from "@/features/events/components/staff-time/frames";
import { SubmitSheet } from "@/features/events/components/staff-time/sheet-actions";
import { SheetDecision, SheetTiles, TimesheetBody } from "@/features/events/components/staff-time/sheet-views";
import { duration, monthLabel, parseMonth, sheetChip, splitSuggestions, timesheetRoutes } from "@/features/events/lib/staff-time-ui";
import { coursesTaughtBy, hasStaffTime, timesheetOr404 } from "@/features/events/staff-time";
import { monthOf } from "@/features/staff/timesheet-math";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "My timesheet" };

export default async function MyTimesheetPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!hasStaffTime(viewer) || !viewer.membership) notFound();
  const now = new Date();
  const timeZone = viewer.workspace?.timezone ?? DEFAULT_TIME_ZONE;
  const thisMonth = monthOf(now, timeZone);
  const month = parseMonth((await searchParams).month, thisMonth);
  const [view, prefs, courses] = await Promise.all([
    timesheetOr404(viewer, { month }),
    getUserPreferences(viewer.user.id),
    coursesTaughtBy(viewer.membership.id),
  ]);
  const ctx = { timeZone, locale: resolveLocale(prefs.preferredLanguage) };
  const chip = sheetChip(view.sheet.status);
  const label = monthLabel(month, ctx.locale);

  return (
    <TimesheetFrame
      month={month}
      thisMonth={thisMonth}
      locale={ctx.locale}
      at={timesheetRoutes.mine}
      tabs={can(viewer, "timesheets.manage")}
      current="mine"
      actions={
        view.editable && view.entries.length > 0 ? (
          <SubmitSheet
            timesheetId={view.sheet.id}
            summary={`${duration(view.totals.minutes)} in ${label}`}
            leftOut={splitSuggestions(view.suggestions, now).taught.length}
            forName={null}
          />
        ) : null
      }
    >
      <PageTitle
        icon={<ReceiptText />}
        title="My timesheet"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {label}
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          </span>
        }
        properties={<SheetTiles view={view} />}
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <SheetDecision view={view} ctx={ctx} />
      <TimesheetBody view={view} ctx={ctx} now={now} courses={courses} />
    </TimesheetFrame>
  );
}
