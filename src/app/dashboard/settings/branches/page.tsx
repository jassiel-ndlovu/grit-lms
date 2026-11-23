/**
 * /dashboard/settings/branches — an organisation's branches and teams
 * (viewer.md, "Roles and branches"). Seen with `teams.manage` or
 * `members.role`; changed with `teams.manage`, in a branch manager's own
 * branches only.
 */

import { notFound, redirect } from "next/navigation";
import { Network } from "lucide-react";

import { BranchCard, NewBranchButton, NewTeamButton, TeamList } from "@/components/settings/roles/branch-teams";
import { branchesWithin, grantsOf, managesTeam } from "@/components/settings/roles/role-ui";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { listBranchesFor } from "@/features/workspaces/roles";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Branches and teams · Settings" };

export default async function BranchesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const grants = grantsOf(viewer);
  if (!grants || !(can(viewer, "teams.manage") || can(viewer, "members.role"))) notFound();

  const { branches, teamsWithoutBranch } = await listBranchesFor(viewer.workspace!.id);
  const whole = grants.scope === "WORKSPACE";
  const addsBranches = whole && can(viewer, "teams.manage");
  const shown = branchesWithin(grants, branches);

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Branches and teams" }]}
      actions={addsBranches ? <NewBranchButton /> : null}
    >
      <PageTitle
        icon={<Network />}
        title="Branches and teams"
        description="A branch holds teams, and a team holds people and courses. Someone with a branch role reaches the courses in their branches' teams."
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <PageSection id="branches" title="Branches">
        {shown.length ? (
          <div className="grid gap-4">
            {shown.map((b) => (
              <BranchCard key={b.id} branch={b} manage={managesTeam(grants, b.id)} remove={addsBranches} />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            illustration={<Scene name="empty-courses" />}
            title="No branches yet"
            description={
              addsBranches
                ? "Add a branch for each place or part of your organisation. If you only have one, you don't need branches."
                : "There are no branches for you to look after yet."
            }
          />
        )}
      </PageSection>
      {whole ? (
        <PageSection
          id="teams"
          title="Teams without a branch"
          description="Branch roles don't reach these teams' courses."
          actions={managesTeam(grants, null) ? <NewTeamButton branchId={null} /> : null}
        >
          {teamsWithoutBranch.length ? (
            <div className="border-border rounded-lg border">
              <TeamList teams={teamsWithoutBranch} manage={managesTeam(grants, null)} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">None.</p>
          )}
        </PageSection>
      ) : null}
    </PageFrame>
  );
}
