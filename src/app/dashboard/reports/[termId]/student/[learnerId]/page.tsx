/**
 * /dashboard/reports/[termId]/student/[learnerId] — one student's report for
 * staff: what the PDF will say, the general comment, and the download.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { DownloadReport, StudentReportBody } from "@/features/grades/components/term-reports/views";
import { reportRoutes } from "@/features/grades/lib/term-report";
import { getTerm, reportStaff, studentReport } from "@/features/grades/term-reports";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Student report" };

export default async function StudentReportPage({ params }: { params: Promise<{ termId: string; learnerId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const staff = reportStaff(viewer);
  if (!staff) notFound();
  const { termId, learnerId } = await params;
  const term = await getTerm(termId, staff.workspaceId);
  if (!term) notFound();
  const view = await studentReport(term, learnerId, staff);
  if (!view) notFound();

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Term reports", href: reportRoutes.home }, { label: term.title, href: reportRoutes.term(term.id) }, { label: view.report.name }]}
      actions={view.complete ? <DownloadReport termId={term.id} learnerId={view.report.learnerId} /> : undefined}
    >
      <PageTitle eyebrow={term.title} title={view.report.name} description="Released marks only. Work that was due and has no mark shows a dash." />
      <StudentReportBody termId={term.id} report={view.report} overall={view.overall} complete={view.complete} canEditOverall={view.canEditOverall} />
    </PageFrame>
  );
}
