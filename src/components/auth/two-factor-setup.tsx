"use client";

/**
 * Two-factor setup for owners and Nexa admins (#178; design 02, section 7;
 * viewer.user.twoFactorRequired). Better Auth only:
 *   1. password → authClient.twoFactor.enable → an otpauth:// link. Accounts
 *      without a password (Google sign-ups) skip the password: the server's
 *      `allowPasswordless` lets them enable it without one.
 *   2. add it to an authenticator app (scan the QR code, open the link on a
 *      phone, or type the key), then enter a code → authClient.twoFactor.verifyTotp
 *   3. save the backup codes.
 * "Remind me tomorrow" skips it for a day (remindTwoFactorLater).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Lock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { renderSVG } from "uqr";

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

const BUTTON = "w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const QUIET = "w-full rounded-md py-2 text-sm text-muted-foreground hover:text-foreground";

type Step = { kind: "password" } | { kind: "scan"; uri: string; backupCodes: string[] } | { kind: "codes"; backupCodes: string[] };

/** The otpauth:// link as an SVG QR code (uqr, no dependencies). Empty if it can't be drawn. */
export function totpQrSvg(uri: string): string {
  try {
    return renderSVG(uri, { border: 2, ecc: "M" });
  } catch {
    return "";
  }
}

/** Step 2's body: the QR code next to the setup key, and the link for phones. */
export function TotpKeyBlock({ uri }: { uri: string }) {
  const secret = secretFromTotpUri(uri);
  const qr = totpQrSvg(uri);
  return (
    <>
      Add Nexa to your authenticator app. Scan the QR code with the app,{" "}
      <a href={uri} className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2">
        <Smartphone className="size-3.5" /> open it in the app
      </a>{" "}
      on this phone, or choose &quot;Enter a setup key&quot; in the app and type the key.
      <span className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {qr ? (
          <span
            role="img"
            aria-label="QR code for your authenticator app"
            data-testid="totp-qr"
            className="block size-40 shrink-0 rounded-md border border-border bg-card p-1 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        ) : null}
        <span className="block min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Setup key</span>
          <span className="mt-1 block rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-wider break-all text-foreground" data-testid="totp-secret">
            {secret}
          </span>
        </span>
      </span>
    </>
  );
}

export function TwoFactorSetup({ remindLater, hasPassword = true }: { remindLater: () => Promise<void>; hasPassword?: boolean }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>({ kind: "password" });
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasPassword && !password) return setError("Enter your password.");
    setBusy(true);
    // No password on the account (Google sign-up): the server allows enabling without one.
    const r = await authClient.twoFactor.enable((hasPassword ? { password } : {}) as { password: string });
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
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
  const card = "space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm";

  if (step.kind === "password") {
    return (
      <form onSubmit={start} className={card} noValidate>
        <p className="text-sm text-muted-foreground">
          You&apos;ll need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        {hasPassword ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">You sign in with Google, so there&apos;s no password to enter.</p>
        )}
        {alert}
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? "Starting…" : hasPassword ? "Continue" : "Start setup"}
        </button>
        <button type="button" onClick={later} disabled={busy} className={QUIET}>
          Remind me tomorrow
        </button>
      </form>
    );
  }

  if (step.kind === "scan") {
    return (
      <form onSubmit={verify} className={card} noValidate>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-foreground">
          <li>
            <TotpKeyBlock uri={step.uri} />
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
      <p className="text-sm font-medium text-foreground">Two-factor sign-in is on.</p>
      <p className="text-sm text-muted-foreground">
        Keep these backup codes somewhere safe. Each one signs you in once if you lose your phone. This is the only time
        they&apos;re shown.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm text-foreground">
        {step.backupCodes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button type="button" onClick={() => copyCodes(step.backupCodes)} className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground">
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
