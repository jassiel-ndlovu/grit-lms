/**
 * Charging a platform invoice: the Payment row for each attempt, and the
 * saved-card charge used by Pay now, renewals and dunning retries (design
 * 04, section 4). Server only.
 */

import "server-only";

import { getProvider, type PaymentProvider } from "@/features/payments/provider";
import { decryptSecret } from "@/features/payments/secrets";
import { settlePayment, type SettleResult } from "@/features/payments/settle";
import { platformPaymentReference } from "@/features/payments/settlement-rules";
import { prisma } from "@/lib/db";

/** A new attempt on the invoice: its Payment row and reference (`nx-inv-<id>-<attempt>`). */
export async function createInvoicePayment(input: {
  invoice: { id: string; totalCents: number };
  workspaceId: string;
  /** The person paying; null for the scheduled renewal charge. */
  userId: string | null;
}): Promise<string> {
  const { attemptCount } = await prisma.platformInvoice.update({
    where: { id: input.invoice.id },
    data: { attemptCount: { increment: 1 } },
    select: { attemptCount: true },
  });
  const reference = platformPaymentReference(input.invoice.id, attemptCount);
  await prisma.payment.create({
    data: {
      provider: "PAYSTACK", reference, purpose: "PLATFORM_INVOICE", workspaceId: input.workspaceId,
      payerUserId: input.userId, platformInvoiceId: input.invoice.id, amountCents: input.invoice.totalCents,
    },
  });
  return reference;
}

export type SavedCardCharge =
  | { status: "NO_CARD" }
  | { status: "FAILED"; reference: string; message?: string }
  | { status: SettleResult["status"]; reference: string };

/**
 * Charges the workspace's saved card for the invoice total and settles the
 * result. NO_CARD when there is no usable saved card.
 */
export async function chargeSavedCard(input: {
  invoice: { id: string; totalCents: number };
  workspaceId: string;
  userId: string | null;
  provider?: PaymentProvider;
}): Promise<SavedCardCharge> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { status: true, authorizationCodeEnc: true, billingEmail: true },
  });
  if (sub?.status !== "AUTHORISED" || !sub.authorizationCodeEnc) return { status: "NO_CARD" };

  const provider = input.provider ?? getProvider();
  const reference = await createInvoicePayment(input);
  const charge = await provider.chargeAuthorization({
    authorizationCode: decryptSecret(sub.authorizationCodeEnc),
    email: sub.billingEmail,
    amountCents: input.invoice.totalCents,
    reference,
    metadata: { workspaceId: input.workspaceId, invoiceId: input.invoice.id, purpose: "PLATFORM_INVOICE" },
  });
  if (charge.status === "FAILED") {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
    return { status: "FAILED", reference, message: charge.gatewayMessage };
  }
  const settled = await settlePayment(reference, { provider });
  return { status: settled.status, reference };
}
