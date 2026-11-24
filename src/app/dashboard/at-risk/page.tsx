/**
 * /dashboard/at-risk — students the daily check picked out (viewer.md Draft
 * 1.20, Pro). Staff with `grades.view`, narrowed to their courses.
 * `?status=closed` shows closed alerts, `?course=` one course.
 *
 * A's notifications link to /dashboard/courses/<id>/at-risk, which comes here.
 */

import { notFound, redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { alertRows, alertsSwitchedOn, seesAlerts } from "@/features/activity/at-risk";
import { AlertCourseFilter, AlertList, NoAlerts } from "@/features/activity/components/at-risk/views";
import { alertCourses, atRiskRoutes, parseAlertView } from "@/features/activity/lib/at-risk";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "At risk" };

interface PageProps {
  searchParams: Promise<{ status?: string | string[]; course?: string | string[] }>;
}

export default async function AtRiskPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!seesAlerts(viewer)) notFound();

  const sp = await searchParams;
  const view = parseAlertView(sp.status);
  const courseId = typeof sp.course === "string" && sp.course ? sp.course : null;

  const [all, prefs] = await Promise.all([alertRows(viewer, view), getUserPreferences(viewer.user.id)]);
  const rows = courseId ? all.filter((a) => a.course.id === courseId) : all;
  const switchedOn = all.length > 0 || (await alertsSwitchedOn(viewer));
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "At risk" }]}
      secondary={
        <RibbonNav
          label="Alerts"
          links={[
            { label: "Open", href: atRiskRoutes.view("open", courseId) },
            { label: "Closed", href: atRiskRoutes.view("closed", courseId) },
          ]}
          current={atRiskRoutes.view(view, courseId)}
        />
      }
    >
      <PageTitle
        icon={<LifeBuoy />}
        title="At risk"
        description="Students whose marks, missed work or attendance need a look. Families see nothing until you share it."
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <PageSection id="alerts">
        <AlertCourseFilter view={view} courses={alertCourses(all)} current={courseId} total={all.length} />
        {rows.length === 0 ? <NoAlerts view={view} switchedOn={switchedOn} /> : <AlertList rows={rows} ctx={ctx} />}
      </PageSection>
    </PageFrame>
  );
}
