/**
 * settlePayment: the one place a Payment leaves PENDING (design 04, sections
 * 3, 4 and 6). The webhook, the return-page poll and reconciliation all call
 * it. It asks the provider (verifyTransaction) and applies the result in one
 * transaction. Idempotent: the status change is a conditional update, so two
 * callers racing apply it once.
 *
 * Built: PLATFORM_INVOICE (Gate 1). CARD_AUTHORISATION and PARENT_CHECKOUT
 * are left PENDING until their flows exist.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { getBillingConfig } from "@/features/billing/data";
import { periodFromPayment } from "@/features/billing/pricing";
import { prisma } from "@/lib/db";

import { getProvider, type PaymentProvider } from "./provider";
import { encryptSecret } from "./secrets";
import { decideSettlement, seatsAt } from "./settlement-rules";

type Tx = Prisma.TransactionClient;

/** Statuses a verified success may still replace. */
const OPEN_STATUSES: Array<"PENDING" | "FAILED" | "ABANDONED"> = ["PENDING", "FAILED", "ABANDONED"];
type Verified = Awaited<ReturnType<PaymentProvider["verifyTransaction"]>>;

export type SettleResult = {
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "ABANDONED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "UNKNOWN";
  /** True when this call changed the payment. */
  applied: boolean;
};

export async function settlePayment(
  reference: string,
  opts: { provider?: PaymentProvider; now?: Date } = {},
): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) return { status: "UNKNOWN", applied: false };
  // FAILED and ABANDONED are not final: Paystack lets the payer retry a
  // declined card on the same reference, so a later verified success wins.
  if (!(OPEN_STATUSES as string[]).includes(payment.status)) return { status: payment.status, applied: false };
  if (payment.purpose !== "PLATFORM_INVOICE") return { status: payment.status, applied: false };

  const provider = opts.provider ?? getProvider();
  const v = await provider.verifyTransaction(reference);
  const decision = decideSettlement(payment.amountCents, v);

  // "abandoned" is also what Paystack says while the payer is still on the
  // checkout page, so it never closes a payment here. Reconciliation marks
  // ABANDONED after 24 hours (design 04, section 7).
  if (decision.kind === "PENDING" || decision.kind === "ABANDONED") return { status: payment.status, applied: false };
  if (decision.kind === "MISMATCH") {
    // Never apply money we did not ask for. Throw so the webhook event is
    // FAILED and reconciliation and Sentry see it.
    throw new Error(`Payment ${reference} not applied: ${decision.reason}`);
  }
  if (decision.kind === "FAILED") {
    const r = await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED", channel: v.channel ?? null },
    });
    return { status: "FAILED", applied: r.count === 1 };
  }

  const config = await getBillingConfig();
  const paidAt = v.paidAt ?? opts.now ?? new Date();
  const applied = await prisma.$transaction(
    async (tx) => {
      const won = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: OPEN_STATUSES } },
        data: { status: "SUCCEEDED", paidAt, feeCents: v.feeCents ?? null, channel: v.channel ?? null },
      });
      if (won.count === 0) return false;
      await applyPlatformInvoicePayment(tx, { paymentId: payment.id, paidAt, verified: v, periodDays: config.periodDays });
      return true;
    },
    { timeout: 15_000 },
  );
  return { status: "SUCCEEDED", applied };
}

/**
 * The invoice is paid: open the period from the payment time, record the
 * advance seats, save the card, end the trial (design 03, section 6).
 */
