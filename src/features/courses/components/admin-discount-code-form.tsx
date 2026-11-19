"use client";

/**
 * Creates a Nexa discount code for workspace bills (adminCreateDiscountCode,
 * contracts/billing.md section 4). Workspaces redeem it on their billing
 * page. The form checks what it can before sending; A checks everything
 * again and answers CODE_INVALID or CODE_USED.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCreateDiscountCode } from "@/features/admin/billing-actions";
import { SERVICES } from "@/features/billing/catalogue";

import { adminErrorMessage, normaliseCode, parsePercentToBps, parseRandToCents } from "../lib/admin-billing-ui";
import { TIER_LABEL, type TierKey } from "../lib/billing-ui";

const PREMIUM = Object.values(SERVICES).filter((s) => s.kind === "premium" && s.status === "v1");
const SELECT =
  "border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DiscountCodeForm() {
  const ids = React.useId();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({
    code: "",
    description: "",
    kind: "PERCENT" as "PERCENT" | "FIXED",
    value: "",
    scope: "WORKSPACE_BILL" as "WORKSPACE_BILL" | "TIER" | "ADDON",
    tier: "PLUS" as TierKey,
    service: (PREMIUM[0]?.key ?? "") as string,
    startsOn: today,
    endsOn: "",
    maxRedemptions: "",
    durationPeriods: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const whole = (s: string) => (s.trim() === "" ? null : /^\d+$/.test(s.trim()) && Number(s) > 0 ? Number(s) : NaN);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    const code = normaliseCode(f.code);
    if (!code) return setError("Codes are 3 to 32 letters, digits, - or _.");
    if (!f.description.trim()) return setError("Add a description: workspaces see it on their invoices.");
    const percentBps = f.kind === "PERCENT" ? parsePercentToBps(f.value) : null;
    const amountCents = f.kind === "FIXED" ? parseRandToCents(f.value) : null;
    if (f.kind === "PERCENT" && percentBps == null) return setError("Enter a percentage from 0,01 to 100.");
    if (f.kind === "FIXED" && amountCents == null) return setError("Enter an amount in rand, for example 100.");
    const maxRedemptions = whole(f.maxRedemptions);
    const durationPeriods = whole(f.durationPeriods);
    if (Number.isNaN(maxRedemptions) || Number.isNaN(durationPeriods)) return setError("Uses and payments are whole numbers above zero, or empty.");
    if (f.endsOn && f.endsOn < f.startsOn) return setError("The end date is before the start date.");

    setBusy(true);
    const res = await adminCreateDiscountCode({
      code,
      description: f.description.trim(),
      kind: f.kind,
      percentBps,
      amountCents,
      scope: f.scope,
      scopeTierKey: f.scope === "TIER" ? f.tier : null,
      scopeServiceKey: f.scope === "ADDON" ? f.service : null,
      // Starts at the beginning and ends at the end of the chosen UTC days.
      startsAt: `${f.startsOn}T00:00:00.000Z`,
      endsAt: f.endsOn ? `${f.endsOn}T23:59:59.000Z` : null,
      maxRedemptions,
      durationPeriods,
    });
    setBusy(false);
    if (!res?.data) return setError(res?.validationErrors ? "Check the fields and try again." : adminErrorMessage(res?.serverError));
    setCreated(res.data.code);
    toast.success(`Code ${res.data.code} created.`);
    setF((s) => ({ ...s, code: "", description: "", value: "" }));
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-code`}>Code</Label>
          <Input id={`${ids}-code`} value={f.code} onChange={(e) => set("code")(e.target.value)} placeholder="LAUNCH10" autoCapitalize="characters" className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-desc`}>Description</Label>
          <Input id={`${ids}-desc`} value={f.description} onChange={(e) => set("description")(e.target.value)} maxLength={200} placeholder="10% off plans for launch" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Discount</legend>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {(["PERCENT", "FIXED"] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input type="radio" name={`${ids}-kind`} checked={f.kind === k} onChange={() => set("kind")(k)} />
              {k === "PERCENT" ? "Percentage" : "Fixed amount"}
            </label>
          ))}
          <span className="inline-flex items-center gap-2">
            <Label htmlFor={`${ids}-value`} className="sr-only">
              {f.kind === "PERCENT" ? "Percentage off" : "Amount off in rand"}
            </Label>
            {f.kind === "FIXED" ? <span aria-hidden>R</span> : null}
            <Input id={`${ids}-value`} inputMode="decimal" value={f.value} onChange={(e) => set("value")(e.target.value)} className="w-28" placeholder={f.kind === "PERCENT" ? "10" : "100"} />
            {f.kind === "PERCENT" ? <span aria-hidden>%</span> : null}
          </span>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-scope`}>Applies to</Label>
          <select id={`${ids}-scope`} value={f.scope} onChange={(e) => set("scope")(e.target.value as typeof f.scope)} className={SELECT}>
            <option value="WORKSPACE_BILL">The whole bill</option>
            <option value="TIER">Courses on one plan</option>
            <option value="ADDON">One service&apos;s charges</option>
          </select>
        </div>
        {f.scope === "TIER" ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-tier`}>Plan</Label>
            <select id={`${ids}-tier`} value={f.tier} onChange={(e) => set("tier")(e.target.value as TierKey)} className={SELECT}>
              {(["CORE", "PLUS", "PRO"] as const).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {f.scope === "ADDON" ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-service`}>Service</Label>
            <select id={`${ids}-service`} value={f.service} onChange={(e) => set("service")(e.target.value)} className={SELECT}>
              {PREMIUM.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-starts`}>Starts</Label>
          <Input id={`${ids}-starts`} type="date" value={f.startsOn} onChange={(e) => set("startsOn")(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-ends`}>Ends (optional)</Label>
          <Input id={`${ids}-ends`} type="date" min={f.startsOn} value={f.endsOn} onChange={(e) => set("endsOn")(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-max`}>Workspaces that can use it (optional)</Label>
          <Input id={`${ids}-max`} inputMode="numeric" value={f.maxRedemptions} onChange={(e) => set("maxRedemptions")(e.target.value)} className="w-28" placeholder="No limit" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-dur`}>Payments it applies to (optional)</Label>
          <Input id={`${ids}-dur`} inputMode="numeric" value={f.durationPeriods} onChange={(e) => set("durationPeriods")(e.target.value)} className="w-28" placeholder="Every one" />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {created ? (
        <p role="status" className="text-sm">
          Created <span className="font-mono font-medium">{created}</span>. Workspaces enter it on their billing page.
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Create code
      </Button>
    </form>
  );
}
