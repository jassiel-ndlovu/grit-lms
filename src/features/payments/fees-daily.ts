/**
 * The daily fees job (design 04, section 5), run by /api/cron/fees-daily:
 *
 *   1. Monthly invoices: each active MONTHLY schedule whose billing day is
 *      today in the workspace's time zone invoices its learner (or every
 *      learner enrolled in the course). Lines are grouped into one invoice
 *      per learner and payee. A schedule invoices a learner once per month,
 *      so a rerun or a late run adds nothing.
 *   2. Overdue reminders 1 and 7 days after the due date (unless the
 *      workspace switched them off), once each.
 *   3. Refunds still owed by a payee with no payout for 60 days: emails
 *      them an invoice they can pay by card (./recovery.ts).
 *   4. Sends queued email.
 *
 * Behind BILLING=1. Learners whose payee has no payout account are skipped
 * and counted.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { drainEmailQueue } from "@/lib/email/queue";

import { queueFeeEmail } from "./fee-emails";
import { issueInvoice, resolvePayee, type IssueLine } from "./fees";
import { offerRecoveryInvoices } from "./recovery";

const DAY = 24 * 60 * 60 * 1000;

/** Year, month (1-12) and day of `at` in `timeZone`. */
export function localDate(at: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Which reminder (1 or 7 days) is due for an invoice due at `dueAt`, if any. */
export function overdueReminder(dueAt: Date, now: Date): 1 | 7 | null {
  const days = (now.getTime() - dueAt.getTime()) / DAY;
  if (days >= 7) return 7;
  if (days >= 1) return 1;
  return null;
}

export type FeesRunResult = { skipped?: string; invoicesIssued: number; linesSkippedNoPayee: number; reminders: number; recoveryInvoices: number; emailsSent: number; errors: number };

export async function runFeesDaily(opts: { now?: Date } = {}): Promise<FeesRunResult> {
  const r: FeesRunResult = { invoicesIssued: 0, linesSkippedNoPayee: 0, reminders: 0, recoveryInvoices: 0, emailsSent: 0, errors: 0 };
  if (!isBillingEnabled()) return { ...r, skipped: "BILLING is off" };
  const now = opts.now ?? new Date();

  // 1. Monthly invoices.
  const schedules = await prisma.feeSchedule.findMany({
    where: { active: true, kind: "MONTHLY", startsOn: { lte: now }, OR: [{ endsOn: null }, { endsOn: { gte: new Date(now.getTime() - DAY) } }] },
    select: {
      id: true, workspaceId: true, courseId: true, learnerId: true, amountCents: true, description: true, billingDay: true,
      workspace: { select: { timezone: true, paymentSettings: { select: { defaultDueDays: true } } } },
    },
  });
  type Pending = { workspaceId: string; learnerId: string; payeeId: string; dueDays: number; periodStart: Date; periodEnd: Date; lines: IssueLine[] };
  const groups = new Map<string, Pending>();
  for (const s of schedules) {
    const { y, m, d } = localDate(now, s.workspace.timezone);
    if (d !== s.billingDay) continue;
    const periodStart = new Date(Date.UTC(y, m - 1, 1));
    const periodEnd = new Date(Date.UTC(y, m, 1));
    const learnerIds = s.learnerId
      ? [s.learnerId]
      : (await prisma.enrollment.findMany({ where: { courseId: s.courseId, endedAt: null }, select: { learnerId: true }, distinct: ["learnerId"] })).map((e) => e.learnerId);
    if (learnerIds.length === 0) continue;
    // Already invoiced this month by this schedule (a voided one counts: the tutor chose to cancel it).
    const done = new Set(
      (await prisma.invoiceLine.findMany({
        where: { feeScheduleId: s.id, invoice: { learnerId: { in: learnerIds }, periodStart } },
        select: { invoice: { select: { learnerId: true } } },
      })).map((l) => l.invoice.learnerId),
    );
    const payee = await resolvePayee(prisma, s.courseId, s.workspaceId);
    const label = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(periodStart);
    for (const learnerId of learnerIds) {
      if (done.has(learnerId)) continue;
      if (!payee) {
        r.linesSkippedNoPayee++;
        continue;
      }
      const key = `${learnerId}:${payee.id}:${periodStart.toISOString()}`;
      const g = groups.get(key) ?? { workspaceId: s.workspaceId, learnerId, payeeId: payee.id, dueDays: s.workspace.paymentSettings?.defaultDueDays ?? 7, periodStart, periodEnd, lines: [] };
      g.lines.push({ courseId: s.courseId, feeScheduleId: s.id, description: `${s.description}, ${label}`, quantity: 1, unitAmountCents: s.amountCents });
      groups.set(key, g);
    }
  }
  for (const g of groups.values()) {
    try {
      await issueInvoice(null, g.workspaceId, {
        learnerId: g.learnerId, lines: g.lines, dueAt: new Date(now.getTime() + g.dueDays * DAY).toISOString(), periodStart: g.periodStart, periodEnd: g.periodEnd,
      });
      r.invoicesIssued++;
    } catch (e) {
      r.errors++;
      console.error("[fees] monthly invoice failed:", g.learnerId, (e as Error).message);
    }
  }

  // 2. Overdue reminders.
  const overdue = await prisma.invoice.findMany({
    where: { status: "OPEN", dueAt: { lte: new Date(now.getTime() - DAY) }, workspace: { OR: [{ paymentSettings: null }, { paymentSettings: { overdueReminders: true } }] } },
    select: { id: true, number: true, workspaceId: true, learnerId: true, studentUserId: true, payoutAccountId: true, totalCents: true, dueAt: true },
    take: 500,
  });
  for (const inv of overdue) {
    const days = overdueReminder(inv.dueAt, now);
    if (!days) continue;
    try {
      r.reminders += await queueFeeEmail(prisma, {
        studentUserId: inv.studentUserId, learnerId: inv.learnerId, workspaceId: inv.workspaceId, payoutAccountId: inv.payoutAccountId,
        template: "overdue", event: `${inv.id}:${days}`,
        data: (who) => ({ payeeName: who.payeeName, studentName: who.studentName, number: inv.number, totalCents: inv.totalCents, dueOn: who.day(inv.dueAt), days }),
      });
    } catch (e) {
      r.errors++;
      console.error("[fees] reminder failed:", inv.id, (e as Error).message);
    }
  }

  // 3. Refund recoveries with no payout for 60 days: offer the payee an invoice.
  try {
    r.recoveryInvoices = await offerRecoveryInvoices(now);
  } catch (e) {
    r.errors++;
    console.error("[fees] recovery invoices failed:", (e as Error).message);
  }

  // 4. Email.
  try {
    r.emailsSent = (await drainEmailQueue({ limit: 80, now })).sent;
  } catch (e) {
    r.errors++;
    console.error("[fees] email drain failed:", (e as Error).message);
  }
  return r;
}
