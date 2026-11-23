/**
 * Lesson credits from prepaid lesson packs (#216 phase 2, Plus).
 *
 * A lesson pack is a LESSON_PACK fee schedule (payments/fees.ts). When its
 * invoice is paid (online or marked paid offsite), the learner gets
 * `lessonsInPack × quantity` credits for that course; a fully refunded
 * invoice takes them back. The ledger is LessonCredit; `syncLessonCredits`
 * brings it up to date and runs before every balance read and booking, so
 * no payment code needs to call it.
 */

import "server-only";

import { assertBillingEnabled } from "@/features/billing/errors";
import { issueInvoice } from "@/features/payments/fees";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";

import { creditBalance } from "./booking-math";

type Db = typeof prisma | Prisma.TransactionClient;

/** Credits paid packs and reverses refunded ones, once each. Returns how many rows it wrote. */
export async function syncLessonCredits(learnerId: string, db: Db = prisma): Promise<number> {
  const lines = await db.invoiceLine.findMany({
    where: { feeScheduleId: { not: null }, invoice: { learnerId, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } } },
    select: { id: true, quantity: true, feeScheduleId: true, invoice: { select: { workspaceId: true, status: true } } },
  });
  if (!lines.length) return 0;
  const packs = new Map(
    (await db.feeSchedule.findMany({
      where: { id: { in: [...new Set(lines.map((l) => l.feeScheduleId!))] }, kind: "LESSON_PACK" },
      select: { id: true, courseId: true, lessonsInPack: true, description: true },
    })).map((p) => [p.id, p]),
  );
  const rows: Prisma.LessonCreditCreateManyInput[] = [];
  for (const l of lines) {
    const pack = packs.get(l.feeScheduleId!);
    if (!pack?.lessonsInPack) continue;
    const lessons = pack.lessonsInPack * l.quantity;
    rows.push({ workspaceId: l.invoice.workspaceId, learnerId, courseId: pack.courseId, kind: "PURCHASE", lessons, invoiceLineId: l.id, note: pack.description.slice(0, 300) });
    if (l.invoice.status === "REFUNDED") {
      rows.push({ workspaceId: l.invoice.workspaceId, learnerId, courseId: pack.courseId, kind: "REFUND_REVERSAL", lessons: -lessons, reversesLineId: l.id, note: "Pack refunded" });
    }
  }
  if (!rows.length) return 0;
  // The unique line ids make this idempotent.
  const { count } = await db.lessonCredit.createMany({ data: rows, skipDuplicates: true });
  return count;
}

export async function balanceFor(learnerId: string, courseId: string, db: Db = prisma): Promise<number> {
  const rows = await db.lessonCredit.findMany({ where: { learnerId, courseId }, select: { lessons: true } });
  return creditBalance(rows);
}

/** The active lesson packs for a course (and this learner, if the pack is personal). */
export async function packsFor(courseId: string, learnerId: string | null, now: Date = new Date()) {
  return prisma.feeSchedule.findMany({
    where: {
      courseId, kind: "LESSON_PACK", active: true, startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      AND: [{ OR: [{ learnerId: null }, ...(learnerId ? [{ learnerId }] : [])] }],
    },
    orderBy: { amountCents: "asc" },
    select: { id: true, description: true, amountCents: true, lessonsInPack: true, learnerId: true },
  });
}

/** True when the course sells lesson packs, so a booking needs a credit. */
export async function requiresCredit(courseId: string, learnerId: string, now: Date = new Date()): Promise<boolean> {
  return (await packsFor(courseId, learnerId, now)).length > 0;
}

export type CreditSummary = {
  courseId: string;
  courseName: string;
  balance: number;
  /** False when the course doesn't sell packs: bookings are free. */
  needsCredits: boolean;
  packs: Array<{ id: string; description: string; amountCents: number; lessons: number }>;
};

/** Balances and packs for each of a learner's courses. */
export async function creditSummary(learnerId: string, courseIds: string[], now: Date = new Date()): Promise<CreditSummary[]> {
  await syncLessonCredits(learnerId);
  const [courses, sums] = await Promise.all([
    prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } }),
    prisma.lessonCredit.groupBy({ by: ["courseId"], where: { learnerId, courseId: { in: courseIds } }, _sum: { lessons: true } }),
  ]);
  const out: CreditSummary[] = [];
  for (const c of courses) {
    const packs = await packsFor(c.id, learnerId, now);
    out.push({
      courseId: c.id,
      courseName: c.name,
      balance: sums.find((s) => s.courseId === c.id)?._sum.lessons ?? 0,
      needsCredits: packs.length > 0,
      packs: packs.map((p) => ({ id: p.id, description: p.description, amountCents: p.amountCents, lessons: p.lessonsInPack ?? 0 })),
    });
  }
  return out;
}

/** Staff correction (a cash payment, a goodwill lesson, a mistake): + or − lessons, with a note. */
export async function adjustCredits(input: { workspaceId: string; learnerId: string; courseId: string; lessons: number; note: string; byUserId: string }) {
  if (!Number.isInteger(input.lessons) || input.lessons === 0 || Math.abs(input.lessons) > 100) throw new UserError("Add or remove between 1 and 100 lessons.");
  const [learner, course] = await Promise.all([
    prisma.learner.findUnique({ where: { id: input.learnerId }, select: { workspaceId: true } }),
    prisma.course.findUnique({ where: { id: input.courseId }, select: { workspaceId: true } }),
  ]);
  if (learner?.workspaceId !== input.workspaceId || course?.workspaceId !== input.workspaceId) throw new UserError("That student or course isn't in this workspace.");
  await prisma.lessonCredit.create({
    data: { workspaceId: input.workspaceId, learnerId: input.learnerId, courseId: input.courseId, kind: "ADJUSTMENT", lessons: input.lessons, byUserId: input.byUserId, note: input.note.slice(0, 300) },
  });
  await syncLessonCredits(input.learnerId);
  return { balance: await balanceFor(input.learnerId, input.courseId) };
}

/**
 * A parent or adult student buys a pack: an OPEN invoice due today, which
 * they pay through the usual checkout (startCheckout with its id). Credits
 * arrive when it's paid. Needs billing on (January).
 */
export async function buyPack(input: { workspaceId: string; learnerId: string; feeScheduleId: string; now?: Date }) {
  assertBillingEnabled();
  const now = input.now ?? new Date();
  const pack = await prisma.feeSchedule.findUnique({
    where: { id: input.feeScheduleId },
    select: { id: true, workspaceId: true, courseId: true, kind: true, active: true, amountCents: true, description: true, learnerId: true, startsOn: true, endsOn: true },
  });
  const usable = pack && pack.workspaceId === input.workspaceId && pack.kind === "LESSON_PACK" && pack.active && pack.startsOn <= now && (!pack.endsOn || pack.endsOn >= now) && (!pack.learnerId || pack.learnerId === input.learnerId);
  if (!usable) throw new UserError("That lesson pack isn't available any more.");
  const enrolled = await prisma.enrollment.findFirst({ where: { learnerId: input.learnerId, courseId: pack.courseId, endedAt: null }, select: { id: true } });
  if (!enrolled) throw new UserError("Join the course before buying a lesson pack for it.");
  const inv = await issueInvoice(null, input.workspaceId, {
    learnerId: input.learnerId,
    dueAt: now.toISOString(),
    lines: [{ courseId: pack.courseId, description: pack.description, quantity: 1, unitAmountCents: pack.amountCents, feeScheduleId: pack.id }],
  });
  return { invoiceId: inv.id };
}
