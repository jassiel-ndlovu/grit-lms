/**
 * The frame of a tutor's course pages (UI draft "Course page"): a record
 * PageFrame (#205) with the course's views in the ribbon. Overview,
 * Lessons, Coverage, Services (billing on) and Settings are separate routes, so each
 * view has its own URL. The lesson editor passes `type="editor"`, the
 * settings views `type="settings"`.
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageFrame } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { RibbonNav } from "@/components/shell/ribbon";
import { isBillingEnabled } from "@/features/billing/errors";
import type { PageType } from "@/lib/ui-layout";

export const courseRoutes = {
  list: "/dashboard/manage-courses",
  overview: (id: string) => `/dashboard/manage-courses/${id}`,
  lessons: (id: string, lessonId?: string) =>
    `/dashboard/manage-courses/lessons/${id}${lessonId ? `?lesson=${lessonId}` : ""}`,
  settings: (id: string) => `/dashboard/manage-courses/${id}/settings`,
  services: (id: string) => `/dashboard/manage-courses/${id}/services`,
  coverage: (id: string) => `/dashboard/manage-courses/${id}/coverage`,
};

export function CourseFrame({
  course,
  page,
  actions,
  type = "record",
  children,
}: {
  course: { id: string; name: string };
  /** The last crumb after the course name, e.g. "Lessons". Omit on the overview. */
  page?: string;
  actions?: React.ReactNode;
  type?: PageType;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Courses", href: courseRoutes.list },
    { label: course.name, href: page ? courseRoutes.overview(course.id) : undefined },
  ];
  if (page) crumbs.push({ label: page });

  return (
    <PageFrame
      type={type}
      breadcrumb={crumbs}
      actions={actions}
      secondary={
        <RibbonNav
          label="Course"
          links={[
            { label: "Overview", href: courseRoutes.overview(course.id) },
            { label: "Lessons", href: courseRoutes.lessons(course.id) },
            { label: "Coverage", href: courseRoutes.coverage(course.id) },
            // Premium services exist only with billing on (BILLING=1).
            ...(isBillingEnabled() ? [{ label: "Services", href: courseRoutes.services(course.id) }] : []),
            { label: "Settings", href: courseRoutes.settings(course.id) },
          ]}
        />
      }
    >
      {children}
    </PageFrame>
  );
}
