/**
 * /design-system/roles — the role, member-role, and branches-and-teams
 * screens (viewer.md, "Roles and branches") with sample data and no
 * session. Buttons that reach the server refuse here. Same gate as
 * /design-system.
 */

import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { BranchCard, NewBranchButton, NewTeamButton, TeamList } from "@/components/settings/roles/branch-teams";
import { MemberList } from "@/components/settings/roles/member-list";
import { RoleEditor } from "@/components/settings/roles/role-editor";
import { RoleList } from "@/components/settings/roles/role-list";
import { assignableRoles, roleRows, type Grants } from "@/components/settings/roles/role-ui";
import { TeamBranch, TeamCourses, TeamMembers } from "@/components/settings/roles/team-editor";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { WorkspaceAccessProvider } from "@/components/shell/workspace-access";
import type { MemberRow } from "@/features/courses/lib/roster";
import type { TeamDetail } from "@/features/courses/lib/teams";
import { ASSIGNABLE_PRESETS, ROLE_PRESETS, type PresetKey } from "@/lib/roles";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Roles · Design system", robots: { index: false } };

const grantsAs = (key: PresetKey, branchIds: string[] = []): Grants => ({ permissions: [...ROLE_PRESETS[key].permissions], scope: ROLE_PRESETS[key].scope, branchIds });
const ADMIN = grantsAs("ADMIN");

const ROLES = roleRows({
  presets: ["OWNER" as const, ...ASSIGNABLE_PRESETS].map((k) => ({
    ...ROLE_PRESETS[k], permissions: [...ROLE_PRESETS[k].permissions], assignable: k !== "OWNER", members: k === "TUTOR" ? 12 : k === "OWNER" ? 1 : 0,
  })),
  custom: [
    { key: "custom:r1", id: "r1", name: "Head of department", basedOn: "TUTOR", scope: "BRANCHES", permissions: [...ROLE_PRESETS.TUTOR.permissions, "reports.view"], members: 2 },
    { key: "custom:r2", id: "r2", name: "Marker", basedOn: "ASSISTANT_TUTOR", scope: "OWN_COURSES", permissions: ["courses.edit", "grades.view"], members: 0 },
  ],
});

const person = (id: string, name: string, key: PresetKey, branches: MemberRow["branches"] = [], isSelf = false): MemberRow => ({
  membershipId: id, name, email: `${name.split(" ")[0].toLowerCase()}@example.test`, isSelf,
  roleKey: key, roleName: ROLE_PRESETS[key].name, scope: ROLE_PRESETS[key].scope, permissions: [...ROLE_PRESETS[key].permissions], branches,
});
const BRANCHES = [{ id: "b1", name: "Cape Town" }, { id: "b2", name: "Durban" }];
const MEMBERS = [
  person("m1", "Lerato Mokoena", "OWNER"),
  person("m2", "Sam Naidoo", "ADMIN", [], true),
  person("m3", "Thabo Khumalo", "BRANCH_MANAGER", BRANCHES),
  person("m4", "Priya Pillay", "SUPPORT"),
  person("m5", "Johan Botha", "TUTOR"),
];

const TEAM: TeamDetail = {
  id: "t1", name: "Grade 10 Mathematics", branchId: "b1", branchName: "Cape Town",
  members: [
    { membershipId: "m5", name: "Johan Botha", roleName: "Tutor", isLead: true },
    { membershipId: "m4", name: "Priya Pillay", roleName: "Support staff", isLead: false },
  ],
  others: [{ membershipId: "m3", name: "Thabo Khumalo", roleName: "Branch manager" }],
  courses: [{ id: "c1", name: "Functions and algebra" }],
  movable: [{ id: "c2", name: "Trigonometry", teamName: null }, { id: "c3", name: "Mechanics", teamName: "Physical Sciences" }],
};

export default function RolesPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <WorkspaceAccessProvider readOnly={false}>
        <PageFrame type="settings" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Roles" }]}>
          <PageTitle icon={<ShieldCheck />} title="Roles" description="Roles, member roles, branches and teams, as an admin sees them." />
          <PageSection id="own" title="The organisation's roles">
            <RoleList roles={ROLES.filter((r) => r.id != null)} grants={ADMIN} label="The organisation's roles" />
          </PageSection>
          <PageSection id="built-in" title="Built-in roles">
            <RoleList roles={ROLES.filter((r) => r.id == null)} grants={ADMIN} label="Built-in roles" />
          </PageSection>
          <PageSection id="members" title="Members">
            <MemberList members={MEMBERS} choices={{ grants: ADMIN, roles: assignableRoles(ADMIN, ROLES), branches: BRANCHES }} />
          </PageSection>
          <PageSection id="branches" title="Branches and teams" actions={<NewBranchButton />}>
            <div className="grid gap-4">
              <BranchCard
                manage
                remove
                branch={{ id: "b1", name: "Cape Town", people: 1, teams: [{ id: "t1", name: "Grade 10 Mathematics", courses: 1, members: 2 }, { id: "t2", name: "Physical Sciences", courses: 0, members: 0 }] }}
              />
              <BranchCard manage={false} remove={false} branch={{ id: "b2", name: "Durban", people: 0, teams: [] }} />
            </div>
          </PageSection>
          <PageSection id="no-branch" title="Teams without a branch" actions={<NewTeamButton branchId={null} />}>
            <div className="border-border rounded-lg border">
              <TeamList manage teams={[{ id: "t3", name: "Accounting", courses: 3, members: 1 }]} />
            </div>
          </PageSection>
          <PageSection id="team" title="One team">
            <TeamBranch team={TEAM} branches={BRANCHES} allowNone />
            <TeamMembers team={TEAM} />
            <TeamCourses team={TEAM} canClear />
          </PageSection>
          <PageSection id="editor" title="Editing a role" description="As a branch manager, who can't give what they don't hold.">
            <RoleEditor
              grants={grantsAs("BRANCH_MANAGER", ["b1"])}
              draft={{ roleId: "r1", name: "Head of department", basedOn: "TUTOR", scope: "OWN_COURSES", permissions: ["courses.edit", "grades.view", "billing.view"], members: 2 }}
            />
          </PageSection>
        </PageFrame>
      </WorkspaceAccessProvider>
    </div>
  );
}
