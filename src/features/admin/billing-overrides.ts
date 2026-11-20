/**
 * Nexa admin billing overrides (design 03, section 9; contract section 4).
 * Each takes the acting admin and a note, and writes an AuditLog row in the
 * same transaction. The server actions in ./billing-actions.ts check
 * `admin.override` and call these. Server only.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { getBillingConfig, loadCourseBilling } from "@/features/billing/data";
import { BillingError } from "@/features/billing/errors";
import { addDays, billedTier, derivedTier } from "@/features/billing/pricing";
import { getProvider, type PaymentProvider } from "@/features/payments/provider";
import { recoveryOwed } from "@/features/payments/recovery-math";
import { issueRefund, markInvoicePaid } from "@/features/payments/settle";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;
export type Actor = { userId: string; impersonatorUserId?: string | null };
const TX = { timeout: 30_000 };

function audit(tx: Tx, actor: Actor, workspaceId: string | null, action: string, targetType: string, targetId: string, data: Record<string, unknown>) {
  return tx.auditLog.create({
    data: {
      workspaceId, actorUserId: actor.userId, impersonatorUserId: actor.impersonatorUserId ?? null,
      action, targetType, targetId, data: data as Prisma.InputJsonValue,
    },
  });
}

/** The workspace's Subscription, created for a workspace that never had one (billing email: its owner). */
async function ensureSubscription(tx: Tx, workspaceId: string) {
  const sub = await tx.subscription.findUnique({ where: { workspaceId } });
  if (sub) return sub;
  const owner = await tx.membership.findFirst({
    where: { workspaceId, role: "OWNER", status: "ACTIVE" },
    select: { user: { select: { email: true } } },
  });
  if (!owner) throw new BillingError("NOT_FOUND", "The workspace has no owner to bill");
  return tx.subscription.create({ data: { workspaceId, billingEmail: owner.user.email } });
}

/** Trial ends `days` later; an expired, never-paid trial reopens for `days` from now. */
export async function extendTrial(actor: Actor, input: { workspaceId: string; days: number; note: string }) {
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: input.workspaceId }, select: { billingState: true, trialEndsAt: true } });
    if (!ws) throw new BillingError("NOT_FOUND", "Workspace not found");
    const sub = await tx.subscription.findUnique({ where: { workspaceId: input.workspaceId }, select: { lastPaidAt: true } });
    const neverPaid = !sub?.lastPaidAt;
    const now = new Date();
    const reopen = ws.billingState === "READ_ONLY" && neverPaid;
    if (ws.billingState !== "TRIAL" && !reopen) throw new BillingError("FORBIDDEN", `No trial to extend in state ${ws.billingState}`);
    const from = ws.trialEndsAt && ws.trialEndsAt > now ? ws.trialEndsAt : now;
    const trialEndsAt = addDays(from, input.days);
    await tx.workspace.update({ where: { id: input.workspaceId }, data: { trialEndsAt, billingState: "TRIAL" } });
    if (reopen) await tx.subscription.updateMany({ where: { workspaceId: input.workspaceId }, data: { readOnlySince: null, deleteAfter: null } });
    await audit(tx, actor, input.workspaceId, "billing.trial.extend", "Workspace", input.workspaceId, { days: input.days, note: input.note, trialEndsAt: trialEndsAt.toISOString(), reopened: reopen });
    return { trialEndsAt: trialEndsAt.toISOString() };
  }, TX);
}

/**
 * Comp the workspace until a date (null = until ended), or end a comp. A
 * comped workspace is never deleted; its renewals carry a COMP line. Ending
 * makes it ACTIVE if it ever paid (the next renewal charges the card), else
 * READ_ONLY.
 */
