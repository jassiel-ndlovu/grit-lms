/**
 * GET /api/payouts/recoveries/[id]/pay: the link in the recovery invoice
 * email. Starts a card payment for what the payee still owes and sends them
 * to Paystack. Only the payee (the tutor, or an owner or admin when the
 * workspace is paid out as one) may use it.
 */

import { NextResponse } from "next/server";

import { BillingError, isBillingEnabled } from "@/features/billing/errors";
import { startRecoveryPaymentFor } from "@/features/payments/recovery";
import { settlePayment } from "@/features/payments/settle";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const back = (state: string) => NextResponse.redirect(new URL(`/dashboard/fees?recovery=${state}`, url.origin), 303);
  if (!isBillingEnabled()) return back("unavailable");
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL(`/?callbackUrl=${encodeURIComponent(url.pathname)}`, url.origin), 303);
  try {
    const r = await startRecoveryPaymentFor(
      { id: viewer.user.id, email: viewer.user.email },
      id,
      `${url.origin}/api/payouts/recoveries/${encodeURIComponent(id)}/return`,
      undefined,
      (reference) => settlePayment(reference),
    );
    return NextResponse.redirect(r.authorizationUrl, 303);
  } catch (e) {
    if (e instanceof BillingError) return back(e.code === "NOT_FOUND" ? "not-found" : "nothing-owed");
    console.error("[payouts] recovery payment not started:", (e as Error).message);
    return back("error");
  }
}
