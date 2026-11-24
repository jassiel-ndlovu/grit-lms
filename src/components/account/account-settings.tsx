"use client";

/**
 * Settings › Account (#182, #185; viewer contract Drafts 1.8 and 1.9):
 *   EmailChangeForm   — requestEmailChange({ password, newEmail }), then
 *                       "check your new inbox". Errors as the server writes them.
 *   DataExportButton  — GET /api/account/export (own data, or ?userId= for a
 *                       student), with the 24-hour limit shown in words.
 *   DeleteAccountPanel — a strict confirm (type DELETE), then
 *                       requestAccountDeletion, which signs the user out.
 *   StudentDeletionPanel — a tutor deletes a student's account on a
 *                       parent's request, or cancels a pending one.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Mail, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestEmailChange } from "@/features/auth/email-change-actions";
import { actionError } from "@/features/courses/lib/account-ui";
import { cancelStudentAccountDeletion, requestAccountDeletion, requestStudentAccountDeletion } from "@/features/users/privacy-actions";

import { DELETE_WORD, deleteWordMatches, deletionDoneHref, formatDeletionDate } from "./account-copy";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from "@/lib/datetime";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

/* ─── Email address ─────────────────────────────────────────────────── */

export function EmailChangeForm({ currentEmail, twoFactorEnabled }: { currentEmail: string | null; twoFactorEnabled: boolean }) {
  const [password, setPassword] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const adding = currentEmail === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newEmail.trim()) return setError("Enter the new email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    const res = await requestEmailChange({ password, newEmail: newEmail.trim() });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    setPassword("");
    setSentTo(res.data.sentTo);
  }

  if (sentTo) {
    return (
      <div role="status" className="border-border bg-muted/50 space-y-2 rounded-lg border p-4">
        <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4" aria-hidden /> Check your new inbox
        </p>
        <p className="text-muted-foreground text-sm">
          We&apos;ve sent a link to <strong className="text-foreground [overflow-wrap:anywhere]">{sentTo}</strong>. It works for 1 hour.
          {adding ? null : " Until you open it, your email address stays the same."}
        </p>
        <p className="text-muted-foreground text-sm">Opening it signs you out everywhere; then sign in with the new address.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => { setSentTo(null); setNewEmail(""); }}>
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="border-border space-y-4 rounded-lg border p-4">
      <p className="text-sm">
        {adding ? (
          "Your account has no email address yet. Add one to get notifications and reset your own password."
        ) : (
          <>
            Your email address is <strong className="[overflow-wrap:anywhere]">{currentEmail}</strong>.
          </>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">{adding ? "Email address" : "New email address"}</Label>
          <Input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-password">Your password</Label>
          <Input id="email-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      {twoFactorEnabled ? (
        <p className="text-muted-foreground text-xs">
          Two-factor sign-in is on, so you need to have signed in with your authenticator code in the last 15 minutes.
        </p>
      ) : null}
      <ErrorLine error={error} />
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {adding ? "Add email address" : "Change email address"}
      </Button>
    </form>
  );
}

/* ─── Data export ───────────────────────────────────────────────────── */

