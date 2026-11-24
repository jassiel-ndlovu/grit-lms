"use client";

/**
 * The fees list's actions (a/ux/04 §6; contracts/billing.md section 3):
 *   - New fee: one line for one student on one course (issueInvoice).
 *   - Mark paid off-site: cash, EFT to the tutor or other, for the full
 *     total, with a note (markInvoicePaidOffsite).
 *   - Void, with a reason (voidInvoice).
 * A refuses the last two while a parent's checkout holds the fee; its
 * message is shown as written.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, CircleEllipsis, Landmark, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { issueInvoice, markInvoicePaidOffsite, voidInvoice } from "@/features/payments/fee-actions";

import { noteProblem, parseRandToCents } from "../lib/admin-billing-ui";
import { formatRand } from "../lib/billing-ui";
import { payoutErrorMessage } from "../lib/payouts-ui";

const SELECT =
  "border-input bg-background h-9 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Today as YYYY-MM-DD on this device's clock and zone. */
function localToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

type Res = { data?: unknown; serverError?: string; validationErrors?: unknown } | undefined;
const failed = (res: Res) => (res?.validationErrors ? "Check the fields and try again." : payoutErrorMessage(res?.serverError));

/* ── New fee ──────────────────────────────────────────────────────────── */

export function NewFeeButton({ courses }: { courses: Array<{ id: string; name: string; learners: Array<{ learnerId: string; name: string }> }> }) {
  const [open, setOpen] = React.useState(false);
  const usable = courses.filter((c) => c.learners.length > 0);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={usable.length === 0} title={usable.length === 0 ? "No course has students yet" : undefined}>
        <Plus aria-hidden className="size-4" /> New fee
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{open ? <NewFeeForm courses={usable} onDone={() => setOpen(false)} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

function NewFeeForm({ courses, onDone }: { courses: Array<{ id: string; name: string; learners: Array<{ learnerId: string; name: string }> }>; onDone: () => void }) {
  const router = useRouter();
  const ids = React.useId();
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [learnerId, setLearnerId] = React.useState("");
  const [description, setDescription] = React.useState(courses[0] ? `${courses[0].name} fee` : "");
  const [amount, setAmount] = React.useState("");
  const [due, setDue] = React.useState(localToday(7));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function pickCourse(id: string) {
    const c = courses.find((x) => x.id === id);
    // Keep a description the person typed; replace the default one.
    if (course && description === `${course.name} fee` && c) setDescription(`${c.name} fee`);
    setCourseId(id);
    setLearnerId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseRandToCents(amount);
    if (!learnerId) return setError("Choose the student.");
    if (!description.trim()) return setError("Add a description: the parent sees it on the fee.");
    if (cents == null) return setError("Enter an amount in rand, for example 1430.");
    if (!due) return setError("Choose a due date.");
    setBusy(true);
    setError(null);
    const res = await issueInvoice({
      learnerId,
      lines: [{ courseId, description: description.trim(), quantity: 1, unitAmountCents: cents }],
      // Midday UTC, so the due day is the same day in South Africa.
      dueAt: `${due}T12:00:00.000Z`,
    });
    setBusy(false);
    if (!res?.data) return setError(failed(res));
    toast.success(`Fee ${res.data.number} created.`);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>New fee</DialogTitle>
        <DialogDescription>One fee for one student. It goes to whoever is paid for the course&apos;s fees.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-course`}>Course</Label>
          <select id={`${ids}-course`} value={courseId} onChange={(e) => pickCourse(e.target.value)} className={SELECT}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-student`}>Student</Label>
          <select id={`${ids}-student`} value={learnerId} onChange={(e) => setLearnerId(e.target.value)} className={SELECT}>
            <option value="">Choose a student</option>
            {(course?.learners ?? []).map((l) => (
              <option key={l.learnerId} value={l.learnerId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-desc`}>Description</Label>
        <Input id={`${ids}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-amount`}>Amount (R)</Label>
          <Input id={`${ids}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" placeholder="1430" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-due`}>Due</Label>
          <Input id={`${ids}-due`} type="date" min={localToday()} value={due} onChange={(e) => setDue(e.target.value)} className="w-44" />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Create fee
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ── Row actions ──────────────────────────────────────────────────────── */

type Fee = { id: string; number: string; learnerName: string; totalCents: number };

export function FeeRowActions({ fee, canMarkOffsite }: { fee: Fee; canMarkOffsite: boolean }) {
  const [open, setOpen] = React.useState<"offsite" | "void" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for fee ${fee.number}`}>
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMarkOffsite ? <DropdownMenuItem onSelect={() => setOpen("offsite")}>Paid in cash or by transfer…</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => setOpen("void")}>Cancel fee…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open === "offsite" ? <OffsiteForm fee={fee} onDone={() => setOpen(null)} /> : null}
          {open === "void" ? <VoidForm fee={fee} onDone={() => setOpen(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OffsiteForm({ fee, onDone }: { fee: Fee; onDone: () => void }) {
  const router = useRouter();
  const ids = React.useId();
  const [method, setMethod] = React.useState<"CASH" | "EFT" | "OTHER">("CASH");
  const [received, setReceived] = React.useState(localToday());
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = noteProblem(note);
    if (problem) return setError(problem.replace("it goes in the audit log", "it's kept with the fee"));
    if (!received || received > localToday()) return setError("Choose the day you received it: today or earlier.");
    setBusy(true);
    setError(null);
    // Start of that day, but never later than now (A refuses a future time).
    const receivedOn = new Date(Math.min(Date.parse(`${received}T00:00:00.000Z`), Date.now())).toISOString();
    const res = await markInvoicePaidOffsite({
      invoiceId: fee.id,
      method,
      amountCents: fee.totalCents,
      receivedOn,
      reference: reference.trim() || null,
      note: note.trim(),
    });
    setBusy(false);
    if (!res?.data) return setError(failed(res));
    toast.success(`${fee.number} marked paid.`);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>Mark as paid in cash or by transfer</DialogTitle>
        <DialogDescription>
          {fee.number} · {fee.learnerName} · {formatRand(fee.totalCents)}. The parent sees it as paid to you directly. Nexa
          takes no commission on it.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How it was paid</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["CASH", "Cash", Banknote],
              ["EFT", "Bank transfer (EFT) to my account", Landmark],
              ["OTHER", "Other", CircleEllipsis],
            ] as const
          ).map(([v, label, Icon]) => (
            <label key={v} className="inline-flex items-center gap-2">
              <input type="radio" name={`${ids}-method`} checked={method === v} onChange={() => setMethod(v)} />
              <Icon aria-hidden className="text-muted-foreground size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-muted-foreground text-sm">
        Amount: <span className="text-foreground font-medium tabular-nums">{formatRand(fee.totalCents)}</span> (the full fee; part
        payments can&apos;t be recorded).
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-received`}>Received</Label>
          <Input id={`${ids}-received`} type="date" max={localToday()} value={received} onChange={(e) => setReceived(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-ref`}>Reference (optional)</Label>
          <Input id={`${ids}-ref`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="w-56" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-note`}>Note</Label>
        <Textarea id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Paid at the lesson" />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Mark paid
        </Button>
      </DialogFooter>
    </form>
  );
}

function VoidForm({ fee, onDone }: { fee: Fee; onDone: () => void }) {
  const router = useRouter();
  const ids = React.useId();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = noteProblem(reason);
    if (problem) return setError(problem.replace("Add a note", "Add a reason").replace("it goes in the audit log", "it's kept with the fee"));
    setBusy(true);
    setError(null);
    const res = await voidInvoice({ invoiceId: fee.id, reason: reason.trim() });
    setBusy(false);
    if (!res?.data) return setError(failed(res));
    toast.success(`${fee.number} cancelled.`);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>Cancel fee {fee.number}</DialogTitle>
        <DialogDescription>
          {fee.learnerName} · {formatRand(fee.totalCents)}. The parent can no longer pay it. This can&apos;t be undone; create a new
          fee if it was a mistake.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-reason`}>Reason</Label>
        <Textarea id={`${ids}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Keep it
        </Button>
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Cancel fee
        </Button>
      </DialogFooter>
    </form>
  );
}
