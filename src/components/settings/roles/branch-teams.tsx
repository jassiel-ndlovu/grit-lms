"use client";

/**
 * Branches and their teams (viewer.md, "Roles and branches"): an
 * organisation has branches, a branch has teams, and a course sits in a
 * team. A's role-actions check every change again.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionError } from "@/features/courses/lib/account-ui";
import { createBranch, createTeam, deleteBranch, deleteTeam, renameBranch } from "@/features/workspaces/role-actions";

import { count, roleRoutes } from "./role-ui";

export interface TeamSummary {
  id: string;
  name: string;
  courses: number;
  members: number;
}

export interface BranchSummary {
  id: string;
  name: string;
  people: number;
  teams: TeamSummary[];
}

type ActionResult = { data?: unknown; serverError?: string; validationErrors?: unknown } | undefined;

/** A button that asks for one name and runs an action with it. */
export function NameDialog({
  trigger, title, description, label, initial = "", submitLabel, run, onDone,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  label: string;
  initial?: string;
  submitLabel: string;
  run: (name: string) => Promise<ActionResult>;
  onDone?: (name: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Give it a name of at least 2 letters.");
    setBusy(true);
    setError(null);
    const res = await run(name.trim());
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "That couldn't be saved. Try again."));
    setOpen(false);
    onDone?.(name.trim());
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setName(initial);
        setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A delete button that confirms first; `blocked` explains why it can't be deleted yet. */
export function ConfirmDelete({
  name, what, blocked, run, onDone,
}: {
  name: string;
  what: "branch" | "team";
  blocked: string | null;
  run: () => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await run();
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "That couldn't be deleted. Try again."));
    setOpen(false);
    toast.success(`${name} is deleted.`);
    onDone?.();
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
          <AlertDialogDescription>{blocked ?? `The ${what} goes; nothing else does. You can't undo this.`}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{blocked ? "Close" : "Keep it"}</AlertDialogCancel>
          {blocked ? null : (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirm();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Delete {what}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NewBranchButton() {
  return (
    <WriteGuard label="New branch" variant="default">
      <NameDialog
        trigger={
          <Button size="sm">
            <Plus aria-hidden className="size-3.5" /> New branch
          </Button>
        }
        title="New branch"
        description="A place or part of your organisation, such as a campus or a city."
        label="Branch name"
        submitLabel="Create branch"
        run={(name) => createBranch({ name })}
        onDone={(name) => toast.success(`${name} is created.`)}
      />
    </WriteGuard>
  );
}

export function NewTeamButton({ branchId, branchName }: { branchId: string | null; branchName?: string }) {
  return (
    <WriteGuard label="New team">
      <NameDialog
        trigger={
          <Button variant="outline" size="sm" aria-label={branchName ? `New team in ${branchName}` : "New team without a branch"}>
            <Plus aria-hidden className="size-3.5" /> New team
          </Button>
        }
        title={branchName ? `New team in ${branchName}` : "New team"}
        description="A group of staff and the courses they run, such as a grade or a subject."
        label="Team name"
        submitLabel="Create team"
        run={(name) => createTeam({ name, branchId })}
        onDone={(name) => toast.success(`${name} is created.`)}
      />
    </WriteGuard>
  );
}

export function TeamList({ teams, manage }: { teams: TeamSummary[]; manage: boolean }) {
  return (
    <ul className="divide-border divide-y">
      {teams.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span className="flex min-w-0 items-start gap-2">
            <Users aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              {manage ? (
                <Link href={roleRoutes.team(t.id)} className="text-foreground font-medium underline-offset-2 hover:underline">
                  {t.name}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{t.name}</span>
              )}
              <span className="text-muted-foreground block text-xs">
                {count(t.members, "person", "people")} · {count(t.courses, "course")}
              </span>
            </span>
          </span>
          {manage ? (
            <WriteGuard label="Delete">
              <ConfirmDelete
                name={t.name}
                what="team"
                blocked={t.courses > 0 ? `It has ${count(t.courses, "course")}. Move ${t.courses === 1 ? "it" : "them"} to another team first.` : null}
                run={() => deleteTeam({ teamId: t.id })}
              />
            </WriteGuard>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** `manage`: change its teams and name. `remove`: delete it (whole-organisation roles only). */
export function BranchCard({ branch: b, manage, remove }: { branch: BranchSummary; manage: boolean; remove: boolean }) {
  const blocked = b.teams.length
    ? "Move or remove its teams first."
    : b.people
      ? `${count(b.people, "person works", "people work")} in this branch. Change their branches on the Members page first.`
      : null;
  return (
    <section aria-label={b.name} className="border-border divide-border divide-y rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold [overflow-wrap:anywhere]">{b.name}</h3>
          <p className="text-muted-foreground text-xs">
            {count(b.teams.length, "team")}
            {b.people ? ` · ${count(b.people, "person", "people")} with a branch role` : ""}
          </p>
        </div>
        {manage ? (
          <div className="flex flex-wrap items-center gap-2">
            <WriteGuard label="Rename">
              <NameDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Rename ${b.name}`}>
                    <Pencil aria-hidden className="size-3.5" /> Rename
                  </Button>
                }
                title="Rename branch"
                description="Everyone sees the new name straight away."
                label="Branch name"
                initial={b.name}
                submitLabel="Save name"
                run={(name) => renameBranch({ branchId: b.id, name })}
              />
            </WriteGuard>
            {remove ? (
              <WriteGuard label="Delete">
                <ConfirmDelete name={b.name} what="branch" blocked={blocked} run={() => deleteBranch({ branchId: b.id })} />
              </WriteGuard>
            ) : null}
            <NewTeamButton branchId={b.id} branchName={b.name} />
          </div>
        ) : null}
      </div>
      {b.teams.length ? <TeamList teams={b.teams} manage={manage} /> : <p className="text-muted-foreground p-4 text-sm">No teams yet.</p>}
    </section>
  );
}
