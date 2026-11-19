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

type TestView = "questions" | "submissions" | "preview";
const VIEW_LABEL: Record<TestView, string> = { questions: "Questions", submissions: "Submissions", preview: "Preview" };

export function TestFrame({
  test,
  page,
  view,
  actions,
  children,
}: {
  test: { id: string; title: string; isActive: boolean | null; courseId: string; course: { name: string } };
  /** The last crumb: the view's name, or a page inside a view (a student's name). */
  page: string;
  /** Set for a page inside a view: adds that view's crumb and lights its tab. */
  view?: TestView;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "Tests", href: testRoutes.list },
    { label: test.course.name, href: courseRoutes.overview(test.courseId) },
    { label: test.title, href: testRoutes.questions(test.id) },
  ];
  if (view) crumbs.push({ label: VIEW_LABEL[view], href: testRoutes[view](test.id) });
  crumbs.push({ label: page });

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
          current={view ? testRoutes[view](test.id) : undefined}
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
