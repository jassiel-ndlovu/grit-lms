"use client";

/**
 * A parent's or adult student's fees (contracts/billing.md section 2): open
 * fees to tick and pay together, an optional discount code checked with
 * previewCheckout, then startCheckout sends them to Paystack. Fees already
 * held by a checkout show "Payment in progress" and can't be ticked. Paid
 * fees are listed below. Dates arrive formatted, in the payer's zone.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewCheckout, startCheckout } from "@/features/payments/checkout-actions";

import { formatRand } from "../lib/billing-ui";
import { FEES_RETURN_PATH, canSelect, checkoutErrorMessage, cleanCode, groupByChild, selectedTotal } from "../lib/fee-pay-ui";
import { feeChip, type FeeStatus } from "../lib/payouts-ui";

export type PayableRow = {
  id: string;
  number: string;
  child: { userId: string; name: string };
  payee: { name: string };
  workspaceName: string;
  totalCents: number;
  status: string;
  lockedUntil: string | null;
  /** YYYY-MM-DD in the payer's zone, for Overdue. */
  dueDay: string;
  dueLabel: string;
  /** "14:30" in the payer's zone, when a checkout holds it. */
  lockedLabel: string | null;
};

type Preview = { code: string; totalCents: number; discountCents: number; ids: string };

export function FeeCheckout({ open, paid, today, forSelf }: { open: PayableRow[]; paid: PayableRow[]; today: string; forSelf: boolean }) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(open.filter(canSelect).map((i) => i.id)));
  const [code, setCode] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"code" | "pay" | null>(null);
  const id = React.useId();

  const ids = open.filter((i) => selected.has(i.id)).map((i) => i.id);
  const idsKey = ids.join(",");
  // A discount was worked out for one set of fees; it lapses when the set changes.
  const applied = preview && preview.ids === idsKey ? preview : null;
  const total = applied ? applied.totalCents : selectedTotal(open, selected);
  const groups = groupByChild(open);

  function toggle(invoiceId: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
    setError(null);
  }

  async function applyCode() {
    const c = cleanCode(code);
    if (!c) return setError("Enter a code first.");
    if (ids.length === 0) return setError("Tick at least one fee.");
    setBusy("code");
    setError(null);
    const res = await previewCheckout({ invoiceIds: ids, discountCode: c });
    setBusy(null);
    if (!res?.data) return setError(checkoutErrorMessage(res?.serverError));
    setPreview({ code: res.data.code ?? c, totalCents: res.data.totalCents, discountCents: res.data.discountCents, ids: idsKey });
  }

  async function pay() {
    if (ids.length === 0) return setError("Tick at least one fee.");
    setBusy("pay");
    setError(null);
    const res = await startCheckout({
      invoiceIds: ids,
      ...(applied ? { discountCode: applied.code } : {}),
      returnPath: FEES_RETURN_PATH,
    });
    if (!res?.data) {
      setBusy(null);
      return setError(checkoutErrorMessage(res?.serverError));
    }
    window.location.assign(res.data.authorizationUrl);
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="open-heading" className="space-y-4">
        <h2 id="open-heading" className="text-foreground text-sm font-semibold">
          To pay
        </h2>
        {open.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to pay right now.</p>
        ) : (
          <>
            {groups.map((g) => (
              <fieldset key={g.userId} className="space-y-1">
                {forSelf || groups.length === 1 ? (
                  <legend className="sr-only">{forSelf ? "Your fees" : `Fees for ${g.name}`}</legend>
                ) : (
                  <legend className="text-muted-foreground text-xs font-medium">{g.name || "Your child"}</legend>
                )}
                <ul className="divide-border divide-y text-sm">
                  {g.items.map((i) => {
                    const chip = feeChip(i.status as FeeStatus, null, i.dueDay, today);
                    const selectable = canSelect(i);
                    return (
                      <li key={i.id} className="flex items-start gap-3 py-3">
                        <Checkbox
                          id={`${id}-${i.id}`}
                          checked={selected.has(i.id) && selectable}
                          disabled={!selectable || busy != null}
                          onCheckedChange={(v) => toggle(i.id, v === true)}
                          className="mt-0.5"
                        />
                        <label htmlFor={`${id}-${i.id}`} className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <span className="min-w-0 space-y-0.5">
                            <span className="text-foreground block font-medium">{i.payee.name || i.workspaceName}</span>
                            <span className="text-muted-foreground block text-xs">
                              {i.number} · due {i.dueLabel}
                              {i.payee.name && i.workspaceName && i.payee.name !== i.workspaceName ? ` · ${i.workspaceName}` : ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            {i.lockedLabel ? (
                              <StatusChip tone="info">Payment in progress until {i.lockedLabel}</StatusChip>
                            ) : (
                              <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                            )}
                            <span className="tabular-nums">{formatRand(i.totalCents)}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
            {open.some((i) => i.lockedLabel) ? (
              <p className="text-muted-foreground text-xs">
                A fee marked &ldquo;Payment in progress&rdquo; is waiting on a card payment you started. If it didn&apos;t go
                through, you can pay it again after the time shown.
              </p>
            ) : null}

            <div className="border-border space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-code`}>Discount code (optional)</Label>
                  <Input
                    id={`${id}-code`}
                    value={code}
                    maxLength={32}
                    autoCapitalize="characters"
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPreview(null);
                    }}
                    className="w-44 font-mono uppercase"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyCode} disabled={busy != null || code.trim() === ""}>
                  {busy === "code" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
              <dl className="space-y-1 text-sm" aria-live="polite">
                {applied && applied.discountCents > 0 ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Fees</dt>
                      <dd className="tabular-nums">{formatRand(applied.totalCents + applied.discountCents)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Discount {applied.code}</dt>
                      <dd className="tabular-nums">−{formatRand(applied.discountCents)}</dd>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>
                    {ids.length === 1 ? "1 fee" : `${ids.length} fees`}
                  </dt>
                  <dd className="tabular-nums">{formatRand(total)}</dd>
                </div>
              </dl>
              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
              <div className="space-y-1">
                <Button type="button" onClick={pay} disabled={busy != null || ids.length === 0}>
                  {busy === "pay" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Pay {formatRand(total)} by card
                </Button>
                <p className="text-muted-foreground text-xs">You&apos;ll enter your card details on a secure payment page, then come back here.</p>
              </div>
            </div>
          </>
        )}
      </section>

      {paid.length > 0 ? (
        <section aria-labelledby="paid-heading" className="space-y-2">
          <h2 id="paid-heading" className="text-foreground text-sm font-semibold">
            Paid
          </h2>
          <ul className="divide-border divide-y text-sm">
            {paid.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="text-foreground">{i.payee.name || i.workspaceName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {i.number}
                    {!forSelf && i.child.name ? ` · ${i.child.name}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusChip tone="success">Paid</StatusChip>
                  <span className="tabular-nums">{formatRand(i.totalCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
