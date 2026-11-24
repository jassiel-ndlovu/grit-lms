"use client";

/**
 * Buying AI credits (billing.md "AI credit top-ups"): the packs on offer.
 * Buying sends the browser to Paystack's page; how long the credits last
 * shows before anyone pays.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { startTopupAction } from "@/features/ai-credits/topup-actions";

import { formatRand } from "../../lib/billing-ui";
import { checkoutErrorMessage } from "../../lib/fee-pay-ui";
import { answersLabel, number, studyRoutes, validityLabel } from "../../lib/study-ui";

export type CreditBuyer =
  | { kind: "WORKSPACE" }
  /** A student's own, or a parent's child's. */
  | { kind: "STUDENT"; studentUserId: string; workspaceId: string };

export function CreditPacks({
  offer,
  buyer,
}: {
  offer: { validityDays: number; packs: Array<{ priceCents: number; credits: number }> };
  buyer: CreditBuyer;
}) {
  const [busy, setBusy] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const student = buyer.kind === "STUDENT";

  async function buy(priceCents: number) {
    setBusy(priceCents);
    setError(null);
    const r = await startTopupAction({
      forWhom: buyer.kind,
      priceCents,
      ...(buyer.kind === "STUDENT" ? { studentUserId: buyer.studentUserId, workspaceId: buyer.workspaceId } : {}),
      returnPath: studyRoutes.creditsReturn,
    }).catch(() => null);
    if (!r?.data) {
      setError(checkoutErrorMessage(r?.serverError));
      setBusy(null);
      return;
    }
    window.location.assign(r.data.authorizationUrl);
  }

  return (
    <div className="space-y-3">
      <p className="text-foreground text-sm">
        Credits last {validityLabel(offer.validityDays)} from the day you pay. Any left after that are lost.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {offer.packs.map((p) => {
          const price = formatRand(p.priceCents);
          return (
            <li key={p.priceCents} className="border-border flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <p className="text-foreground text-lg font-semibold tabular-nums">{price}</p>
                {student ? <p className="text-foreground text-sm">{answersLabel(p.credits)}</p> : null}
                <p className="text-muted-foreground text-sm">{number(p.credits)} credits</p>
              </div>
              <div className="mt-auto">
                <WriteGuard label={`Buy for ${price}`}>
                  <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void buy(p.priceCents)}>
                    {busy === p.priceCents ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                    Buy for {price}
                  </Button>
                </WriteGuard>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">Paid to Nexa by card, on Paystack&apos;s page.</p>
    </div>
  );
}
