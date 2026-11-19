/**
 * Platform invoices (design 03, section 4). Built here: the first invoice,
 * which opens period 1 with seats in advance. buildRenewalInvoice (arrears,
 * catch-ups, usage) joins with the daily billing job.
 */

import "server-only";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { nextInvoiceNumber } from "@/features/payments/settlement-rules";

import { activeSeatsByCourse, getBillingConfig, getTierPrices, loadWorkspaceCourses } from "./data";
import { billedTier, buildPeriodInvoice, derivedTier } from "./pricing";

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
