/**
 * /dashboard/imports/[jobId] — one import: preview and fix, confirm,
 * progress, results and undo (#216). A's getImport checks the viewer may
 * see the job; anything else is a 404.
 */

import { notFound, redirect } from "next/navigation";

import { ImportJob } from "@/components/imports/import-job";
import { IMPORT_STATUS, importRoutes } from "@/components/imports/import-ui";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { getImport } from "@/features/imports/actions";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Import" };

export default async function ImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const { jobId } = await params;
  const res = await getImport({ jobId });
  const view = res?.data;
  if (!view) notFound();
  const status = IMPORT_STATUS[view.status];

  return (
    <PageFrame
      type="record"
      width="full"
      breadcrumb={[{ label: "Imports", href: importRoutes.home }, { label: view.fileName }]}
      status={<StatusChip tone={status.tone}>{status.label}</StatusChip>}
    >
      <PageTitle title={view.title} description={view.fileName} />
      <ImportJob key={view.id} initial={view} />
    </PageFrame>
  );
}
