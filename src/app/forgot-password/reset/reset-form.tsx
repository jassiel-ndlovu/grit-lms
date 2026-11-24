"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/features/auth/password-reset-actions";

type State =
  | { phase: "idle" | "pending" }
  | { phase: "done"; email: string }
  | { phase: "dead"; expired: boolean }
  | { phase: "error"; message: string };

export function ResetForm({ token }: { token: string }) {
  const [pw, setPw] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [state, setState] = React.useState<State>({ phase: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== again) {
      setState({ phase: "error", message: "The two passwords don't match." });
      return;
    }
    setState({ phase: "pending" });
    const res = await resetPasswordAction({ token, password: pw });
    const d = res?.data;
    if (!d) setState({ phase: "error", message: res?.serverError ?? "We couldn't change your password just now. Try again, or ask for a new link." });
    else if (d.status === "reset") setState({ phase: "done", email: d.email });
    else if (d.status === "weak") setState({ phase: "error", message: d.message });
    else setState({ phase: "dead", expired: d.status === "expired" });
  }

  if (state.phase === "done") {
    return (
      <div className="mt-4 space-y-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <CheckCircle2 className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
          <span>
            The password for <strong>{state.email}</strong> is changed. Sign in with it now.
          </span>
        </p>
        <Button asChild>
          <Link href="/">Sign in</Link>
        </Button>
      </div>
    );
  }
  if (state.phase === "dead") {
    return (
      <div className="mt-4 space-y-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
          {state.expired ? "This link has expired." : "This link is invalid or has already been used."}
        </p>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <p className="text-muted-foreground text-sm">At least 10 characters, mixing letters with numbers or symbols.</p>
      <div className="space-y-1.5">
        <Label htmlFor="pw">New password</Label>
        <Input id="pw" type="password" autoComplete="new-password" required minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="again">New password again</Label>
        <Input id="again" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
      </div>
      {state.phase === "error" ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" className="w-full" disabled={state.phase === "pending"}>
        {state.phase === "pending" ? <Loader2 className="size-4 animate-spin" /> : null}
        Set new password
      </Button>
    </form>
  );
}
