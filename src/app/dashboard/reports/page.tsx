/**
 * /dashboard/reports — a workspace's report terms (contracts/term-reports.md).
 * Staff with `grades.view`; the owner and admins add terms.
 */

import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { TermDialogButton } from "@/features/grades/components/term-reports/term-controls";
import { TermList } from "@/features/grades/components/term-reports/views";
import { termPhase } from "@/features/grades/lib/term-report";
import { listTerms, reportStaff } from "@/features/grades/term-reports";
import { getUserPreferences } from "@/features/users/preferences";
import { resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Term reports" };

export default async function TermReportsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const staff = reportStaff(viewer);
  if (!staff) notFound();

  const [terms, prefs] = await Promise.all([listTerms(staff.workspaceId), getUserPreferences(viewer.user.id)]);
  const now = new Date();
  const locale = resolveLocale(prefs.preferredLanguage);

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Gradebook", href: "/dashboard/gradebook" }, { label: "Term reports" }]} actions={staff.manages && terms.length > 0 ? <TermDialogButton /> : undefined}>
      <PageTitle icon={<FileText />} title="Term reports" description="Marks, attendance and comments for a term, as a PDF for each student." />
      {terms.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            compact
            illustration={<Scene name="nothing-to-grade" />}
            title="No terms yet"
            description={staff.manages ? "Add a term with its first and last day. Tutors then write their comments." : "The owner or an admin adds the terms. Then you can write your comments."}
            action={staff.manages ? <TermDialogButton /> : undefined}
          />
        </Card>
      ) : (
        <TermList
          locale={locale}
          terms={terms.map((t) => ({ id: t.id, title: t.title, startsOn: t.startsOn, endsOn: t.endsOn, released: t.releasedAt !== null, phase: termPhase(t.startsOn, t.endsOn, t.workspace.timezone, now) }))}
        />
      )}
    </PageFrame>
  );
}
