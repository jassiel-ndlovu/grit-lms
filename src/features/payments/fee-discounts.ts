/**
 * Discount codes on parent invoices (design 03, section 8; design 04,
 * section 5, step 2). A workspace issues them (scope PARENT_INVOICE,
 * `issuerWorkspaceId` set): the discount comes out of what its payees
 * receive, so only owners and admins (unscoped `fees.manage`) create them,
 * and they apply to that workspace's invoices only. Nexa issues none.
 *
 * Redeemed per payer and child (`user:<payer>:learner:<learner>`). Each paid
 * checkout that used the code for a child counts one period; the code stops
 * for that child after `durationPeriods`. `maxRedemptions` counts children.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { BillingError } from "@/features/billing/errors";
import { prisma } from "@/lib/db";

import { discountShares } from "./checkout-math";
import type { Actor } from "./fees";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type FeeDiscountInput = {
  code: string;
  description: string;
  kind: "PERCENT" | "FIXED";
  percentBps?: number | null;
  amountCents?: number | null;
  startsAt: string;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  durationPeriods?: number | null;
};

export const redeemerKey = (payerUserId: string, learnerId: string) => `user:${payerUserId}:learner:${learnerId}`;

export async function createFeeDiscountCode(actor: Actor, workspaceId: string, input: FeeDiscountInput) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new BillingError("CODE_INVALID", "A code is 3 to 32 characters long: letters, numbers, - or _.");
  if (input.kind === "PERCENT" && !(input.percentBps && input.percentBps > 0 && input.percentBps <= 10_000)) throw new BillingError("CODE_INVALID", "A percentage discount must be between 1% and 100%.");
  if (input.kind === "FIXED" && !(input.amountCents && input.amountCents > 0)) throw new BillingError("CODE_INVALID", "A fixed discount must be more than R0.");
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && !(endsAt > startsAt))) throw new BillingError("CODE_INVALID", "The end date must be after the start date.");
  return prisma.$transaction(async (tx) => {
    if (await tx.discountCode.findUnique({ where: { code } })) throw new BillingError("CODE_USED", "That code is already in use. Choose another.");
    const row = await tx.discountCode.create({
      data: {
        code, issuerWorkspaceId: workspaceId, description: input.description, kind: input.kind,
        percentBps: input.kind === "PERCENT" ? input.percentBps! : null,
        amountCents: input.kind === "FIXED" ? input.amountCents! : null,
        scope: "PARENT_INVOICE", startsAt, endsAt,
        maxRedemptions: input.maxRedemptions ?? null, durationPeriods: input.durationPeriods ?? null,
        createdByUserId: actor.userId,
      },
    });
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: actor.userId, action: "fees.discount.create", targetType: "DiscountCode", targetId: row.id, data: { code, kind: input.kind } },
    });
    return { id: row.id, code };
  }, { timeout: 30_000 });
}

export async function deactivateFeeDiscountCode(actor: Actor, workspaceId: string, input: { id: string }) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.discountCode.findFirst({ where: { id: input.id, issuerWorkspaceId: workspaceId }, select: { id: true, code: true } });
    if (!row) throw new BillingError("NOT_FOUND", "Code not found");
    await tx.discountCode.update({ where: { id: row.id }, data: { active: false } });
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: actor.userId, action: "fees.discount.deactivate", targetType: "DiscountCode", targetId: row.id, data: { code: row.code } },
    });
    return { active: false as const };
  }, { timeout: 30_000 });
}

export async function listFeeDiscountCodesFor(workspaceId: string) {
  const rows = await prisma.discountCode.findMany({ where: { issuerWorkspaceId: workspaceId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 });
  return rows.map((c) => ({
    id: c.id, code: c.code, description: c.description, kind: c.kind, percentBps: c.percentBps, amountCents: c.amountCents,
    startsAt: c.startsAt.toISOString(), endsAt: c.endsAt?.toISOString() ?? null, maxRedemptions: c.maxRedemptions,
    redemptions: c.redemptionCount, durationPeriods: c.durationPeriods, active: c.active,
  }));
}

export type CheckoutDiscount = { codeId: string; code: string; perInvoice: Record<string, number>; discountCents: number };

/**
 * What `code` takes off each invoice in a checkout, or a BillingError
 * (CODE_INVALID, CODE_EXPIRED, CODE_USED). Invoices of other workspaces, and
 * children for whom the code has run out, are not discounted.
 */
