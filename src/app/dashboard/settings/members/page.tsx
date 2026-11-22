/**
 * /dashboard/settings/members — the workspace's staff and invites (#174;
 * a/ux/01, section 5). Needs `members.invite`. Only the owner (or a Nexa
 * admin) can invite admins.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { InviteList, InviteStaffForm, type InviteRow } from "@/features/courses/components/accounts/staff-invites";
import { listMembers } from "@/features/courses/lib/roster";
import { listInvites } from "@/features/auth/invite-actions";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Members" };

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", TUTOR: "Tutor" };

export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "members.invite")) redirect("/dashboard/settings");

  const [members, invitesRes] = await Promise.all([listMembers(viewer), listInvites({})]);
  const invites: InviteRow[] = (invitesRes?.data ?? []).map((i) => ({
    ...i,
    createdAt: String(i.createdAt),
    expiresAt: String(i.expiresAt),
  }));
  const canInviteAdmins = viewer.membership?.role === "OWNER" || viewer.persona === "admin";

  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Members" }]}>
      <PageTitle
        title="Members"
        description={
          <>
            The tutors and admins at {viewer.workspace.name}. Invite someone by email; they join when they sign in with that
            address.
          </>
        }
      />

      <section aria-labelledby="invite-heading" className="border-border space-y-4 rounded-lg border p-5">
        <h2 id="invite-heading" className="text-foreground text-sm font-semibold">
          Invite people
        </h2>
        <InviteStaffForm canInviteAdmins={canInviteAdmins} />
      </section>

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-foreground text-sm font-semibold">
          {members.length === 1 ? "1 member" : `${members.length} members`}
        </h2>
        <ul className="divide-border border-border divide-y rounded-lg border">
          {members.map((m) => (
            <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="text-foreground block font-medium">{m.name}</span>
                <span className="text-muted-foreground block truncate text-xs">{m.email}</span>
              </span>
              <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
            </li>
          ))}
        </ul>
      </section>

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
    </PageFrame>
  );
}