export function DataExportButton({ userId, label = "Download my data" }: { userId?: string; label?: string }) {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function download() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/account/export${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`, { cache: "no-store" });
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { lastAt?: string };
        const when = body.lastAt ? new Date(body.lastAt) : null;
        const next = when ? new Date(when.getTime() + 24 * 60 * 60 * 1000) : null;
        setNote({
          tone: "info",
          text: next
            ? `A download was made in the last 24 hours. The next one is possible from ${next.toLocaleString(DEFAULT_LOCALE, { timeZone: DEFAULT_TIME_ZONE, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
            : "A download was made in the last 24 hours. Try again tomorrow.",
        });
        return;
      }
      if (!res.ok) {
        setNote({ tone: "error", text: res.status === 401 ? "Sign in again, then try." : "We couldn't make the download. Try again." });
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "nexa-data.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote({ tone: "info", text: `Downloaded ${name}. Keep it somewhere safe: it holds personal details.` });
    } catch {
      setNote({ tone: "error", text: "We couldn't reach Nexa. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={download} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {label}
      </Button>
      {note ? (
        <p role={note.tone === "error" ? "alert" : "status"} className={note.tone === "error" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Delete my account ─────────────────────────────────────────────── */

function TypedConfirm({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Type <span className="font-mono font-semibold">{DELETE_WORD}</span> to confirm
      </Label>
      <Input id={id} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function DeleteAccountPanel({
  soleOwnerOf,
  graceDays,
  consequences,
  hasRealEmail,
  isMinor,
}: {
  soleOwnerOf: string[];
  graceDays: number;
  consequences: string[];
  hasRealEmail: boolean;
  isMinor: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await requestAccountDeletion({ confirm: "DELETE" });
    if (!res?.data) {
      setBusy(false);
      return setError(actionError(res));
    }
    // The server has ended every session; leave the dashboard for the signed-out page.
    window.location.assign(deletionDoneHref(res.data.deleteOn, hasRealEmail));
  }

  if (soleOwnerOf.length) {
    return (
      <div className="border-border space-y-2 rounded-lg border p-4 text-sm">
        <p className="text-foreground font-medium">Hand over your workspace first</p>
        <p className="text-muted-foreground">
          You&apos;re the only owner of {soleOwnerOf.join(", ")}. Make someone else an owner, or close the workspace, before you delete
          your account.
        </p>
      </div>
    );
  }

  return (
    <div className="border-destructive/40 space-y-3 rounded-lg border p-4 text-sm">
      <p>
        Your account is deleted <strong>{graceDays} days</strong> after you ask. Until then you can&apos;t sign in, and you can change your
        mind {hasRealEmail ? "with the link we email you" : "by asking your tutor"}. After that:
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-5">
        {consequences.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {isMinor ? <p className="text-muted-foreground">If you&apos;re under 18, talk to your parent or guardian before you do this.</p> : null}
      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTyped(""); setError(null); } }}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive">
            <Trash2 className="size-4" aria-hidden /> Delete my account…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be signed out on every device now, and the account is deleted in {graceDays} days.{" "}
              {hasRealEmail ? "We'll email you a link to cancel." : "Your tutor can cancel it until then."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TypedConfirm id="confirm-delete" value={typed} onChange={setTyped} />
          <ErrorLine error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy || !deleteWordMatches(typed)} onClick={confirm}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete my account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── A student's account, on a parent's request (tutor) ─────────────── */

export function StudentDeletionPanel({
  userId,
  name,
  managed,
  deleteOn,
  graceDays,
}: {
  userId: string;
  name: string;
  /** False when the student signed up themself: they delete it in their own settings. */
  managed: boolean;
  /** ISO date when a deletion is pending, or null. */
  deleteOn: string | null;
  graceDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    const res = await requestStudentAccountDeletion({ userId, confirm: "DELETE" });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    setOpen(false);
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await cancelStudentAccountDeletion({ userId });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    router.refresh();
  }

  if (!managed) {
    return (
      <p className="text-muted-foreground text-sm">
        {name} manages their own account, so only they can delete it, from their settings.
      </p>
    );
  }

  if (deleteOn) {
    return (
      <div data-slot="tone-panel" data-tone="danger" className="space-y-3 rounded-lg p-4 text-sm">
        <p className="text-foreground font-medium">Deletion pending</p>
        <p className="text-muted-foreground">
          {name}&apos;s account will be deleted on {formatDeletionDate(deleteOn)}. They can&apos;t sign in until then. Cancel if the parent
          changes their mind.
        </p>
        <ErrorLine error={error} />
        <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Cancel deletion
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Only when a parent or guardian asks. {name} is signed out at once and the account is deleted after {graceDays} days: their tests,
        assignments and grades go, and invoices keep their name only. You can cancel until then.
      </p>
      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTyped(""); setError(null); } }}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="text-destructive">
            <Trash2 className="size-4" aria-hidden /> Delete account (parent&apos;s request)…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}&apos;s account?</AlertDialogTitle>
            <AlertDialogDescription>
              Do this only at a parent&apos;s or guardian&apos;s request. The account is deleted in {graceDays} days; you can cancel until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TypedConfirm id="confirm-student-delete" value={typed} onChange={setTyped} />
          <ErrorLine error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Don&apos;t delete</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy || !deleteWordMatches(typed)} onClick={request}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!open ? <ErrorLine error={error} /> : null}
    </div>
  );
}
