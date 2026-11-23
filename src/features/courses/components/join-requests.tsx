"use client";

/**
 * Join requests (#206; viewer.md Draft 1.12). Students and parents ask to
 * join a listed course; staff approve or decline. A's actions in
 * @/features/workspaces/join-request-actions do the work and the checks;
 * their errors are written for the user and shown as they come.
 *
 *   RequestJoinButton     browse page: ask for yourself or a linked child
 *   CancelRequestButton   the person who asked withdraws it
 *   ApproveRequestButton  staff: is the student a minor, and the consent tick
 *   DeclineRequestButton  staff: an optional note that goes into the email
 *   CourseListingSwitch   course settings: list the course in Find courses
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  approveJoinRequest, cancelJoinRequest, declineJoinRequest, requestToJoin, setCourseListed,
} from "@/features/workspaces/join-request-actions";

import { BILLING_PATH, actionError, isStudentLimitError } from "../lib/account-ui";
import { JOIN_LIMITS, needsConsent, type AskFor } from "../lib/join-ui";

function Busy({ on }: { on: boolean }) {
  return on ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null;
}

function ErrorLine({ error }: { error: React.ReactNode }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

/* ───── Asking ───── */

export function RequestJoinButton({
  courseId,
  courseName,
  workspaceName,
  targets,
}: {
  courseId: string;
  courseName: string;
  workspaceName: string;
  /** Who may be asked for and hasn't asked yet. Empty hides the button. */
  targets: AskFor[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [who, setWho] = React.useState(targets[0]?.userId ?? "");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (targets.length === 0) return null;
  const target = targets.find((t) => t.userId === who) ?? targets[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestToJoin({
      courseId,
      ...(target.self ? {} : { studentUserId: target.userId }),
      ...(message.trim() ? { message: message.trim() } : {}),
    });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "Your request couldn't be sent. Try again."));
    setOpen(false);
    setMessage("");
    toast.success(`Request sent. ${workspaceName} will reply by email.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || setError(null))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden className="size-4" />
          Ask to join
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ask to join {courseName}</DialogTitle>
            <DialogDescription>
              {workspaceName} gets your request and decides. You&apos;ll hear back by email; nothing is shared until they say yes.
            </DialogDescription>
          </DialogHeader>
          {targets.length > 1 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Who is it for?</legend>
              {targets.map((t) => (
                <label key={t.userId} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="join-for" value={t.userId} checked={who === t.userId} onChange={() => setWho(t.userId)} />
                  {t.self ? "Me" : t.name}
                </label>
              ))}
            </fieldset>
          ) : !target.self ? (
            <p className="text-sm">
              For <strong>{target.name}</strong>
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="join-message">Message (optional)</Label>
            <Textarea
              id="join-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={JOIN_LIMITS.messageMax}
              rows={3}
              placeholder="Your grade, or anything the tutor should know"
            />
          </div>
          <ErrorLine error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Busy on /> : <Send aria-hidden className="size-4" />}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelRequestButton({ requestId, label = "Cancel request" }: { requestId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function cancel() {
    setBusy(true);
    const res = await cancelJoinRequest({ requestId });
    setBusy(false);
    if (!res?.data) return toast.error(actionError(res, "Couldn't cancel the request. Try again."));
    toast.success("Request cancelled.");
    router.refresh();
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>
      <Busy on={busy} />
      {label}
    </Button>
  );
}

/* ───── Deciding ───── */

export function ApproveRequestButton({
  requestId,
  studentName,
  courseName,
  byParent,
}: {
  requestId: string;
  studentName: string;
  courseName: string;
  /** A parent asked: their request counts as consent for a minor. */
  byParent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [minor, setMinor] = React.useState<"yes" | "no" | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode>(null);
  const isMinor = minor === "yes";
  const consentNeeded = needsConsent(isMinor, byParent);
  const ready = minor !== null && (!consentNeeded || consent);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const res = await approveJoinRequest({ requestId, isMinor, ...(consentNeeded ? { consentAttested: true } : {}) });
    setBusy(false);
    if (!res?.data) {
      const message = actionError(res, "Couldn't approve the request. Try again.");
      return setError(
        isStudentLimitError(res?.serverError) ? (
          <>
            {message}{" "}
            <Link href={BILLING_PATH} className="text-foreground font-medium underline underline-offset-2">
              Go to billing
            </Link>
          </>
        ) : (
          message
        ),
      );
    }
    setOpen(false);
    toast.success(`${studentName} is on ${courseName}.`);
    router.refresh();
  }

  return (
    <WriteGuard label="Approve" variant="default">
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || setError(null))}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Check aria-hidden className="size-4" />
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                Add {studentName} to {courseName}?
              </DialogTitle>
              <DialogDescription>
                They join your workspace as a student and are enrolled now. {byParent ? "Their parent asked, and will get an email." : "They'll get an email."}
              </DialogDescription>
            </DialogHeader>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Is {studentName} under 18?</legend>
              {(["yes", "no"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="minor" value={v} checked={minor === v} onChange={() => setMinor(v)} />
                  {v === "yes" ? "Yes, a minor" : "No, an adult"}
                </label>
              ))}
            </fieldset>
            {consentNeeded ? (
              <label className="border-border flex items-start gap-2 rounded-md border p-3 text-sm">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <span>
                  I have a parent&apos;s or guardian&apos;s consent for {studentName} to use Nexa.{" "}
                  <span className="text-muted-foreground">Or decline, and ask a parent to make the request instead.</span>
                </span>
              </label>
            ) : null}
            <ErrorLine error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!ready || busy}>
                <Busy on={busy} />
                Approve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

export function DeclineRequestButton({ requestId, studentName }: { requestId: string; studentName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await declineJoinRequest({ requestId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    setBusy(false);
    if (!res?.data) return setError(actionError(res, "Couldn't decline the request. Try again."));
    setOpen(false);
    toast.success("Request declined.");
    router.refresh();
  }

  return (
    <WriteGuard label="Decline">
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || setError(null))}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <X aria-hidden className="size-4" />
            Decline
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Decline {studentName}&apos;s request?</DialogTitle>
              <DialogDescription>They get an email saying so, with your note if you add one.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="decline-reason">Note (optional)</Label>
              <Textarea
                id="decline-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={JOIN_LIMITS.reasonMax}
                rows={3}
                placeholder="For example: this class is full this term"
              />
            </div>
            <ErrorLine error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button type="submit" variant="destructive" disabled={busy}>
                <Busy on={busy} />
                Decline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

/* ───── Listing ───── */

export function CourseListingSwitch({ courseId, listed: initial, pending }: { courseId: string; listed: boolean; pending: number }) {
  const router = useRouter();
  const [listed, setListed] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function toggle(next: boolean) {
    setListed(next);
    setBusy(true);
    const res = await setCourseListed({ courseId, listed: next });
    setBusy(false);
    if (!res?.data) {
      setListed(!next);
      return toast.error(actionError(res, "Couldn't change the listing. Try again."));
    }
    toast.success(next ? "Listed in Find courses." : "No longer listed.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="listing-heading" className="font-display text-xl leading-tight">
            Find courses
          </h2>
          <p className="text-muted-foreground text-sm">
            List this course so students and parents can find it and ask to join. You approve each request; nobody joins on their own.
          </p>
        </div>
        <WriteGuard label={listed ? "Listed" : "Not listed"}>
          <Switch checked={listed} onCheckedChange={toggle} disabled={busy} aria-labelledby="listing-heading" />
        </WriteGuard>
      </div>
      {pending > 0 ? (
        <p className="text-sm">
          <Link href="/dashboard/join-requests" className="text-foreground font-medium underline underline-offset-2">
            {pending} request{pending === 1 ? "" : "s"} waiting
          </Link>
        </p>
      ) : null}
    </div>
  );
}
