"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/features/auth/password-reset-actions";

export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [phase, setPhase] = React.useState<"idle" | "pending" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("pending");
    await requestPasswordResetAction({ email });
    setPhase("sent");
  }

  if (phase === "sent") {
    return (
      <div className="mt-4 space-y-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <CheckCircle2 className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
          <span>
            If <strong>{email}</strong> has an account, a link to choose a new password is on its way. It works once,
            for one hour. Check your spam folder if it doesn&apos;t arrive.
          </span>
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <p className="text-muted-foreground text-sm">Enter the email you sign in with and we&apos;ll send you a link.</p>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={phase === "pending"}>
        {phase === "pending" ? <Loader2 className="size-4 animate-spin" /> : null}
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/" className="text-brand-terracotta underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
