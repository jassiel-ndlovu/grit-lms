"use client";

/**
 * One team: its name and branch, its members and who leads it, and its
 * courses (viewer.md, "Roles and branches"). A course in a team belongs to
 * that team's branch, so a branch role reaches it. A's role-actions check
 * every change again.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Pencil, Plus, X } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actionError } from "@/features/courses/lib/account-ui";
import type { TeamDetail } from "@/features/courses/lib/teams";
import { setCourseTeam, setTeamMember, updateTeam } from "@/features/workspaces/role-actions";

import { NameDialog } from "./branch-teams";

type ActionResult = { data?: unknown; serverError?: string; validationErrors?: unknown } | undefined;

const NO_BRANCH = "none";

/** Runs one change at a time and shows what went wrong beside it. */
function useChange() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  async function change(key: string, run: () => Promise<ActionResult>): Promise<boolean> {
    setBusy(key);
    setError(null);
    const res = await run();
    setBusy(null);
    if (!res?.data) {
      setError(actionError(res, "That couldn't be changed. Try again."));
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }
  return { busy, error, change };
}

function ChangeError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

export function RenameTeamButton({ teamId, name }: { teamId: string; name: string }) {
  return (
    <WriteGuard label="Rename">
      <NameDialog
        trigger={
          <Button variant="outline" size="sm">
            <Pencil aria-hidden className="size-3.5" /> Rename
          </Button>
        }
        title="Rename team"
        description="Everyone sees the new name straight away."
        label="Team name"
        initial={name}
        submitLabel="Save name"
        run={(n) => updateTeam({ teamId, name: n })}
      />
    </WriteGuard>
  );
}

/** `branches` are the ones the viewer may use; `allowNone` for whole-organisation roles. */
export function TeamBranch({ team, branches, allowNone }: { team: TeamDetail; branches: Array<{ id: string; name: string }>; allowNone: boolean }) {
  const { busy, error, change } = useChange();
  const id = React.useId();
  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor={id}>Branch</Label>
      <WriteGuard label={team.branchName ?? "No branch"}>
        <Select
          value={team.branchId ?? NO_BRANCH}
          disabled={busy != null}
          onValueChange={(v) => void change("branch", () => updateTeam({ teamId: team.id, branchId: v === NO_BRANCH ? null : v }))}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value={NO_BRANCH}>No branch</SelectItem> : null}
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WriteGuard>
      <ChangeError error={error} />
    </div>
  );
}

export function TeamMembers({ team }: { team: TeamDetail }) {
  const { busy, error, change } = useChange();
  const [adding, setAdding] = React.useState("");
  return (
    <div className="space-y-3">
      {team.members.length ? (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {team.members.map((m) => (
            <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="text-foreground flex flex-wrap items-center gap-2 font-medium">
                  {m.name}
                  {m.isLead ? (
                    <Badge variant="secondary">
                      <Crown aria-hidden className="size-3" /> Leads the team
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted-foreground block text-xs">{m.roleName}</span>
              </span>
              <WriteGuard label="Change">
                <span className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy != null}
                    onClick={() => void change(m.membershipId, () => setTeamMember({ teamId: team.id, membershipId: m.membershipId, member: true, isLead: !m.isLead }))}
                    aria-label={m.isLead ? `Stop ${m.name} leading the team` : `Make ${m.name} lead the team`}
                  >
                    {busy === m.membershipId ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Crown aria-hidden className="size-3.5" />}
                    {m.isLead ? "Stop leading" : "Make lead"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy != null}
                    onClick={() => void change(m.membershipId, () => setTeamMember({ teamId: team.id, membershipId: m.membershipId, member: false }))}
                    aria-label={`Remove ${m.name} from the team`}
                  >
                    <X aria-hidden className="size-3.5" /> Remove
                  </Button>
                </span>
              </WriteGuard>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Nobody is on this team yet.</p>
      )}
      <ChangeError error={error} />
      {team.others.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="w-64 max-w-full" aria-label="Person to add">
              <SelectValue placeholder="Choose a person" />
            </SelectTrigger>
            <SelectContent>
              {team.others.map((p) => (
                <SelectItem key={p.membershipId} value={p.membershipId}>
                  {p.name} ({p.roleName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <WriteGuard label="Add person" size="default">
            <Button
              variant="outline"
              disabled={!adding || busy != null}
              onClick={async () => {
                if (await change("add", () => setTeamMember({ teamId: team.id, membershipId: adding, member: true }))) setAdding("");
              }}
            >
              {busy === "add" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />} Add person
            </Button>
          </WriteGuard>
        </div>
      ) : null}
    </div>
  );
}

/** `canClear`: take a course out of every team (whole-organisation roles only). */
export function TeamCourses({ team, canClear }: { team: TeamDetail; canClear: boolean }) {
  const { busy, error, change } = useChange();
  const [adding, setAdding] = React.useState("");
  const picked = team.movable.find((c) => c.id === adding);
  return (
    <div className="space-y-3">
      {team.courses.length ? (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {team.courses.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="text-foreground min-w-0 font-medium [overflow-wrap:anywhere]">{c.name}</span>
              {canClear ? (
                <WriteGuard label="Remove">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy != null}
                    onClick={() => void change(c.id, () => setCourseTeam({ courseId: c.id, teamId: null }))}
                    aria-label={`Take ${c.name} out of the team`}
                  >
                    {busy === c.id ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <X aria-hidden className="size-3.5" />} Remove
                  </Button>
                </WriteGuard>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No courses in this team yet.</p>
      )}
      <ChangeError error={error} />
      {team.movable.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <Select value={adding} onValueChange={setAdding}>
              <SelectTrigger className="w-64 max-w-full" aria-label="Course to add">
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {team.movable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.teamName ? ` (in ${c.teamName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <WriteGuard label="Add course" size="default">
              <Button
                variant="outline"
                disabled={!adding || busy != null}
                onClick={async () => {
                  if (await change("add", () => setCourseTeam({ courseId: adding, teamId: team.id }))) setAdding("");
                }}
              >
                {busy === "add" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />} Add course
              </Button>
            </WriteGuard>
          </div>
          {picked?.teamName ? <p className="text-muted-foreground text-xs">This moves it out of {picked.teamName}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
