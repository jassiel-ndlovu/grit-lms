"use client";

/**
 * Cover for a class: ask for it, pick who covers, call it off. A's actions
 * check everything again and tell the people concerned.
 */

import * as React from "react";
import { Check, Loader2, UserRoundSearch, X } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assignCoverAction, cancelCoverAction, coverCandidatesAction, requestCoverAction } from "@/features/staff/actions";

import { candidateNote } from "../../lib/staff-time-ui";
import { useRun } from "./use-run";

type Candidate = { membershipId: string; name: string; teachesCourse: boolean; sameSubject: boolean };
type Person = { membershipId: string; name: string };

/* ------------------------------------------------------------------------- */
/* Asking                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * "I need cover" for their own class, or (a manager) cover for someone who
 * teaches the course. A manager goes on to pick who covers.
 */
export function RequestCoverDialog({ open, onClose, eventId, occurrenceStart, what, forOthers, onAsked }: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  occurrenceStart: string;
  /** "Mathematics Grade 10, Tue 1 Dec at 14:00". */
  what: string;
  /** Managers: the people who might be away. Null for one's own class. */
  forOthers: Person[] | null;
  onAsked: (coverId: string) => void;
}) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [reason, setReason] = React.useState("");
  const [absent, setAbsent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const picked = absent ?? (forOthers?.length === 1 ? forOthers[0].membershipId : null);

  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setAbsent(null);
    setError(null);
  }, [open]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (forOthers && !picked) return setError("Choose who is away.");
    setError(null);
    const r = await run(
      () => requestCoverAction({ eventId, occurrenceStart: new Date(occurrenceStart), absentMembershipId: forOthers ? (picked ?? undefined) : undefined, reason: reason.trim() || null }),
      { done: forOthers ? undefined : "Cover asked for.", onError: setError },
    );
    if (r) onAsked(r.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={ask} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{forOthers ? "Arrange cover" : "Ask for cover"}</DialogTitle>
            <DialogDescription>
              {what}. {forOthers ? "Next, pick who covers it." : "Whoever arranges cover sees your request on the Cover page."}
            </DialogDescription>
          </DialogHeader>
          {forOthers ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-who`}>Who is away</Label>
              <Select value={picked ?? ""} onValueChange={setAbsent}>
                <SelectTrigger id={`${id}-who`} className="w-full">
                  <SelectValue placeholder="Choose a tutor" />
                </SelectTrigger>
                <SelectContent>
                  {forOthers.map((p) => (
                    <SelectItem key={p.membershipId} value={p.membershipId}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-why`}>Reason (optional)</Label>
            <Textarea id={`${id}-why`} value={reason} maxLength={300} rows={2} onChange={(e) => setReason(e.target.value)} />
            <p className="text-muted-foreground text-xs">The tutor who covers sees it.</p>
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              {forOthers ? "Choose who covers" : "Ask for cover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* Arranging                                                                 */
/* ------------------------------------------------------------------------- */

/** The free tutors for a request, best match first. */
export function CandidateList({ candidates, picked, onPick, name }: { candidates: Candidate[]; picked: string | null; onPick: (id: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Free tutors" className="divide-border border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
      {candidates.map((c) => (
        <label key={c.membershipId} className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-4 py-2.5">
          <input type="radio" name={name} value={c.membershipId} checked={picked === c.membershipId} onChange={() => onPick(c.membershipId)} className="accent-primary size-4 shrink-0" />
          <span className="min-w-0">
            <span className="text-foreground block text-sm break-words">{c.name}</span>
            <span className="text-muted-foreground block text-xs empty:hidden">{candidateNote(c)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function AssignCoverDialog({ coverId, onClose, what, current }: {
  /** Null while closed. */
  coverId: string | null;
  onClose: () => void;
  what: string;
  /** Who covers now, when it's being changed. */
  current: Person | null;
}) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [list, setList] = React.useState<Candidate[] | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!coverId) return;
    let live = true;
    setList(null);
    setPicked(null);
    setError(null);
    coverCandidatesAction({ coverId })
      .catch(() => null)
      .then((r) => {
        if (!live) return;
        if (r?.data) setList(r.data);
        else setError(r?.serverError ?? "The list of tutors didn't load. Close this and try again.");
      });
    return () => {
      live = false;
    };
  }, [coverId]);

  const choice = list?.find((c) => c.membershipId === picked) ?? null;

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!coverId || !picked) return setError("Choose a tutor.");
    setError(null);
    const r = await run(() => assignCoverAction({ coverId, coverMembershipId: picked }), { done: "Cover arranged.", onError: setError });
    if (r) onClose();
  }

  return (
    <Dialog open={coverId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={assign} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{current ? "Change who covers" : "Who covers?"}</DialogTitle>
            <DialogDescription>
              {what}. {current ? `${current.name} covers it now.` : "These tutors are free then."}
            </DialogDescription>
          </DialogHeader>
          {list === null && !error ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Checking who is free
            </p>
          ) : null}
          {list?.length === 0 ? <p className="text-foreground text-sm">None of the tutors you manage is free then.</p> : null}
          {list && list.length > 0 ? <CandidateList candidates={list} picked={picked} onPick={setPicked} name={id} /> : null}
          {choice && !choice.teachesCourse ? (
            <p className="text-muted-foreground text-sm">{choice.name} joins the course until a day after the class.</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {current ? "Cancel" : "Later"}
            </Button>
            <Button type="submit" disabled={pending || !picked}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              Arrange cover
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Arrange, change or call off cover that has been asked for. */
export function CoverButtons({ cover, what, manages, mine }: {
  cover: { id: string; status: "OPEN" | "ASSIGNED"; cover: Person | null };
  what: string;
  manages: boolean;
  /** The viewer is the one away. */
  mine: boolean;
}) {
  const { pending, run } = useRun();
  const [arranging, setArranging] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const open = cover.status === "OPEN";
  const mayCancel = manages || (mine && open);
  const arrange = open ? "Arrange cover" : "Change who covers";

  async function callOff() {
    const r = await run(() => cancelCoverAction({ coverId: cover.id }), { done: "Cover called off." });
    if (r) setConfirm(false);
  }

  return (
    <>
      {manages ? (
        <WriteGuard label={arrange}>
          <Button type="button" size="sm" variant={open ? "default" : "outline"} aria-label={`${arrange}: ${what}`} onClick={() => setArranging(true)}>
            <UserRoundSearch aria-hidden className="size-4" />
            {arrange}
          </Button>
        </WriteGuard>
      ) : null}
      {mayCancel ? (
        <WriteGuard label="Call off">
          <Button type="button" size="sm" variant="ghost" aria-label={`Call off cover: ${what}`} onClick={() => setConfirm(true)}>
            <X aria-hidden className="size-4" />
            Call off
          </Button>
        </WriteGuard>
      ) : null}
      <AssignCoverDialog coverId={arranging ? cover.id : null} onClose={() => setArranging(false)} what={what} current={cover.cover} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Call off this cover?</AlertDialogTitle>
            <AlertDialogDescription>
              {what}. {cover.cover ? `Let ${cover.cover.name} know, because Nexa doesn't tell them.` : "The class goes back to its own tutor."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void callOff();
              }}
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
              Call off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
