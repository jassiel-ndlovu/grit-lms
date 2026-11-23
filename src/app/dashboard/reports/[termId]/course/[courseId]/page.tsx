/**
 * /dashboard/reports/[termId]/course/[courseId] — a course's students with
 * their figures for the term, and a comment box each.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { CourseComments } from "@/features/grades/components/term-reports/views";
import { commentsText, reportRoutes } from "@/features/grades/lib/term-report";
import { courseReports, getTerm, reportStaff } from "@/features/grades/term-reports";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Report comments" };

export default async function TermCoursePage({ params }: { params: Promise<{ termId: string; courseId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const staff = reportStaff(viewer);
  if (!staff) notFound();
  const { termId, courseId } = await params;
  const term = await getTerm(termId, staff.workspaceId);
  if (!term) notFound();
  const found = await courseReports(term, courseId, staff);
  if (!found) notFound();
  const { course, canEdit, reports } = found;
  const written = reports.filter((r) => r.courses.some((c) => c.comment)).length;

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Term reports", href: reportRoutes.home }, { label: term.title, href: reportRoutes.term(term.id) }, { label: course.name }]}
    >
      <PageTitle
        eyebrow={term.title}
        title={course.name}
        description={
          reports.length === 0
            ? undefined
            : `${commentsText(written, reports.length)}.${canEdit ? ` Comments save as you write.${term.releasedAt ? " Families see changes in new downloads." : ""}` : ""}`
        }
      />
      {reports.length === 0 ? (
        <Card className="p-0">
          <EmptyState compact illustration={<Scene name="empty-courses" />} title="No students in this term" description="Students enrolled on this course during the term show here." />
        </Card>
      ) : (
        <CourseComments termId={term.id} courseId={course.id} reports={reports} canEdit={canEdit} />
      )}
    </PageFrame>
  );
}
