/**
 * /dashboard/cover — cover for absent tutors (viewer.md Draft 1.24,
 * organisations). Managers with `cover.manage` see the staff they manage and
 * arrange it; a tutor sees what they asked for and what they cover. Asking
 * is on the calendar. `?view=past` for the past and cancelled.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, UserRoundSearch } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { CoverDays } from "@/features/events/components/staff-time/cover-views";
import { coverRoutes, parseCoverView } from "@/features/events/lib/staff-time-ui";
import { coverRows, hasStaffTime } from "@/features/events/staff-time";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Cover" };

export default async function CoverPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!hasStaffTime(viewer)) notFound();
  const view = parseCoverView((await searchParams).view);
  const now = new Date();
  const [prefs, rows] = await Promise.all([getUserPreferences(viewer.user.id), coverRows(viewer, view, now)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const manages = can(viewer, "cover.manage");
  const me = viewer.membership?.id ?? null;
  const open = rows.filter((r) => r.status === "OPEN");
  const arranged = rows.filter((r) => r.status !== "OPEN");
  const days = (list: typeof rows) => <CoverDays rows={list} ctx={ctx} now={now} me={me} newestFirst={view === "past"} />;
  const calendar = (
    <Button asChild size="sm" variant="outline">
      <Link href="/dashboard/calendar">
        <CalendarDays aria-hidden className="size-4" />
        Open the calendar
      </Link>
    </Button>
  );

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Cover" }]}
      actions={calendar}
      secondary={
        <RibbonNav
          label="Cover"
          links={[
            { label: "Upcoming", href: coverRoutes.list("upcoming") },
            { label: "Past and cancelled", href: coverRoutes.list("past") },
          ]}
          current={coverRoutes.list(view)}
        />
      }
    >
      <PageTitle
        icon={<UserRoundSearch />}
        title="Cover"
        description={
          manages
            ? "Classes whose tutor is away, and who takes them. Ask for cover by opening a class on the calendar."
            : "Classes you need someone to take, and classes you take for others. Ask for cover by opening your class on the calendar."
        }
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      {rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            compact
            illustration={<Scene name="calendar-empty" />}
            title={view === "past" ? "No past or cancelled cover" : "No cover needed"}
            description={view === "past" ? "Cover from the last three months shows here." : "Cover for the next three months shows here."}
          />
        </Card>
      ) : view === "past" ? (
        <PageSection id="past" title="Last three months">{days(rows)}</PageSection>
      ) : (
        <>
          {open.length > 0 ? (
            <PageSection id="open" title={`Needs cover (${open.length})`}>
              {days(open)}
            </PageSection>
          ) : null}
          {arranged.length > 0 ? (
            <PageSection id="arranged" title={`Arranged (${arranged.length})`}>
              {days(arranged)}
            </PageSection>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
