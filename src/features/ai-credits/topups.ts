/**
 * Buying AI credits (#216; owner decisions 24 Nov). Arithmetic: ./topup-math.ts.
 * Contract: billing.md, "AI credit top-ups".
 *
 *   An organisation (billing.manage) buys a pack for its shared BOUGHT pool.
 *   A student (adult, paying) or a parent for a child buys STUDENT credits:
 *   only that student's study assistant spends them, never staff.
 *
 * Paid to Nexa through Paystack (purpose AI_CREDITS, no splits). A paid pack
 * becomes one PURCHASE entry with an expiry; a daily job takes back what's
 * left of a purchase once it expires, oldest credits first. Billing must be
 * on (January).
 */

import "server-only";

import { randomBytes } from "node:crypto";

import { assertBillingEnabled, BillingError } from "@/features/billing/errors";
import { getProvider } from "@/features/payments/provider";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { creditsForPack, isPack, markupBps, roughAnswers, TOPUP_PACKS, unspentAtExpiry, validityDays, type TopupFor } from "./topup-math";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

/** The packs on offer, priced now, for a screen. */
export function topupOffer(forWhom: TopupFor) {
  const bps = markupBps();
  return {
    forWhom,
    validityDays: validityDays(),
    markupPercent: bps / 100,
    packs: TOPUP_PACKS[forWhom].map((priceCents) => {
      const credits = creditsForPack(priceCents, bps);
      return { priceCents, credits, roughStudyAnswers: roughAnswers(credits) };
    }),
  };
}

/** Who is buying, for whom: an organisation's billing manager, an adult paying student, or a parent for a child. */
async function buyerContext(viewer: Viewer, input: { forWhom: TopupFor; studentUserId?: string; workspaceId?: string }) {
  if (input.forWhom === "WORKSPACE") {
    if (!viewer.workspace || !can(viewer, "billing.manage")) throw new ViewerError("FORBIDDEN");
    return { workspaceId: viewer.workspace.id, studentUserId: null as string | null };
  }
  if (viewer.persona === "learner") {
    if (!viewer.workspace || !viewer.learner) throw new ViewerError("FORBIDDEN");
    if (!viewer.learner.paymentVisible) throw new UserError("Ask your parent to buy study credits.");
    return { workspaceId: viewer.workspace.id, studentUserId: viewer.user.id };
  }
  if (viewer.persona === "guardian") {
    if (!input.studentUserId || !viewer.children.some((c) => c.userId === input.studentUserId)) throw new ViewerError("FORBIDDEN");
    const learner = await prisma.learner.findFirst({
      where: { userId: input.studentUserId, status: "ACTIVE", ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}) },
      select: { workspaceId: true },
    });
    if (!learner) throw new UserError("Your child isn't in a class on Nexa yet.");
    return { workspaceId: learner.workspaceId, studentUserId: input.studentUserId };
  }
  throw new ViewerError("FORBIDDEN");
}

/** Starts a Paystack checkout for a pack. Returns where to send the browser. */
export async function startTopup(viewer: Viewer, input: { forWhom: TopupFor; priceCents: number; studentUserId?: string; workspaceId?: string; callbackUrl: string }) {
  assertBillingEnabled();
  if (!isPack(input.forWhom, input.priceCents)) throw new UserError("Choose one of the packs.");
  const ctx = await buyerContext(viewer, input);
  const credits = creditsForPack(input.priceCents);
  const reference = `nx-cr-${randomBytes(10).toString("hex")}`;
  await prisma.payment.create({
    data: {
      provider: "PAYSTACK", reference, purpose: "AI_CREDITS", workspaceId: ctx.workspaceId, payerUserId: viewer.user.id, amountCents: input.priceCents,
      splitSent: { topup: { forWhom: input.forWhom, studentUserId: ctx.studentUserId, credits, markupBps: markupBps(), validityDays: validityDays() } } as Prisma.InputJsonValue,
    },
  });
  const { authorizationUrl } = await getProvider().initializeCheckout({
    reference, email: viewer.user.email, amountCents: input.priceCents, callbackUrl: input.callbackUrl, channels: ["card"],
    metadata: { purpose: "AI_CREDITS", for: input.forWhom },
  });
  return { authorizationUrl, reference, credits };
}

/** From settlePayment, inside its transaction: turns a paid pack into credits, once. */
export async function applyTopupPayment(tx: Tx, input: { paymentId: string; paidAt: Date }) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId }, select: { workspaceId: true, payerUserId: true, splitSent: true } });
  const t = (p.splitSent as { topup?: { forWhom: TopupFor; studentUserId: string | null; credits: number; validityDays: number } } | null)?.topup;
  if (!t || !p.workspaceId) throw new BillingError("FORBIDDEN", "A credit payment without its pack");
  await tx.aiCreditEntry.create({
    data: {
      workspaceId: p.workspaceId, pool: t.forWhom === "STUDENT" ? "STUDENT" : "BOUGHT", kind: "PURCHASE", credits: t.credits,
      userId: t.forWhom === "STUDENT" ? t.studentUserId : null, ref: input.paymentId, key: `topup:${input.paymentId}`,
      expiresAt: new Date(input.paidAt.getTime() + t.validityDays * DAY), createdById: p.payerUserId,
      note: `Bought pack (${t.credits} credits)`,
    },
  });
}

