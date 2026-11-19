/**
 * Platform invoices (design 03, section 4). Built here: the first invoice,
 * which opens period 1 with seats in advance. buildRenewalInvoice (arrears,
 * catch-ups, usage) joins with the daily billing job.
 */

import "server-only";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { nextInvoiceNumber } from "@/features/payments/settlement-rules";

import {
  activeSeatsByCourse,
  aiUsageByCourse,
  getBillingConfig,
  getTierPrices,
  loadOpenPeriod,
  loadWorkspaceCourses,
  overlappingLearnersByCourse,
} from "./data";
import { billedTier, buildPeriodInvoice, derivedTier, highestTierDuring } from "./pricing";
import { courseTierAtStart } from "./queries";

type Tx = Prisma.TransactionClient;

/** Inserts with the next free number; retries if another invoice took it first. */
async function withInvoiceNumber<T>(at: Date, write: (tx: Tx, number: string) => Promise<T>): Promise<T> {
  const year = at.getUTCFullYear();
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.platformInvoice.findFirst({
          where: { number: { startsWith: `NX-${year}-` } },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        return write(tx, nextInvoiceNumber(year, last?.number ?? null));
      });
    } catch (e) {
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!clash || attempt >= 4) throw e;
    }
  }
}

/**
 * The invoice a workspace pays to leave the trial (or to come back from
 * READ_ONLY or CANCELLED): seats in advance for 30 days, for the learners
 * enrolled now, at each course's billed tier. Voids any earlier unpaid
 * first invoice so only one is open. Status OPEN, due now.
 */
export async function createFirstInvoice(workspaceId: string, now = new Date()) {
  const [config, courses, { prices, aiMarksPerStudent }] = await Promise.all([
    getBillingConfig(),
    loadWorkspaceCourses(workspaceId),
    getTierPrices(now),
  ]);
  const seats = await activeSeatsByCourse(courses.map((c) => c.courseId));
  const draft = buildPeriodInvoice({
    prices,
    aiMarksPerStudent,
    apiMarginBps: config.apiMarginBps,
    advance: courses.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      tier: billedTier({ derived: derivedTier(c.enabledKeys), holds: c.holds, override: c.override, at: now }),
      learnerIds: seats.get(c.courseId) ?? [],
    })),
    vatRateBps: config.vatRegistered ? config.vatRateBps : null,
  });

  return withInvoiceNumber(now, async (tx, number) => {
    await tx.platformInvoice.updateMany({
      where: { workspaceId, closesPeriodId: null, status: "OPEN", opensPeriodStart: { lte: now }, paidAt: null },
      data: { status: "VOID" },
    });
    return tx.platformInvoice.create({
      data: {
        number,
        workspaceId,
        opensPeriodStart: now,
        status: "OPEN",
        subtotalCents: draft.subtotalCents,
        discountCents: draft.discountCents,
        creditCents: draft.creditCents,
        vatRateBps: config.vatRegistered ? config.vatRateBps : null,
        vatCents: draft.vatCents,
        totalCents: draft.totalCents,
        issuedAt: now,
        dueAt: now,
        lines: {
          create: draft.lines.map((l) => ({
            kind: l.kind,
            courseId: l.courseId,
            courseTitle: l.courseTitle,
            tierKey: l.tierKey,
            serviceKey: l.serviceKey,
            description: l.description,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            amountCents: l.amountCents,
          })),
        },
      },
      select: { id: true, number: true, totalCents: true, attemptCount: true },
    });
  });
}

/**
 * The renewal invoice for the period starting at `at` that closes the
 * workspace's current period P (design 03, section 4): seats in advance at
 * each course's tier at `at`, catch-up seats and tier upgrades for P, and
 * AI marks above the Pro pool. A COMPED workspace gets a COMP line that
 * brings the total to zero. Idempotent: one invoice per closed period
 * (unique workspaceId + closesPeriodId); a second call returns the first.
 *
 * Writes P's CATCH_UP seat charges and tier upgrades now, so a later
 * catch-up never bills a seat twice. Not yet applied here: discount codes
 * and credit notes (no redemption flow yet).
 */
