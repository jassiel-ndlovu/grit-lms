/**
 * Gate 2, tutor side (design 04, section 5; contract section 3): payout
 * accounts (Paystack subaccounts), payout mode, fee schedules and fee
 * invoices issued, voided and marked paid off-site. Parent checkout, the
 * monthly invoice job and refunds come with the next slice.
 *
 * Every function takes its context (workspace, acting user) so scripts can
 * test it; ./fee-actions.ts checks permissions first. Account and ID numbers
 * go to Paystack only; we keep the last 4 digits. Server only.
 */

import "server-only";

import { Prisma } from "@/generated/prisma";
import { BillingError } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { emitWebhook } from "@/features/api/webhooks";

import { queueFeeEmail } from "./fee-emails";
import { getProvider, type PaymentProvider } from "./provider";

type Tx = Prisma.TransactionClient;
const TX = { timeout: 30_000 };

export type Actor = { userId: string; role: "OWNER" | "ADMIN" | "TUTOR" | "NEXA_ADMIN" };

async function audit(tx: Tx, actor: Actor, workspaceId: string, action: string, targetType: string, targetId: string, data: Record<string, unknown>) {
  await tx.auditLog.create({ data: { workspaceId, actorUserId: actor.userId, action, targetType, targetId, data: data as Prisma.InputJsonValue } });
}

/* ------------------------------------------------------------------------- */
/* Payouts                                                                    */
/* ------------------------------------------------------------------------- */

export async function payoutSettingsFor(workspaceId: string) {
  const [settings, accounts] = await Promise.all([
    prisma.paymentSettings.findUnique({ where: { workspaceId }, select: { payoutMode: true } }),
    prisma.payoutAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, membershipId: true, businessName: true, bankName: true, accountNumberLast4: true, accountName: true, status: true },
    }),
  ]);
  return { payoutMode: settings?.payoutMode ?? ("WORKSPACE" as const), accounts };
}

export async function setPayoutMode(actor: Actor, workspaceId: string, payoutMode: "WORKSPACE" | "PER_TUTOR") {
  return prisma.$transaction(async (tx) => {
    await tx.paymentSettings.upsert({ where: { workspaceId }, create: { workspaceId, payoutMode }, update: { payoutMode } });
    await audit(tx, actor, workspaceId, "fees.payout.mode", "Workspace", workspaceId, { payoutMode });
    return { payoutMode };
  }, TX);
}

/** The name the bank has on the account, to show before connecting it. */
export async function resolvePayoutAccount(input: { bankCode: string; accountNumber: string; idNumber?: string }, provider: PaymentProvider = getProvider()) {
  const r = await provider.resolveAccount(input);
  if (!r) throw new BillingError("NOT_FOUND", "The bank doesn't recognise that account number");
  return { accountName: r.accountName };
}

/**
 * Connects (or replaces) a payout account: the workspace's own, or in
 * PER_TUTOR mode the tutor's (`membershipId`). Checks the account with the
 * bank, then creates a Paystack subaccount. ACTIVE at once: Paystack holds a
 * new subaccount's first payout until it has verified it, so no money can go
 * to an unverified account.
 */
export async function connectPayoutAccount(
  actor: Actor,
  input: {
    workspaceId: string;
    membershipId: string | null;
    contactEmail: string;
    bankCode: string;
    accountNumber: string;
    businessName: string;
    idNumber?: string;
  },
  provider: PaymentProvider = getProvider(),
) {
  const digits = input.accountNumber.replace(/\s+/g, "");
  if (!/^\d{6,20}$/.test(digits)) throw new BillingError("FORBIDDEN", "Account numbers are 6 to 20 digits");
  const banks = await provider.listBanks();
  const bank = banks.find((b) => b.code === input.bankCode);
  if (!bank) throw new BillingError("NOT_FOUND", "Unknown bank");
  const resolved = await provider.resolveAccount({ bankCode: input.bankCode, accountNumber: digits, idNumber: input.idNumber });
  if (!resolved) throw new BillingError("NOT_FOUND", "The bank doesn't recognise that account number");
  const sub = await provider.createSubaccount({
    businessName: input.businessName,
    bankCode: input.bankCode,
    accountNumber: digits,
    contactEmail: input.contactEmail,
    description: `Nexa payee ${input.workspaceId}${input.membershipId ? ` ${input.membershipId}` : ""}`,
  });
  const data = {
    subaccountCode: sub.subaccountCode,
    businessName: input.businessName,
    bankCode: input.bankCode,
    bankName: bank.name,
    accountNumberLast4: digits.slice(-4),
    accountName: sub.accountName ?? resolved.accountName,
    status: "ACTIVE" as const,
    verifiedAt: new Date(),
    createdByUserId: actor.userId,
  };
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payoutAccount.findFirst({ where: { workspaceId: input.workspaceId, membershipId: input.membershipId }, select: { id: true } });
    const row = existing
      ? await tx.payoutAccount.update({ where: { id: existing.id }, data, select: { id: true, status: true } })
      : await tx.payoutAccount.create({ data: { ...data, workspaceId: input.workspaceId, membershipId: input.membershipId }, select: { id: true, status: true } });
    await audit(tx, actor, input.workspaceId, existing ? "fees.payout.replace" : "fees.payout.connect", "PayoutAccount", row.id, {
      bankName: bank.name, last4: data.accountNumberLast4, membershipId: input.membershipId,
    });
    return row;
  }, TX);
}

