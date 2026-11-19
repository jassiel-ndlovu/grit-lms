/**
 * The frame of a tutor's course pages (UI draft "Course page"): one
 * PageHeader and a ribbon with the course's views. Overview, Lessons and
 * Settings are separate routes, so each view has its own URL.
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageHeader, type Crumb } from "@/components/shell/page-header";
import { Ribbon, RibbonNav } from "@/components/shell/ribbon";

export const courseRoutes = {
  list: "/dashboard/manage-courses",
  overview: (id: string) => `/dashboard/manage-courses/${id}`,
  lessons: (id: string, lessonId?: string) =>
    `/dashboard/manage-courses/lessons/${id}${lessonId ? `?lesson=${lessonId}` : ""}`,
  settings: (id: string) => `/dashboard/manage-courses/${id}/settings`,
};

export function CourseFrame({
  course,
  page,
  actions,
  children,
}: {
  course: { id: string; name: string };
  /** The last crumb after the course name, e.g. "Lessons". Omit on the overview. */
  page?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Courses", href: courseRoutes.list },
    { label: course.name, href: page ? courseRoutes.overview(course.id) : undefined },
  ];
  if (page) crumbs.push({ label: page });

  return (
    <>
      <PageHeader breadcrumb={crumbs} actions={actions} />
      <Ribbon>
        <RibbonNav
          label="Course"
          links={[
            { label: "Overview", href: courseRoutes.overview(course.id) },
            { label: "Lessons", href: courseRoutes.lessons(course.id) },
            { label: "Settings", href: courseRoutes.settings(course.id) },
          ]}
        />
      </Ribbon>
      {children}
    </>
  );
}
