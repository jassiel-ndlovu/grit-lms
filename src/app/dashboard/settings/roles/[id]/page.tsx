/**
 * /dashboard/settings/roles/[id] — change one of the organisation's own
 * roles. A role holding more than the viewer's own is a 404 here, as A's
 * updateRole refuses it.
 */

import { notFound, redirect } from "next/navigation";

import { RoleEditor } from "@/components/settings/roles/role-editor";
import { count, grantsOf, roleRoutes, withinGrants } from "@/components/settings/roles/role-ui";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { listRolesFor } from "@/features/workspaces/roles";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Edit role · Settings" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const grants = grantsOf(viewer);
  if (!grants || !can(viewer, "members.role")) notFound();

  const { id } = await params;
  const role = (await listRolesFor(viewer.workspace!.id)).custom.find((r) => r.id === id);
  if (!role || !withinGrants(grants, role)) notFound();

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Roles", href: roleRoutes.index }, { label: role.name }]}
    >
      <PageTitle
        title={role.name}
        description={role.members ? `${count(role.members, "person has", "people have")} this role. Changes reach them straight away.` : "Nobody has this role yet."}
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <RoleEditor
        key={role.updatedAt}
        grants={grants}
        draft={{ roleId: role.id, name: role.name, basedOn: role.basedOn, scope: role.scope, permissions: role.permissions, members: role.members }}
      />
    </PageFrame>
  );
}
