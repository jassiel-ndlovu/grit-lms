"use client";

/**
 * What people do with a month's timesheet: add suggested classes and other
 * work, change and remove entries, submit it, and (managers) decide on it
 * and set pay. A's actions check everything again.
 */

import * as React from "react";
import { Check, Loader2, Pencil, Plus, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addTimesheetEntryAction, addTimesheetSuggestionsAction, decideTimesheetAction, removeTimesheetEntryAction, setPayRateAction,
  submitTimesheetAction, updateTimesheetEntryAction,
} from "@/features/staff/actions";

import { wallToInstant } from "../../lib/calendar-ui";
import { lastDayOf, parseDuration, parseRate, rateInput } from "../../lib/staff-time-ui";
import { useRun } from "./use-run";

const Icon = ({ pending, children }: { pending: boolean; children: React.ReactNode }) =>
  pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <>{children}</>;

/* ------------------------------------------------------------------------- */
/* Entries                                                                   */
/* ------------------------------------------------------------------------- */

/** Adds some of the suggested classes. */
export function AddSuggestions({ timesheetId, keys, label, what }: { timesheetId: string; keys: string[]; label: string; what: string }) {
  const { pending, run } = useRun();
  return (
    <WriteGuard label={label}>
      <Button
        type="button"
        size="sm"
        variant={keys.length > 1 ? "outline" : "ghost"}
        disabled={pending}
        aria-label={`${label}: ${what}`}
        onClick={() => run(() => addTimesheetSuggestionsAction({ timesheetId, keys }), { done: keys.length === 1 ? "Added." : `Added ${keys.length}.` })}
      >
        <Icon pending={pending}>
          <Plus aria-hidden className="size-4" />
        </Icon>
        {label}
      </Button>
    </WriteGuard>
  );
}

function FormError({ id, children }: { id: string; children: string | null }) {
  return children ? (
    <p id={id} role="alert" className="text-destructive text-sm">
      {children}
    </p>
  ) : null;
}

function DurationFields({ hours, minutes, onHours, onMinutes }: { hours: string; minutes: string; onHours: (v: string) => void; onMinutes: (v: string) => void }) {
  const id = React.useId();
  return (
    <div className="flex gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={`${id}-h`}>Hours</Label>
        <Input id={`${id}-h`} inputMode="numeric" value={hours} maxLength={2} placeholder="0" onChange={(e) => onHours(e.target.value)} />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={`${id}-m`}>Minutes</Label>
        <Input id={`${id}-m`} inputMode="numeric" value={minutes} maxLength={2} placeholder="0" onChange={(e) => onMinutes(e.target.value)} />
      </div>
    </div>
  );
}

const NO_COURSE = "none";

