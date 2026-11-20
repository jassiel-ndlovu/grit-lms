"use client";

/**
 * Nexa admin billing actions on one course, invoice, payment or discount
 * code (contracts/billing.md section 4). Each opens a dialog that says what
 * will happen and asks for the note A writes to the audit log, then
 * refreshes the page when A answers. Workspace-level actions are in
 * admin-workspace-actions.tsx; refund recovery ones in
 * admin-recovery-dialogs.tsx, which reuses NoteForm and DialogButton.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDeactivateDiscountCode,
  adminMarkPaidOffsite,
  adminOverrideCourseTier,
  adminRefundPayment,
  adminVoidPlatformInvoice,
} from "@/features/admin/billing-actions";

import { adminErrorMessage, noteProblem, refundAmount } from "../lib/admin-billing-ui";
import { TIER_LABEL, formatRand, type TierKey } from "../lib/billing-ui";

export type Result = { serverError?: string; validationErrors?: unknown; data?: unknown } | undefined;

export const SELECT =
  "border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The shared shell: title, what happens, the fields, the note, an error and
 * the buttons. `run` validates the fields and calls A, returning the toast
 * on success or an error to show.
 */
export function NoteForm({
  title,
  body,
  button,
  noteLabel = "Note",
  notePlaceholder = "Why, and who asked. Kept in the audit log.",
  destructive,
  onDone,
  run,
  children,
}: {
  title: string;
  body: React.ReactNode;
  button: string;
  noteLabel?: string;
  notePlaceholder?: string;
  destructive?: boolean;
  onDone: () => void;
  run: (note: string) => Promise<{ ok: string } | { error: string }>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = noteProblem(note);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const r = await run(note.trim());
    setBusy(false);
    if ("error" in r) return setError(r.error);
    toast.success(r.ok);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{body}</DialogDescription>
      </DialogHeader>
      {children}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-note`}>{noteLabel}</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={notePlaceholder}
        />
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
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {button}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A's answer → ok text or an error to show. */
export function outcome(res: Result, ok: string): { ok: string } | { error: string } {
  if (res?.data) return { ok };
  return { error: res?.validationErrors ? "Check the fields and try again." : adminErrorMessage(res?.serverError) };
}

/** A button that opens one form in a dialog. */
export function DialogButton({
  label,
  srLabel,
  variant = "outline",
  children,
}: {
  label: React.ReactNode;
  srLabel?: string;
  variant?: "outline" | "ghost" | "destructive";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)} aria-label={srLabel}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{open ? children(() => setOpen(false)) : null}</DialogContent>
      </Dialog>
    </>
  );
}

/* ───── A course's tier ───── */

export function CourseTierOverride({
  course,
}: {
  course: { courseId: string; title: string; billedTierKey: TierKey; derivedTierKey: TierKey; override: { tierKey: TierKey; until: string | null } | null };
}) {
  return (
    <DialogButton label={course.override ? "Change" : "Override"} srLabel={`Override the tier of ${course.title}`} variant="ghost">
      {(close) => <TierForm course={course} onDone={close} />}
    </DialogButton>
  );
}

function TierForm({
  course,
  onDone,
}: {
  course: { courseId: string; title: string; derivedTierKey: TierKey; override: { tierKey: TierKey; until: string | null } | null };
  onDone: () => void;
}) {
  const [tier, setTier] = React.useState<TierKey | "">(course.override?.tierKey ?? "");
  const [until, setUntil] = React.useState(course.override?.until?.slice(0, 10) ?? "");
  const id = React.useId();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <NoteForm
      title={`Tier for ${course.title}`}
      body={
        <>
          The course is billed at the tier you pick instead of the one its services need ({TIER_LABEL[course.derivedTierKey]}).
          Choose &ldquo;No override&rdquo; to go back to that.
        </>
      }
      button={tier ? "Save override" : course.override ? "Remove override" : "Save"}
      onDone={onDone}
      run={async (note) => {
        if (!tier && !course.override) return { error: "Pick a tier to override with." };
        const res = await adminOverrideCourseTier({
          courseId: course.courseId,
          tierKey: tier || null,
          until: tier && until ? `${until}T23:59:59.000Z` : null,
          note,
        });
        return outcome(res, tier ? `${course.title} is billed at ${TIER_LABEL[tier]}.` : `${course.title}: override removed.`);
      }}
    >
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-tier`}>Bill at</Label>
          <select id={`${id}-tier`} value={tier} onChange={(e) => setTier(e.target.value as TierKey | "")} className={`${SELECT} block`}>
            <option value="">No override</option>
            {(["CORE", "PLUS", "PRO"] as const).map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {tier ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-until`}>Until (optional)</Label>
            <Input id={`${id}-until`} type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className="w-44" />
          </div>
        ) : null}
      </div>
    </NoteForm>
  );
}

/* ───── An open invoice ───── */

type InvoiceAction = "offsite" | "void";

export function InvoiceActions({ invoice }: { invoice: { id: string; number: string; totalCents: number } }) {
  const [open, setOpen] = React.useState<InvoiceAction | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Actions for invoice ${invoice.number}`}>
            Actions <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen("offsite")}>Mark paid off-site…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen("void")} className="text-destructive focus:text-destructive">
            Void invoice…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open === "offsite" ? <OffsiteForm invoice={invoice} onDone={() => setOpen(null)} /> : null}
          {open === "void" ? (
            <NoteForm
              title={`Void ${invoice.number}`}
              body="The workspace no longer owes it and it can't be paid. This can't be undone."
              button="Void invoice"
              destructive
              onDone={() => setOpen(null)}
              run={async (note) => outcome(await adminVoidPlatformInvoice({ invoiceId: invoice.id, note }), `${invoice.number} is void.`)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OffsiteForm({ invoice, onDone }: { invoice: { id: string; number: string; totalCents: number }; onDone: () => void }) {
  const [method, setMethod] = React.useState<"EFT" | "CASH" | "OTHER">("EFT");
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = React.useState(today);
  const [reference, setReference] = React.useState("");
  const id = React.useId();
  return (
    <NoteForm
      title={`Mark ${invoice.number} paid off-site`}
      body="For money received outside Paystack, such as an EFT to Nexa's account."
      button="Mark paid"
      onDone={onDone}
      run={async (note) => {
        const cents = invoice.totalCents;
        if (!day || day > today) return { error: "Choose the day it was received, today or earlier." };
        // A wants a moment that has passed: today is "now", other days noon UTC.
        const receivedOn = day === today ? new Date().toISOString() : `${day}T12:00:00.000Z`;
        const res = await adminMarkPaidOffsite({
          platformInvoiceId: invoice.id,
          method,
          amountCents: cents,
          receivedOn,
          reference: reference.trim() || null,
          note,
        });
        return outcome(res, `${formatRand(cents)} recorded on ${invoice.number}.`);
      }}
    >
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">How it was paid</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["EFT", "CASH", "OTHER"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input type="radio" name={`${id}-method`} value={m} checked={method === m} onChange={() => setMethod(m)} />
              {m === "EFT" ? "EFT" : m === "CASH" ? "Cash" : "Other"}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm">
        Amount: <strong className="tabular-nums">{formatRand(invoice.totalCents)}</strong>{" "}
        <span className="text-muted-foreground">(the full invoice; part payments can&apos;t be recorded)</span>
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-day`}>Received</Label>
          <Input id={`${id}-day`} type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-ref`}>Reference (optional)</Label>
        <Input id={`${id}-ref`} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
      </div>
    </NoteForm>
  );
}

/* ───── A card payment ───── */

export function RefundButton({ payment, invoiceNumber }: { payment: { paymentId: string; refundableCents: number }; invoiceNumber: string }) {
  return (
    <DialogButton label="Refund" srLabel={`Refund a payment on ${invoiceNumber}`} variant="ghost">
      {(close) => <RefundForm payment={payment} onDone={close} />}
    </DialogButton>
  );
}

function RefundForm({ payment, onDone }: { payment: { paymentId: string; refundableCents: number }; onDone: () => void }) {
  const [amount, setAmount] = React.useState("");
  const id = React.useId();
  return (
    <NoteForm
      title="Refund this payment"
      body={`Paystack returns the money to the card. Up to ${formatRand(payment.refundableCents)} can be refunded. Refunds can't be undone.`}
      button="Refund"
      noteLabel="Reason"
      destructive
      onDone={onDone}
      run={async (note) => {
        const r = refundAmount(amount, payment.refundableCents);
        if ("error" in r) return r;
        const whole = r.cents === payment.refundableCents;
        const res = await adminRefundPayment({ paymentId: payment.paymentId, ...(whole ? {} : { amountCents: r.cents }), reason: note });
        return outcome(res, `Refund of ${formatRand(r.cents)} sent to Paystack.`);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-amount`}>Amount (R)</Label>
        <Input
          id={`${id}-amount`}
          inputMode="decimal"
          placeholder={(payment.refundableCents / 100).toFixed(2).replace(".", ",")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-36"
        />
        <p className="text-muted-foreground text-xs">Leave empty to refund all of it.</p>
      </div>
    </NoteForm>
  );
}

/* ───── A discount code ───── */

export function DeactivateCodeButton({ code }: { code: { id: string; code: string } }) {
  return (
    <DialogButton label="Turn off" srLabel={`Turn off code ${code.code}`} variant="ghost">
      {(close) => (
        <NoteForm
          title={`Turn off ${code.code}`}
          body="No one can redeem it from now on. You can't turn it back on; create a new code instead."
          button="Turn off code"
          destructive
          onDone={close}
          run={async (note) => outcome(await adminDeactivateDiscountCode({ id: code.id, note }), `${code.code} is off.`)}
        />
      )}
    </DialogButton>
  );
}
