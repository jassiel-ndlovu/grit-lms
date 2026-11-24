"use client";

/**
 * What staff do with an at-risk alert: share it with the family, or close it
 * ("Sorted", "Not a concern"). A's actions check everything again.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellOff, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dismissRiskAlertAction, resolveRiskAlertAction, shareRiskAlertAction } from "@/features/risk/actions";
import { RISK_RULES } from "@/features/risk/rules";

import { nobodyToShareWith, SHARE_NOTE_MAX, sharedToast } from "../../lib/at-risk";

const FAILED = "That didn't work. Try again.";

export function ShareAlertButton({
  alertId,
  studentName,
  summary,
  to,
  again,
}: {
  alertId: string;
  studentName: string;
  summary: string;
  to: { guardians: number; student: boolean };
  /** Already shared once. */
  again: boolean;
}) {
  const router = useRouter();
  const fieldId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [guardians, setGuardians] = React.useState(false);
  const [student, setStudent] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const label = again ? "Share again" : "Share";
  const nobody = nobodyToShareWith(to);

  function show() {
    setGuardians(to.guardians > 0);
    setStudent(false);
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function share(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await shareRiskAlertAction({ alertId, withGuardians: guardians, withStudent: student, note: note.trim() || null }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      setError(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    toast.success(sharedToast(r.data));
    router.refresh();
  }

  if (nobody) return <p className="text-muted-foreground order-last basis-full text-xs">{nobody}</p>;

  return (
    <WriteGuard label={label}>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button type="button" size="sm" variant="outline" onClick={show}>
          <Send aria-hidden className="size-4" />
          {label}
        </Button>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={share} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Share with {studentName}&apos;s family</DialogTitle>
              <DialogDescription>They get an email and a notice in Nexa, from you.</DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2.5">
              <legend className="text-foreground mb-2 text-sm font-medium">Share with</legend>
              <Choice id={`${fieldId}-p`} checked={guardians} onChange={setGuardians} disabled={to.guardians === 0}>
                Parents ({to.guardians})
              </Choice>
              <Choice id={`${fieldId}-s`} checked={student} onChange={setStudent} disabled={!to.student}>
                The student
              </Choice>
              {to.guardians === 0 || !to.student ? (
                <p className="text-muted-foreground text-xs">
                  {to.guardians === 0 ? "No linked parent has a confirmed email yet." : "The student has no confirmed email."}
                </p>
              ) : null}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-note`}>Your note (optional)</Label>
              <Textarea
                id={`${fieldId}-note`}
                value={note}
                maxLength={SHARE_NOTE_MAX}
                rows={4}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you suggest, or a time to talk."
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-foreground text-sm font-medium">Sent with it</p>
              <p className="bg-muted/60 text-foreground rounded-md px-3 py-2 text-sm">{summary}</p>
            </div>

            {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || (!guardians && !student)}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                Share
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

function Choice({
  id, checked, onChange, disabled, children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className={disabled ? "text-muted-foreground font-normal" : "font-normal"}>
        {children}
      </Label>
    </div>
  );
}

const CLOSE = {
  sorted: {
    label: "Sorted",
    icon: Check,
    title: "Close this alert?",
    body: "Use this when it's been dealt with. A new alert opens if the same problems are still there at the next daily check.",
    done: "Alert closed.",
    run: resolveRiskAlertAction,
  },
  dismiss: {
    label: "Not a concern",
    icon: BellOff,
    title: "Not a concern?",
    body: `The alert closes, and this student gets no new one in this course for ${RISK_RULES.quietDays} days.`,
    done: `Alert closed for ${RISK_RULES.quietDays} days.`,
    run: dismissRiskAlertAction,
  },
} as const;

export function CloseAlertButton({ alertId, studentName, kind }: { alertId: string; studentName: string; kind: keyof typeof CLOSE }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const c = CLOSE[kind];

  async function close() {
    setPending(true);
    const r = await c.run({ alertId }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    toast.success(c.done);
    router.refresh();
  }

  return (
    <WriteGuard label={c.label}>
      <Button type="button" size="sm" variant="ghost" aria-label={`${c.label}: ${studentName}`} onClick={() => setOpen(true)}>
        <c.icon aria-hidden className="size-4" />
        {c.label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.title}</AlertDialogTitle>
            <AlertDialogDescription>{c.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it open</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void close();
              }}
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <c.icon aria-hidden className="size-4" />}
              Close alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}
