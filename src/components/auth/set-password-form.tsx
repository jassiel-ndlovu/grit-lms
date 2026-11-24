"use client";

/**
 * First sign-in with a tutor's code: choose your own password (#174;
 * viewer.user.mustChangePassword, A's setOwnPassword). The rule matches
 * A's passwordProblem: at least 8 characters, mixing letters with numbers
 * or symbols; the server has the last word.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";

import { setOwnPassword } from "@/features/users/account-actions";

import { Field, INPUT } from "./auth-parts";

function problem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 2) return "Mix letters with numbers or symbols.";
  return null;
}

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = problem(password);
    if (p) return setError(p);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const res = await setOwnPassword({ newPassword: password });
    if (!res?.data?.ok) {
      setBusy(false);
      return setError(res?.serverError ?? "We couldn't save your password just now. Try again.");
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm" noValidate>
      <Field id="new-password" label="New password" icon={<Lock className="size-4" />} hint="At least 8 characters, with letters and numbers or symbols.">
        <input
          id="new-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${INPUT} pr-10`}
          aria-describedby="new-password-hint"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </Field>
      <Field id="confirm-password" label="Type it again" icon={<Lock className="size-4" />}>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={INPUT}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
