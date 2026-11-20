/**
 * GET /api/payouts/recoveries/[id]/return: Paystack sends the payee back
 * here after paying a recovery invoice. Settles the payment (the webhook
 * may be late) and returns them to their fees page with the outcome.
 */

import { NextResponse } from "next/server";

import { recoveryPaymentFor } from "@/features/payments/recovery";
import { settlePayment } from "@/features/payments/settle";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (state: string) => NextResponse.redirect(new URL(`/dashboard/fees?recovery=${state}`, url.origin), 303);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const viewer = await getViewer();
  if (!viewer || !reference || reference.length > 128) return back("unknown");
  if (!(await recoveryPaymentFor(viewer.user.id, reference))) return back("unknown");
  try {
    const r = await settlePayment(reference);
    return back(r.status === "SUCCEEDED" ? "paid" : r.status === "FAILED" ? "failed" : "pending");
  } catch (e) {
    console.error("[payouts] recovery return check failed:", (e as Error).message);
    return back("pending");
  }
}
