/**
 * Roles: the organisation's own and the built-in ones, with what each can
 * do (viewer.md, "Roles and branches"). Display only; the page loads A's
 * listRolesFor and /design-system/roles passes samples.
 */

import Link from "next/link";
import { Copy, Pencil } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DeleteRoleButton } from "./role-editor";
import { count, permissionLabels, roleRoutes, scopeLabel, withinGrants, type Grants, type RoleRow } from "./role-ui";

export function RoleList({ roles, grants, label }: { roles: RoleRow[]; grants: Grants; label: string }) {
  return (
    <ul aria-label={label} className="divide-border border-border divide-y rounded-lg border">
      {roles.map((r) => (
        <RoleItem key={r.key} role={r} grants={grants} />
      ))}
    </ul>
  );
}

function RoleItem({ role: r, grants }: { role: RoleRow; grants: Grants }) {
  const held = permissionLabels(r.permissions);
  // A role holding more than the viewer's own can't be changed by them; copying one is fine, with their permissions only.
  const editable = r.id != null && withinGrants(grants, r);
  return (
    <li className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-foreground font-medium [overflow-wrap:anywhere]">{r.name}</h3>
          <p className="text-muted-foreground text-xs">
            {r.description ?? (r.basedOn ? `Made from ${r.basedOn}.` : null)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="outline">{scopeLabel(r.scope)}</Badge>
          <Badge variant="secondary">{count(r.members, "person", "people")}</Badge>
        </div>
      </div>
      <details className="group">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-xs underline-offset-2 hover:underline">
          {count(held.length, "permission")}
        </summary>
        <ul className="text-muted-foreground mt-2 grid list-disc gap-x-6 gap-y-0.5 pl-5 text-xs sm:grid-cols-2">
          {held.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            <WriteGuard label="Edit">
              <Button asChild variant="outline" size="sm">
                <Link href={roleRoutes.edit(r.id!)} aria-label={`Edit ${r.name}`}>
                  <Pencil aria-hidden className="size-3.5" /> Edit
                </Link>
              </Button>
            </WriteGuard>
            <WriteGuard label="Delete">
              <DeleteRoleButton roleId={r.id!} name={r.name} members={r.members} />
            </WriteGuard>
          </>
        ) : null}
        {r.key !== "OWNER" ? (
          <WriteGuard label="Copy">
            <Button asChild variant="ghost" size="sm">
              <Link href={roleRoutes.new(r.key)} aria-label={`Copy ${r.name} into a new role`}>
                <Copy aria-hidden className="size-3.5" /> Copy
              </Link>
            </Button>
          </WriteGuard>
        ) : null}
      </div>
    </li>
  );
}
