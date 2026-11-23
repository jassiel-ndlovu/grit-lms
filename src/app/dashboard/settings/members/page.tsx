/**
 * /dashboard/settings/members — the workspace's staff and invites (#174;
 * a/ux/01, section 5). Needs `members.invite` or `members.role`. Only the
 * owner (or a Nexa admin) can invite admins. In an organisation, people with
 * `members.role` change roles here (viewer.md, "Roles and branches").
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { MemberList, type RoleChoices } from "@/components/settings/roles/member-list";
import { assignableRoles, grantsOf, roleRoutes, roleRows } from "@/components/settings/roles/role-ui";
import { importRoutes } from "@/components/imports/import-ui";
import { Button } from "@/components/ui/button";
import { InviteList, InviteStaffForm, type InviteRow } from "@/features/courses/components/accounts/staff-invites";
import { listMembers } from "@/features/courses/lib/roster";
import { listInvites } from "@/features/auth/invite-actions";
import { listBranchesFor, listRolesFor } from "@/features/workspaces/roles";
import { can, getViewer, type Viewer } from "@/lib/viewer";

export const metadata = { title: "Members" };

/** What the viewer may give people, or null when they can't change roles. */
async function roleChoices(viewer: Viewer): Promise<RoleChoices | null> {
  const grants = grantsOf(viewer);
  if (!grants || !viewer.workspace || !can(viewer, "members.role")) return null;
  const [roles, { branches }] = await Promise.all([listRolesFor(viewer.workspace.id), listBranchesFor(viewer.workspace.id)]);
  return { grants, roles: assignableRoles(grants, roleRows(roles)), branches: branches.map(({ id, name }) => ({ id, name })) };
}

export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const invitesPeople = can(viewer, "members.invite");
  if (!viewer.workspace || !(invitesPeople || can(viewer, "members.role"))) redirect("/dashboard/settings");

  const [members, invitesRes, choices] = await Promise.all([listMembers(viewer), invitesPeople ? listInvites({}) : undefined, roleChoices(viewer)]);
  const invites: InviteRow[] = (invitesRes?.data ?? []).map((i) => ({
    ...i,
    createdAt: String(i.createdAt),
    expiresAt: String(i.expiresAt),
  }));
  const canInviteAdmins = viewer.membership?.role === "OWNER" || viewer.persona === "admin";

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Members" }]}
      actions={
        invitesPeople ? (
          <Button asChild variant="outline" size="sm">
            <Link href={importRoutes.start("staff")}>
              <FileUp className="size-3.5" /> Import staff
            </Link>
          </Button>
        ) : null
      }
    >
      <PageTitle
        title="Members"
        description={
          <>
            The people who work at {viewer.workspace.name}.
            {invitesPeople ? " Invite someone by email; they join when they sign in with that address." : ""}
            {choices ? (
              <>
                {" "}
                <Link href={roleRoutes.index} className="text-foreground underline underline-offset-2">
                  See what each role can do
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />

      {invitesPeople ? (
        <section aria-labelledby="invite-heading" className="border-border space-y-4 rounded-lg border p-5">
          <h2 id="invite-heading" className="text-foreground text-sm font-semibold">
            Invite people
          </h2>
          <InviteStaffForm canInviteAdmins={canInviteAdmins} />
        </section>
      ) : null}

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-foreground text-sm font-semibold">
          {members.length === 1 ? "1 member" : `${members.length} members`}
        </h2>
        <MemberList members={members} choices={choices} />
      </section>

      {invitesPeople ? (
        <section aria-labelledby="invites-heading" className="space-y-3">
          <h2 id="invites-heading" className="text-foreground text-sm font-semibold">
            Invites
          </h2>
          {invitesRes?.data ? (
            <InviteList invites={invites} />
          ) : (
            <p role="alert" className="text-muted-foreground text-sm">
              We couldn&apos;t load the invites just now. Refresh to try again.
            </p>
          )}
        </section>
      ) : null}
    </PageFrame>
  );
}
