"use client";

/**
 * A Nexa admin's actions on one workspace's billing (contracts/billing.md
 * section 4): extend the trial, start or end a comp, issue a credit note.
 * Each opens a dialog that asks for the note A writes to the audit log,
 * says what will happen, and refreshes the page when A answers.
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminExtendTrial, adminIssueCreditNote, adminSetComp } from "@/features/admin/billing-actions";

import { adminErrorMessage, noteProblem, parseRandToCents, workspaceActions, type WorkspaceAction } from "../lib/admin-billing-ui";
import { formatRand, type BillingState } from "../lib/billing-ui";

const LABEL: Record<WorkspaceAction, string> = {
  extendTrial: "Extend trial…",
  setComp: "Make complimentary…",
  endComp: "End complimentary…",
  creditNote: "Issue credit…",
};

export function WorkspaceActions({ workspace }: { workspace: { workspaceId: string; name: string; state: BillingState } }) {
  const [open, setOpen] = React.useState<WorkspaceAction | null>(null);
  const actions = workspaceActions(workspace.state);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Billing actions for ${workspace.name}`}>
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a) => (
            <DropdownMenuItem key={a} onSelect={() => setOpen(a)}>
              {LABEL[a]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open ? <ActionForm key={open} action={open} workspace={workspace} onDone={() => setOpen(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionForm({
  action,
  workspace,
  onDone,
}: {
  action: WorkspaceAction;
  workspace: { workspaceId: string; name: string; state: BillingState };
  onDone: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [days, setDays] = React.useState("14");
  const [until, setUntil] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const ids = React.useId();

  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = noteProblem(note);
    if (problem) return setError(problem);
    const workspaceId = workspace.workspaceId;
    setBusy(true);
    setError(null);
    let res: { serverError?: string; validationErrors?: unknown; data?: unknown } | undefined;
    let done = "";
    if (action === "extendTrial") {
      const n = Number(days);
      if (!Number.isInteger(n) || n < 1 || n > 90) {
        setBusy(false);
        return setError("Choose 1 to 90 days.");
      }
      res = await adminExtendTrial({ workspaceId, days: n, note: note.trim() });
      done = `Trial extended by ${n} day${n === 1 ? "" : "s"}.`;
    } else if (action === "setComp") {
      // End of the chosen day in UTC, so "until 31 Dec" includes the 31st.
      res = await adminSetComp({ workspaceId, until: until ? `${until}T23:59:59.000Z` : null, note: note.trim() });
      done = "Workspace is complimentary.";
    } else if (action === "endComp") {
      res = await adminSetComp({ workspaceId, until: null, end: true, note: note.trim() });
      done = "Complimentary billing ended.";
    } else {
      const cents = parseRandToCents(amount);
      if (cents == null) {
        setBusy(false);
        return setError("Enter an amount in rand, for example 250 or 99,50.");
      }
      res = await adminIssueCreditNote({ workspaceId, amountCents: cents, reason: note.trim() });
      done = `${formatRand(cents)} credit issued.`;
    }
    setBusy(false);
    if (!res?.data) return setError(res?.validationErrors ? "Check the fields and try again." : adminErrorMessage(res?.serverError));
    toast.success(`${workspace.name}: ${done}`);
    onDone();
    router.refresh();
  }

  const copy: Record<WorkspaceAction, { title: string; body: string; button: string }> = {
    extendTrial: {
      title: "Extend the trial",
      body:
        workspace.state === "READ_ONLY"
          ? "Reopens the trial from today, if this workspace has never paid. Its deletion date is cleared."
          : "Adds days to the end of the trial.",
      button: "Extend trial",
    },
    setComp: {
      title: "Make complimentary",
      body: "No charges while it lasts: renewals carry a complimentary line, and the workspace is never deleted. Leave the date empty to keep it until you end it.",
      button: "Make complimentary",
    },
    endComp: {
      title: "End complimentary billing",
      body: "If the workspace has paid before, it becomes Active and the next renewal charges its card. If it never paid, it becomes Read-only until someone pays.",
      button: "End complimentary",
    },
    creditNote: {
      title: "Issue credit",
      body: "The amount comes off the workspace's next invoices until it is used up.",
      button: "Issue credit",
    },
  };
  const c = copy[action];

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {c.title}: {workspace.name}
        </DialogTitle>
        <DialogDescription>{c.body}</DialogDescription>
      </DialogHeader>

      {action === "extendTrial" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-days`}>Days to add</Label>
          <Input id={`${ids}-days`} type="number" inputMode="numeric" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="w-28" />
        </div>
      ) : null}
      {action === "setComp" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-until`}>Until (optional)</Label>
          <Input id={`${ids}-until`} type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className="w-44" />
        </div>
      ) : null}
      {action === "creditNote" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-amount`}>Amount (R)</Label>
          <Input id={`${ids}-amount`} inputMode="decimal" placeholder="250" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-note`}>{action === "creditNote" ? "Reason" : "Note"}</Label>
        <Textarea
          id={`${ids}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Why, and who asked. Kept in the audit log."
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
        <Button type="submit" variant={action === "endComp" ? "destructive" : "default"} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {c.button}
        </Button>
      </DialogFooter>
    </form>
  );
}
