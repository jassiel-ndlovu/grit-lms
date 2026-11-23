/**
 * Parent checkout (Gate 2; design 04, section 5; contract section 2). A
 * guardian, or an adult student who may see their fees, pays any open
 * invoices across children and tutors at once. Tutor shares split at
 * capture into each payee's Paystack subaccount; Nexa never holds tutor
 * money. Server only; takes its payer context so scripts can test it.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { BillingError } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { emitWebhook } from "@/features/api/webhooks";
import { enqueueEmail } from "@/lib/email/queue";

import { DEFAULT_CHECKOUT_CONFIG, planCheckout } from "./checkout-math";
import { applyCheckoutDiscount, resolveCheckoutDiscount, type CheckoutDiscount } from "./fee-discounts";
import { getProvider, type PaymentProvider } from "./provider";
import { closeRecovered, planRecoveryDeductions } from "./recovery";

type Tx = Prisma.TransactionClient;
const LOCK_MS = 30 * 60 * 1000;

/** Whose invoices this person may pay: their children's, and their own if they may see their fees. */
export type Payer = { userId: string; email: string; childUserIds: string[]; selfVisible: boolean };

function payableUserIds(p: Payer): string[] {
  return [...p.childUserIds, ...(p.selfVisible ? [p.userId] : [])];
}

/** Open (and recently paid) invoices this payer may see, newest due first. */
export async function listPayableInvoicesFor(payer: Payer, input: { status?: "OPEN" | "PAID" } = {}) {
  const now = new Date();
  const rows = await prisma.invoice.findMany({
    where: { studentUserId: { in: payableUserIds(payer) }, status: input.status ?? { in: ["OPEN", "PAID"] } },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true, number: true, studentUserId: true, totalCents: true, dueAt: true, status: true, lockedUntil: true,
      payoutAccount: { select: { businessName: true } }, workspace: { select: { name: true } },
    },
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentUserId))] } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    child: { userId: r.studentUserId, name: name.get(r.studentUserId) ?? "" },
    payee: { name: r.payoutAccount.businessName },
    workspaceName: r.workspace.name,
    totalCents: r.totalCents,
    dueAt: r.dueAt.toISOString(),
    status: r.status,
    lockedUntil: r.lockedUntil && r.lockedUntil > now ? r.lockedUntil.toISOString() : null,
  }));
}

/** Checks the payer may pay these invoices now, applies the discount code, and plans the split. */
async function prepareCheckout(payer: Payer, input: { invoiceIds: string[]; discountCode?: string }, now: Date) {
  const ids = [...new Set(input.invoiceIds)];
  if (ids.length === 0 || ids.length > 30) throw new BillingError("FORBIDDEN", "Choose between 1 and 30 invoices");
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, studentUserId: true, learnerId: true, workspaceId: true, status: true, totalCents: true, lockedUntil: true,
      payoutAccount: { select: { id: true, subaccountCode: true, status: true } },
    },
  });
  if (invoices.length !== ids.length) throw new BillingError("NOT_FOUND", "Some invoices were not found");
  const allowed = new Set(payableUserIds(payer));
  for (const i of invoices) {
    if (!allowed.has(i.studentUserId)) throw new BillingError("FORBIDDEN", "You can't pay one of these invoices");
    if (i.status !== "OPEN") throw new BillingError("FORBIDDEN", "One of these invoices is no longer open");
    if (i.lockedUntil && i.lockedUntil > now) throw new BillingError("FORBIDDEN", "One of these invoices is already being paid; try again in 30 minutes");
    if (i.payoutAccount.status !== "ACTIVE") throw new BillingError("FORBIDDEN", "A tutor's payout account isn't ready yet");
  }
  const discount = input.discountCode?.trim()
    ? await resolveCheckoutDiscount(prisma, { code: input.discountCode, payerUserId: payer.userId, invoices, now })
    : null;
  const plan = planCheckout(invoices.map((i) => ({
    invoiceId: i.id, payoutAccountId: i.payoutAccount.id, subaccountCode: i.payoutAccount.subaccountCode,
    totalCents: i.totalCents - (discount?.perInvoice[i.id] ?? 0),
  })));
  return { ids, invoices, discount, plan };
}

/**
 * What the payer would pay, before they choose to: totals per invoice after
 * the discount code, if any. Same checks as startCheckout, nothing locked.
 */
