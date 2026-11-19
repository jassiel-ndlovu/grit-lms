/**
 * settlePayment: the one place a Payment leaves PENDING (design 04, sections
 * 3, 4 and 6). The webhook, the return-page poll, the renewal charge and
 * reconciliation all call it. It asks the provider (verifyTransaction) and
 * applies the result in one transaction. Idempotent: the status change is a
 * conditional update, so two callers racing apply it once.
 *
 * Built: PLATFORM_INVOICE and CARD_AUTHORISATION (Gate 1). PARENT_CHECKOUT is
 * left alone until its flow exists.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { getBillingConfig } from "@/features/billing/data";
import { dayLabel, queueBillingEmail } from "@/features/billing/emails";
import { periodFromPayment } from "@/features/billing/pricing";
import { prisma } from "@/lib/db";

import { getProvider, type PaymentProvider } from "./provider";
import { encryptSecret } from "./secrets";
import { addCalendarMonths, decideSettlement, seatsAt } from "./settlement-rules";

type Tx = Prisma.TransactionClient;
type Verified = Awaited<ReturnType<PaymentProvider["verifyTransaction"]>>;
type Card = NonNullable<Verified["authorization"]>;

/** Statuses a verified success may still replace. */
const OPEN_STATUSES: Array<"PENDING" | "FAILED" | "ABANDONED"> = ["PENDING", "FAILED", "ABANDONED"];

/** Data is kept until this long after the last payment (design 03, section 5). */
const RETENTION_MONTHS = 2;

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
  if (payment.purpose === "PARENT_CHECKOUT") return { status: payment.status, applied: false };

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
  const card = v.authorization?.reusable ? v.authorization : null;
  const outcome = await prisma.$transaction(
    async (tx) => {
      const won = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: OPEN_STATUSES } },
        data: { status: "SUCCEEDED", paidAt, feeCents: v.feeCents ?? null, channel: v.channel ?? null },
      });
      if (won.count === 0) return null;
      if (payment.purpose === "PLATFORM_INVOICE") {
        await applyPlatformInvoicePayment(tx, { paymentId: payment.id, paidAt, card, periodDays: config.periodDays });
        return { refundId: null };
      }
      // CARD_AUTHORISATION: keep the card, give the verification charge back.
      if (payment.workspaceId && card) await saveCard(tx, payment.workspaceId, card);
      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          amountCents: payment.amountCents,
          reason: "Card check for Nexa billing, refunded",
          requestedByUserId: payment.payerUserId!,
        },
        select: { id: true },
      });
      if (payment.payerUserId) {
        await tx.auditLog.create({
          data: {
            workspaceId: payment.workspaceId, actorUserId: payment.payerUserId, action: "billing.card.replace",
            targetType: "Payment", targetId: payment.id, data: { cardSaved: card != null, last4: card?.last4 ?? null },
          },
        });
      }
      return { refundId: refund.id };
    },
    { timeout: 30_000 },
  );
  // The refund is a provider call, so it runs after the commit. If it fails
  // the Refund stays PENDING and reconciliation retries it.
  if (outcome?.refundId) await issueRefund(outcome.refundId, provider).catch((e) => {
    console.error("[payments] card-check refund not sent yet:", (e as Error).message);
  });
  return { status: "SUCCEEDED", applied: outcome != null };
}

/**
 * Sends a PENDING refund to the provider. Paystack has no idempotency key,
 * but it refuses to refund more than is left on a transaction, so retrying
 * a full refund cannot pay out twice.
 */
export async function issueRefund(refundId: string, provider: PaymentProvider = getProvider()) {
  const refund = await prisma.refund.findUniqueOrThrow({
    where: { id: refundId },
    select: { id: true, status: true, amountCents: true, reason: true, providerRefundId: true, payment: { select: { id: true, reference: true, amountCents: true } } },
  });
  if (refund.status !== "PENDING" || refund.providerRefundId) return refund.status;
  const r = await provider.refund({
    reference: refund.payment.reference,
    amountCents: refund.amountCents,
    reason: refund.reason,
    idempotencyKey: refund.id,
  });
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: { providerRefundId: r.providerRefundId, status: r.status, processedAt: r.status === "PENDING" ? null : new Date() },
    });
    if (r.status === "PROCESSED") await markRefunded(tx, refund.payment.id);
  }, { timeout: 30_000 });
  return r.status;
}

