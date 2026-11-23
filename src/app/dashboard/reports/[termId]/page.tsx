/**
 * /dashboard/reports/[termId] — one term: its courses (to write comments)
 * and its students (to read and download reports). The owner and admins
 * edit, release and delete it here.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { DeleteTermButton, ReleaseTermButton, TermDialogButton } from "@/features/grades/components/term-reports/term-controls";
import { TermCourses, termDays, TermStatus, TermStudents } from "@/features/grades/components/term-reports/views";
import { reportRoutes, termPhase } from "@/features/grades/lib/term-report";
import { getTerm, reportStaff, termOverview } from "@/features/grades/term-reports";
import { getUserPreferences } from "@/features/users/preferences";
import { resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Term report" };

export default async function TermPage({ params }: { params: Promise<{ termId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const staff = reportStaff(viewer);
  if (!staff) notFound();
  const { termId } = await params;
  const term = await getTerm(termId, staff.workspaceId);
  if (!term) notFound();

  const [{ courses, students }, prefs] = await Promise.all([termOverview(term, staff), getUserPreferences(viewer.user.id)]);
  const released = term.releasedAt !== null;
  const missing = courses.reduce((n, c) => n + c.students - c.written, 0);

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Gradebook", href: "/dashboard/gradebook" }, { label: "Term reports", href: reportRoutes.home }, { label: term.title }]}
      status={<TermStatus released={released} phase={termPhase(term.startsOn, term.endsOn, term.workspace.timezone, new Date())} />}
      actions={staff.manages ? <ReleaseTermButton termId={term.id} released={released} missing={missing} /> : undefined}
    >
      <PageTitle
        title={term.title}
        actions={staff.manages ? <TermDialogButton term={{ id: term.id, title: term.title, startsOn: term.startsOn, endsOn: term.endsOn }} /> : undefined}
        description={`${termDays(term.startsOn, term.endsOn, resolveLocale(prefs.preferredLanguage))}. ${released ? "Families can download these reports." : "Only staff can see these reports."}`}
      />
      {courses.length === 0 ? (
        <Card className="p-0">
          <EmptyState compact illustration={<Scene name="empty-courses" />} title="No students in this term" description="Students enrolled on your courses during the term show here." />
        </Card>
      ) : (
        <>
          <PageSection id="comments" title="Comments" description="Open a course to comment on each student.">
            <TermCourses termId={term.id} courses={courses} />
          </PageSection>
          <PageSection id="students" title="Students" description="Open a student to see and download the report.">
            <TermStudents termId={term.id} students={students} />
          </PageSection>
        </>
      )}
      {staff.manages && !released ? (
        <div>
          <DeleteTermButton termId={term.id} title={term.title} />
        </div>
      ) : null}
    </PageFrame>
  );
}
