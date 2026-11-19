/**
 * Paystack webhook handling (design 04, section 6). The route passes the raw
 * body; this verifies the signature, stores the event once (dedupeKey), and
 * hands charge events to settlePayment, which asks Paystack before applying
 * anything. Errors leave the event FAILED and return 500 so Paystack retries.
 */

import "server-only";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { getProvider, InvalidSignatureError, type NormalisedEvent, type PaymentProvider } from "./provider";
import { markRefunded, settlePayment } from "./settle";

export type WebhookResult = { httpStatus: 200 | 401 | 400 | 500; outcome: string };

export async function handlePaystackWebhook(
  rawBody: string,
  headers: Headers,
  provider: PaymentProvider = getProvider(),
): Promise<WebhookResult> {
  let event: NormalisedEvent;
  try {
    event = provider.verifyWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof InvalidSignatureError) return { httpStatus: 401, outcome: "bad signature" };
    return { httpStatus: 400, outcome: "unreadable body" };
  }

  // Store once. A redelivery of a finished event is acknowledged and skipped.
  let row: { id: string; status: string };
  try {
    row = await prisma.paymentEvent.create({
      data: {
        provider: "PAYSTACK",
        dedupeKey: event.dedupeKey,
        type: event.providerType,
        reference: event.reference,
        payload: event.raw as Prisma.InputJsonValue,
      },
      select: { id: true, status: true },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    row = await prisma.paymentEvent.findUniqueOrThrow({ where: { dedupeKey: event.dedupeKey }, select: { id: true, status: true } });
    if (row.status === "PROCESSED" || row.status === "IGNORED") return { httpStatus: 200, outcome: "duplicate" };
  }

  if ((event.type === "refund.processed" || event.type === "refund.failed") && event.reference) {
    const n = await applyRefundEvent(event.reference, event.type === "refund.processed" ? "PROCESSED" : "FAILED", event.raw);
    await prisma.paymentEvent.update({
      where: { id: row.id },
      data: { status: n > 0 ? "PROCESSED" : "IGNORED", processedAt: new Date(), attempts: { increment: 1 } },
    });
    return { httpStatus: 200, outcome: `refund ${n}` };
  }

  const isCharge = event.type === "charge.succeeded" || event.type === "charge.failed";
  if (!isCharge || !event.reference) {
    await prisma.paymentEvent.update({ where: { id: row.id }, data: { status: "IGNORED", processedAt: new Date() } });
    return { httpStatus: 200, outcome: "ignored" };
  }

  try {
    const result = await settlePayment(event.reference, { provider });
    // UNKNOWN: not one of ours (another integration on the same Paystack account).
    const status = result.status === "UNKNOWN" ? "IGNORED" : "PROCESSED";
    await prisma.paymentEvent.update({
      where: { id: row.id },
      data: { status, processedAt: new Date(), attempts: { increment: 1 }, error: null },
    });
    return { httpStatus: 200, outcome: `${status.toLowerCase()} ${result.status}` };
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    console.error("[payments] webhook processing failed:", message);
    await prisma.paymentEvent.update({
      where: { id: row.id },
      data: { status: "FAILED", attempts: { increment: 1 }, error: message },
    });
    return { httpStatus: 500, outcome: "failed" };
  }
}

/**
 * Closes our PENDING refunds on the payment with this reference. Matches the
 * provider's refund id when the event carries one. Returns how many changed.
 */
async function applyRefundEvent(reference: string, status: "PROCESSED" | "FAILED", raw: unknown): Promise<number> {
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (!payment) return 0;
  const data = ((raw as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
  const providerId = data.id != null ? String(data.id) : null;
  return prisma.$transaction(async (tx) => {
    const pending = await tx.refund.findMany({ where: { paymentId: payment.id, status: "PENDING" }, select: { id: true, providerRefundId: true } });
    const exact = providerId ? pending.filter((r) => r.providerRefundId === providerId) : [];
    const targets = exact.length ? exact : pending;
    for (const r of targets) {
      await tx.refund.update({ where: { id: r.id }, data: { status, processedAt: new Date(), providerRefundId: r.providerRefundId ?? providerId } });
    }
    if (status === "PROCESSED") await markRefunded(tx, payment.id);
    return targets.length;
  });
}