/** Payment REFUNDED or PARTIALLY_REFUNDED from its processed refunds. */
export async function markRefunded(tx: Tx, paymentId: string) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { amountCents: true } });
  const done = await tx.refund.aggregate({ where: { paymentId, status: "PROCESSED" }, _sum: { amountCents: true } });
  const sum = done._sum.amountCents ?? 0;
  if (sum <= 0) return;
  await tx.payment.update({ where: { id: paymentId }, data: { status: sum >= p.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
}

async function saveCard(tx: Tx, workspaceId: string, card: Card) {
  await tx.subscription.update({
    where: { workspaceId },
    data: {
      authorizationCodeEnc: encryptSecret(card.code),
      cardBrand: card.brand,
      cardLast4: card.last4,
      cardExpMonth: card.expMonth,
      cardExpYear: card.expYear,
      status: "AUTHORISED",
    },
  });
}

async function applyPlatformInvoicePayment(
  tx: Tx,
  { paymentId, paidAt, card, periodDays }: { paymentId: string; paidAt: Date; card: Card | null; periodDays: number },
) {
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { id: true, reference: true, amountCents: true, payerUserId: true, workspaceId: true, platformInvoice: { select: { id: true, status: true } } },
  });
  const invoice = payment.platformInvoice;
  const actorUserId = payment.payerUserId;

  // Paid for an invoice that is no longer open (voided by a newer checkout,
  // or paid twice). Keep the money recorded and flag it for a refund by hand.
  if (!invoice || (invoice.status !== "OPEN" && invoice.status !== "PAST_DUE")) {
    console.error(`[payments] ${payment.reference} succeeded for a closed invoice; refund by hand`);
    if (actorUserId) {
      await tx.auditLog.create({
        data: {
          workspaceId: payment.workspaceId, actorUserId, action: "billing.payment.unapplied", targetType: "Payment", targetId: payment.id,
          data: { invoiceId: invoice?.id ?? null, invoiceStatus: invoice?.status ?? null, amountCents: payment.amountCents },
        },
      });
    }
    return;
  }
  await markInvoicePaid(tx, {
    invoiceId: invoice.id, paidAt, paidVia: "CARD", card, periodDays, actorUserId,
    audit: { paymentId: payment.id, amountCents: payment.amountCents },
  });
}

/**
 * An invoice is paid (by card, or at zero because of a comp or credit): open
 * the period from the payment time, record the advance seats, save the card
 * if one came with it, and make the workspace ACTIVE (a COMPED one stays
 * COMPED). Design 03, sections 3, 4 and 6.
 */
