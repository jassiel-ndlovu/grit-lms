"use client";

/**
 * Members with their roles, and "Change role" for people who hold
 * members.role in an organisation (viewer.md, "Roles and branches"). A's
 * setMemberRole checks every limit again.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actionError } from "@/features/courses/lib/account-ui";
import type { MemberRow } from "@/features/courses/lib/roster";
import { setMemberRole } from "@/features/workspaces/role-actions";

import { branchesWithin, memberRoleLine, roleLock, scopeLabel, type Grants, type RoleOption } from "./role-ui";

export interface RoleChoices {
  grants: Grants;
  roles: RoleOption[];
  branches: Array<{ id: string; name: string }>;
}

/** `choices` is null for someone who can't change roles. */
export function MemberList({ members, choices }: { members: MemberRow[]; choices: RoleChoices | null }) {
  const [editing, setEditing] = React.useState<MemberRow | null>(null);
  return (
    <>
      <ul className="divide-border border-border divide-y rounded-lg border">
        {members.map((m) => {
          const locked = choices ? roleLock(choices.grants, m) : null;
          return (
            <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="text-foreground block font-medium">
                  {m.name}
                  {m.isSelf ? <span className="text-muted-foreground font-normal"> (you)</span> : null}
                </span>
                <span className="text-muted-foreground block truncate text-xs">{m.email}</span>
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full whitespace-normal">
                  {memberRoleLine(m)}
                </Badge>
                {choices && !locked ? (
                  <WriteGuard label="Change role">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(m)} aria-label={`Change role for ${m.name}`}>
                      <UserCog aria-hidden className="size-3.5" /> Change role
                    </Button>
                  </WriteGuard>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {choices && editing ? <ChangeRoleDialog key={editing.membershipId} member={editing} choices={choices} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ChangeRoleDialog({ member, choices, onClose }: { member: MemberRow; choices: RoleChoices; onClose: () => void }) {
  const router = useRouter();
  const [roleKey, setRoleKey] = React.useState(member.roleKey);
  const [branchIds, setBranchIds] = React.useState<string[]>(member.branches.map((b) => b.id));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const role = choices.roles.find((r) => r.key === roleKey);
  const branches = branchesWithin(choices.grants, choices.branches);
  // Ids outside the viewer's branches (a colleague's other branch) would be refused, so only theirs are sent.
  const picked = branchIds.filter((b) => branches.some((x) => x.id === b));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (role?.scope === "BRANCHES" && picked.length === 0) return setError("Choose at least one branch.");
    setBusy(true);
    const res = await setMemberRole({ membershipId: member.membershipId, roleKey, branchIds: role?.scope === "BRANCHES" ? picked : undefined });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "The role couldn't be changed. Try again."));
    toast.success(`${member.name} is now ${res.data.roleName}.`);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {member.name} is {memberRoleLine(member)}. A change takes effect straight away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-role`}>Role</Label>
            <Select value={roleKey} onValueChange={setRoleKey}>
              <SelectTrigger id={`${id}-role`} className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {choices.roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role ? (
              <p className="text-muted-foreground text-xs">
                {role.description ? `${role.description} ` : ""}
                {scopeLabel(role.scope)}.
              </p>
            ) : null}
          </div>
          {role?.scope === "BRANCHES" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Branches</legend>
              {branches.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  There are no branches to choose from yet. Add one under Settings, Branches and teams.
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {branches.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`${id}-${b.id}`}
                        checked={branchIds.includes(b.id)}
                        onCheckedChange={(v) => setBranchIds((s) => (v === true ? [...s, b.id] : s.filter((x) => x !== b.id)))}
                      />
                      <label htmlFor={`${id}-${b.id}`}>{b.name}</label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !role}>
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Change role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
