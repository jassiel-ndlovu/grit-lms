/**
 * /dashboard/imports — bring students or staff in from a CSV (#216, on A's
 * engine #221). Choose a kind, get a template, pick a file; the preview
 * opens on the job's page. Below, the recent imports. Needs
 * `learners.invite` (students) or `members.invite` (staff); A's actions
 * check again.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportStart } from "@/components/imports/import-start";
import { IMPORT_STATUS, importRoutes, rowsLabel } from "@/components/imports/import-ui";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { listImportTypes, listImports } from "@/features/imports/actions";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Imports" };

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !(can(viewer, "learners.invite") || can(viewer, "members.invite"))) redirect("/dashboard");

  const [{ kind }, typesRes, jobsRes] = await Promise.all([searchParams, listImportTypes({}), listImports({})]);
  const types = typesRes?.data ?? [];
  const jobs = jobsRes?.data ?? [];

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Imports" }]}>
      <PageTitle
        title="Import from a spreadsheet"
        description="Add many students or staff at once from a CSV file. You check every row before anything changes."
      />

      <section aria-labelledby="start-heading" className="space-y-3">
        <h2 id="start-heading" className="text-foreground text-sm font-semibold">
          New import
        </h2>
        <ImportStart types={types} initialKind={kind ?? null} />
      </section>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-foreground text-sm font-semibold">
          Recent imports
        </h2>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No imports yet.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={importRoutes.job(j.id)} className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-foreground block font-medium [overflow-wrap:anywhere]">{j.fileName}</span>
                    <span className="text-muted-foreground block text-xs">
                      {j.title} · {rowsLabel(j.rowCount)} · {formatDateTime(j.createdAt, { timeZone: DEFAULT_TIME_ZONE })}
                    </span>
                  </span>
                  <StatusChip tone={IMPORT_STATUS[j.status].tone}>{IMPORT_STATUS[j.status].label}</StatusChip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageFrame>
  );
}