export async function previewCheckoutFor(payer: Payer, input: { invoiceIds: string[]; discountCode?: string }) {
  const { invoices, discount, plan } = await prepareCheckout(payer, input, new Date());
  return {
    totalCents: plan.totalCents,
    discountCents: discount?.discountCents ?? 0,
    code: discount?.code ?? null,
    invoices: invoices.map((i) => ({ id: i.id, totalCents: i.totalCents, discountCents: discount?.perInvoice[i.id] ?? 0 })),
  };
}

/**
 * Locks the invoices for 30 minutes, records the payment and its split, and
 * returns Paystack's checkout page. A PARENT_INVOICE discount code lowers
 * the invoices of the workspace that issued it (./fee-discounts.ts); it is
 * recorded on the invoices only once the payment succeeds.
 */
export async function startCheckoutFor(
  payer: Payer,
  input: { invoiceIds: string[]; discountCode?: string; callbackUrl: string },
  provider: PaymentProvider = getProvider(),
) {
  const now = new Date();
  const { ids, invoices, discount, plan } = await prepareCheckout(payer, input, now);
  const reference = `nx-chk-${randomBytes(10).toString("hex")}`;
  const until = new Date(now.getTime() + LOCK_MS);

  const splits = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        provider: "PAYSTACK", reference, purpose: "PARENT_CHECKOUT", payerUserId: payer.userId, amountCents: plan.totalCents,
        commissionCents: plan.commissionCents, estimatedFeeCents: plan.estimatedFeeCents,
        splitSent: { splits: plan.splits, nexaShareCents: plan.nexaShareCents, config: DEFAULT_CHECKOUT_CONFIG, discount } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    // Take every lock or none: another checkout may have taken one meanwhile.
    const locked = await tx.invoice.updateMany({
      where: { id: { in: ids }, status: "OPEN", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
      data: { lockedByPaymentId: payment.id, lockedUntil: until },
    });
    if (locked.count !== ids.length) throw new BillingError("FORBIDDEN", "One of these invoices is already being paid; try again in 30 minutes");
    await tx.paymentAllocation.createMany({ data: plan.allocations.map((a) => ({ ...a, paymentId: payment.id })) });
    // Refunds Nexa funded come back out of these payees' shares (./recovery.ts).
    const subOf = new Map(invoices.map((i) => [i.payoutAccount.id, i.payoutAccount.subaccountCode]));
    const shareOf = new Map<string, number>();
    for (const a of plan.allocations) shareOf.set(a.payoutAccountId, (shareOf.get(a.payoutAccountId) ?? 0) + a.shareCents);
    const taken = await planRecoveryDeductions(tx, payment.id, [...shareOf].map(([payoutAccountId, shareCents]) => ({ payoutAccountId, shareCents })), now);
    if (taken.size === 0) return plan.splits;
    const less = new Map([...taken].map(([pa, cents]) => [subOf.get(pa)!, cents]));
    const adjusted = plan.splits.map((s) => ({ subaccountCode: s.subaccountCode, shareCents: s.shareCents - (less.get(s.subaccountCode) ?? 0) }));
    const recoveredCents = [...taken.values()].reduce((n, c) => n + c, 0);
    await tx.payment.update({
      where: { id: payment.id },
      data: { splitSent: { splits: adjusted, nexaShareCents: plan.nexaShareCents + recoveredCents, recoveredCents, config: DEFAULT_CHECKOUT_CONFIG, discount } as Prisma.InputJsonValue },
    });
    return adjusted;
  }, { timeout: 30_000 });

  try {
    const { authorizationUrl } = await provider.initializeCheckout({
      reference,
      email: payer.email,
      amountCents: plan.totalCents,
      callbackUrl: input.callbackUrl,
      channels: ["card"],
      splits,
      feeBearer: "PAYEES_PROPORTIONAL",
      metadata: { purpose: "PARENT_CHECKOUT", invoices: String(ids.length) },
    });
    return { authorizationUrl, reference, totalCents: plan.totalCents, discountCents: discount?.discountCents ?? 0 };
  } catch (e) {
    await releaseLocks(prisma, reference, "FAILED");
    throw e;
  }
}