/**
 * Who is paid for a course's fees: in PER_TUTOR mode the course lead's own
 * account, else the workspace account. Null when that account isn't
 * connected yet.
 */
export async function resolvePayee(db: Tx | typeof prisma, courseId: string | null, workspaceId: string) {
  const mode = (await db.paymentSettings.findUnique({ where: { workspaceId }, select: { payoutMode: true } }))?.payoutMode ?? "WORKSPACE";
  if (mode === "PER_TUTOR" && courseId) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { ownerMembershipId: true, staff: { where: { role: "LEAD" }, select: { membershipId: true }, take: 1 } },
    });
    const lead = course?.staff[0]?.membershipId ?? course?.ownerMembershipId;
    if (lead) return db.payoutAccount.findFirst({ where: { workspaceId, membershipId: lead } });
  }
  return db.payoutAccount.findFirst({ where: { workspaceId, membershipId: null } });
}

/* ------------------------------------------------------------------------- */
/* Fee schedules                                                              */
/* ------------------------------------------------------------------------- */

export type FeeScheduleInput = {
  id?: string;
  courseId: string;
  learnerId?: string | null;
  kind: "MONTHLY" | "LESSON_PACK" | "ONCE_OFF";
  amountCents: number;
  lessonsInPack?: number | null;
  description: string;
  billingDay?: number | null;
  startsOn: string;
  endsOn?: string | null;
};

export async function upsertFeeSchedule(actor: Actor, workspaceId: string, input: FeeScheduleInput) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new BillingError("FORBIDDEN", "Amount must be whole cents above zero");
  if (input.kind === "MONTHLY" && !(input.billingDay && input.billingDay >= 1 && input.billingDay <= 28)) throw new BillingError("FORBIDDEN", "A monthly fee needs a billing day from 1 to 28");
  if (input.kind === "LESSON_PACK" && !(input.lessonsInPack && input.lessonsInPack > 0)) throw new BillingError("FORBIDDEN", "A lesson pack needs the number of lessons");
  const startsOn = new Date(input.startsOn);
  const endsOn = input.endsOn ? new Date(input.endsOn) : null;
  if (endsOn && endsOn < startsOn) throw new BillingError("FORBIDDEN", "The end date is before the start date");
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: input.courseId }, select: { workspaceId: true } });
    if (course?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "Course not found");
    if (input.learnerId) {
      const l = await tx.learner.findUnique({ where: { id: input.learnerId }, select: { workspaceId: true } });
      if (l?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "That student isn't in this organisation any more. Refresh the page.");
    }
    const data = {
      courseId: input.courseId, learnerId: input.learnerId ?? null, kind: input.kind, amountCents: input.amountCents,
      lessonsInPack: input.kind === "LESSON_PACK" ? input.lessonsInPack! : null, description: input.description,
      billingDay: input.kind === "MONTHLY" ? input.billingDay! : null, startsOn, endsOn,
    };
    let id: string;
    if (input.id) {
      const cur = await tx.feeSchedule.findUnique({ where: { id: input.id }, select: { workspaceId: true } });
      if (cur?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "Fee schedule not found");
      id = (await tx.feeSchedule.update({ where: { id: input.id }, data, select: { id: true } })).id;
    } else {
      id = (await tx.feeSchedule.create({ data: { ...data, workspaceId }, select: { id: true } })).id;
    }
    await audit(tx, actor, workspaceId, input.id ? "fees.schedule.update" : "fees.schedule.create", "FeeSchedule", id, { kind: input.kind, amountCents: input.amountCents, courseId: input.courseId });
    return { id };
  }, TX);
}

/* ------------------------------------------------------------------------- */
/* Fee invoices                                                               */
/* ------------------------------------------------------------------------- */