export async function markInvoicePaid(
  tx: Tx,
  input: {
    invoiceId: string;
    paidAt: Date;
    paidVia: "CARD" | "COMPED" | "CREDIT" | "OFFSITE";
    card?: Card | null;
    periodDays: number;
    actorUserId?: string | null;
    audit?: Record<string, unknown>;
  },
) {
  const { paidAt, periodDays } = input;
  const invoice = await tx.platformInvoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
    select: {
      id: true, number: true, workspaceId: true, issuedAt: true, totalCents: true, creditCents: true,
      lines: { where: { kind: "ADVANCE" }, select: { courseId: true, tierKey: true, quantity: true } },
    },
  });
  const workspaceId = invoice.workspaceId;
  const ws = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { billingState: true, name: true, timezone: true } });

  // The final arrears invoice of a cancelled workspace: paid, but it opens
  // no new period and does not reactivate the workspace.
  if (ws.billingState === "CANCELLED" && invoice.lines.length === 0) {
    await tx.platformInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt, paidVia: input.paidVia, nextAttemptAt: null, dunningStage: "NONE" } });
    await tx.subscription.update({ where: { workspaceId }, data: { lastPaidAt: paidAt, deleteAfter: addCalendarMonths(paidAt, RETENTION_MONTHS) } });
    await consumeInvoiceAdjustments(tx, invoice);
    return;
  }

  // The new period starts at the payment, or when the current one ends if
  // it was paid early. Periods never overlap.
  const latest = await tx.billingPeriod.findFirst({ where: { workspaceId }, orderBy: { end: "desc" } });
  const start = latest && latest.end > paidAt ? latest.end : paidAt;
  const { end, renewsAt } = periodFromPayment(start, periodDays);

  await tx.platformInvoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paidAt, paidVia: input.paidVia, opensPeriodStart: start, nextAttemptAt: null, dunningStage: "NONE" },
  });
  await consumeInvoiceAdjustments(tx, invoice);
  await tx.billingPeriod.updateMany({ where: { workspaceId, status: "OPEN" }, data: { status: "CLOSED" } });
  const period = await tx.billingPeriod.create({ data: { workspaceId, start, end, openedByInvoiceId: invoice.id } });

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
            workspaceId, billingPeriodId: period.id, courseId: l.courseId!,
            learnerId, tierKey: l.tierKey!, kind: "ADVANCE" as const, invoiceId: invoice.id,
          }))
        : [],
    );
    if (data.length) await tx.seatCharge.createMany({ data, skipDuplicates: true });
  }

  await tx.subscription.update({
    where: { workspaceId },
    data: {
      currentPeriodStart: start,
      currentPeriodEnd: end,
      renewsAt,
      lastPaidAt: paidAt,
      deleteAfter: addCalendarMonths(paidAt, RETENTION_MONTHS),
      readOnlySince: null,
      cancelledAt: null,
    },
  });
  if (input.card) await saveCard(tx, workspaceId, input.card);
  if (ws.billingState !== "COMPED") await tx.workspace.update({ where: { id: workspaceId }, data: { billingState: "ACTIVE" } });
  await tx.usageCap.deleteMany({ where: { workspaceId, source: "TRIAL" } });

  if (input.paidVia === "CARD" && invoice.totalCents > 0) {
    const sub = await tx.subscription.findUniqueOrThrow({ where: { workspaceId }, select: { cardLast4: true } });
    await queueBillingEmail(tx, {
      workspaceId,
      template: "receipt",
      event: invoice.id,
      data: {
        workspaceName: ws.name,
        invoiceNumber: invoice.number,
        totalCents: invoice.totalCents,
        paidOn: dayLabel(paidAt, ws.timezone),
        renewsOn: dayLabel(renewsAt, ws.timezone),
        cardLast4: input.card?.last4 ?? sub.cardLast4,
      },
    });
  }

  if (input.actorUserId) {
    await tx.auditLog.create({
      data: {
        workspaceId, actorUserId: input.actorUserId, action: "billing.invoice.paid", targetType: "PlatformInvoice",
        targetId: invoice.id,
        data: { ...input.audit, paidVia: input.paidVia, periodStart: start.toISOString(), cardSaved: input.card != null },
      } as Prisma.AuditLogUncheckedCreateInput,
    });
  }
}

/**
 * A paid invoice uses up what it applied: one period of its discount code
 * (exhausted at the code's durationPeriods) and its credit, oldest credit
 * note first. A partly used note is closed and its remainder reissued.
 */
async function consumeInvoiceAdjustments(
  tx: Tx,
  invoice: { id: string; workspaceId: string; creditCents: number },
) {
  const discountLines = await tx.platformInvoiceLine.findMany({
    where: { invoiceId: invoice.id, kind: "DISCOUNT", discountCodeId: { not: null } },
    select: { discountCodeId: true },
  });
  for (const codeId of new Set(discountLines.map((l) => l.discountCodeId!))) {
    const red = await tx.redemption.findUnique({
      where: { discountCodeId_redeemerKey: { discountCodeId: codeId, redeemerKey: `ws:${invoice.workspaceId}` } },
      select: { id: true, periodsApplied: true, discountCode: { select: { durationPeriods: true } } },
    });
    if (!red) continue;
    const periods = red.periodsApplied + 1;
    const limit = red.discountCode.durationPeriods;
    await tx.redemption.update({
      where: { id: red.id },
      data: { periodsApplied: periods, exhaustedAt: limit != null && periods >= limit ? new Date() : null },
    });
  }

  let left = invoice.creditCents;
  if (left <= 0) return;
  const notes = await tx.creditNote.findMany({ where: { workspaceId: invoice.workspaceId, status: "OPEN" }, orderBy: { createdAt: "asc" } });
  for (const n of notes) {
    if (left <= 0) break;
    const use = Math.min(left, n.amountCents);
    await tx.creditNote.update({ where: { id: n.id }, data: { status: "APPLIED", appliedToInvoiceId: invoice.id } });
    if (use < n.amountCents) {
      await tx.creditNote.create({
        data: {
          workspaceId: n.workspaceId, amountCents: n.amountCents - use, reason: `Remainder of credit ${n.id}`,
          createdByUserId: n.createdByUserId,
        },
      });
    }
    left -= use;
  }
}
