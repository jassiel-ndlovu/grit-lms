"use client";

/**
 * "Join" on /auth/invite/[token], for a signed-in person (#174; A's
 * acceptInvite). The invite only works for the address it was sent to;
 * on WRONG_ACCOUNT we say which one, masked, and offer to switch accounts.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { acceptInvite } from "@/features/auth/invite-actions";
import { appSignOut } from "@/lib/auth-client";

const REASON: Record<string, string> = {
  INVALID: "This invite link isn't valid.",
  EXPIRED: "This invite has expired. Ask for a new one.",
  ACCEPTED: "This invite has already been used.",
  REVOKED: "This invite was cancelled.",
};

export function AcceptInvite({ token, workspaceName, signedInAs, emailMasked }: { token: string; workspaceName: string; signedInAs: string; emailMasked: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wrongAccount, setWrongAccount] = React.useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await acceptInvite({ token });
    const r = res?.data as { ok: boolean; reason?: string; emailMasked?: string } | undefined;
    if (r?.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setBusy(false);
    if (r?.reason === "WRONG_ACCOUNT") return setWrongAccount(r.emailMasked ?? emailMasked);
    setError((r?.reason && REASON[r.reason]) || res?.serverError || "We couldn't accept the invitation just now. Try again in a minute.");
  }

  if (wrongAccount) {
    return (
      <div className="space-y-4 text-sm text-foreground">
        <p role="alert">
          This invite is for <span className="font-medium text-foreground">{wrongAccount}</span>. You&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{signedInAs}</span>.
        </p>
        <button
          type="button"
          onClick={() => appSignOut(`/auth?callbackUrl=${encodeURIComponent(`/auth/invite/${token}`)}`)}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in with {wrongAccount}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{signedInAs}</span>.
      </p>
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Joining…" : `Join ${workspaceName}`}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
