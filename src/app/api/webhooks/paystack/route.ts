/**
 * Paystack webhooks (design 04, section 6). Signed with the secret key
 * (HMAC-SHA512 of the raw body), so the body is read as text before parsing.
 * Set this URL as the webhook in the Paystack dashboard (test and live).
 */

import { NextResponse } from "next/server";

import { handlePaystackWebhook } from "@/features/payments/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const { httpStatus, outcome } = await handlePaystackWebhook(raw, req.headers);
  return NextResponse.json({ ok: httpStatus === 200, outcome }, { status: httpStatus });
}
