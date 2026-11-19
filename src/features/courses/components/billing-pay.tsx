"use client";

/**
 * Paying for Nexa (a/ux/03-billing.md §5; billing.md 1.3). `PayButton`
 * starts the first payment or pays an open invoice; Paystack's page takes
 * the card. `PaymentReturn` runs when Paystack sends the payer back with
 * `?reference=`: it polls getBillingPaymentStatus every 2.5 s for up to
 * 60 s (rules for B, 6). The redirect itself never counts as paid.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getBillingPaymentStatus,
  payPlatformInvoice,
  startCardReplacement,
  startFirstPayment,
} from "@/features/billing/actions";

import { billingErrorMessage } from "../lib/billing-ui";

export const BILLING_RETURN_PATH = "/dashboard/settings/billing";

const POLL_MS = 2500;
const POLL_FOR_MS = 60_000;

export function PayButton({ invoiceId, label }: { invoiceId: string | null; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      if (invoiceId) {
        const res = await payPlatformInvoice({ invoiceId, returnPath: BILLING_RETURN_PATH });
        if (res?.serverError || !res?.data) throw new Error(billingErrorMessage(res?.serverError));
        if (res.data.status === "REDIRECT") return window.location.assign(res.data.authorizationUrl);
        if (res.data.status === "PENDING") return router.replace(`${BILLING_RETURN_PATH}?reference=${encodeURIComponent(res.data.reference)}`);
        router.replace(`${BILLING_RETURN_PATH}?paid=1`);
        router.refresh();
      } else {
        const res = await startFirstPayment({ returnPath: BILLING_RETURN_PATH });
        if (res?.serverError || !res?.data) throw new Error(billingErrorMessage(res?.serverError));
        window.location.assign(res.data.authorizationUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : billingErrorMessage(null));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={pay} disabled={busy}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">Card payments through Paystack.</p>
    </div>
  );
}

/**
 * Adds or replaces the card used for renewals: Paystack runs a R10 check
 * that A refunds at once (billing.md 1.4). The return page tells it from a
 * payment by its reference (isCardCheckReference in lib/billing-ui).
 */
export function CardButton({ hasCard }: { hasCard: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await startCardReplacement({ returnPath: BILLING_RETURN_PATH });
    if (res?.data) return window.location.assign(res.data.authorizationUrl);
    setError(billingErrorMessage(res?.serverError));
    setBusy(false);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={go} disabled={busy}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {hasCard ? "Change card" : "Add card"}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}

type Phase = "checking" | "slow" | "succeeded" | "failed" | "unknown";

export function PaymentReturn({ reference, purpose = "payment" }: { reference: string | null; purpose?: "payment" | "card" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<Phase>(reference ? "checking" : "succeeded");

  React.useEffect(() => {
    if (!reference) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    async function tick() {
      try {
        const res = await getBillingPaymentStatus({ reference: reference! });
        const status = res?.data?.status;
        if (stopped) return;
        if (status === "SUCCEEDED") {
          setPhase("succeeded");
          router.refresh();
          return;
        }
        if (status === "FAILED") {
          setPhase("failed");
          return;
        }
        if (res?.serverError) {
          setPhase("unknown");
          return;
        }
      } catch {
        // Network blip: keep polling until the deadline.
      }
      if (stopped) return;
      if (Date.now() - started >= POLL_FOR_MS) {
        setPhase("slow");
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference, router]);

  const dismiss = () => router.replace(pathname);
  const box = "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm";

  if (phase === "checking") {
    return (
      <div role="status" className={`${box} border-border`}>
        <span className="inline-flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin" /> {purpose === "card" ? "Checking your card…" : "Checking your payment…"}
        </span>
      </div>
    );
  }
  if (phase === "slow") {
    return (
      <div role="status" className={`${box} border-border`}>
        <span>We&apos;re confirming your payment. This page updates once Paystack confirms it; you can leave it.</span>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Close
        </Button>
      </div>
    );
  }
  if (phase === "unknown") {
    return (
      <div role="status" className={`${box} border-border`}>
        <span>We couldn&apos;t check this payment. If it went through, it shows here once Paystack confirms it.</span>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Close
        </Button>
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div role="alert" className={`${box} border-destructive/40 bg-destructive/5`}>
        <span>
          {purpose === "card"
            ? "The card check didn't go through, so your card wasn't changed. You can try again."
            : "Your payment didn't go through. Nothing was charged; you can try again."}
        </span>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <div role="status" className={`${box} border-emerald-600/30 bg-emerald-600/5`}>
      <span>
        {purpose === "card" ? "Card saved. The R10 check is refunded to it." : "Payment received. Thank you."}
      </span>
      <Button variant="outline" size="sm" onClick={dismiss}>
        Close
      </Button>
    </div>
  );
}