export async function resolveCheckoutDiscount(
  db: Db,
  input: { code: string; payerUserId: string; invoices: Array<{ id: string; workspaceId: string; learnerId: string; totalCents: number }>; now: Date },
): Promise<CheckoutDiscount> {
  const c = await db.discountCode.findUnique({ where: { code: input.code.trim().toUpperCase() } });
  if (!c || !c.active || c.scope !== "PARENT_INVOICE" || !c.issuerWorkspaceId) throw new BillingError("CODE_INVALID", "That code isn't valid");
  if (c.startsAt > input.now || (c.endsAt && c.endsAt <= input.now)) throw new BillingError("CODE_EXPIRED", "That code has expired");
  const own = input.invoices.filter((i) => i.workspaceId === c.issuerWorkspaceId);
  if (own.length === 0) throw new BillingError("CODE_INVALID", "That code doesn't apply to these fees.");

  const learners = [...new Set(own.map((i) => i.learnerId))];
  const reds = await db.redemption.findMany({
    where: { discountCodeId: c.id, redeemerKey: { in: learners.map((l) => redeemerKey(input.payerUserId, l)) } },
    select: { learnerId: true, exhaustedAt: true },
  });
  const existing = new Map(reds.map((r) => [r.learnerId, r]));
  let room = c.maxRedemptions == null ? Infinity : c.maxRedemptions - c.redemptionCount;
  const allowed = new Set<string>();
  for (const l of learners) {
    const r = existing.get(l);
    if (r) {
      if (!r.exhaustedAt) allowed.add(l);
    } else if (room > 0) {
      allowed.add(l);
      room--;
    }
  }
  const eligible = own.filter((i) => allowed.has(i.learnerId));
  if (eligible.length === 0) throw new BillingError("CODE_USED", "That code has already been used up");

  const shares = discountShares(c, eligible.map((i) => i.totalCents));
  const perInvoice: Record<string, number> = {};
  eligible.forEach((i, k) => {
    if (shares[k] > 0) perInvoice[i.id] = shares[k];
  });
  const discountCents = Object.values(perInvoice).reduce((a, b) => a + b, 0);
  if (discountCents === 0) throw new BillingError("CODE_INVALID", "That code doesn't take anything off these fees.");
  return { codeId: c.id, code: c.code, perInvoice, discountCents };
}

/**
 * A checkout that used a code was paid (inside settlement): each invoice
 * gets a discount line and its lower total, and each child's redemption
 * counts one more period. Invoices that weren't applied are skipped.
 */
export async function applyCheckoutDiscount(
  tx: Tx,
  input: { discount: CheckoutDiscount; payerUserId: string; appliedInvoiceIds: string[]; now: Date },
) {
  const { discount } = input;
  const applied = input.appliedInvoiceIds.filter((id) => (discount.perInvoice[id] ?? 0) > 0);
  if (applied.length === 0) return;
  const invoices = await tx.invoice.findMany({ where: { id: { in: applied } }, select: { id: true, learnerId: true, workspaceId: true } });
  for (const inv of invoices) {
    const d = discount.perInvoice[inv.id];
    await tx.invoiceLine.create({
      data: { invoiceId: inv.id, description: `Discount ${discount.code}`, quantity: 1, unitAmountCents: -d, amountCents: -d, discountCodeId: discount.codeId },
    });
    await tx.invoice.update({ where: { id: inv.id }, data: { discountCents: { increment: d }, totalCents: { decrement: d } } });
  }
  const code = await tx.discountCode.findUniqueOrThrow({ where: { id: discount.codeId }, select: { durationPeriods: true } });
  for (const learnerId of new Set(invoices.map((i) => i.learnerId))) {
    const key = redeemerKey(input.payerUserId, learnerId);
    const ws = invoices.find((i) => i.learnerId === learnerId)!.workspaceId;
    const r = await tx.redemption.findUnique({ where: { discountCodeId_redeemerKey: { discountCodeId: discount.codeId, redeemerKey: key } } });
    const periods = (r?.periodsApplied ?? 0) + 1;
    const exhaustedAt = code.durationPeriods != null && periods >= code.durationPeriods ? input.now : null;
    if (r) {
      await tx.redemption.update({ where: { id: r.id }, data: { periodsApplied: periods, exhaustedAt } });
    } else {
      await tx.redemption.create({
        data: { discountCodeId: discount.codeId, redeemerKey: key, workspaceId: ws, payerUserId: input.payerUserId, learnerId, periodsApplied: periods, exhaustedAt },
      });
      await tx.discountCode.update({ where: { id: discount.codeId }, data: { redemptionCount: { increment: 1 } } });
    }
  }
}
