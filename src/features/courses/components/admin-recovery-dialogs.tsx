"use client";

/**
 * Nexa admin refund recovery (contracts/billing.md section 4, Draft 1.12):
 * refund a fee invoice after an investigation, and hold, settle or waive
 * what a payee still owes. Same dialog shell as admin-billing-dialogs.
 */

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminHoldRecovery,
  adminRefundFeeInvoice,
  adminSettleRecoveryOffsite,
  adminWaiveRecovery,
} from "@/features/admin/billing-actions";

import { parseRandToCents } from "../lib/admin-billing-ui";
import { formatRand } from "../lib/billing-ui";
import { recoveryActions, type RecoveryStatus } from "../lib/recovery-ui";
import { DialogButton, NoteForm, outcome } from "./admin-billing-dialogs";

/* ───── Refund a fee invoice ───── */

export function FeeRefundButton() {
  return (
    <DialogButton label="Refund a fee invoice">{(close) => <FeeRefundForm onDone={close} />}</DialogButton>
  );
}

function FeeRefundForm({ onDone }: { onDone: () => void }) {
  const [invoiceId, setInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const id = React.useId();
  return (
    <NoteForm
      title="Refund a fee invoice"
      body="Only after an investigation. Paystack returns the money to the parent's card, and the tutor's share is taken from their later payouts after a notice of deduction. Refunds can't be undone."
      button="Refund"
      noteLabel="Reason"
      notePlaceholder="Quoted to the tutor in their notice. Say what the investigation found."
      destructive
      onDone={onDone}
      run={async (reason) => {
        const invoice = invoiceId.trim();
        if (!invoice) return { error: "Paste the fee invoice's id." };
        const cents = amount.trim() === "" ? null : parseRandToCents(amount);
        if (amount.trim() !== "" && cents == null) return { error: "Enter an amount in rand, for example 250 or 99,50." };
        const res = await adminRefundFeeInvoice({ invoiceId: invoice, ...(cents != null ? { amountCents: cents } : {}), reason });
        return outcome(res, cents != null ? `Refund of ${formatRand(cents)} sent to Paystack.` : "Refund sent to Paystack.");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-invoice`}>Fee invoice id</Label>
        <Input id={`${id}-invoice`} value={invoiceId} maxLength={64} onChange={(e) => setInvoiceId(e.target.value)} className="font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-amount`}>Amount (R, optional)</Label>
        <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" />
        <p className="text-muted-foreground text-xs">Leave empty to refund everything not yet refunded.</p>
      </div>
    </NoteForm>
  );
}

/* ───── One recovery ───── */

type Recovery = { id: string; status: RecoveryStatus; payeeName: string; invoiceNumber: string | null; outstandingCents: number };
type Action = "hold" | "settle" | "waive";

const LABEL: Record<Action, string> = { hold: "Hold deductions…", settle: "Repaid off-site…", waive: "Waive…" };

export function RecoveryActions({ recovery: r }: { recovery: Recovery }) {
  const [open, setOpen] = React.useState<Action | null>(null);
  const actions = recoveryActions(r.status);
  if (actions.length === 0) return null;
  const what = `${r.payeeName || "the payee"}${r.invoiceNumber ? ` (${r.invoiceNumber})` : ""}`;
  const close = () => setOpen(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Actions for the recovery from ${what}`}>
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a) => (
            <DropdownMenuItem key={a} onSelect={() => setOpen(a)} className={a === "waive" ? "text-destructive focus:text-destructive" : undefined}>
              {LABEL[a]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open != null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {open === "hold" ? <HoldForm recovery={r} what={what} onDone={close} /> : null}
          {open === "settle" ? (
            <NoteForm
              title={`Repaid off-site by ${what}`}
              body={`Closes it as repaid: the ${formatRand(r.outstandingCents)} still owed is no longer taken from payouts. Use it when the money came back another way, such as an EFT.`}
              button="Mark repaid"
              onDone={close}
              run={async (note) => outcome(await adminSettleRecoveryOffsite({ recoveryId: r.id, note }), "Marked repaid.")}
            />
          ) : null}
          {open === "waive" ? (
            <NoteForm
              title={`Waive the recovery from ${what}`}
              body="Nothing more is taken from their payouts and Nexa bears the rest of the refund. This can't be undone."
              button="Waive"
              destructive
              onDone={close}
              run={async (note) => outcome(await adminWaiveRecovery({ recoveryId: r.id, note }), "Recovery waived.")}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function HoldForm({ recovery: r, what, onDone }: { recovery: Recovery; what: string; onDone: () => void }) {
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [day, setDay] = React.useState("");
  const id = React.useId();
  return (
    <NoteForm
      title={`Hold deductions from ${what}`}
      body="No deductions are taken before the date you pick, for example while a dispute is looked at again. What they owe doesn't change."
      button="Hold"
      onDone={onDone}
      run={async (note) => {
        if (!day || day < tomorrow) return { error: "Pick a date after today." };
        const res = await adminHoldRecovery({ recoveryId: r.id, until: `${day}T00:00:00.000Z`, note });
        return outcome(res, "Deductions held.");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-until`}>No deductions before</Label>
        <Input id={`${id}-until`} type="date" min={tomorrow} value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
      </div>
    </NoteForm>
  );
}
