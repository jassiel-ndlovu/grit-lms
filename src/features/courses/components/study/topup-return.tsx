"use client";

/**
 * Where Paystack sends a buyer of credits back
 * (`/dashboard/credits/return?reference=`). Polls getTopupStatus every 2.5 s
 * for up to 60 s; A's action asks Paystack while it is pending. The redirect
 * itself never counts as paid.
 */

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { getTopupStatus } from "@/features/ai-credits/topup-actions";

import { number, studyRoutes } from "../../lib/study-ui";

const POLL_MS = 2500;
const POLL_FOR_MS = 60_000;
const BOX = "space-y-3 rounded-lg border p-5 text-sm";

type Phase = "checking" | "slow" | "paid" | "failed" | "unknown";

/** `staff`: where Back goes until the purchase says who it was for. */
export function TopupReturn({ reference, staff }: { reference: string | null; staff: boolean }) {
  const [phase, setPhase] = React.useState<Phase>(reference ? "checking" : "unknown");
  const [bought, setBought] = React.useState<{ credits: number; forWhom: "WORKSPACE" | "STUDENT" } | null>(null);

  React.useEffect(() => {
    if (!reference) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    async function tick() {
      try {
        const res = await getTopupStatus({ reference: reference! });
        if (stopped) return;
        const data = res?.data;
        if (data) setBought({ credits: data.credits, forWhom: data.forWhom });
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

  const forStaff = bought ? bought.forWhom === "WORKSPACE" : staff;
  const back = (
    <Link
      href={forStaff ? studyRoutes.workspaceCredits : studyRoutes.credits}
      className="text-foreground font-medium underline underline-offset-2"
    >
      Back to credits
    </Link>
  );

  if (phase === "checking") {
    return (
      <div role="status" className={`${BOX} border-border`}>
        <p className="inline-flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your payment with Paystack…
        </p>
      </div>
    );
  }
  if (phase === "paid") {
    return (
      <div role="status" className={`${BOX} border-success/30 bg-success/5`}>
        <p className="text-foreground font-medium">Payment received. Thank you.</p>
        <p>
          {bought?.credits ? `${number(bought.credits)} credits are` : "Your credits are"} ready to use. {back}
        </p>
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div role="alert" className={`${BOX} border-destructive/40 bg-destructive/5`}>
        <p className="text-foreground font-medium">The payment didn&apos;t go through.</p>
        <p>No credits were added. You can try again. {back}</p>
      </div>
    );
  }
  if (phase === "slow") {
    return (
      <div role="status" className={`${BOX} border-border`}>
        <p className="text-foreground font-medium">We&apos;re still confirming your payment.</p>
        <p>You can leave this page. The credits are added once Paystack confirms it. {back}</p>
      </div>
    );
  }
  return (
    <div role="status" className={`${BOX} border-border`}>
      <p className="text-foreground font-medium">We couldn&apos;t check this payment.</p>
      <p>If money left your account, the credits are added once Paystack confirms it. {back}</p>
    </div>
  );
}