/** INV-<year>-<6 digits>, per workspace. */
export function nextFeeInvoiceNumber(year: number, last: string | null): string {
  const prefix = `INV-${year}-`;
  const n = last && last.startsWith(prefix) ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(6, "0")}`;
}

export type IssueLine = { courseId?: string | null; description: string; quantity: number; unitAmountCents: number; feeScheduleId?: string | null };

/**
 * An OPEN invoice to one learner, for one payee: every line's course must be
 * paid to the same account (in PER_TUTOR mode, one tutor per invoice).
 */
export async function issueInvoice(actor: Actor | null, workspaceId: string, input: { learnerId: string; lines: IssueLine[]; dueAt: string; periodStart?: Date; periodEnd?: Date }) {
  if (input.lines.length === 0) throw new BillingError("FORBIDDEN", "An invoice needs at least one line");
  for (const l of input.lines) {
    if (!Number.isSafeInteger(l.quantity) || l.quantity <= 0) throw new BillingError("FORBIDDEN", "Each quantity must be a whole number, 1 or more.");
    if (!Number.isSafeInteger(l.unitAmountCents) || l.unitAmountCents <= 0) throw new BillingError("FORBIDDEN", "Each amount must be more than R0.");
  }
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new BillingError("FORBIDDEN", "Check the due date: choose a day from the calendar.");
  const learner = await prisma.learner.findUnique({ where: { id: input.learnerId }, select: { workspaceId: true, userId: true } });
  if (learner?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "That student isn't in this organisation any more. Refresh the page.");

  const payees = new Map<string, string>();
  for (const l of input.lines) {
    if (l.courseId) {
      const c = await prisma.course.findUnique({ where: { id: l.courseId }, select: { workspaceId: true } });
      if (c?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "Course not found");
    }
    const payee = await resolvePayee(prisma, l.courseId ?? null, workspaceId);
    if (!payee) throw new BillingError("FORBIDDEN", "Add the bank account your fees are paid into before you send fees.");
    payees.set(payee.id, payee.status);
  }
  if (payees.size > 1) throw new BillingError("FORBIDDEN", "These courses are paid to different tutors; issue one invoice per tutor");
  const [payoutAccountId] = [...payees.keys()];
  const total = input.lines.reduce((n, l) => n + l.quantity * l.unitAmountCents, 0);
  const year = new Date().getUTCFullYear();

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.invoice.findFirst({ where: { workspaceId, number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
        const number = nextFeeInvoiceNumber(year, last?.number ?? null);
        const inv = await tx.invoice.create({
          data: {
            number, workspaceId, payoutAccountId, learnerId: input.learnerId, studentUserId: learner.userId, status: "OPEN", dueAt,
            periodStart: input.periodStart ?? null, periodEnd: input.periodEnd ?? null, subtotalCents: total, totalCents: total,
            lines: {
              create: input.lines.map((l) => ({
                courseId: l.courseId ?? null, feeScheduleId: l.feeScheduleId ?? null, description: l.description,
                quantity: l.quantity, unitAmountCents: l.unitAmountCents, amountCents: l.quantity * l.unitAmountCents,
              })),
            },
          },
          select: { id: true, number: true },
        });
        if (actor) await audit(tx, actor, workspaceId, "fees.invoice.issue", "Invoice", inv.id, { number, totalCents: total, learnerId: input.learnerId });
        await queueFeeEmail(tx, {
          studentUserId: learner.userId, learnerId: input.learnerId, workspaceId, template: "invoice", event: inv.id,
          data: (who) => ({ payeeName: who.payeeName, studentName: who.studentName, number, totalCents: total, dueOn: who.day(dueAt) }),
          payoutAccountId,
        });
        return inv;
      }, TX);
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || attempt >= 4) throw e;
    }
  }
}

/** Voids an OPEN invoice that no checkout holds. */
export async function voidInvoice(actor: Actor, workspaceId: string, input: { invoiceId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId }, select: { workspaceId: true, status: true, number: true, lockedUntil: true } });
    if (inv?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "Invoice not found");
    if (inv.status !== "OPEN") throw new BillingError("FORBIDDEN", `Can't void an invoice that is ${inv.status}`);
    if (inv.lockedUntil && inv.lockedUntil > new Date()) throw new BillingError("FORBIDDEN", "A payment for this invoice is in progress");
    await tx.invoice.update({ where: { id: input.invoiceId }, data: { status: "VOID" } });
    await audit(tx, actor, workspaceId, "fees.invoice.void", "Invoice", input.invoiceId, { number: inv.number, reason: input.reason });
    return { status: "VOID" as const };
  }, TX);
}

