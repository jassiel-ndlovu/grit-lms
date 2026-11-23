/**
 * /dashboard/settings/branches/teams/[id] — one team: its branch, people
 * and courses (viewer.md, "Roles and branches"). Needs `teams.manage`, and
 * the team's branch for a branch manager.
 */

import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";

import { branchesWithin, grantsOf, managesTeam, roleRoutes } from "@/components/settings/roles/role-ui";
import { RenameTeamButton, TeamBranch, TeamCourses, TeamMembers } from "@/components/settings/roles/team-editor";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { getTeamDetail } from "@/features/courses/lib/teams";
import { prisma } from "@/lib/db";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Team · Settings" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamPage({ params }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const grants = grantsOf(viewer);
  if (!grants || !can(viewer, "teams.manage")) notFound();

  const { id } = await params;
  const [team, branches] = await Promise.all([
    getTeamDetail(viewer, id),
    prisma.branch.findMany({ where: { workspaceId: viewer.workspace!.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!team || !managesTeam(grants, team.branchId)) notFound();
  const whole = grants.scope === "WORKSPACE";

  return (
    <PageFrame
      type="settings"
      breadcrumb={[
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Branches and teams", href: roleRoutes.branches },
        { label: team.name },
      ]}
      actions={<RenameTeamButton teamId={team.id} name={team.name} />}
    >
      <PageTitle icon={<Users />} eyebrow={team.branchName ?? "No branch"} title={team.name} />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <TeamBranch team={team} branches={branchesWithin(grants, branches)} allowNone={whole} />
      <PageSection id="people" title="People" description="Being on a team doesn't change what someone can do; their role does.">
        <TeamMembers team={team} />
      </PageSection>
      <PageSection id="courses" title="Courses" description="A course is in one team at most.">
        <TeamCourses team={team} canClear={whole} />
      </PageSection>
    </PageFrame>
  );
}
