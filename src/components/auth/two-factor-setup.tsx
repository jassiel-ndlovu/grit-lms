"use client";

/**
 * Two-factor setup for owners and Nexa admins (#178; design 02, section 7;
 * viewer.user.twoFactorRequired). Better Auth only:
 *   1. password → authClient.twoFactor.enable → an otpauth:// link
 *   2. add it to an authenticator app (open the link on a phone, or type the
 *      key), then enter a code → authClient.twoFactor.verifyTotp
 *   3. save the backup codes.
 * "Remind me tomorrow" skips it for a day (remindTwoFactorLater).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Lock, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { Field, INPUT } from "./auth-parts";

/** The base32 secret inside an otpauth:// URI, grouped in fours for typing. */
export function secretFromTotpUri(uri: string): string {
  try {
    const s = new URL(uri).searchParams.get("secret") ?? "";
    return s.replace(/(.{4})/g, "$1 ").trim();
  } catch {
    return "";
  }
}

const BUTTON = "w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
const QUIET = "w-full rounded-md py-2 text-sm text-slate-600 hover:text-slate-900";

type Step = { kind: "password" } | { kind: "scan"; uri: string; backupCodes: string[] } | { kind: "codes"; backupCodes: string[] };

export function TwoFactorSetup({ remindLater }: { remindLater: () => Promise<void> }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>({ kind: "password" });
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) return setError("Enter your password.");
    setBusy(true);
    const r = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (r.error || !r.data || r.data.method !== "totp") {
      return setError(
        r.error?.status === 400 || r.error?.status === 401 ? "That password isn't right." : r.error?.message ?? "Couldn't start setup. Try again.",
      );
    }
    setPassword("");
    setStep({ kind: "scan", uri: r.data.totpURI, backupCodes: r.data.backupCodes });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "scan") return;
    setError(null);
    const c = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(c)) return setError("Enter the 6-digit code from the app.");
    setBusy(true);
    const r = await authClient.twoFactor.verifyTotp({ code: c });
    setBusy(false);
    if (r.error) return setError("That code didn't work. Check the time on your phone and try the newest code.");
    setStep({ kind: "codes", backupCodes: step.backupCodes });
  }

  async function later() {
    setBusy(true);
    await remindLater();
    router.replace("/dashboard");
    router.refresh();
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Copied the backup codes.");
    } catch {
      toast.error("Couldn't copy. Write them down instead.");
    }
  }

  const alert = error ? (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  ) : null;
  const card = "space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm";

  if (step.kind === "password") {
    return (
      <form onSubmit={start} className={card} noValidate>
        <p className="text-sm text-slate-600">
          You&apos;ll need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <Field id="2fa-password" label="Your password" icon={<Lock className="size-4" />}>
          <input
            id="2fa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </Field>
        {alert}
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? "Starting…" : "Continue"}
        </button>
        <button type="button" onClick={later} disabled={busy} className={QUIET}>
          Remind me tomorrow
        </button>
      </form>
    );
  }

  if (step.kind === "scan") {
    const secret = secretFromTotpUri(step.uri);
    return (
      <form onSubmit={verify} className={card} noValidate>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            Add Nexa to your authenticator app.{" "}
            <a href={step.uri} className="inline-flex items-center gap-1 font-medium text-slate-900 underline underline-offset-2">
              <Smartphone className="size-3.5" /> Open in the app
            </a>{" "}
            on this phone, or choose &quot;Enter a setup key&quot; in the app and type:
            <span className="mt-2 block rounded-md bg-slate-100 px-3 py-2 font-mono text-sm tracking-wider break-all text-slate-900" data-testid="totp-secret">
              {secret}
            </span>
          </li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <Field id="2fa-code" label="Code" icon={<KeyRound className="size-4" />}>
          <input
            id="2fa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={INPUT}
            placeholder="123 456"
          />
        </Field>
        {alert}
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? "Checking…" : "Turn on two-factor sign-in"}
        </button>
      </form>
    );
  }

  return (
    <div className={card}>
      <p className="text-sm font-medium text-slate-900">Two-factor sign-in is on.</p>
      <p className="text-sm text-slate-600">
        Keep these backup codes somewhere safe. Each one signs you in once if you lose your phone. This is the only time
        they&apos;re shown.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-3 font-mono text-sm text-slate-900">
        {step.backupCodes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button type="button" onClick={() => copyCodes(step.backupCodes)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
        <Copy className="size-3.5" /> Copy the codes
      </button>
      <button
        type="button"
        onClick={() => {
          router.replace("/dashboard");
          router.refresh();
        }}
        className={BUTTON}
      >
        I&apos;ve saved them
      </button>
    </div>
  );
}
