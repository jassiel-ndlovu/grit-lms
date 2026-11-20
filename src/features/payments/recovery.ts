/**
 * Recovering refunds from payees (owner decision 2026-11-20; rules in
 * ./recovery-math.ts).
 *
 *   1. A Nexa admin refunds a fee invoice after an investigation
 *      (admin/billing-overrides.ts, refundFeeInvoice). Paystack takes it from
 *      Nexa's balance; a PayoutRecovery records the payee's share, waiting
 *      for the refund to process.
 *   2. Once Paystack processes it (syncRecoveries), the payee is sent a
 *      notice of deduction and deductions start a week later.
 *   3. Each later checkout sends that payee a smaller split
 *      (planRecoveryDeductions); Nexa's share takes the difference.
 *   4. With no deduction for 60 days the payee is emailed an invoice they
 *      can pay by card (offerRecoveryInvoices, startRecoveryPaymentFor).
 *
 * A deduction counts while its payment is pending or paid, so two checkouts
 * at once can't both take the same debt; a failed or abandoned payment's
 * deduction drops out on its own.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { billingRecipients, dayLabel } from "@/features/billing/emails";
import { BillingError } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import type { PayoutTemplate, PayoutTemplateData } from "@/lib/email/payout-templates";

import { getProvider, type PaymentProvider } from "./provider";
import { RECOVERY, takeDeductions } from "./recovery-math";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;
const DAY = 24 * 60 * 60 * 1000;
/** Paystack lets a payer retry a declined card on the same reference while they're on the page. */
const FAILED_HOLD_MS = 60 * 60 * 1000;
const PAID = ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

/** Per recovery: what pending and paid payments hold, and what is confirmed paid. */
async function deductionSums(db: Db, recoveryIds: string[], now: Date) {
  const rows = await db.payoutRecoveryDeduction.findMany({
    where: { recoveryId: { in: recoveryIds } },
    select: { recoveryId: true, amountCents: true, createdAt: true, payment: { select: { status: true, createdAt: true } } },
  });
  const out = new Map<string, { held: number; confirmed: number; lastConfirmedAt: Date | null }>();
  for (const id of recoveryIds) out.set(id, { held: 0, confirmed: 0, lastConfirmedAt: null });
  for (const r of rows) {
    const s = out.get(r.recoveryId)!;
    const st = r.payment.status;
    const paid = (PAID as readonly string[]).includes(st);
    if (paid) {
      s.confirmed += r.amountCents;
      if (!s.lastConfirmedAt || r.createdAt > s.lastConfirmedAt) s.lastConfirmedAt = r.createdAt;
    }
    if (paid || st === "PENDING" || (st === "FAILED" && now.getTime() - r.payment.createdAt.getTime() < FAILED_HOLD_MS)) s.held += r.amountCents;
  }
  return out;
}

/** Who hears about a payout account: the tutor in PER_TUTOR mode, else the workspace's owners and admins. */
async function payeePeople(db: Db, payoutAccountId: string) {
  const pa = await db.payoutAccount.findUniqueOrThrow({ where: { id: payoutAccountId }, select: { workspaceId: true, membershipId: true, businessName: true } });
  if (pa.membershipId) {
    const m = await db.membership.findUnique({ where: { id: pa.membershipId }, select: { user: { select: { id: true, email: true } } } });
    return { pa, people: m ? [{ email: m.user.email, userId: m.user.id as string | null }] : [] };
  }
  return { pa, people: await billingRecipients(db, pa.workspaceId) };
}

async function queuePayoutEmail<T extends PayoutTemplate>(db: Db, payoutAccountId: string, template: T, event: string, data: (payeeName: string) => PayoutTemplateData[T]) {
  const { pa, people } = await payeePeople(db, payoutAccountId);
  for (const p of people) {
    await enqueueEmail(db, {
      key: `payouts:${template}:${event}:${createHash("sha256").update(p.email.toLowerCase()).digest("hex").slice(0, 16)}`,
      template: `payouts:${template}`,
      to: p.email,
      userId: p.userId,
      workspaceId: pa.workspaceId,
      category: "BILLING",
      priority: "BILLING",
      data: data(pa.businessName) as Prisma.InputJsonValue,
    });
  }
  return people.length;
}

