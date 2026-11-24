"use client";

/**
 * /auth: sign-in page.
 *
 * Signs in through A's @/lib/auth-client (#154), so the same page works
 * before and after the Better Auth cutover. After the cutover it also
 * shows "Continue with Google" (when configured), a code step for
 * accounts with two-factor on, and a link to /auth/sign-up.
 *
 * The form is replaced by a spinner while signing in, so the wait is
 * never silent. ?callbackUrl= is honoured for same-site paths only.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";

import { authClient, googleSignInAvailable, signInWithPassword } from "@/lib/auth-client";
import { AuthFrame, Busy, Field, GoogleButton, INPUT, keepCallback, OrDivider, safeCallback, signUpOpen } from "@/components/auth/auth-parts";

/** With sign-up closed: the enquiry form, opened on "I want an account". */
const requestHref = "/contact?kind=ACCESS&from=sign-in";

type Phase = "form" | "code" | "signing-in" | "redirecting";

export default function LoginPage() {
  return (
    <AuthFrame title="Sign in to Nexa LMS" lead="Continue where you left off.">
      <React.Suspense fallback={<div className="min-h-[380px] rounded-xl border border-border bg-card shadow-sm" />}>
        <SignInCard />
      </React.Suspense>
    </AuthFrame>
  );
}

function SignInCard() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [trustDevice, setTrustDevice] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("form");

  function done() {
    setPhase("redirecting");
    router.push(callbackUrl);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("signing-in");
    try {
      const r = await signInWithPassword({ identifier: identifier.trim(), password, callbackUrl });
      if (r.ok) return done();
      if (r.twoFactorRequired) {
        setPhase("code");
        return;
      }
      setError(r.error);
      setPhase("form");
    } catch {
      setError("We couldn't sign you in just now. Check your connection and try again.");
      setPhase("form");
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("signing-in");
    try {
      const r = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice });
      if (!r.error) return done();
      setError(r.error.status === 429 ? "Too many attempts. Wait a minute and try again." : "That code didn't work. Check your app and try again.");
    } catch {
      setError("We couldn't sign you in just now. Check your connection and try again.");
    }
    setCode("");
    setPhase("code");
  }

  const errorBox = error ? (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </div>
  ) : null;

  return (
    <>
      <div className="min-h-[380px] rounded-xl border border-border bg-card p-6 shadow-sm">
        {phase === "signing-in" || phase === "redirecting" ? (
          <Busy
            message={phase === "signing-in" ? "Signing you in…" : "Taking you to your dashboard…"}
            sub={phase === "signing-in" ? "Checking your details." : "One moment, opening your dashboard."}
          />
        ) : phase === "code" ? (
          <form onSubmit={onCode} className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-foreground">Two-step verification</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
            </div>
            <Field id="code" label="Code" icon={<KeyRound className="size-4" />}>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${INPUT} tracking-widest`}
                placeholder="123 456"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="size-4 rounded border-input" />
              Trust this device for 30 days
            </label>
            {errorBox}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Verify
              <ArrowRight aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("form");
                setError(null);
                setCode("");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {googleSignInAvailable ? (
              <>
                <GoogleButton callbackUrl={callbackUrl} />
                <OrDivider />
              </>
            ) : null}
            <form onSubmit={onSubmit} className="space-y-4">
              <Field id="identifier" label={signUpOpen ? "Email or username" : "Email"} icon={<Mail className="size-4" />}>
                <input
                  id="identifier"
                  type={signUpOpen ? "text" : "email"}
                  required
                  autoComplete={signUpOpen ? "username" : "email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={INPUT}
                  placeholder={signUpOpen ? "you@example.com or your username" : "you@example.com"}
                />
              </Field>

              <Field
                id="password"
                label="Password"
                icon={<Lock className="size-4" />}
                hint={signUpOpen ? "First time? Use the sign-in code from your tutor." : undefined}
              >
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT} pr-10`}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </Field>

              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>

              {errorBox}

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in
                <ArrowRight aria-hidden className="size-4" />
              </button>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden className="size-3" />
                Secure sign-in over HTTPS.
              </div>
            </form>
          </div>
        )}
      </div>

      {phase === "form" ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-4 text-center text-sm">
          <p className="text-foreground">Don&apos;t have an account yet?</p>
          {signUpOpen ? (
            <Link
              href={keepCallback("/auth/sign-up", params.get("callbackUrl"))}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-brand-terracotta px-4 py-2 text-sm font-medium text-brand-terracotta-foreground transition-colors hover:bg-brand-terracotta/90"
            >
              Create an account
            </Link>
          ) : (
            <>
              <a
                href={requestHref}
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-brand-terracotta px-4 py-2 text-sm font-medium text-brand-terracotta-foreground transition-colors hover:bg-brand-terracotta/90"
              >
                <Mail aria-hidden className="size-4" />
                Ask for an account
              </a>
              <p className="mt-2 text-xs text-muted-foreground">Tell us who you are, and we&apos;ll reply within one working day.</p>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
