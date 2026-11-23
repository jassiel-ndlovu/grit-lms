/**
 * GET /dashboard/reports/[termId]/student/[learnerId]/pdf — the report as a
 * PDF, rendered on request and never stored. `termReportPdfFor` decides who
 * may have it; anyone else gets a 404, so it never confirms a student exists.
 */

import { termReportPdfFor } from "@/features/grades/term-reports";
import { pdfResponse, renderTermReportPdf, termReportFileName } from "@/features/reports/term-report-pdf";
import { getViewer } from "@/lib/viewer";

export async function GET(_req: Request, { params }: { params: Promise<{ termId: string; learnerId: string }> }) {
  const viewer = await getViewer();
  const { termId, learnerId } = await params;
  const data = viewer ? await termReportPdfFor(viewer, termId, learnerId) : null;
  if (!data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return pdfResponse(await renderTermReportPdf(data), termReportFileName(data.student.name, data.term.title));
}
