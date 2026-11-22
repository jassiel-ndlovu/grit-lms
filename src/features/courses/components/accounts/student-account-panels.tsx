"use client";

/**
 * The student profile's Sign-in and Parents tabs (#174; a/ux/01, section 7).
 * Both call A's actions in account-actions.ts, which check again that the
 * viewer manages this student.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, UserMinus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { issueSignInCode, linkParent, revokeGuardianship } from "@/features/users/account-actions";
import { formatDate } from "@/lib/datetime";

import { actionError } from "../../lib/account-ui";
import { SignInCard, type SignInCardData } from "./sign-in-card";

function iso(v: string | Date): string {
  return typeof v === "string" ? v : v.toISOString();
}

/* ─── Sign-in ─────────────────────────────────────────────────────────── */

export function SignInPanel({
  userId,
  name,
  workspaceName,
  username,
  email,
  awaitingFirstSignIn,
  managed = true,
}: {
  userId: string;
  name: string;
  workspaceName: string;
  username: string | null;
  email: string | null;
  awaitingFirstSignIn: boolean;
  /** False for someone who signed up themself: no new codes (viewer contract Draft 1.13). */
  managed?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [card, setCard] = React.useState<SignInCardData | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    const res = await issueSignInCode({ userId });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    setCard({ name, role: "Student", workspaceName, username: res.data.username, email: res.data.email, code: res.data.code, expiresAt: iso(res.data.expiresAt) });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Username</dt>
        <dd className="font-mono">{username ?? "—"}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{email ?? "None"}</dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd>{awaitingFirstSignIn ? "Still the sign-in code: they haven't chosen a password yet." : "Their own."}</dd>
      </dl>

      {!managed ? (
        <p className="text-muted-foreground text-sm">
          {name} manages their own account, so you can&apos;t give them a sign-in code. They can reset their password from the sign-in page.
        </p>
      ) : card ? (
        <SignInCard card={card} onDone={() => setCard(null)} />
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              New sign-in code
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Give {name} a new sign-in code?</AlertDialogTitle>
              <AlertDialogDescription>
                Their current password or code stops working and they&apos;re signed out on every device. They sign in with the new
                code, then choose a password.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={issue}>Issue a new code</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Parents ─────────────────────────────────────────────────────────── */

export interface ParentRow {
  guardianshipId: string;
  name: string;
  email: string | null;
  username: string | null;
  relationship: string;
  linkedAt: string;
}

const RELATIONSHIPS = [
  { value: "PARENT", label: "Parent" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "OTHER", label: "Other" },
] as const;

export function ParentsPanel({
  learnerId,
  studentName,
  workspaceName,
  parents,
}: {
  learnerId: string;
  studentName: string;
  workspaceName: string;
  parents: ParentRow[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [relationship, setRelationship] = React.useState<"PARENT" | "GUARDIAN" | "OTHER">("PARENT");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [card, setCard] = React.useState<SignInCardData | null>(null);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (name.trim().length < 2) return setError("Enter the parent's name.");
    setBusy(true);
    const res = await linkParent({ learnerId, name: name.trim(), email: email.trim() || null, relationship });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    const r = res.data;
    if (r.newAccount && r.code) {
      setCard({
        name: name.trim(),
        role: `Parent of ${studentName}`,
        workspaceName,
        username: r.username ?? null,
        email: email.trim() || null,
        code: r.code,
        expiresAt: r.codeExpiresAt ? iso(r.codeExpiresAt) : new Date().toISOString(),
      });
    } else {
      setNotice(`Linked. ${name.trim()} already had an account; we've emailed them.`);
    }
    setName("");
    setEmail("");
    router.refresh();
  }

  async function revoke(guardianshipId: string) {
    setError(null);
    const res = await revokeGuardianship({ guardianshipId });
    if (!res?.data) return setError(actionError(res));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {parents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No parents linked yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {parents.map((p) => (
            <li key={p.guardianshipId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {p.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {RELATIONSHIPS.find((r) => r.value === p.relationship)?.label ?? p.relationship}
                  </span>
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {p.email ?? (p.username ? `Username ${p.username}` : "No email")} · linked {formatDate(p.linkedAt)}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <UserMinus className="size-3.5" /> Unlink
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink {p.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They stop seeing {studentName}&apos;s work, grades and fees here. Their account stays.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => revoke(p.guardianshipId)}>Unlink</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}

      {card ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Linked. Give {card.name} this card.</p>
          <SignInCard card={card} onDone={() => setCard(null)} />
        </div>
      ) : (
        <form onSubmit={link} className="space-y-3" noValidate>
          <h3 className="text-sm font-semibold">Link a parent</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Email (optional)</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Relationship</span>
              <Select value={relationship} onValueChange={(v) => setRelationship(v as typeof relationship)}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            If they already have a Nexa account with that email, we link it and email them. Otherwise we make them an account and
            show you a sign-in card.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Link parent
          </Button>
        </form>
      )}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