export async function setComp(actor: Actor, input: { workspaceId: string; until: string | null; note: string; end?: boolean }) {
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: input.workspaceId }, select: { billingState: true } });
    if (!ws) throw new BillingError("NOT_FOUND", "Workspace not found");
    const sub = await ensureSubscription(tx, input.workspaceId);
    let state: string;
    if (input.end) {
      if (ws.billingState !== "COMPED") throw new BillingError("FORBIDDEN", "The workspace is not comped");
      const everPaid = sub.lastPaidAt != null || sub.renewsAt != null;
      state = everPaid ? "ACTIVE" : "READ_ONLY";
      await tx.subscription.update({ where: { workspaceId: input.workspaceId }, data: { compedUntil: null, ...(everPaid ? {} : { readOnlySince: new Date() }) } });
      await audit(tx, actor, input.workspaceId, "billing.comp.end", "Workspace", input.workspaceId, { note: input.note, state });
    } else {
      const until = input.until ? new Date(input.until) : null;
      if (until && until <= new Date()) throw new BillingError("FORBIDDEN", "`until` must be in the future");
      state = "COMPED";
      await tx.subscription.update({ where: { workspaceId: input.workspaceId }, data: { compedUntil: until, deleteAfter: null, readOnlySince: null } });
      await audit(tx, actor, input.workspaceId, "billing.comp.set", "Workspace", input.workspaceId, { note: input.note, until: until?.toISOString() ?? null, from: ws.billingState });
    }
    await tx.workspace.update({ where: { id: input.workspaceId }, data: { billingState: state as never } });
    return { state };
  }, TX);
}

/** Pin a course to a tier (optionally until a date), or remove the pin with `tierKey: null`. */
export async function overrideCourseTier(actor: Actor, input: { courseId: string; tierKey: "CORE" | "PLUS" | "PRO" | null; until?: string | null; note: string }) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { workspaceId: true } });
  if (!course?.workspaceId) throw new BillingError("NOT_FOUND", "Course not found");
  const workspaceId = course.workspaceId;
  await prisma.$transaction(async (tx) => {
    if (input.tierKey == null) {
      await tx.courseTierOverride.deleteMany({ where: { courseId: input.courseId } });
    } else {
      const until = input.until ? new Date(input.until) : null;
      await tx.courseTierOverride.upsert({
        where: { courseId: input.courseId },
        create: { workspaceId, courseId: input.courseId, tierKey: input.tierKey, until, reason: input.note, createdByUserId: actor.userId },
        update: { tierKey: input.tierKey, until, reason: input.note, createdByUserId: actor.userId },
      });
    }
    await audit(tx, actor, workspaceId, "billing.tier.override", "Course", input.courseId, { tierKey: input.tierKey, until: input.until ?? null, note: input.note });
  }, TX);
  const row = await loadCourseBilling(input.courseId);
  const billedTierKey = row ? billedTier({ derived: derivedTier(row.enabledKeys), holds: row.holds, override: row.override, at: new Date() }) : input.tierKey;
  return { billedTierKey };
}

/** Credit applied to the workspace's next invoices. */
export async function issueCreditNote(actor: Actor, input: { workspaceId: string; amountCents: number; reason: string }) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new BillingError("FORBIDDEN", "Amount must be whole cents above zero");
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: input.workspaceId }, select: { id: true } });
    if (!ws) throw new BillingError("NOT_FOUND", "Workspace not found");
    const note = await tx.creditNote.create({ data: { workspaceId: input.workspaceId, amountCents: input.amountCents, reason: input.reason, createdByUserId: actor.userId } });
    await audit(tx, actor, input.workspaceId, "billing.credit.issue", "CreditNote", note.id, { amountCents: input.amountCents, reason: input.reason });
    return { creditNoteId: note.id };
  }, TX);
}

/**
 * Void an unpaid invoice that has no successful payment. Its CATCH_UP seat
 * charges go with it. A PAST_DUE or READ_ONLY workspace with no other
 * overdue invoice becomes ACTIVE. Tier upgrades already written to seat
 * charges stay (they were billed, and are now waived with the invoice).
 */
export async function voidPlatformInvoice(actor: Actor, input: { invoiceId: string; note: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.platformInvoice.findUnique({ where: { id: input.invoiceId }, select: { id: true, workspaceId: true, status: true, number: true, totalCents: true } });
    if (!inv) throw new BillingError("NOT_FOUND", "Invoice not found");
    if (inv.status !== "OPEN" && inv.status !== "PAST_DUE") throw new BillingError("FORBIDDEN", `Can't void an invoice that is ${inv.status}`);
    const paid = await tx.payment.count({ where: { platformInvoiceId: inv.id, status: { in: ["SUCCEEDED", "PENDING"] } } });
    if (paid > 0) throw new BillingError("FORBIDDEN", "The invoice has a payment in progress or taken; refund it instead");
    await tx.platformInvoice.update({ where: { id: inv.id }, data: { status: "VOID", nextAttemptAt: null, dunningStage: "NONE" } });
    await tx.seatCharge.deleteMany({ where: { invoiceId: inv.id, kind: "CATCH_UP" } });
    const now = new Date();
    const otherOverdue = await tx.platformInvoice.count({
      where: { workspaceId: inv.workspaceId, id: { not: inv.id }, OR: [{ status: "PAST_DUE" }, { status: "OPEN", dueAt: { lt: now } }] },
    });
    if (otherOverdue === 0) {
      await tx.workspace.updateMany({ where: { id: inv.workspaceId, billingState: { in: ["PAST_DUE", "READ_ONLY"] } }, data: { billingState: "ACTIVE" } });
    }
    await audit(tx, actor, inv.workspaceId, "billing.invoice.void", "PlatformInvoice", inv.id, { number: inv.number, totalCents: inv.totalCents, note: input.note });
    return { status: "VOID" as const };
  }, TX);
}