/** Records the full invoice total as received outside Paystack. */
export async function markInvoicePaidOffsite(
  actor: Actor,
  workspaceId: string,
  input: { invoiceId: string; method: "CASH" | "EFT" | "OTHER"; amountCents: number; receivedOn: string; reference?: string | null; note: string },
) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId }, select: { workspaceId: true, status: true, totalCents: true, number: true, lockedUntil: true } });
    if (inv?.workspaceId !== workspaceId) throw new BillingError("NOT_FOUND", "Invoice not found");
    if (inv.status !== "OPEN") throw new BillingError("FORBIDDEN", `Can't mark an invoice that is ${inv.status} as paid`);
    if (inv.lockedUntil && inv.lockedUntil > new Date()) throw new BillingError("FORBIDDEN", "A payment for this invoice is in progress");
    if (input.amountCents !== inv.totalCents) throw new BillingError("FORBIDDEN", `The amount must equal the invoice total (${inv.totalCents} cents)`);
    const receivedOn = new Date(input.receivedOn);
    if (Number.isNaN(receivedOn.getTime()) || receivedOn > new Date()) throw new BillingError("FORBIDDEN", "`receivedOn` must be a date that has passed");
    const off = await tx.offsitePayment.create({
      data: {
        workspaceId, invoiceId: input.invoiceId, method: input.method, amountCents: input.amountCents, receivedOn,
        reference: input.reference ?? null, note: input.note, markedByUserId: actor.userId,
        markedAs: actor.role === "TUTOR" ? "TUTOR" : actor.role === "NEXA_ADMIN" ? "NEXA_ADMIN" : "WORKSPACE_ADMIN",
      },
      select: { id: true },
    });
    await tx.invoice.update({ where: { id: input.invoiceId }, data: { status: "PAID", paidAt: receivedOn, paidVia: "OFFSITE" } });
    await emitWebhook(tx, workspaceId, "invoice.paid", { invoiceId: input.invoiceId, number: inv.number, paidVia: "OFFSITE", paidAt: receivedOn.toISOString(), amountCents: input.amountCents });
    await audit(tx, actor, workspaceId, "fees.invoice.offsite", "Invoice", input.invoiceId, { number: inv.number, amountCents: input.amountCents, method: input.method, offsitePaymentId: off.id });
    return { status: "PAID" as const };
  }, TX);
}

/** Undoes an off-site mark made by mistake: the invoice is OPEN again. */
export async function voidOffsitePayment(actor: Actor, workspaceId: string, input: { offsitePaymentId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const off = await tx.offsitePayment.findUnique({ where: { id: input.offsitePaymentId }, select: { workspaceId: true, invoiceId: true, voidedAt: true } });
    if (off?.workspaceId !== workspaceId || !off.invoiceId) throw new BillingError("NOT_FOUND", "That cash or bank transfer payment wasn't found. Refresh the page and try again.");
    if (off.voidedAt) throw new BillingError("FORBIDDEN", "Already voided");
    await tx.offsitePayment.update({ where: { id: input.offsitePaymentId }, data: { voidedAt: new Date() } });
    await tx.invoice.update({ where: { id: off.invoiceId }, data: { status: "OPEN", paidAt: null, paidVia: null } });
    await audit(tx, actor, workspaceId, "fees.offsite.void", "OffsitePayment", input.offsitePaymentId, { invoiceId: off.invoiceId, reason: input.reason });
    return { invoiceStatus: "OPEN" as const };
  }, TX);
}

/** Fee invoices in the workspace, newest first; `courseIds` limits a tutor to their courses. */
export async function listFeeInvoicesFor(
  workspaceId: string,
  input: { courseId?: string; learnerId?: string; status?: "OPEN" | "PAID" | "VOID" | "REFUNDED" | "PARTIALLY_REFUNDED"; cursor?: string; limit?: number; courseIds?: string[] },
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const courseFilter = input.courseId ? [input.courseId] : input.courseIds;
  const rows = await prisma.invoice.findMany({
    where: {
      workspaceId,
      status: input.status ?? { not: "DRAFT" },
      ...(input.learnerId ? { learnerId: input.learnerId } : {}),
      ...(courseFilter ? { lines: { some: { courseId: { in: courseFilter } } } } : {}),
    },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, number: true, learnerId: true, studentUserId: true, totalCents: true, status: true, dueAt: true, paidVia: true, payoutAccount: { select: { businessName: true } } },
  });
  const page = rows.slice(0, limit);
  const users = await prisma.user.findMany({ where: { id: { in: page.map((r) => r.studentUserId) } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return {
    items: page.map((r) => ({
      id: r.id, number: r.number, learnerName: name.get(r.studentUserId) ?? "", payeeName: r.payoutAccount.businessName,
      totalCents: r.totalCents, status: r.status, dueAt: r.dueAt.toISOString(), paidVia: r.paidVia,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}
