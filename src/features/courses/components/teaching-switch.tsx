"use client";

/**
 * The organisation's teaching switch (#206, owner decision 2026-11-21).
 *
 * Owner side, `TeachingOffButton`: strict. A warning names what changes,
 * says only Nexa support can undo it, and the owner types the
 * organisation's name before A's switchTeachingOff runs. A refusal (an
 * owner or admin still teaches a course) comes back as a written message.
 *
 * Nexa admin side, `TeachingOnButton`: A's adminSwitchTeachingOn, with the
 * note the audit log needs.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminSwitchTeachingOn } from "@/features/admin/workspace-actions";
import { switchTeachingOff } from "@/features/workspaces/actions";

import { actionError } from "../lib/account-ui";
import { confirmsName } from "../lib/teaching-ui";
import { TonePanel } from "@/components/ui/nexus";

export function TeachingOffButton({ organisationName }: { organisationName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const matches = confirmsName(typed, organisationName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    const res = await switchTeachingOff({ confirmName: typed });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "Teaching couldn't be switched off. Try again."));
    setOpen(false);
    toast.success("Teaching is off for this organisation.");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Switch teaching off…</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Switch teaching off for {organisationName}?</DialogTitle>
            <DialogDescription>Your organisation will only run things. Its tutors keep teaching.</DialogDescription>
          </DialogHeader>
          <TonePanel tone="danger" role="note" className="space-y-2 p-3 text-sm">
            <p className="text-foreground flex items-center gap-2 font-semibold">
              <AlertTriangle aria-hidden className="text-destructive size-4 shrink-0" />
              You can&apos;t undo this yourself
            </p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>Owners and admins stop teaching and aren&apos;t listed as tutors.</li>
              <li>The Organisation / Tutor switch goes away.</li>
              <li>New courses need a tutor: you&apos;ll assign one.</li>
              <li>
                <strong className="text-foreground">Only Nexa support can switch teaching back on.</strong>
              </li>
            </ul>
          </TonePanel>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-name">
              Type <span className="text-foreground font-semibold">{organisationName}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !matches ? true : undefined}
            />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep teaching
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || busy}>
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Switch teaching off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeachingOnButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminSwitchTeachingOn({ workspaceId, note });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "Teaching couldn't be switched on. Try again."));
    setOpen(false);
    setNote("");
    toast.success(`Teaching is back on for ${name}.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Switch teaching on…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Switch teaching back on for {name}?</DialogTitle>
            <DialogDescription>
              Its owners and admins can teach again and get the Organisation / Tutor switch. The note goes in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="teaching-note">Note</Label>
            <Textarea
              id="teaching-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Who asked, and why"
            />
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
            <Button type="submit" disabled={note.trim().length < 3 || busy}>
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Switch on
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