/** Frees the invoices a checkout holds and closes the payment (failed or abandoned). */
export async function releaseLocks(db: Tx | typeof prisma, reference: string, status: "FAILED" | "ABANDONED") {
  const p = await db.payment.findUnique({ where: { reference }, select: { id: true } });
  if (!p) return;
  await db.invoice.updateMany({ where: { lockedByPaymentId: p.id }, data: { lockedByPaymentId: null, lockedUntil: null } });
  await db.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status } });
}

/**
 * The checkout was paid (called by settlePayment inside its transaction):
 * each invoice still OPEN becomes PAID online. One paid meanwhile another way
 * (two guardians at once, or off-site) is flagged for a refund of that share.
 */
export async function applyCheckoutPayment(tx: Tx, input: { paymentId: string; paidAt: Date; feeCents: number | null }) {
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    select: { payerUserId: true, amountCents: true, splitSent: true, allocations: { select: { id: true, invoiceId: true, amountCents: true, invoice: { select: { status: true, workspaceId: true, number: true } } } } },
  });
  const unapplied: string[] = [];
  for (const a of payment.allocations) {
    const ok = await tx.invoice.updateMany({
      where: { id: a.invoiceId, status: "OPEN" },
      data: { status: "PAID", paidAt: input.paidAt, paidVia: "ONLINE", payerUserId: payment.payerUserId, lockedByPaymentId: null, lockedUntil: null },
    });
    if (ok.count === 0) unapplied.push(a.invoice.number);
    else await emitWebhook(tx, a.invoice.workspaceId, "invoice.paid", { invoiceId: a.invoiceId, number: a.invoice.number, paidVia: "ONLINE", paidAt: input.paidAt.toISOString(), amountCents: a.amountCents });
    if (input.feeCents != null && payment.amountCents > 0) {
      await tx.paymentAllocation.update({ where: { id: a.id }, data: { feeShareCents: Math.round((input.feeCents * a.amountCents) / payment.amountCents) } });
    }
  }
  // Receipt to the payer, for what was applied.
  const applied = payment.allocations.filter((a) => !unapplied.includes(a.invoice.number));
  const discount = (payment.splitSent as { discount?: CheckoutDiscount | null } | null)?.discount;
  if (discount && payment.payerUserId) {
    await applyCheckoutDiscount(tx, { discount, payerUserId: payment.payerUserId, appliedInvoiceIds: applied.map((a) => a.invoiceId), now: input.paidAt });
  }
  if (payment.payerUserId && applied.length) {
    const payer = await tx.user.findUnique({ where: { id: payment.payerUserId }, select: { email: true } });
    const payee = await tx.paymentAllocation.findFirst({ where: { paymentId: input.paymentId }, select: { payoutAccount: { select: { businessName: true } } } });
    if (payer) {
      await enqueueEmail(tx, {
        key: `fees:receipt:${input.paymentId}`,
        template: "fees:receipt",
        to: payer.email,
        userId: payment.payerUserId,
        workspaceId: applied[0].invoice.workspaceId,
        category: "BILLING",
        priority: "BILLING",
        data: {
          payeeName: payee?.payoutAccount.businessName ?? "",
          numbers: applied.map((a) => a.invoice.number),
          totalCents: applied.reduce((n, a) => n + a.amountCents, 0),
          paidOn: new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(input.paidAt),
        },
      });
    }
  }
  await closeRecovered(tx, input.paymentId, input.paidAt);
  if (unapplied.length) {
    console.error(`[payments] checkout paid invoices that were no longer open (${unapplied.join(", ")}); refund those shares by hand`);
    const ws = payment.allocations[0]?.invoice.workspaceId ?? null;
    if (payment.payerUserId) {
      await tx.auditLog.create({
        data: { workspaceId: ws, actorUserId: payment.payerUserId, action: "fees.checkout.unapplied", targetType: "Payment", targetId: input.paymentId, data: { invoices: unapplied } },
      });
    }
  }
}

/** For the return page: the payment and each invoice in it. */
export async function checkoutStatusFor(payerUserId: string, reference: string) {
  const p = await prisma.payment.findUnique({
    where: { reference },
    select: { payerUserId: true, purpose: true, status: true, allocations: { select: { invoiceId: true, invoice: { select: { status: true } } } } },
  });
  if (!p || p.purpose !== "PARENT_CHECKOUT" || p.payerUserId !== payerUserId) throw new BillingError("NOT_FOUND", "No checkout with that reference");
  return { status: p.status, invoices: p.allocations.map((a) => ({ id: a.invoiceId, status: a.invoice.status })) };
}
