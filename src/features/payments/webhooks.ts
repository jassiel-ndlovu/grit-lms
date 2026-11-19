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
import { settlePayment } from "./settle";

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
