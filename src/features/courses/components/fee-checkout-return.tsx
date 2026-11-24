"use client";

/**
 * Where Paystack sends a parent back after paying fees
 * (`/dashboard/fees/return?reference=`). Polls getCheckoutStatus every
 * 2.5 s for up to 60 s; A's action asks Paystack while it is pending. The
 * redirect itself never counts as paid.
 */

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { getCheckoutStatus } from "@/features/payments/checkout-actions";

const POLL_MS = 2500;
const POLL_FOR_MS = 60_000;

type Phase = "checking" | "slow" | "paid" | "failed" | "unknown";

const BOX = "space-y-3 rounded-lg border p-5 text-sm";

export function CheckoutReturn({ reference }: { reference: string | null }) {
  const [phase, setPhase] = React.useState<Phase>(reference ? "checking" : "unknown");
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!reference) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    async function tick() {
      try {
        const res = await getCheckoutStatus({ reference: reference! });
        if (stopped) return;
        const data = res?.data;
        if (data) setCount(data.invoices.length);
        if (data?.status === "SUCCEEDED") return setPhase("paid");
        if (data?.status === "FAILED") return setPhase("failed");
        if (res?.serverError) return setPhase("unknown");
      } catch {
        // A network blip: keep trying until the deadline.
      }
      if (stopped) return;
      if (Date.now() - started >= POLL_FOR_MS) return setPhase("slow");
      timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference]);

  const back = (
    <Link href="/dashboard/fees" className="text-foreground font-medium underline underline-offset-2">
      Back to fees
    </Link>
  );
  const fees = count == null ? "your fees" : count === 1 ? "the fee" : `the ${count} fees`;

  if (phase === "checking") {
    return (
      <div role="status" className={`${BOX} border-border`}>
        <p className="inline-flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your payment…
        </p>
      </div>
    );
  }
  if (phase === "paid") {
    return (
      <div role="status" className={`${BOX} border-success/30 bg-success/5`}>
        <p className="text-foreground font-medium">Payment received. Thank you.</p>
        <p>
          We&apos;ve marked {fees} paid and emailed you a receipt. {back}
        </p>
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div role="alert" className={`${BOX} border-destructive/40 bg-destructive/5`}>
        <p className="text-foreground font-medium">The payment didn&apos;t go through.</p>
        <p>
          Nothing was charged. The fees show as &ldquo;Payment in progress&rdquo; for up to 30 minutes; after that you
          can pay again. {back}
        </p>
      </div>
    );
  }
  if (phase === "slow") {
    return (
      <div role="status" className={`${BOX} border-border`}>
        <p className="text-foreground font-medium">We&apos;re still confirming your payment.</p>
        <p>You can leave this page. Your fees show as paid as soon as your bank confirms the payment, usually within a minute. {back}</p>
      </div>
    );
  }
  return (
    <div role="status" className={`${BOX} border-border`}>
      <p className="text-foreground font-medium">We couldn&apos;t check this payment.</p>
      <p>If money left your account, your fees will show as paid within an hour. Please don&apos;t pay again in the meantime. {back}</p>
    </div>
  );
}
