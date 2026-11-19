/**
 * The frame of a tutor's test pages, like CourseFrame for courses: one
 * PageHeader (Tests › course › test, the Published or Draft chip) and a
 * ribbon with the test's views. Questions, Submissions and Preview are
 * separate routes, so each view keeps its own URL.
 *
 * Server component; RibbonNav (client) lights the current view.
 */

import { PageHeader, type Crumb } from "@/components/shell/page-header";
import { Ribbon, RibbonNav } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { courseRoutes } from "@/features/courses/components/course-frame";

export const testRoutes = {
  list: "/dashboard/tutor-tests",
  create: "/dashboard/tutor-tests/new",
  questions: (id: string) => `/dashboard/tutor-tests/${id}/edit`,
  submissions: (id: string) => `/dashboard/tutor-tests/${id}/submissions`,
  preview: (id: string) => `/dashboard/tutor-tests/${id}/preview`,
};

export function TestFrame({
  test,
  page,
  actions,
  children,
}: {
  test: { id: string; title: string; isActive: boolean | null; courseId: string; course: { name: string } };
  /** The view's name, the last crumb: "Questions", "Submissions" or "Preview". */
  page: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Tests", href: testRoutes.list },
    { label: test.course.name, href: courseRoutes.overview(test.courseId) },
    { label: test.title, href: testRoutes.questions(test.id) },
    { label: page },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={crumbs}
        status={<StatusChip tone={test.isActive ? "success" : "neutral"}>{test.isActive ? "Published" : "Draft"}</StatusChip>}
        actions={actions}
      />
      <Ribbon>
        <RibbonNav
          label="Test"
          links={[
            { label: "Questions", href: testRoutes.questions(test.id) },
            { label: "Submissions", href: testRoutes.submissions(test.id) },
            { label: "Preview", href: testRoutes.preview(test.id) },
          ]}
        />
      </Ribbon>
      {children}
    </>
  );
}