/**
 * Record a payment received outside Paystack (EFT, cash) for the full
 * invoice total. The invoice is PAID via OFFSITE and opens its period from
 * `receivedOn`, like a card payment would from its payment time.
 */
export async function markPaidOffsite(
  actor: Actor,
  input: { platformInvoiceId: string; method: "CASH" | "EFT" | "OTHER"; amountCents: number; receivedOn: string; reference?: string | null; note: string },
) {
  const config = await getBillingConfig();
  return prisma.$transaction(async (tx) => {
    const inv = await tx.platformInvoice.findUnique({ where: { id: input.platformInvoiceId }, select: { id: true, workspaceId: true, status: true, totalCents: true, number: true } });
    if (!inv) throw new BillingError("NOT_FOUND", "Invoice not found");
    if (inv.status !== "OPEN" && inv.status !== "PAST_DUE") throw new BillingError("FORBIDDEN", `Can't mark an invoice that is ${inv.status} as paid`);
    if (input.amountCents !== inv.totalCents) throw new BillingError("FORBIDDEN", `The amount must equal the invoice total (${inv.totalCents} cents); part payments aren't supported`);
    const receivedOn = new Date(input.receivedOn);
    if (Number.isNaN(receivedOn.getTime()) || receivedOn > new Date()) throw new BillingError("FORBIDDEN", "`receivedOn` must be a date that has passed");
    const off = await tx.offsitePayment.create({
      data: {
        workspaceId: inv.workspaceId, platformInvoiceId: inv.id, method: input.method, amountCents: input.amountCents,
        receivedOn, reference: input.reference ?? null, note: input.note, markedByUserId: actor.userId, markedAs: "NEXA_ADMIN",
      },
    });
    await markInvoicePaid(tx, { invoiceId: inv.id, paidAt: receivedOn, paidVia: "OFFSITE", periodDays: config.periodDays, actorUserId: actor.userId, audit: { offsitePaymentId: off.id, method: input.method } });
    await audit(tx, actor, inv.workspaceId, "billing.invoice.offsite", "PlatformInvoice", inv.id, { number: inv.number, amountCents: input.amountCents, method: input.method, receivedOn: input.receivedOn, note: input.note });
    return { status: "PAID" as const };
  }, TX);
}

/**
 * Refund a Gate 1 payment in full or in part. A partial refund is sent once:
 * if Paystack's answer is lost, it stays PENDING for a person to check
 * (reconciliation never resends a partial refund).
 */
export async function refundPayment(actor: Actor, input: { paymentId: string; amountCents?: number; reason: string }, provider: PaymentProvider = getProvider()) {
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { id: true, workspaceId: true, amountCents: true, status: true, reference: true } });
    if (!p) throw new BillingError("NOT_FOUND", "Payment not found");
    if (p.status !== "SUCCEEDED" && p.status !== "PARTIALLY_REFUNDED") throw new BillingError("FORBIDDEN", `Can't refund a payment that is ${p.status}`);
    const done = await tx.refund.aggregate({ where: { paymentId: p.id, status: { in: ["PENDING", "PROCESSED"] } }, _sum: { amountCents: true } });
    const left = p.amountCents - (done._sum.amountCents ?? 0);
    const amount = input.amountCents ?? left;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > left) throw new BillingError("FORBIDDEN", `Refund must be between 1 and ${left} cents`);
    const refund = await tx.refund.create({ data: { paymentId: p.id, amountCents: amount, reason: input.reason, requestedByUserId: actor.userId } });
    await audit(tx, actor, p.workspaceId, "billing.payment.refund", "Payment", p.id, { refundId: refund.id, amountCents: amount, reason: input.reason });
    return refund;
  }, TX);
  let status: string = "PENDING";
  try {
    status = await issueRefund(created.id, provider);
  } catch (e) {
    console.error("[admin] refund not confirmed by Paystack:", (e as Error).message);
  }
  return { refundId: created.id, status };
}