async function applyPlatformInvoicePayment(
  tx: Tx,
  { paymentId, paidAt, verified, periodDays }: { paymentId: string; paidAt: Date; verified: Verified; periodDays: number },
) {
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: {
      id: true, reference: true, amountCents: true, payerUserId: true, workspaceId: true,
      platformInvoice: {
        select: {
          id: true, workspaceId: true, status: true, issuedAt: true, closesPeriodId: true,
          lines: { where: { kind: "ADVANCE" }, select: { courseId: true, tierKey: true, quantity: true } },
        },
      },
    },
  });
  const invoice = payment.platformInvoice;
  const workspaceId = invoice?.workspaceId ?? payment.workspaceId;
  const actorUserId = payment.payerUserId;

  // Paid for an invoice that is no longer open (voided by a newer checkout,
  // or paid twice). Keep the money recorded and flag it for a refund by hand.
  if (!invoice || (invoice.status !== "OPEN" && invoice.status !== "PAST_DUE")) {
    console.error(`[payments] ${payment.reference} succeeded for a closed invoice; refund by hand`);
    if (actorUserId) {
      await tx.auditLog.create({
        data: {
          workspaceId, actorUserId, action: "billing.payment.unapplied", targetType: "Payment", targetId: payment.id,
          data: { invoiceId: invoice?.id ?? null, invoiceStatus: invoice?.status ?? null, amountCents: payment.amountCents },
        },
      });
    }
    return;
  }

  // The new period starts at the payment, or when the current one ends if
  // it was paid early. Periods never overlap.
  const latest = await tx.billingPeriod.findFirst({ where: { workspaceId: invoice.workspaceId }, orderBy: { end: "desc" } });
  const start = latest && latest.end > paidAt ? latest.end : paidAt;
  const { end, renewsAt } = periodFromPayment(start, periodDays);

  await tx.platformInvoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paidAt, paidVia: "CARD", opensPeriodStart: start, nextAttemptAt: null, dunningStage: "NONE" },
  });
  await tx.billingPeriod.updateMany({ where: { workspaceId: invoice.workspaceId, status: "OPEN" }, data: { status: "CLOSED" } });
  const period = await tx.billingPeriod.create({
    data: { workspaceId: invoice.workspaceId, start, end, openedByInvoiceId: invoice.id },
  });

  // Advance seats: the learners the invoice counted, rebuilt from the
  // enrolment intervals at its issue time, capped at each line's quantity.
  const courseIds = invoice.lines.map((l) => l.courseId).filter((id): id is string => id != null);
  if (courseIds.length) {
    const rows = await tx.enrollment.findMany({
      where: { courseId: { in: courseIds }, startedAt: { lte: invoice.issuedAt } },
      select: { courseId: true, learnerId: true, startedAt: true, endedAt: true },
    });
    const seats = seatsAt(rows, invoice.issuedAt);
    const data = invoice.lines.flatMap((l) =>
      l.courseId && l.tierKey
        ? (seats.get(l.courseId) ?? []).slice(0, l.quantity).map((learnerId) => ({
            workspaceId: invoice.workspaceId, billingPeriodId: period.id, courseId: l.courseId!,
            learnerId, tierKey: l.tierKey!, kind: "ADVANCE" as const, invoiceId: invoice.id,
          }))
        : [],
    );
    if (data.length) await tx.seatCharge.createMany({ data, skipDuplicates: true });
  }

  const card = verified.authorization?.reusable ? verified.authorization : null;
  await tx.subscription.update({
    where: { workspaceId: invoice.workspaceId },
    data: {
      currentPeriodStart: start,
      currentPeriodEnd: end,
      renewsAt,
      lastPaidAt: paidAt,
      deleteAfter: null,
      readOnlySince: null,
      cancelledAt: null,
      ...(card
        ? {
            authorizationCodeEnc: encryptSecret(card.code),
            cardBrand: card.brand,
            cardLast4: card.last4,
            cardExpMonth: card.expMonth,
            cardExpYear: card.expYear,
            status: "AUTHORISED" as const,
          }
        : {}),
    },
  });
  await tx.workspace.update({ where: { id: invoice.workspaceId }, data: { billingState: "ACTIVE" } });
  await tx.usageCap.deleteMany({ where: { workspaceId: invoice.workspaceId, source: "TRIAL" } });

  if (actorUserId) {
    await tx.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId, actorUserId, action: "billing.invoice.paid", targetType: "PlatformInvoice",
        targetId: invoice.id,
        data: { paymentId: payment.id, amountCents: payment.amountCents, periodStart: start.toISOString(), cardSaved: card != null },
      },
    });
  }
}
