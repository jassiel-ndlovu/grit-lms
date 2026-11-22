"use client";

/**
 * The emailed-link landing pages (/account/*; viewer contract Drafts 1.8
 * and 1.9): one button each, so the action runs on a click and never on
 * load (mail scanners open links). Each works signed out.
 *
 *   cancel-deletion → cancelAccountDeletion({ token })  → { cancelled }
 *   confirm-email   → confirmEmailChange({ token })     → { status, email? }
 *   revert-email    → revertEmailChange({ token })      → { status }
 */

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirmEmailChange, revertEmailChange } from "@/features/auth/email-change-actions";
import { actionError } from "@/features/courses/lib/account-ui";
import { cancelAccountDeletion } from "@/features/users/privacy-actions";

import { EMAIL_LINK_COPY, type EmailLinkKind } from "./account-copy";

type Outcome = { tone: "success" | "neutral" | "error"; title: string; body: React.ReactNode; next?: { href: string; label: string } };

export function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const tone =
    outcome.tone === "success"
      ? "border-emerald-600/30 bg-emerald-600/5"
      : outcome.tone === "error"
        ? "border-destructive/40 bg-destructive/5"
        : "border-border bg-muted/50";
  return (
    <div role="status" className={`space-y-2 rounded-lg border p-4 ${tone}`}>
      <p className="text-foreground text-sm font-semibold">{outcome.title}</p>
      <div className="text-muted-foreground space-y-2 text-sm">{outcome.body}</div>
      {outcome.next ? (
        <Button asChild size="sm" className="mt-2">
          <Link href={outcome.next.href}>{outcome.next.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function useRun<T>(run: () => Promise<{ data?: T; serverError?: string; validationErrors?: unknown } | undefined>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<T | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const res = await run();
    setBusy(false);
    if (res?.data) setData(res.data);
    else setError(actionError(res, "That didn't work. Check your connection and try again."));
  }
  return { busy, error, data, go };
}

function ActionButton({ busy, onClick, children, variant }: { busy: boolean; onClick: () => void; children: React.ReactNode; variant?: "default" | "destructive" }) {
  return (
    <Button type="button" onClick={onClick} disabled={busy} variant={variant}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

/* ─── Cancel a pending deletion ─────────────────────────────────────── */

export function CancelDeletionAction({ token }: { token: string }) {
  const { busy, error, data, go } = useRun(() => cancelAccountDeletion({ token }));
  if (data) {
    return (
      <OutcomeCard
        outcome={
          data.cancelled
            ? { tone: "success", title: "Your account won't be deleted", body: <p>You can sign in again as usual.</p>, next: { href: "/auth", label: "Sign in" } }
            : {
                tone: "neutral",
                title: "Nothing to cancel",
                body: <p>This link has been used, or the account was already deleted. If you can sign in, your account is safe.</p>,
                next: { href: "/auth", label: "Go to sign-in" },
              }
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <ActionButton busy={busy} onClick={go}>
        Keep my account
      </ActionButton>
      <ErrorLine error={error} />
    </div>
  );
}

/* ─── Confirm or undo an email change ───────────────────────────────── */

export function EmailLinkAction({ kind, token }: { kind: EmailLinkKind; token: string }) {
  const copy = EMAIL_LINK_COPY[kind];
  const { busy, error, data, go } = useRun<{ status: string; email?: string }>(() =>
    kind === "confirm" ? confirmEmailChange({ token }) : revertEmailChange({ token }),
  );
  if (data) {
    const s = data.status as keyof typeof copy.outcomes;
    const o = copy.outcomes[s] ?? copy.outcomes.invalid;
    return (
      <OutcomeCard
        outcome={{
          tone: o.tone,
          title: o.title,
          body: (
            <>
              {"email" in data && data.email && s === "changed" ? (
                <p>
                  Your email address is now <strong className="text-foreground [overflow-wrap:anywhere]">{data.email}</strong>.
                </p>
              ) : null}
              <p>{o.body}</p>
            </>
          ),
          next: o.next,
        }}
      />
    );
  }
  return (
    <div className="space-y-3">
      <ActionButton busy={busy} onClick={go} variant={kind === "revert" ? "destructive" : "default"}>
        {copy.button}
      </ActionButton>
      <ErrorLine error={error} />
    </div>
  );
}
