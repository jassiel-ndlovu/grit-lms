"use client";

/**
 * /auth/sign-up: create an account (A's #154). Name, email and a password
 * of 10+ characters through signUpWithPassword, or "Continue with Google".
 * An email sign-up must verify its address, so success shows "Check your
 * email"; the link lands on /dashboard/welcome, where a new account
 * chooses tutor, student or parent, or on `?callbackUrl=` when it is a
 * same-site path (the invite page passes its own, #174). Before the Better
 * Auth cutover, sign-up is closed.
 */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react";

import { googleSignInAvailable, signUpWithPassword } from "@/lib/auth-client";
import { AuthFrame, Busy, Field, GoogleButton, INPUT, OrDivider, signUpOpen } from "@/components/auth/auth-parts";

const MIN_PASSWORD = 10;

type Phase = "form" | "creating" | "sent";

export default function SignUpPage() {
  return (
    <AuthFrame title="Create your Nexa account" lead="For tutors, students and parents.">
      {signUpOpen ? (
        <React.Suspense fallback={null}>
          <SignUpCard />
        </React.Suspense>
      ) : (
        <ClosedCard />
      )}
    </AuthFrame>
  );
}

/** Same-site paths only ("/x", not "//host"); anything else goes to the welcome page. */
function backTo(v: string | null): string | undefined {
  return v && /^\/(?![/\\])/.test(v) ? v : undefined;
}

function SignUpCard() {
  const callbackUrl = backTo(useSearchParams().get("callbackUrl"));
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("form");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setPhase("creating");
    try {
      const r = await signUpWithPassword({ name: name.trim(), email: email.trim(), password, callbackUrl });
      if (r.ok) {
        setPhase("sent");
        return;
      }
      setError(r.error);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setPhase("form");
  }

  if (phase === "sent") {
    return (
      <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
          <MailCheck aria-hidden className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-medium text-slate-900">Check your email</h2>
        <p className="mt-1 text-sm text-slate-600">
          We&apos;ve sent a link to <span className="font-medium text-slate-900">{email.trim()}</span>. Open it to verify your
          address and finish setting up.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Nothing there? Check your spam folder, or{" "}
          <button type="button" onClick={() => setPhase("form")} className="font-medium text-slate-700 underline underline-offset-2">
            try a different address
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[420px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {phase === "creating" ? (
          <Busy message="Creating your account…" sub="One moment." />
        ) : (
          <div className="space-y-4">
            {googleSignInAvailable ? (
              <>
                <GoogleButton callbackUrl={callbackUrl ?? "/dashboard/welcome"} />
                <OrDivider />
              </>
            ) : null}
            <form onSubmit={onSubmit} className="space-y-4">
              <Field id="name" label="Your name" icon={<User className="size-4" />}>
                <input
                  id="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT}
                  placeholder="Thandi Mokoena"
                />
              </Field>
              <Field id="email" label="Email" icon={<Mail className="size-4" />}>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT}
                  placeholder="you@example.com"
                />
              </Field>
              <Field id="password" label="Password" icon={<Lock className="size-4" />} hint={`At least ${MIN_PASSWORD} characters.`}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </Field>

              {error ? (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Create account
                <ArrowRight aria-hidden className="size-4" />
              </button>
              <p className="text-center text-xs text-slate-500">
                For tutors, students and parents. You&apos;ll choose which after you verify your email.
              </p>
            </form>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/auth" className="font-medium text-slate-900 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}

function ClosedCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-base font-medium text-slate-900">Sign-up isn&apos;t open yet</h2>
      <p className="mt-1 text-sm text-slate-600">For now, accounts are created by request.</p>
      <Link
        href="/auth"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        Back to sign in
      </Link>
    </div>
  );
}
