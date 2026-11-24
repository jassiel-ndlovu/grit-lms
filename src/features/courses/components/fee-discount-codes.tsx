"use client";

/**
 * A workspace's discount codes on parents' fees (a/ux/05, section 3;
 * contracts/billing.md section 3): the list with Turn off, and the form for
 * a new one. Parents enter a code when paying (FeeCheckout). Owners and
 * admins only, since a discount comes out of every payee's share.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFeeDiscountCode, deactivateFeeDiscountCode } from "@/features/payments/fee-actions";
import { formatDate, type DateContext } from "@/lib/datetime";

import { codeStatus, discountLabel, normaliseCode, parsePercentToBps, parseRandToCents } from "../lib/admin-billing-ui";
import { formatRand } from "../lib/billing-ui";
import { checkoutErrorMessage } from "../lib/fee-pay-ui";

export type FeeCode = {
  id: string;
  code: string;
  description: string;
  kind: string;
  percentBps: number | null;
  amountCents: number | null;
  startsAt: string;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  durationPeriods: number | null;
  active: boolean;
};

/* ───── The list ───── */

export function FeeCodeList({ codes, ctx, now }: { codes: FeeCode[]; ctx: DateContext; now: string }) {
  // The form saves whole UTC days (start 00:00, end 23:59:59), so show them in UTC too.
  const day = (iso: string) => formatDate(iso, { ...ctx, timeZone: "UTC" }, { day: "numeric", month: "short", year: "numeric" });
  if (codes.length === 0) {
    return (
      <EmptyState
        compact
        title="No discount codes yet"
        description="Give siblings or new students a discount. Parents enter the code when paying."
      />
    );
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="text-muted-foreground border-border border-b text-left text-xs">
          <tr>
            <th className="py-2 pr-3 font-medium">Code</th>
            <th className="py-2 pr-3 font-medium">Off</th>
            <th className="py-2 pr-3 font-medium">Dates</th>
            <th className="py-2 pr-3 text-right font-medium">Students</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y align-top">
          {codes.map((c) => {
            const st = codeStatus(c, now);
            return (
              <tr key={c.id}>
                <td className="py-2 pr-3">
                  <span className="text-foreground font-mono text-xs">{c.code}</span>
                  <span className="text-muted-foreground block text-xs">{c.description}</span>
                </td>
                <td className="py-2 pr-3">
                  {discountLabel(c, formatRand)}
                  <span className="text-muted-foreground block text-xs">
                    {c.durationPeriods ? `${c.durationPeriods} payment${c.durationPeriods === 1 ? "" : "s"} per student` : "Every payment"}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  {day(c.startsAt)}
                  {c.endsAt ? ` – ${day(c.endsAt)}` : " onwards"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {c.redemptions}
                  {c.maxRedemptions != null ? <span className="text-muted-foreground"> of {c.maxRedemptions}</span> : null}
                </td>
                <td className="py-2 pr-3">
                  <StatusChip tone={st.tone}>{st.label}</StatusChip>
                </td>
                <td className="py-2 text-right">{c.active ? <TurnOff code={c} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TurnOff({ code }: { code: FeeCode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await deactivateFeeDiscountCode({ id: code.id });
    setBusy(false);
    if (!res?.data) return setError(checkoutErrorMessage(res?.serverError));
    toast.success(`${code.code} is off.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Turn off ${code.code}`}>
        Turn off
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off {code.code}?</DialogTitle>
            <DialogDescription>
              Parents can&apos;t use it from now on. Fees already paid with it keep their discount. You can&apos;t turn it
              back on; create a new code instead.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Turn off code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───── A new code ───── */

export function FeeCodeForm() {
  const router = useRouter();
  const ids = React.useId();
  const today = new Date().toISOString().slice(0, 10);
  const blank = { code: "", description: "", kind: "PERCENT" as "PERCENT" | "FIXED", value: "", startsOn: today, endsOn: "", maxStudents: "", payments: "" };
  const [f, setF] = React.useState(blank);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const whole = (s: string) => (s.trim() === "" ? null : /^\d+$/.test(s.trim()) && Number(s) > 0 ? Number(s) : NaN);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = normaliseCode(f.code);
    if (!code) return setError("Codes are 3 to 32 letters, digits, - or _.");
    if (!f.description.trim()) return setError("Add a short description, for example “Second child in a family”.");
    const percentBps = f.kind === "PERCENT" ? parsePercentToBps(f.value) : null;
    const amountCents = f.kind === "FIXED" ? parseRandToCents(f.value) : null;
    if (f.kind === "PERCENT" && percentBps == null) return setError("Enter a percentage from 0,01 to 100.");
    if (f.kind === "FIXED" && amountCents == null) return setError("Enter an amount in rand, for example 100.");
    const maxRedemptions = whole(f.maxStudents);
    const durationPeriods = whole(f.payments);
    if (Number.isNaN(maxRedemptions) || Number.isNaN(durationPeriods)) return setError("Students and payments are whole numbers above zero, or empty.");
    if (f.endsOn && f.endsOn < f.startsOn) return setError("The end date is before the start date.");

    setBusy(true);
    const res = await createFeeDiscountCode({
      code,
      description: f.description.trim(),
      kind: f.kind,
      percentBps,
      amountCents,
      startsAt: `${f.startsOn}T00:00:00.000Z`,
      endsAt: f.endsOn ? `${f.endsOn}T23:59:59.000Z` : null,
      maxRedemptions,
      durationPeriods,
    });
    setBusy(false);
    if (!res?.data) return setError(res?.validationErrors ? "Check the fields and try again." : checkoutErrorMessage(res?.serverError));
    toast.success(`Code ${res.data.code} created. Share it with parents.`);
    setF(blank);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-code`}>Code</Label>
          <Input id={`${ids}-code`} value={f.code} onChange={(e) => set("code")(e.target.value)} placeholder="SIBLING15" autoCapitalize="characters" className="font-mono uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-desc`}>Description</Label>
          <Input id={`${ids}-desc`} value={f.description} onChange={(e) => set("description")(e.target.value)} maxLength={200} placeholder="Second child in a family" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Discount</legend>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {(["PERCENT", "FIXED"] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input type="radio" name={`${ids}-kind`} checked={f.kind === k} onChange={() => set("kind")(k)} />
              {k === "PERCENT" ? "Percentage of each fee" : "Rand amount per payment"}
            </label>
          ))}
          <span className="inline-flex items-center gap-2">
            <Label htmlFor={`${ids}-value`} className="sr-only">
              {f.kind === "PERCENT" ? "Percentage off" : "Amount off in rand"}
            </Label>
            {f.kind === "FIXED" ? <span aria-hidden>R</span> : null}
            <Input id={`${ids}-value`} inputMode="decimal" value={f.value} onChange={(e) => set("value")(e.target.value)} className="w-28" placeholder={f.kind === "PERCENT" ? "15" : "100"} />
            {f.kind === "PERCENT" ? <span aria-hidden>%</span> : null}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          A rand amount is taken once per payment, shared across the fees paid together. Every fee keeps at least R1.
        </p>
      </fieldset>

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
          <Label htmlFor={`${ids}-max`}>Students who can use it (optional)</Label>
          <Input id={`${ids}-max`} inputMode="numeric" value={f.maxStudents} onChange={(e) => set("maxStudents")(e.target.value)} className="w-28" placeholder="No limit" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-dur`}>Payments per student (optional)</Label>
          <Input id={`${ids}-dur`} inputMode="numeric" value={f.payments} onChange={(e) => set("payments")(e.target.value)} className="w-28" placeholder="Every one" />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Create code
      </Button>
    </form>
  );
}