/** Marking, preparation, meetings: work the calendar doesn't know about. */
export function AddWorkButton({ timesheetId, month, timeZone, courses, defaultDay }: {
  timesheetId: string;
  month: string;
  timeZone: string;
  courses: Array<{ id: string; name: string }>;
  /** The day the form opens on, inside the month. */
  defaultDay: string;
}) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const blank = { label: "", day: defaultDay, time: "09:00", hours: "1", minutes: "", course: NO_COURSE, note: "" };
  const [f, setF] = React.useState(blank);
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = parseDuration(f.hours, f.minutes);
    if (!f.label.trim()) return setError("Say what you did.");
    if (!f.day || !f.time) return setError("Choose a date and time.");
    if ("error" in d) return setError(d.error);
    setError(null);
    const r = await run(
      () =>
        addTimesheetEntryAction({
          timesheetId, startsAt: wallToInstant(f.day, f.time, timeZone), minutes: d.minutes, label: f.label.trim(),
          courseId: f.course === NO_COURSE ? null : f.course, note: f.note.trim() || null,
        }),
      { done: "Added.", onError: setError },
    );
    if (r) setOpen(false);
  }

  return (
    <WriteGuard label="Add other work">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setF(blank);
          setError(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        Add other work
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add other work</DialogTitle>
              <DialogDescription>Marking, preparation or a meeting.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-what`}>What you did</Label>
              <Input id={`${id}-what`} value={f.label} maxLength={200} onChange={(e) => set("label")(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`${id}-day`}>Date</Label>
                <Input id={`${id}-day`} type="date" value={f.day} min={`${month}-01`} max={lastDayOf(month)} onChange={(e) => set("day")(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`${id}-time`}>Started at</Label>
                <Input id={`${id}-time`} type="time" value={f.time} onChange={(e) => set("time")(e.target.value)} />
              </div>
            </div>
            <DurationFields hours={f.hours} minutes={f.minutes} onHours={set("hours")} onMinutes={set("minutes")} />
            {courses.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-course`}>Course (optional)</Label>
                <Select value={f.course} onValueChange={set("course")}>
                  <SelectTrigger id={`${id}-course`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COURSE}>No course</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-note`}>Note (optional)</Label>
              <Textarea id={`${id}-note`} value={f.note} maxLength={300} rows={2} onChange={(e) => set("note")(e.target.value)} />
            </div>
            <FormError id={`${id}-error`}>{error}</FormError>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                <Icon pending={pending}>
                  <Plus aria-hidden className="size-4" />
                </Icon>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

export function EntryButtons({ entry }: { entry: { id: string; kind: string; label: string; minutes: number; note: string | null } }) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const start = { label: entry.label, hours: String(Math.floor(entry.minutes / 60)), minutes: String(entry.minutes % 60), note: entry.note ?? "" };
  const [f, setF] = React.useState(start);
  const set = (k: keyof typeof start) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const manual = entry.kind === "MANUAL";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = parseDuration(f.hours, f.minutes);
    if ("error" in d) return setError(d.error);
    if (manual && !f.label.trim()) return setError("Say what you did.");
    setError(null);
    const r = await run(
      () => updateTimesheetEntryAction({ entryId: entry.id, minutes: d.minutes, note: f.note.trim() || null, ...(manual ? { label: f.label.trim() } : {}) }),
      { done: "Saved.", onError: setError },
    );
    if (r) setOpen(false);
  }

  return (
    <div className="flex shrink-0 gap-1">
      <WriteGuard label="Edit">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Edit ${entry.label}`}
          onClick={() => {
            setF(start);
            setError(null);
            setOpen(true);
          }}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
      </WriteGuard>
      <WriteGuard label="Remove">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={pending}
          aria-label={`Remove ${entry.label}`}
          onClick={() => run(() => removeTimesheetEntryAction({ entryId: entry.id }), { done: "Removed." })}
        >
          <Icon pending={pending && !open}>
            <Trash2 aria-hidden className="size-4" />
          </Icon>
        </Button>
      </WriteGuard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit entry</DialogTitle>
              <DialogDescription>{manual ? "Change what you did, how long it took or the note." : entry.label}</DialogDescription>
            </DialogHeader>
            {manual ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-what`}>What you did</Label>
                <Input id={`${id}-what`} value={f.label} maxLength={200} onChange={(e) => set("label")(e.target.value)} />
              </div>
            ) : null}
            <DurationFields hours={f.hours} minutes={f.minutes} onHours={set("hours")} onMinutes={set("minutes")} />
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-note`}>Note (optional)</Label>
              <Textarea id={`${id}-note`} value={f.note} maxLength={300} rows={2} onChange={(e) => set("note")(e.target.value)} />
            </div>
            <FormError id={`${id}-error`}>{error}</FormError>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                <Icon pending={pending}>
                  <Check aria-hidden className="size-4" />
                </Icon>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The sheet                                                                 */
/* ------------------------------------------------------------------------- */