/**
 * Refund a paid fee invoice, in full or in part, after an investigation
 * (owner decision 2026-11-20: never self-serve). Paystack takes it from
 * Nexa's balance; the payee's share of it becomes a PayoutRecovery, which
 * starts with a notice once Paystack processes the refund.
 */
export async function refundFeeInvoice(actor: Actor, input: { invoiceId: string; amountCents?: number; reason: string }, provider: PaymentProvider = getProvider()) {
  const created = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true, number: true, workspaceId: true, status: true, paidVia: true,
        allocations: {
          where: { payment: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } } },
          select: { id: true, paymentId: true, payoutAccountId: true, amountCents: true, shareCents: true },
        },
      },
    });
    if (!inv) throw new BillingError("NOT_FOUND", "Invoice not found");
    if ((inv.status !== "PAID" && inv.status !== "PARTIALLY_REFUNDED") || inv.paidVia !== "ONLINE") {
      throw new BillingError("FORBIDDEN", "Only invoices paid online through Nexa can be refunded here");
    }
    if (inv.allocations.length !== 1) throw new BillingError("FORBIDDEN", "This invoice was paid more than once; refund the extra payment from its payment record");
    const a = inv.allocations[0];
    const done = await tx.refund.aggregate({ where: { allocationId: a.id, status: { in: ["PENDING", "PROCESSED"] } }, _sum: { amountCents: true } });
    const left = a.amountCents - (done._sum.amountCents ?? 0);
    const amount = input.amountCents ?? left;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > left) throw new BillingError("FORBIDDEN", `Refund must be between 1 and ${left} cents`);
    const owed = recoveryOwed(amount, a);
    const refund = await tx.refund.create({
      data: { paymentId: a.paymentId, allocationId: a.id, amountCents: amount, commissionReturnedCents: amount - owed, reason: input.reason, requestedByUserId: actor.userId },
    });
    if (owed > 0) await tx.payoutRecovery.create({ data: { workspaceId: inv.workspaceId, payoutAccountId: a.payoutAccountId, refundId: refund.id, amountCents: owed } });
    await audit(tx, actor, inv.workspaceId, "fees.invoice.refund", "Invoice", inv.id, { refundId: refund.id, amountCents: amount, recoveryCents: owed, reason: input.reason });
    return refund;
  }, TX);
  let status: string = "PENDING";
  try {
    status = await issueRefund(created.id, provider);
  } catch (e) {
    console.error("[admin] fee refund not confirmed by Paystack:", (e as Error).message);
  }
  return { refundId: created.id, status };
}

/** Stop recovering a refund from the payee (for example, the investigation found Nexa at fault). */
export async function waiveRecovery(actor: Actor, input: { recoveryId: string; note: string }) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.payoutRecovery.findUnique({ where: { id: input.recoveryId }, select: { id: true, workspaceId: true, status: true } });
    if (!r) throw new BillingError("NOT_FOUND", "Recovery not found");
    if (r.status !== "ACTIVE" && r.status !== "AWAITING_REFUND") throw new BillingError("FORBIDDEN", `Can't waive a recovery that is ${r.status}`);
    await tx.payoutRecovery.update({ where: { id: r.id }, data: { status: "WAIVED", closedAt: new Date(), note: input.note } });
    await audit(tx, actor, r.workspaceId, "fees.recovery.waive", "PayoutRecovery", r.id, { note: input.note });
    return { id: r.id, status: "WAIVED" as const };
  }, TX);
}

