"use client";

/**
 * /auth — sign-in page.
 *
 * The form is replaced by a centered spinner + status text the moment
 * signIn is fired, so the user gets visual feedback instead of a silent
 * wait. On success we push to /dashboard; on failure we surface the
 * error and swap back to the form.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

const APP_NAME = "Nexa LMS";

const SIGNUP_EMAIL = "nkosijassiel@gmail.com";
const SIGNUP_SUBJECT = "Nexa LMS access request";
const SIGNUP_BODY = [
  "Hi,",
  "",
  "I would like an account on Nexa LMS.",
  "",
  "  Name:  ",
  "  Role:  (Student / Tutor)",
  "  Course / class (optional):  ",
  "",
  "Please let me know the next steps.",
  "",
  "Thanks!",
].join("\n");

const mailtoHref = `mailto:${SIGNUP_EMAIL}?subject=${encodeURIComponent(
  SIGNUP_SUBJECT,
)}&body=${encodeURIComponent(SIGNUP_BODY)}`;

type Phase = "form" | "signing-in" | "redirecting";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("form");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("signing-in");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      if (result?.error) {
        setError(result.error);
        setPhase("form");
        return;
      }
      // Success — show the redirect state until the navigation flushes.
      setPhase("redirecting");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setPhase("form");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-orange-50/30 via-white to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-slate-900 text-white">
              <GraduationCap className="size-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              {APP_NAME}
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Continue where you left off.
            </p>
          </div>

          <div className="min-h-[380px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {phase !== "form" ? (
              <SigningInPanel phase={phase} />
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Field
                  id="email"
                  label="Email"
                  icon={<Mail className="size-4" />}
                >
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="you@example.com"
                  />
                </Field>

                <Field
                  id="password"
                  label="Password"
                  icon={<Lock className="size-4" />}
                >
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </Field>

                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Sign in
                  <ArrowRight className="size-4" />
                </button>

                <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                  <ShieldCheck className="size-3" />
                  Secure sign-in over HTTPS.
                </div>
              </form>
            )}
          </div>

          {phase === "form" && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-center text-sm">
              <p className="text-slate-700">
                Don&apos;t have an account yet?
              </p>
              <a
                href={mailtoHref}
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
              >
                <Mail className="size-4" />
                Email us to request access
              </a>
              <p className="mt-2 text-xs text-slate-500">
                Opens your email app with a short message pre-filled.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {APP_NAME}
        </div>
      </footer>
    </div>
  );
}

/* ─── Subcomponents ────────────────────────────────────────────────────── */

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

function SigningInPanel({ phase }: { phase: "signing-in" | "redirecting" }) {
  const message =
    phase === "signing-in" ? "Signing you in…" : "Taking you to your dashboard…";
  const sub =
    phase === "signing-in"
      ? "Verifying your credentials."
      : "One moment — loading your workspace.";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[340px] flex-col items-center justify-center gap-4 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
        <Loader2 className="size-6 animate-spin" />
      </div>
      <div>
        <p className="text-base font-medium text-slate-900">{message}</p>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
