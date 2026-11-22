/**
 * The frame of a learner's course pages (#205): a record PageFrame with
 * My courses › course in the header and Overview / Lessons in the ribbon,
 * like CourseFrame on the tutor's side. The lesson reader passes
 * `type="editor"` for its full width (tree beside the lesson).
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageFrame } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { RibbonNav } from "@/components/shell/ribbon";
import type { PageType } from "@/lib/ui-layout";

export const studentCourseRoutes = {
  list: "/dashboard/courses",
  overview: (id: string) => `/dashboard/courses/${id}`,
  lessons: (id: string, lessonId?: string) => `/dashboard/courses/lessons/${id}${lessonId ? `?lesson=${lessonId}` : ""}`,
};

export function StudentCourseFrame({
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
    { label: "My courses", href: studentCourseRoutes.list },
    { label: course.name, href: page ? studentCourseRoutes.overview(course.id) : undefined },
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
            { label: "Overview", href: studentCourseRoutes.overview(course.id) },
            { label: "Lessons", href: studentCourseRoutes.lessons(course.id) },
          ]}
        />
      }
    >
      {children}
    </PageFrame>
  );
}
