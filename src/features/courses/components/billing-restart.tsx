"use client";

/**
 * Restarting a cancelled (or read-only) workspace (#191; owner decisions of
 * 20 and 21 Nov; billing.md Draft 1.15). The owner pays the outstanding
 * balance plus the first new period before the workspace opens again.
 *
 * "Restart workspace" calls A's restartWorkspace, which answers with the
 * next step:
 *   PAY_OUTSTANDING   pay each unpaid bill (payPlatformInvoice), then restart again
 *   PAY_FIRST_PERIOD  the usual first payment (startFirstPayment)
 *   CARD_REQUIRED     no students and no card: save one (startCardReplacement), then restart again
 *   RESTARTED         open again (a R0 first period); the page refreshes
 * Paystack sends the payer back to Billing, where PaymentReturn settles it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { restartWorkspace } from "@/features/billing/actions";

import { billingErrorMessage, formatRand } from "../lib/billing-ui";
import { restartStep, type RestartResult } from "../lib/teaching-ui";
import { CardButton, PayButton } from "./billing-pay";

export function RestartPanel({
  cancelled,
  firstPeriodCents,
  initial = null,
}: {
  /** CANCELLED (true) or READ_ONLY (false): only the wording differs. */
  cancelled: boolean;
  /** The first period's estimate, for the pay button's label. */
  firstPeriodCents: number;
  /** A result to start from (the design-system page shows each state). */
  initial?: RestartResult | null;
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<RestartResult | null>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function restart() {
    setBusy(true);
    setError(null);
    const res = await restartWorkspace({});
    setBusy(false);
    if (!res?.data) return setError(billingErrorMessage(res?.serverError));
    setResult(res.data);
    if (res.data.status === "RESTARTED") router.refresh();
  }

  const step = result ? restartStep(result) : null;
  const restartButton = (label: string, variant: "default" | "outline" = "default") => (
    <Button onClick={restart} disabled={busy} variant={variant}>
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
      {label}
    </Button>
  );

  return (
    <section aria-labelledby="restart-heading" className="border-border space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 id="restart-heading" className="text-foreground text-sm font-semibold">
          {step ? step.title : cancelled ? "Restart your workspace" : "Unlock your workspace"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {step
            ? step.body
            : `${cancelled ? "Your workspace is cancelled." : "Your workspace is read-only."} To open it again, pay anything still owed and the first 30 days. With no students yet, the first period is free once a card is saved.`}
        </p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!result ? restartButton(cancelled ? "Restart workspace" : "Unlock workspace") : null}

        {result?.status === "PAY_OUTSTANDING" ? (
          <>
            <ul className="space-y-2">
              {result.invoiceIds.map((id, i) => (
                <li key={id} className="flex flex-wrap items-center gap-3">
                  <PayButton invoiceId={id} label={result.invoiceIds.length === 1 ? "Pay the unpaid bill" : `Pay bill ${i + 1}`} />
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              See each bill under{" "}
              <Link href="/dashboard/settings/billing/payments" className="text-foreground underline underline-offset-2">
                Payments
              </Link>
              . Then:
            </p>
            {restartButton("Restart again", "outline")}
          </>
        ) : null}

        {result?.status === "PAY_FIRST_PERIOD" ? (
          <PayButton invoiceId={null} label={firstPeriodCents > 0 ? `Pay ${formatRand(firstPeriodCents)} for 30 days` : "Pay for 30 days"} />
        ) : null}

        {result?.status === "CARD_REQUIRED" ? (
          <div className="flex flex-wrap items-start gap-3">
            <CardButton hasCard={false} />
            {restartButton("Restart again", "outline")}
          </div>
        ) : null}

        {result?.status === "RESTARTED" ? (
          <p role="status" className="text-success flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 aria-hidden className="size-4" /> Restarted. Nothing to pay until the renewal.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
