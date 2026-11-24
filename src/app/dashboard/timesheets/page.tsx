/**
 * /dashboard/timesheets — everyone's timesheets for a month (viewer.md Draft
 * 1.24, organisations). For managers with `timesheets.manage`, over the staff
 * in their scope; other staff go to their own. `?month=YYYY-MM`, `?status=`.
 */

import { notFound, redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { PageSection, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { formatRand } from "@/features/courses/lib/billing-ui";
import { LinkSelect } from "@/features/events/components/booking/pickers";
import { TimesheetFrame } from "@/features/events/components/staff-time/frames";
import { PayrollDownloads, StaffSheets } from "@/features/events/components/staff-time/sheet-views";
import { monthLabel, parseMonth, parseSheetStatus, SHEET_STATUSES, sheetChip, timesheetRoutes } from "@/features/events/lib/staff-time-ui";
import { hasStaffTime } from "@/features/events/staff-time";
import { monthOf } from "@/features/staff/timesheet-math";
import { listTimesheets } from "@/features/staff/timesheets";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Timesheets" };

type Params = Record<string, string | string[] | undefined>;

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!hasStaffTime(viewer)) notFound();
  const sp = await searchParams;
  const thisMonth = monthOf(new Date(), viewer.workspace?.timezone ?? DEFAULT_TIME_ZONE);
  const month = parseMonth(sp.month, thisMonth);
  const monthParam = month === thisMonth ? null : month;
  if (!can(viewer, "timesheets.manage")) redirect(timesheetRoutes.mine(monthParam));

  const locale = resolveLocale((await getUserPreferences(viewer.user.id)).preferredLanguage);
  const status = parseSheetStatus(sp.status);
  const all = await listTimesheets(viewer, { month });
  const rows = status ? all.filter((r) => r.status === status) : all;
  const approved = all.filter((r) => r.status === "APPROVED");
  const pay = approved.reduce((n, r) => n + (r.amountCents ?? 0), 0);

  return (
    <TimesheetFrame month={month} thisMonth={thisMonth} locale={locale} at={(m) => timesheetRoutes.staff({ month: m, status })} tabs={viewer.membership !== null} current="staff">
      <PageTitle
        icon={<ReceiptText />}
        title="Timesheets"
        description={monthLabel(month, locale)}
        properties={
          <StatTiles>
            <StatTile label="To approve" value={String(all.filter((r) => r.status === "SUBMITTED").length)} />
            <StatTile label="Approved" value={`${approved.length} of ${all.length}`} />
            <StatTile label="Approved pay" value={formatRand(pay)} />
          </StatTiles>
        }
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <PageSection id="staff">
        <LinkSelect
          label="Show"
          value={status ?? "all"}
          options={[
            { value: "all", label: `Everyone (${all.length})`, href: timesheetRoutes.staff({ month: monthParam }) },
            ...SHEET_STATUSES.map((s) => ({
              value: s,
              label: `${sheetChip(s).label} (${all.filter((r) => r.status === s).length})`,
              href: timesheetRoutes.staff({ month: monthParam, status: s }),
            })),
          ]}
        />
        {rows.length === 0 ? (
          <Card className="p-0">
            <EmptyState compact illustration={<Scene name="nothing-to-grade" />} title="None here" description="No timesheets match for this month." />
          </Card>
        ) : (
          <StaffSheets rows={rows} month={month} />
        )}
      </PageSection>
      <PayrollDownloads month={month} locale={locale} approved={approved.length} />
    </TimesheetFrame>
  );
}
