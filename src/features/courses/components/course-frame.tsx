/**
 * The frame of a tutor's course pages (UI draft "Course page"): a record
 * PageFrame (#205) with the course's views in the ribbon. Overview,
 * Lessons, Coverage, Practice (Plus), Study chats (Pro), Services (billing on) and Settings are separate routes, so each
 * view has its own URL. The lesson editor passes `type="editor"`, the
 * settings views `type="settings"`.
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageFrame } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { RibbonNav } from "@/components/shell/ribbon";
import { hasPractice } from "@/features/assessments/practice-queries";
import { isBillingEnabled } from "@/features/billing/errors";
import type { PageType } from "@/lib/ui-layout";

import { studyRoutes } from "../lib/study-ui";
import { hasStudyAssistant } from "../study";

export const courseRoutes = {
  list: "/dashboard/manage-courses",
  overview: (id: string) => `/dashboard/manage-courses/${id}`,
  lessons: (id: string, lessonId?: string) =>
    `/dashboard/manage-courses/lessons/${id}${lessonId ? `?lesson=${lessonId}` : ""}`,
  settings: (id: string) => `/dashboard/manage-courses/${id}/settings`,
  services: (id: string) => `/dashboard/manage-courses/${id}/services`,
  coverage: (id: string) => `/dashboard/manage-courses/${id}/coverage`,
  practice: (id: string, setId?: string) => `/dashboard/manage-courses/${id}/practice${setId ? `/${setId}` : ""}`,
};

export async function CourseFrame({
  course,
  page,
  parent,
  current,
  actions,
  type = "record",
  children,
}: {
  course: { id: string; name: string };
  /** The last crumb after the course name, e.g. "Lessons". Omit on the overview. */
  page?: string;
  /** A crumb between the course and the page, for a page inside a view. */
  parent?: Crumb;
  /** The view to light for a page inside a view. */
  current?: string;
  actions?: React.ReactNode;
  type?: PageType;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Courses", href: courseRoutes.list },
    { label: course.name, href: page ? courseRoutes.overview(course.id) : undefined },
  ];
  if (parent) crumbs.push(parent);
  if (page) crumbs.push({ label: page });
  const [practice, assistant] = await Promise.all([hasPractice(course.id), hasStudyAssistant(course.id)]);

  return (
    <PageFrame
      type={type}
      breadcrumb={crumbs}
      actions={actions}
      secondary={
        <RibbonNav
          label="Course"
          current={current}
          links={[
            { label: "Overview", href: courseRoutes.overview(course.id) },
            { label: "Lessons", href: courseRoutes.lessons(course.id) },
            { label: "Coverage", href: courseRoutes.coverage(course.id) },
            ...(practice ? [{ label: "Practice", href: courseRoutes.practice(course.id) }] : []),
            ...(assistant ? [{ label: "Study chats", href: studyRoutes.chats(course.id) }] : []),
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
