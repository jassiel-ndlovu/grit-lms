"use client";

/**
 * Pieces shared by the sign-in and sign-up pages (A's #154): the page
 * frame, a labelled field with an icon, the Google button and the "or"
 * divider. Sign-in logic lives in A's @/lib/auth-client.
 */

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { signInWithGoogle } from "@/lib/auth-client";

const APP_NAME = "Nexa LMS";

/**
 * Whether people can create their own accounts: Better Auth is on
 * (NEXT_PUBLIC_AUTH_PROVIDER, the same switch @/lib/auth-client reads).
 * Before the cutover, sign-up stays closed.
 */
export const signUpOpen = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "better-auth";

/** Only same-site paths, so a crafted ?callbackUrl= can't send people elsewhere. */
export function safeCallback(raw: string | null | undefined, fallback = "/dashboard/start"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}

export function AuthFrame({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-orange-50/30 via-white to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-[#1f1e1b] font-serif text-sm text-[#f7f7f5]">
              Nx
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{lead}</p>
          </div>
          {children}
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

export const INPUT =
  "w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200";

export function Field({
  id,
  label,
  icon,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{icon}</div>
        {children}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-slate-200" />
      or
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/** Google's "G", in its own colours (Google's sign-in branding guidelines). */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/** "Continue with Google": signs in, or creates the account for someone new. Redirects away. */
export function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInWithGoogle(callbackUrl);
          } catch {
            setError("Google sign-in didn't start. Try again.");
            setBusy(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>
      {error ? (
        <p role="alert" className="text-center text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Busy({ message, sub }: { message: string; sub: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[340px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
        <Loader2 aria-hidden className="size-6 animate-spin" />
      </div>
      <div>
        <p className="text-base font-medium text-slate-900">{message}</p>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