export function SubmitSheet({ timesheetId, summary, leftOut, forName }: {
  timesheetId: string;
  /** "12 h 30 min in November 2026". */
  summary: string;
  /** Classes taught that aren't on it yet. */
  leftOut: number;
  /** A manager submitting for someone else. */
  forName: string | null;
}) {
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);

  async function submit() {
    const r = await run(() => submitTimesheetAction({ timesheetId }), { done: "Submitted for approval." });
    if (r) setOpen(false);
  }

  return (
    <WriteGuard label="Submit for approval" variant="default">
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Send aria-hidden className="size-4" />
        Submit for approval
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{forName ? `Submit ${forName}'s timesheet?` : "Submit this timesheet?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {summary}. {leftOut > 0 ? `${leftOut} ${leftOut === 1 ? "class isn't" : "classes aren't"} on it yet. ` : ""}
              Once it&apos;s submitted, it can&apos;t be changed unless it&apos;s sent back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Icon pending={pending}>
                <Send aria-hidden className="size-4" />
              </Icon>
              Submit for approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}

/** Approve, send back with a note, or reopen. */
export function DecideSheet({ timesheetId, status, name, summary }: {
  timesheetId: string;
  status: "SUBMITTED" | "APPROVED";
  name: string;
  /** Hours, and the pay when there's a rate. */
  summary: string;
}) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState<null | "APPROVED" | "REJECTED" | "DRAFT">(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function start(next: "APPROVED" | "REJECTED" | "DRAFT") {
    setNote("");
    setError(null);
    setOpen(next);
  }
  async function decide() {
    if (!open) return;
    if (open === "REJECTED" && !note.trim()) return setError("Say what needs changing.");
    const done = { APPROVED: "Approved.", REJECTED: "Sent back.", DRAFT: "Reopened." }[open];
    const r = await run(() => decideTimesheetAction({ timesheetId, decision: open, note: note.trim() || null }), { done, onError: setError });
    if (r) setOpen(null);
  }

  const TEXT = {
    APPROVED: { title: `Approve ${name}'s timesheet?`, body: `${summary}. The pay is worked out at today's rate.`, button: "Approve", icon: <Check aria-hidden className="size-4" /> },
    REJECTED: { title: "Send this timesheet back?", body: `${name} can change it and submit it again.`, button: "Send back", icon: <Undo2 aria-hidden className="size-4" /> },
    DRAFT: { title: "Reopen this timesheet?", body: `${name} can change it, and it comes off the payroll download until it's approved again.`, button: "Reopen", icon: <RotateCcw aria-hidden className="size-4" /> },
  };
  const t = open ? TEXT[open] : null;

  return (
    <>
      {status === "SUBMITTED" ? (
        <>
          <WriteGuard label="Approve" variant="default">
            <Button type="button" size="sm" onClick={() => start("APPROVED")}>
              <Check aria-hidden className="size-4" />
              Approve
            </Button>
          </WriteGuard>
          <WriteGuard label="Send back">
            <Button type="button" size="sm" variant="outline" onClick={() => start("REJECTED")}>
              <Undo2 aria-hidden className="size-4" />
              Send back
            </Button>
          </WriteGuard>
        </>
      ) : (
        <WriteGuard label="Reopen">
          <Button type="button" size="sm" variant="outline" onClick={() => start("DRAFT")}>
            <RotateCcw aria-hidden className="size-4" />
            Reopen
          </Button>
        </WriteGuard>
      )}
      <AlertDialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <AlertDialogContent>
          {t ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.title}</AlertDialogTitle>
                <AlertDialogDescription>{t.body}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor={id}>{open === "REJECTED" ? "What needs changing" : "Note (optional)"}</Label>
                <Textarea id={id} value={note} maxLength={500} rows={3} aria-invalid={error !== null} onChange={(e) => setNote(e.target.value)} />
                <FormError id={`${id}-error`}>{error}</FormError>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    void decide();
                  }}
                >
                  <Icon pending={pending}>{t.icon}</Icon>
                  {t.button}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PayRateButton({ membershipId, name, hourlyCents, label }: { membershipId: string; name: string; hourlyCents: number | null; label: string }) {
  const id = React.useId();
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = parseRate(value);
    if ("error" in r) return setError(r.error);
    setError(null);
    const ok = await run(() => setPayRateAction({ membershipId, hourlyCents: r.cents }), { done: "Pay rate saved.", onError: setError });
    if (ok) setOpen(false);
  }

  return (
    <WriteGuard label={label}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-mx-2"
        aria-label={`${hourlyCents === null ? "Set" : "Change"} ${name}'s pay rate`}
        onClick={() => {
          setValue(rateInput(hourlyCents));
          setError(null);
          setOpen(true);
        }}
      >
        {label}
        <Pencil aria-hidden className="text-muted-foreground size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Pay rate</DialogTitle>
              <DialogDescription>{name}&apos;s pay for an hour, used for timesheets approved from now on.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={id}>Rand an hour</Label>
              <Input id={id} inputMode="decimal" value={value} maxLength={12} placeholder="250" aria-invalid={error !== null} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => setValue(e.target.value)} />
              <FormError id={`${id}-error`}>{error}</FormError>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                <Icon pending={pending}>
                  <Check aria-hidden className="size-4" />
                </Icon>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}