/**
 * After a payment's refunds change (inside the caller's transaction): a
 * processed refund starts its recovery and sends the notice; a failed one
 * cancels it. Fee invoices with processed refunds become REFUNDED or
 * PARTIALLY_REFUNDED.
 */
export async function syncRecoveries(tx: Tx, paymentId: string, now: Date = new Date()) {
  const allocations = await tx.paymentAllocation.findMany({
    where: { paymentId, refunds: { some: { status: "PROCESSED" } } },
    select: { invoiceId: true, amountCents: true, refunds: { where: { status: "PROCESSED" }, select: { amountCents: true } } },
  });
  for (const a of allocations) {
    const sum = a.refunds.reduce((n, r) => n + r.amountCents, 0);
    await tx.invoice.updateMany({
      where: { id: a.invoiceId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      data: { status: sum >= a.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
  }

  const waiting = await tx.payoutRecovery.findMany({
    where: { status: "AWAITING_REFUND", refund: { paymentId, status: { in: ["PROCESSED", "FAILED"] } } },
    select: {
      id: true, payoutAccountId: true, workspaceId: true, amountCents: true,
      refund: { select: { status: true, amountCents: true, reason: true, allocation: { select: { invoice: { select: { number: true, studentUserId: true } } } } } },
    },
  });
  for (const r of waiting) {
    if (r.refund.status === "FAILED") {
      await tx.payoutRecovery.update({ where: { id: r.id }, data: { status: "CANCELLED", closedAt: now, note: "The refund failed" } });
      continue;
    }
    const deductFrom = new Date(now.getTime() + RECOVERY.graceDays * DAY);
    const won = await tx.payoutRecovery.updateMany({ where: { id: r.id, status: "AWAITING_REFUND" }, data: { status: "ACTIVE", noticeSentAt: now, deductFrom } });
    if (won.count === 0) continue;
    const [ws, student] = await Promise.all([
      tx.workspace.findUnique({ where: { id: r.workspaceId }, select: { timezone: true } }),
      r.refund.allocation ? tx.user.findUnique({ where: { id: r.refund.allocation.invoice.studentUserId }, select: { name: true } }) : null,
    ]);
    await queuePayoutEmail(tx, r.payoutAccountId, "recovery-notice", r.id, (payeeName) => ({
      payeeName,
      invoiceNumber: r.refund.allocation?.invoice.number ?? "",
      studentName: student?.name ?? "the student",
      refundCents: r.refund.amountCents,
      owedCents: r.amountCents,
      reason: r.refund.reason,
      deductFromOn: dayLabel(deductFrom, ws?.timezone ?? "Africa/Johannesburg"),
      maxSharePercent: RECOVERY.maxShareBps / 100,
    }));
  }
}

/**
 * Deductions for a checkout being started (inside its transaction): locks
 * each payee's active recoveries, takes what is still owed from their
 * share, and records it against the payment. Returns the amount taken per
 * payout account.
 */
export async function planRecoveryDeductions(tx: Tx, paymentId: string, payouts: Array<{ payoutAccountId: string; shareCents: number }>, now: Date): Promise<Map<string, number>> {
  const taken = new Map<string, number>();
  const ids = [...new Set(payouts.map((p) => p.payoutAccountId))];
  if (ids.length === 0) return taken;
  const locked = await tx.$queryRaw<Array<{ id: string; payoutAccountId: string; amountCents: number }>>`
    SELECT "id", "payoutAccountId", "amountCents" FROM "PayoutRecovery"
    WHERE "payoutAccountId" IN (${Prisma.join(ids)}) AND "status" = 'ACTIVE' AND "deductFrom" <= ${now}
    ORDER BY "createdAt", "id" FOR UPDATE`;
  if (locked.length === 0) return taken;
  const sums = await deductionSums(tx, locked.map((r) => r.id), now);
  for (const p of payouts) {
    const debts = locked
      .filter((r) => r.payoutAccountId === p.payoutAccountId)
      .map((r) => ({ id: r.id, outstandingCents: r.amountCents - sums.get(r.id)!.held }));
    const take = takeDeductions(p.shareCents, debts);
    if (take.length === 0) continue;
    await tx.payoutRecoveryDeduction.createMany({ data: take.map((t) => ({ recoveryId: t.id, paymentId, amountCents: t.amountCents })) });
    for (const t of take) sums.get(t.id)!.held += t.amountCents;
    taken.set(p.payoutAccountId, (taken.get(p.payoutAccountId) ?? 0) + take.reduce((n, t) => n + t.amountCents, 0));
  }
  return taken;
}

/** A payment carrying deductions succeeded (inside its transaction): close what is now repaid. */
export async function closeRecovered(tx: Tx, paymentId: string, now: Date = new Date()) {
  const deds = await tx.payoutRecoveryDeduction.findMany({ where: { paymentId }, select: { recoveryId: true } });
  if (deds.length === 0) return;
  const recs = await tx.payoutRecovery.findMany({
    where: { id: { in: deds.map((d) => d.recoveryId) }, status: "ACTIVE" },
    select: { id: true, amountCents: true, payoutAccountId: true, refund: { select: { allocation: { select: { invoice: { select: { number: true } } } } } } },
  });
  const sums = await deductionSums(tx, recs.map((r) => r.id), now);
  for (const r of recs) {
    const { confirmed } = sums.get(r.id)!;
    if (confirmed < r.amountCents) continue;
    if (confirmed > r.amountCents) console.error(`[payments] recovery ${r.id} collected ${confirmed - r.amountCents} cents too much; return it to the payee`);
    await tx.payoutRecovery.update({ where: { id: r.id }, data: { status: "RECOVERED", closedAt: now } });
    await queuePayoutEmail(tx, r.payoutAccountId, "recovery-repaid", r.id, (payeeName) => ({
      payeeName, invoiceNumber: r.refund.allocation?.invoice.number ?? "", owedCents: r.amountCents,
    }));
  }
}

/** For the daily fees job: offer an invoice where nothing was recovered for 60 days. */
export async function offerRecoveryInvoices(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RECOVERY.invoiceAfterDays * DAY);
  const recs = await prisma.payoutRecovery.findMany({
    where: { status: "ACTIVE", invoiceOfferedAt: null, deductFrom: { lte: cutoff } },
    select: { id: true, amountCents: true, payoutAccountId: true, refund: { select: { allocation: { select: { invoice: { select: { number: true } } } } } } },
    take: 200,
  });
  if (recs.length === 0) return 0;
  const sums = await deductionSums(prisma, recs.map((r) => r.id), now);
  let n = 0;
  for (const r of recs) {
    const s = sums.get(r.id)!;
    const outstanding = r.amountCents - s.held;
    if (outstanding <= 0 || (s.lastConfirmedAt && s.lastConfirmedAt > cutoff)) continue;
    await prisma.$transaction(async (tx) => {
      const won = await tx.payoutRecovery.updateMany({ where: { id: r.id, invoiceOfferedAt: null }, data: { invoiceOfferedAt: now } });
      if (won.count === 0) return;
      await queuePayoutEmail(tx, r.payoutAccountId, "recovery-invoice", r.id, (payeeName) => ({
        payeeName, invoiceNumber: r.refund.allocation?.invoice.number ?? "", outstandingCents: outstanding,
        payPath: `/api/payouts/recoveries/${r.id}/pay`, days: RECOVERY.invoiceAfterDays,
      }));
      n++;
    }, { timeout: 30_000 });
  }
  return n;
}

/** Whether this user answers for the payout account: the tutor, or an owner or admin in WORKSPACE mode. */
async function isPayee(userId: string, payoutAccount: { workspaceId: string; membershipId: string | null }) {
  if (payoutAccount.membershipId) {
    const m = await prisma.membership.findUnique({ where: { id: payoutAccount.membershipId }, select: { userId: true, status: true } });
    return m?.userId === userId && m.status === "ACTIVE";
  }
  const m = await prisma.membership.findFirst({ where: { workspaceId: payoutAccount.workspaceId, userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
  return m != null;
}

/**
 * The payee pays what is still owed by card (no split: it all goes to
 * Nexa). An earlier attempt still pending is checked with Paystack first,
 * then set aside, so a payee who left the page can start again.
 */
export async function startRecoveryPaymentFor(
  user: { id: string; email: string },
  recoveryId: string,
  callbackUrl: string,
  provider: PaymentProvider = getProvider(),
  settle?: (reference: string) => Promise<unknown>,
) {
  const rec = await prisma.payoutRecovery.findUnique({
    where: { id: recoveryId },
    select: { id: true, status: true, workspaceId: true, payoutAccount: { select: { workspaceId: true, membershipId: true } } },
  });
  if (!rec || !(await isPayee(user.id, rec.payoutAccount))) throw new BillingError("NOT_FOUND", "Nothing to pay here");
  if (rec.status !== "ACTIVE") throw new BillingError("FORBIDDEN", "This is already repaid or closed");

  const earlier = await prisma.payment.findMany({
    where: { purpose: "PAYOUT_RECOVERY", status: "PENDING", recoveryDeductions: { some: { recoveryId } } },
    select: { reference: true },
  });
  for (const p of earlier) {
    if (settle) await settle(p.reference).catch(() => undefined);
    await prisma.payment.updateMany({ where: { reference: p.reference, status: "PENDING" }, data: { status: "ABANDONED" } });
  }

  const now = new Date();
  const reference = `nx-rec-${randomBytes(10).toString("hex")}`;
  const amountCents = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PayoutRecovery" WHERE "id" = ${recoveryId} FOR UPDATE`;
    const r = await tx.payoutRecovery.findUniqueOrThrow({ where: { id: recoveryId }, select: { amountCents: true, status: true } });
    if (r.status !== "ACTIVE") throw new BillingError("FORBIDDEN", "This is already repaid or closed");
    const left = r.amountCents - (await deductionSums(tx, [recoveryId], now)).get(recoveryId)!.held;
    if (left <= 0) throw new BillingError("FORBIDDEN", "Nothing is owed right now; a payment may still be in progress");
    const payment = await tx.payment.create({
      data: { provider: "PAYSTACK", reference, purpose: "PAYOUT_RECOVERY", workspaceId: rec.workspaceId, payerUserId: user.id, amountCents: left },
      select: { id: true },
    });
    await tx.payoutRecoveryDeduction.create({ data: { recoveryId, paymentId: payment.id, amountCents: left } });
    return left;
  }, { timeout: 30_000 });

  try {
    const { authorizationUrl } = await provider.initializeCheckout({
      reference, email: user.email, amountCents, callbackUrl, channels: ["card"], metadata: { purpose: "PAYOUT_RECOVERY" },
    });
    return { authorizationUrl, reference, amountCents };
  } catch (e) {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "ABANDONED" } });
    throw e;
  }
}

/** For the return route: the recovery payment, if it is this user's. */
export async function recoveryPaymentFor(userId: string, reference: string) {
  const p = await prisma.payment.findUnique({ where: { reference }, select: { purpose: true, payerUserId: true, status: true } });
  if (!p || p.purpose !== "PAYOUT_RECOVERY" || p.payerUserId !== userId) return null;
  return p;
}

/** For the payee's screens: their recoveries and what is left on each. */
export async function listRecoveriesFor(payoutAccountIds: string[], now: Date = new Date(), opts: { includeAwaiting?: boolean } = {}) {
  const recs = await prisma.payoutRecovery.findMany({
    where: { payoutAccountId: { in: payoutAccountIds }, ...(opts.includeAwaiting ? {} : { status: { not: "AWAITING_REFUND" } }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, payoutAccountId: true, amountCents: true, status: true, noticeSentAt: true, deductFrom: true, invoiceOfferedAt: true, closedAt: true,
      refund: { select: { amountCents: true, reason: true, allocation: { select: { invoice: { select: { number: true } } } } } },
    },
  });
  const sums = await deductionSums(prisma, recs.map((r) => r.id), now);
  return recs.map((r) => {
    const s = sums.get(r.id)!;
    return {
      id: r.id,
      payoutAccountId: r.payoutAccountId,
      invoiceNumber: r.refund.allocation?.invoice.number ?? null,
      refundCents: r.refund.amountCents,
      reason: r.refund.reason,
      owedCents: r.amountCents,
      repaidCents: s.confirmed,
      outstandingCents: r.status === "ACTIVE" ? Math.max(0, r.amountCents - s.confirmed) : 0,
      status: r.status,
      noticeSentAt: r.noticeSentAt?.toISOString() ?? null,
      deductFrom: r.deductFrom?.toISOString() ?? null,
      payPath: r.status === "ACTIVE" && r.invoiceOfferedAt ? `/api/payouts/recoveries/${r.id}/pay` : null,
      closedAt: r.closedAt?.toISOString() ?? null,
    };
  });
}
