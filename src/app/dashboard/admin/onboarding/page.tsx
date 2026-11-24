/** /dashboard/admin/onboarding: every organisation's set-up at a glance (Nexa admins; viewer.md "Bulk onboarding"). */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { adminOnboardingOverview } from "@/features/workspaces/rollout";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Onboarding" };

export default async function AdminOnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/admin/onboarding");
  if (viewer.persona !== "admin") notFound();
  const rows = await adminOnboardingOverview(viewer, { limit: 100 });
  return (
    <PageFrame type="list" breadcrumb={[{ label: "Onboarding" }]} helpHref={null}>
      <PageTitle title="Onboarding" description="Each organisation's set-up, newest first: its plan, how far through the checklist it is, and how many branches are live." />
      {rows.length === 0 ? <p className="text-muted-foreground text-sm">No organisations yet.</p> : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr><th className="py-2 pr-3 font-medium">Organisation</th><th className="py-2 pr-3 font-medium">Plan</th><th className="py-2 pr-3 font-medium">Checklist</th><th className="py-2 pr-3 font-medium">Branches</th></tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.workspaceId}>
                  <th scope="row" className="text-foreground py-2 pr-3 text-left font-medium">{r.name}</th>
                  <td className="py-2 pr-3">{r.plan === "CORE" ? "Core" : r.plan === "PLUS" ? "Plus" : r.plan === "PRO" ? "Pro" : r.plan}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.checklistDone} of {r.checklistTotal}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.branches ? `${r.live} live, ${r.pilot} in pilot, of ${r.branches}` : "None yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageFrame>
  );
}
