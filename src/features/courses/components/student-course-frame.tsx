/**
 * The frame of a learner's course pages (#205): a record PageFrame with
 * My courses › course in the header and Overview / Lessons / Practice in the ribbon,
 * like CourseFrame on the tutor's side. The lesson reader passes
 * `type="editor"` for its full width (tree beside the lesson).
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageFrame } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { RibbonNav } from "@/components/shell/ribbon";
import { studentHasPractice } from "@/features/assessments/practice-queries";
import type { PageType } from "@/lib/ui-layout";

import { studentCourseRoutes } from "../lib/student-routes";

export { studentCourseRoutes };

export async function StudentCourseFrame({
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
    { label: "My courses", href: studentCourseRoutes.list },
    { label: course.name, href: page ? studentCourseRoutes.overview(course.id) : undefined },
  ];
  if (parent) crumbs.push(parent);
  if (page) crumbs.push({ label: page });
  const practice = await studentHasPractice(course.id);
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
            { label: "Overview", href: studentCourseRoutes.overview(course.id) },
            { label: "Lessons", href: studentCourseRoutes.lessons(course.id) },
            ...(practice ? [{ label: "Practice", href: studentCourseRoutes.practice(course.id) }] : []),
          ]}
        />
      }
    >
      {children}
    </PageFrame>
  );
}