/** Pause deductions while a payee's dispute is looked at again: none are taken before `until`. */
export async function holdRecovery(actor: Actor, input: { recoveryId: string; until: string; note: string }) {
  const until = new Date(input.until);
  if (Number.isNaN(until.getTime()) || until <= new Date()) throw new BillingError("FORBIDDEN", "Hold until a future date");
  return prisma.$transaction(async (tx) => {
    const r = await tx.payoutRecovery.findUnique({ where: { id: input.recoveryId }, select: { id: true, workspaceId: true, status: true } });
    if (!r) throw new BillingError("NOT_FOUND", "Recovery not found");
    if (r.status !== "ACTIVE") throw new BillingError("FORBIDDEN", `Can't hold a recovery that is ${r.status}`);
    await tx.payoutRecovery.update({ where: { id: r.id }, data: { deductFrom: until } });
    await audit(tx, actor, r.workspaceId, "fees.recovery.hold", "PayoutRecovery", r.id, { until: until.toISOString(), note: input.note });
    return { id: r.id, deductFrom: until.toISOString() };
  }, TX);
}

/** The payee repaid outside Nexa (for example by EFT): close it. */
export async function settleRecoveryOffsite(actor: Actor, input: { recoveryId: string; note: string }) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.payoutRecovery.findUnique({ where: { id: input.recoveryId }, select: { id: true, workspaceId: true, status: true } });
    if (!r) throw new BillingError("NOT_FOUND", "Recovery not found");
    if (r.status !== "ACTIVE") throw new BillingError("FORBIDDEN", `Can't settle a recovery that is ${r.status}`);
    await tx.payoutRecovery.update({ where: { id: r.id }, data: { status: "RECOVERED", closedAt: new Date(), note: `Repaid off-site: ${input.note}` } });
    await audit(tx, actor, r.workspaceId, "fees.recovery.offsite", "PayoutRecovery", r.id, { note: input.note });
    return { id: r.id, status: "RECOVERED" as const };
  }, TX);
}

export type DiscountCodeInput = {
  code: string;
  description: string;
  kind: "PERCENT" | "FIXED";
  percentBps?: number | null;
  amountCents?: number | null;
  scope: "WORKSPACE_BILL" | "TIER" | "ADDON";
  scopeTierKey?: "CORE" | "PLUS" | "PRO" | null;
  scopeServiceKey?: string | null;
  startsAt: string;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  durationPeriods?: number | null;
};

/** A Nexa discount code for workspace bills. Codes are stored upper case. */
export async function createDiscountCode(actor: Actor, input: DiscountCodeInput) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new BillingError("CODE_INVALID", "Codes are 3 to 32 letters, digits, - or _");
  if (input.kind === "PERCENT" && !(input.percentBps && input.percentBps > 0 && input.percentBps <= 10_000)) throw new BillingError("CODE_INVALID", "A percent code needs percentBps from 1 to 10000");
  if (input.kind === "FIXED" && !(input.amountCents && input.amountCents > 0)) throw new BillingError("CODE_INVALID", "A fixed code needs amountCents above zero");
  if (input.scope === "TIER" && !input.scopeTierKey) throw new BillingError("CODE_INVALID", "A TIER code needs scopeTierKey");
  if (input.scope === "ADDON" && !input.scopeServiceKey) throw new BillingError("CODE_INVALID", "An ADDON code needs scopeServiceKey");
  return prisma.$transaction(async (tx) => {
    if (await tx.discountCode.findUnique({ where: { code } })) throw new BillingError("CODE_USED", "That code already exists");
    const row = await tx.discountCode.create({
      data: {
        code, description: input.description, kind: input.kind,
        percentBps: input.kind === "PERCENT" ? input.percentBps! : null,
        amountCents: input.kind === "FIXED" ? input.amountCents! : null,
        scope: input.scope, scopeTierKey: input.scopeTierKey ?? null, scopeServiceKey: input.scopeServiceKey ?? null,
        startsAt: new Date(input.startsAt), endsAt: input.endsAt ? new Date(input.endsAt) : null,
        maxRedemptions: input.maxRedemptions ?? null, durationPeriods: input.durationPeriods ?? null,
        createdByUserId: actor.userId,
      },
    });
    await audit(tx, actor, null, "billing.discount.create", "DiscountCode", row.id, { code, kind: input.kind, scope: input.scope });
    return { id: row.id, code };
  }, TX);
}

export async function deactivateDiscountCode(actor: Actor, input: { id: string; note: string }) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.discountCode.findUnique({ where: { id: input.id }, select: { id: true, code: true } });
    if (!row) throw new BillingError("NOT_FOUND", "Code not found");
    await tx.discountCode.update({ where: { id: input.id }, data: { active: false } });
    await audit(tx, actor, null, "billing.discount.deactivate", "DiscountCode", row.id, { code: row.code, note: input.note });
    return { active: false as const };
  }, TX);
}
