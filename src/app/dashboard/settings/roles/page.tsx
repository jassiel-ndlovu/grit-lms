/**
 * /dashboard/settings/roles — an organisation's roles: its own and the
 * built-in ones (viewer.md, "Roles and branches"). Needs `members.role`.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";

import { RoleList } from "@/components/settings/roles/role-list";
import { grantsOf, roleRoutes, roleRows } from "@/components/settings/roles/role-ui";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote, WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { listRolesFor } from "@/features/workspaces/roles";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Roles · Settings" };

export default async function RolesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const grants = grantsOf(viewer);
  if (!grants || !can(viewer, "members.role")) notFound();

  const roles = roleRows(await listRolesFor(viewer.workspace!.id));
  const own = roles.filter((r) => r.id != null);

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Roles" }]}
      actions={
        <WriteGuard label="New role" variant="default">
          <Button asChild size="sm">
            <Link href={roleRoutes.new("TUTOR")}>
              <Plus aria-hidden className="size-3.5" /> New role
            </Link>
          </Button>
        </WriteGuard>
      }
    >
      <PageTitle
        icon={<ShieldCheck />}
        title="Roles"
        description={
          <>
            What each role can do, and where. Give people a role on the{" "}
            <Link href="/dashboard/settings/members" className="text-foreground underline underline-offset-2">
              Members page
            </Link>
            .
          </>
        }
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <PageSection id="own" title="Your organisation's roles" description="Copy a role and change what it can do.">
        {own.length ? (
          <RoleList roles={own} grants={grants} label="Your organisation's roles" />
        ) : (
          <p className="text-muted-foreground text-sm">None yet. The built-in roles below cover most organisations.</p>
        )}
      </PageSection>
      <PageSection id="built-in" title="Built-in roles" description="These can't be changed.">
        <RoleList roles={roles.filter((r) => r.id == null)} grants={grants} label="Built-in roles" />
      </PageSection>
    </PageFrame>
  );
}
