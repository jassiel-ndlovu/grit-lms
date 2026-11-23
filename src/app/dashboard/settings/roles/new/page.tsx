/**
 * /dashboard/settings/roles/new?from=<role key> — a new role, starting from
 * a built-in one or one of the organisation's own. Permissions the viewer
 * doesn't hold are left out of the copy.
 */

import { notFound, redirect } from "next/navigation";

import { RoleEditor } from "@/components/settings/roles/role-editor";
import { copyName, grantsOf, mayGrant, roleRoutes, scopeWithin } from "@/components/settings/roles/role-ui";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { listRolesFor } from "@/features/workspaces/roles";
import { can, getViewer } from "@/lib/viewer";
import type { Permission } from "@/lib/viewer-core";

export const metadata = { title: "New role · Settings" };

interface PageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

export default async function NewRolePage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const grants = grantsOf(viewer);
  if (!grants || !can(viewer, "members.role")) notFound();

  const { from } = await searchParams;
  const { presets, custom } = await listRolesFor(viewer.workspace!.id);
  const own = custom.find((r) => r.key === from);
  const source = own ?? presets.find((p) => p.key === from && p.key !== "OWNER") ?? presets.find((p) => p.key === "TUTOR")!;

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Roles", href: roleRoutes.index }, { label: "New role" }]}
    >
      <PageTitle title="New role" description={`Starts as a copy of ${source.name}. Change anything before you create it.`} />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <RoleEditor
        grants={grants}
        draft={{
          roleId: null,
          name: copyName(source.name, [...presets, ...custom].map((r) => r.name)),
          basedOn: own?.basedOn ?? source.key,
          scope: scopeWithin(grants.scope, source.scope) ? source.scope : grants.scope,
          permissions: source.permissions.filter((p) => mayGrant(grants, p as Permission)),
          members: 0,
        }}
      />
    </PageFrame>
  );
}
