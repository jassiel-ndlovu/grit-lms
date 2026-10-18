"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirmEmailVerification } from "@/features/auth/actions";

type State =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "done"; status: "verified" | "invalid" | "expired"; email?: string }
  | { phase: "error"; message: string };

export function VerifyEmailButton({ token }: { token: string }) {
  const [state, setState] = React.useState<State>({ phase: "idle" });

  async function onConfirm() {
    setState({ phase: "pending" });
    const res = await confirmEmailVerification({ token });
    if (res?.data) {
      setState({
        phase: "done",
        status: res.data.status,
        email: res.data.status === "verified" ? res.data.email : undefined,
      });
    } else {
      setState({ phase: "error", message: res?.serverError ?? "Something went wrong." });
    }
  }

  if (state.phase === "done" && state.status === "verified") {
    return (
      <div className="mt-4 space-y-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <CheckCircle2 className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
          <span>
            <strong>{state.email}</strong> is verified. You&apos;ll now receive the
            notification emails you&apos;ve opted into.
          </span>
        </p>
        <Button asChild>
          <Link href="/dashboard/settings">Go to settings</Link>
        </Button>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="mt-4 space-y-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
          {state.status === "expired"
            ? "This link has expired."
            : "This link is invalid or has already been used."}{" "}
          Request a new one from Settings.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/settings">Open settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted-foreground text-sm">
        Confirm that this email address belongs to you so we can send you course
        notifications.
      </p>
      {state.phase === "error" && <p className="text-destructive text-sm">{state.message}</p>}
      <Button
        onClick={onConfirm}
        disabled={state.phase === "pending"}
        className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
      >
        {state.phase === "pending" && <Loader2 className="size-4 animate-spin" />}
        Confirm my email
      </Button>
    </div>
  );
}
