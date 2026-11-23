"use client";

/**
 * Makes or changes an organisation's own role (viewer.md, "Roles and
 * branches"): a name, where it applies and what it can do. A's createRole,
 * updateRole and deleteRole check every limit again.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionError } from "@/features/courses/lib/account-ui";
import { createRole, deleteRole, updateRole } from "@/features/workspaces/role-actions";
import type { RoleScope } from "@/lib/roles";
import type { Permission } from "@/lib/viewer-core";

import { count, mayGrant, NOT_NARROWED, PERMISSION_GROUPS, roleRoutes, SCOPES, scopeWithin, type Grants } from "./role-ui";

export interface RoleDraft {
  /** Set when changing a role. */
  roleId: string | null;
  name: string;
  basedOn: string;
  scope: RoleScope;
  permissions: string[];
  /** People on it now. */
  members: number;
}

export function RoleEditor({ draft, grants }: { draft: RoleDraft; grants: Grants }) {
  const router = useRouter();
  const [name, setName] = React.useState(draft.name);
  const [scope, setScope] = React.useState<RoleScope>(draft.scope);
  const [held, setHeld] = React.useState<ReadonlySet<string>>(() => new Set(draft.permissions));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  function toggle(key: string, on: boolean) {
    setHeld((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Give the role a name of at least 2 letters.");
    if (held.size === 0) return setError("Tick at least one permission.");
    setBusy(true);
    const input = { name: name.trim(), basedOn: draft.basedOn, permissions: [...held] as Permission[], scope };
    const res = draft.roleId ? await updateRole({ roleId: draft.roleId, ...input }) : await createRole(input);
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "The role couldn't be saved. Try again."));
    toast.success(draft.roleId ? `${input.name} is saved.` : `${input.name} is ready to give to people.`);
    router.push(roleRoutes.index);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <div className="max-w-md space-y-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-foreground text-base font-semibold">Where it applies</legend>
        <div className="grid gap-2">
          {SCOPES.map((s) => {
            const allowed = scopeWithin(grants.scope, s.value);
            return (
              <label
                key={s.value}
                className="border-border has-[:checked]:border-primary has-[:disabled]:opacity-60 flex items-start gap-3 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name={`${id}-scope`}
                  value={s.value}
                  checked={scope === s.value}
                  onChange={() => setScope(s.value)}
                  disabled={!allowed}
                  className="accent-primary mt-0.5 size-4"
                />
                <span>
                  <span className="text-foreground block font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{allowed ? s.description : "Wider than your own role."}</span>
                </span>
              </label>
            );
          })}
        </div>
        {draft.members > 0 && scope !== draft.scope ? (
          <p role="note" className="text-muted-foreground text-sm">
            {scope === "BRANCHES"
              ? `${count(draft.members, "person has", "people have")} this role and no branches yet. Until you choose their branches on the Members page, they only reach the courses they teach or own.`
              : `This changes what ${count(draft.members, "person", "people")} can reach.`}
          </p>
        ) : null}
      </fieldset>

      <div className="space-y-6">
        <h2 className="text-foreground text-base font-semibold">What it can do</h2>
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.title} className="space-y-2">
            <legend className="text-muted-foreground text-xs font-medium">{g.title}</legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.items.map((p) => {
                const mine = mayGrant(grants, p.key);
                const boxId = `${id}-${p.key}`;
                return (
                  <li key={p.key} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      id={boxId}
                      className="mt-0.5"
                      checked={held.has(p.key)}
                      onCheckedChange={(v) => toggle(p.key, v === true)}
                      // One they don't hold can still be unticked.
                      disabled={!mine && !held.has(p.key)}
                      aria-describedby={mine ? undefined : `${boxId}-why`}
                    />
                    <label htmlFor={boxId} className="min-w-0">
                      <span className="text-foreground">{p.label}</span>
                      {p.soon ? (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Coming
                        </Badge>
                      ) : null}
                      {scope !== "WORKSPACE" && NOT_NARROWED.has(p.key) ? (
                        <span className="text-muted-foreground block text-xs">For the whole organisation, even in this role.</span>
                      ) : null}
                      {mine ? null : (
                        <span id={`${boxId}-why`} className="text-muted-foreground block text-xs">
                          You don&apos;t have this yourself.
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <WriteGuard label={draft.roleId ? "Save role" : "Create role"} size="default" variant="default">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            {draft.roleId ? "Save role" : "Create role"}
          </Button>
        </WriteGuard>
        <Button asChild variant="outline">
          <Link href={roleRoutes.index}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

export function DeleteRoleButton({ roleId, name, members }: { roleId: string; name: string; members: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await deleteRole({ roleId });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "The role couldn't be deleted. Try again."));
    setOpen(false);
    toast.success(`${name} is deleted.`);
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${name}`}>
          <Trash2 aria-hidden className="size-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {members > 0
              ? `${count(members, "person has", "people have")} this role. Give them another role first.`
              : "Nobody has this role. You can't undo this."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{members > 0 ? "Close" : "Keep it"}</AlertDialogCancel>
          {members > 0 ? null : (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirm();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Delete role
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
