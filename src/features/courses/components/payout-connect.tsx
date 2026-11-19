"use client";

/**
 * Connecting the bank account parents' payments go to (a/ux/04 §7;
 * contracts/billing.md section 3). Two steps: "Check account" asks the bank
 * for the holder's name (resolvePayoutAccount) and saves nothing; the
 * person confirms the name, then connectPayoutAccount saves it. Only the
 * last four digits ever come back.
 *
 * Also the organisation's choice of who is paid (setPayoutMode).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectPayoutAccount, resolvePayoutAccount, setPayoutMode } from "@/features/payments/fee-actions";

import { accountLabel, cleanAccountNumber, payoutErrorMessage } from "../lib/payouts-ui";

const SELECT =
  "border-input bg-background h-9 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PayoutConnect({
  banks,
  current,
  defaultBusinessName,
}: {
  banks: Array<{ code: string; name: string }>;
  /** The account this form replaces, if any. */
  current: { bankName: string; accountNumberLast4: string } | null;
  defaultBusinessName: string;
}) {
  const router = useRouter();
  const ids = React.useId();
  const [editing, setEditing] = React.useState(current == null);
  const [bankCode, setBankCode] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [businessName, setBusinessName] = React.useState(defaultBusinessName);
  const [idNumber, setIdNumber] = React.useState("");
  const [holder, setHolder] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"check" | "connect" | null>(null);

  // Any change to the details means the name shown no longer belongs to them.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setHolder(null);
  };

  const input = () => {
    const digits = cleanAccountNumber(accountNumber);
    if (!bankCode) return { error: "Choose the bank." };
    if (!digits) return { error: "Account numbers are 6 to 20 digits." };
    if (businessName.trim().length < 2) return { error: "Add the name parents will see on their statements." };
    return { bankCode, accountNumber: digits, businessName: businessName.trim(), ...(idNumber.trim() ? { idNumber: idNumber.trim() } : {}) };
  };

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const i = input();
    if ("error" in i) return setError(i.error ?? null);
    setError(null);
    setBusy("check");
    const res = await resolvePayoutAccount({ bankCode: i.bankCode, accountNumber: i.accountNumber, ...(i.idNumber ? { idNumber: i.idNumber } : {}) });
    setBusy(null);
    if (!res?.data) return setError(res?.validationErrors ? "Check the bank and account number." : payoutErrorMessage(res?.serverError));
    setHolder(res.data.accountName);
  }

  async function connect() {
    const i = input();
    if ("error" in i) return setError(i.error ?? null);
    setError(null);
    setBusy("connect");
    const res = await connectPayoutAccount(i);
    setBusy(null);
    if (!res?.data) return setError(res?.validationErrors ? "Check the details and try again." : payoutErrorMessage(res?.serverError));
    toast.success("Payout account connected.");
    setEditing(false);
    setHolder(null);
    setAccountNumber("");
    router.refresh();
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Change account
      </Button>
    );
  }

  return (
    <form onSubmit={check} className="max-w-md space-y-4" noValidate>
      {current ? (
        <p className="text-muted-foreground text-sm">
          The new account replaces {accountLabel(current)} for payments from now on.
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-bank`}>Bank</Label>
        <select id={`${ids}-bank`} value={bankCode} onChange={(e) => edit(setBankCode)(e.target.value)} className={SELECT}>
          <option value="">Choose a bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-acc`}>Account number</Label>
        <Input
          id={`${ids}-acc`}
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => edit(setAccountNumber)(e.target.value)}
          className="w-56 tabular-nums"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-biz`}>Business name</Label>
        <Input id={`${ids}-biz`} value={businessName} onChange={(e) => edit(setBusinessName)(e.target.value)} maxLength={100} />
        <p className="text-muted-foreground text-xs">Shown on parents&apos; statements.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-id`}>Account holder&apos;s ID number (optional)</Label>
        <Input id={`${ids}-id`} inputMode="numeric" autoComplete="off" value={idNumber} onChange={(e) => edit(setIdNumber)(e.target.value)} className="w-56" />
        <p className="text-muted-foreground text-xs">Only if the bank can&apos;t check the account without it.</p>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {holder ? (
        <div role="status" className="border-border space-y-3 rounded-lg border p-4 text-sm">
          <p className="flex items-center gap-2">
            <CheckCircle2 aria-hidden className="text-success size-4" />
            <span>
              Account holder: <span className="text-foreground font-semibold">{holder}</span>
            </span>
          </p>
          <p className="text-muted-foreground">Is this the right account?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={connect} disabled={busy != null}>
              {busy === "connect" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Yes, connect
            </Button>
            <Button type="button" variant="outline" onClick={() => setHolder(null)} disabled={busy != null}>
              No, edit
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy != null}>
            {busy === "check" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Check account
          </Button>
          {current ? (
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy != null}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}

export function PayoutModeSwitch({ mode }: { mode: "WORKSPACE" | "PER_TUTOR" }) {
  const router = useRouter();
  const [value, setValue] = React.useState(mode);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await setPayoutMode({ payoutMode: value });
    setBusy(false);
    if (!res?.data) return setError(payoutErrorMessage(res?.serverError));
    toast.success(value === "PER_TUTOR" ? "Each tutor is now paid into their own account." : "Payments now go to the organisation's account.");
    router.refresh();
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-foreground text-sm font-semibold">Who is paid</legend>
      <div className="space-y-2 text-sm">
        {(
          [
            ["WORKSPACE", "One account for the organisation", "Every course's fees go to the organisation's account."],
            ["PER_TUTOR", "Each tutor connects their own account", "Fees for a course go to its lead tutor's account. Tutors connect theirs here."],
          ] as const
        ).map(([v, label, hint]) => (
          <label key={v} className="flex items-start gap-2">
            <input type="radio" name="payout-mode" className="mt-1" checked={value === v} onChange={() => setValue(v)} />
            <span>
              <span className="text-foreground block">{label}</span>
              <span className="text-muted-foreground text-xs">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {value !== mode ? (
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Save
        </Button>
      ) : null}
    </fieldset>
  );
}