export async function buildRenewalInvoice(workspaceId: string, at: Date, opts: { comped?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const p = await prisma.billingPeriod.findFirst({ where: { workspaceId }, orderBy: { end: "desc" }, select: { id: true, end: true } });
  if (!p) throw new Error(`Workspace ${workspaceId} has no billing period to renew`);
  const existing = await prisma.platformInvoice.findUnique({
    where: { workspaceId_closesPeriodId: { workspaceId, closesPeriodId: p.id } },
    select: { id: true, number: true, totalCents: true, attemptCount: true, status: true },
  });
  if (existing) return { ...existing, created: false };

  const period = (await loadOpenPeriod(workspaceId, new Date(p.end.getTime() - 1)))!;
  const [config, courses, { prices, aiMarksPerStudent }] = await Promise.all([
    getBillingConfig(),
    loadWorkspaceCourses(workspaceId),
    getTierPrices(at),
  ]);
  const courseIds = courses.map((c) => c.courseId);
  const [seats, overlap, ai] = await Promise.all([
    activeSeatsByCourse(courseIds),
    overlappingLearnersByCourse(courseIds, period.start, period.end),
    aiUsageByCourse(workspaceId, period.start, period.end),
  ]);
  const draft = buildPeriodInvoice({
    prices,
    aiMarksPerStudent,
    apiMarginBps: config.apiMarginBps,
    advance: courses.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      tier: billedTier({ derived: derivedTier(c.enabledKeys), holds: c.holds, override: c.override, at }),
      learnerIds: seats.get(c.courseId) ?? [],
    })),
    closing: courses.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      highestTier: highestTierDuring({ tierAtStart: courseTierAtStart(c, period), holds: c.holds, override: c.override, start: period.start, end: period.end }),
      overlappingLearnerIds: overlap.get(c.courseId) ?? [],
      charged: period.charged.get(c.courseId) ?? [],
      aiMarks: ai.get(c.courseId),
    })),
    vatRateBps: config.vatRegistered ? config.vatRateBps : null,
  });
  const lines = [...draft.lines];
  let total = draft.totalCents;
  if (opts.comped && total > 0) {
    lines.push({
      kind: "COMP", courseId: null, courseTitle: null, tierKey: null, serviceKey: null,
      description: "Waived by Nexa", quantity: 1, unitPriceCents: -total, amountCents: -total,
    });
    total = 0;
  }

  return withInvoiceNumber(now, async (tx, number) => {
    const inv = await tx.platformInvoice.create({
      data: {
        number,
        workspaceId,
        opensPeriodStart: at,
        closesPeriodId: period.id,
        status: "OPEN",
        subtotalCents: draft.subtotalCents,
        discountCents: draft.discountCents,
        creditCents: draft.creditCents,
        vatRateBps: config.vatRegistered ? config.vatRateBps : null,
        vatCents: draft.vatCents,
        totalCents: total,
        issuedAt: now,
        dueAt: at,
        lines: { create: lines.map(({ kind, courseId, courseTitle, tierKey, serviceKey, description, quantity, unitPriceCents, amountCents }) => ({ kind, courseId, courseTitle, tierKey, serviceKey, description, quantity, unitPriceCents, amountCents })) },
      },
      select: { id: true, number: true, totalCents: true, attemptCount: true, status: true },
    });
    const catchUps = draft.seatCharges.filter((s) => s.period === "closing");
    if (catchUps.length) {
      await tx.seatCharge.createMany({
        data: catchUps.map((s) => ({ workspaceId, billingPeriodId: period.id, courseId: s.courseId, learnerId: s.learnerId, tierKey: s.tierKey, kind: s.kind, invoiceId: inv.id })),
        skipDuplicates: true,
      });
    }
    for (const u of draft.tierUpgrades) {
      await tx.seatCharge.updateMany({ where: { billingPeriodId: period.id, courseId: u.courseId, learnerId: u.learnerId }, data: { tierKey: u.tierKey } });
    }
    return { ...inv, created: true };
  });
}