/** A student's study credits in a workspace. */
export async function studentCredits(workspaceId: string, studentUserId: string, db: Tx | typeof prisma = prisma): Promise<number> {
  const s = await db.aiCreditEntry.aggregate({ where: { workspaceId, pool: "STUDENT", userId: studentUserId }, _sum: { credits: true } });
  return s._sum.credits ?? 0;
}

/** Spends a student's study credits for a finished answer; with `force`, even past zero (the call has happened). */
export async function spendStudentCredits(input: { workspaceId: string; studentUserId: string; credits: number; ref: string }) {
  if (input.credits <= 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-credits:${input.workspaceId}:${input.studentUserId}`}))`;
    await tx.aiCreditEntry.create({
      data: { workspaceId: input.workspaceId, pool: "STUDENT", kind: "SPEND", credits: -input.credits, userId: input.studentUserId, feature: "study-assistant", ref: input.ref },
    });
  });
}

/** For the student's (or parent's) screen: their balance, purchases and what's expiring soon. */
export async function myStudyCredits(viewer: Viewer, input: { studentUserId?: string; workspaceId?: string }) {
  const ctx = await buyerContext(viewer, { forWhom: "STUDENT", ...input }).catch((e) => {
    if (e instanceof UserError && viewer.persona === "learner" && viewer.workspace) return { workspaceId: viewer.workspace.id, studentUserId: viewer.user.id };
    throw e;
  });
  const now = new Date();
  const [balance, purchases] = await Promise.all([
    studentCredits(ctx.workspaceId, ctx.studentUserId!),
    prisma.aiCreditEntry.findMany({ where: { workspaceId: ctx.workspaceId, pool: "STUDENT", userId: ctx.studentUserId, kind: "PURCHASE" }, orderBy: { createdAt: "desc" }, take: 20, select: { credits: true, createdAt: true, expiresAt: true } }),
  ]);
  return {
    balance: Math.max(0, balance),
    purchases: purchases.map((p) => ({ credits: p.credits, boughtAt: p.createdAt, expiresAt: p.expiresAt, expired: !!p.expiresAt && p.expiresAt <= now })),
    offer: topupOffer("STUDENT"),
  };
}

/**
 * Daily: for each purchase that has expired and hasn't been settled, takes
 * back its unspent part (oldest credits are spent first, so newer purchases
 * keep theirs). Idempotent through the entry key.
 */
export async function expireCredits(now: Date = new Date()): Promise<{ purchases: number; creditsTakenBack: number }> {
  const due = await prisma.aiCreditEntry.findMany({
    where: { kind: "PURCHASE", pool: { in: ["BOUGHT", "STUDENT"] }, expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: 500,
    select: { id: true, workspaceId: true, pool: true, userId: true, credits: true, createdAt: true },
  });
  let purchases = 0;
  let taken = 0;
  for (const p of due) {
    if (await prisma.aiCreditEntry.findUnique({ where: { key: `expire:${p.id}` }, select: { id: true } })) continue;
    const scope = { workspaceId: p.workspaceId, pool: p.pool, ...(p.pool === "STUDENT" ? { userId: p.userId } : {}) };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-credits:${p.workspaceId}${p.pool === "STUDENT" ? `:${p.userId}` : ""}`}))`;
      const [bal, newer] = await Promise.all([
        tx.aiCreditEntry.aggregate({ where: scope, _sum: { credits: true } }),
        tx.aiCreditEntry.aggregate({ where: { ...scope, kind: "PURCHASE", createdAt: { gt: p.createdAt }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, _sum: { credits: true } }),
      ]);
      const unspent = unspentAtExpiry({ poolBalance: bal._sum.credits ?? 0, purchaseCredits: p.credits, newerUnexpiredCredits: newer._sum.credits ?? 0 });
      await tx.aiCreditEntry.create({
        data: { ...scope, userId: p.userId, kind: "ADJUST", credits: -unspent, key: `expire:${p.id}`, ref: p.id, note: unspent ? "Bought credits expired" : "Bought credits expired (all used)" },
      });
      purchases++;
      taken += unspent;
    });
  }
  return { purchases, creditsTakenBack: taken };
}

/** For the return page: the purchase's status and credits (only the payer's own). */
export async function topupStatusFor(payerUserId: string, reference: string) {
  const p = await prisma.payment.findUnique({ where: { reference }, select: { id: true, payerUserId: true, purpose: true, status: true, splitSent: true } });
  if (!p || p.purpose !== "AI_CREDITS" || p.payerUserId !== payerUserId) throw new BillingError("NOT_FOUND", "No credit purchase with that reference");
  const t = (p.splitSent as { topup?: { credits: number; forWhom: TopupFor } } | null)?.topup;
  return { status: p.status, credits: t?.credits ?? 0, forWhom: t?.forWhom ?? "WORKSPACE" };
}
