/**
 * The billing job (design 03, section 7), run hourly by /api/cron/billing.
 * Every step is idempotent, so a late or repeated run is safe:
 *
 *   1. Trials: an email 4 days and 1 day before the end; unpaid trials go
 *      READ_ONLY with an email.
 *   2. Comps that reached compedUntil end: back to ACTIVE (renewed and
 *      charged as usual), or READ_ONLY if never paid.
 *   3. Renewals due: build the renewal invoice, charge the saved card. A
 *      zero total is marked paid without a charge. A failed or missing card
 *      starts dunning. Owners who cancelled get a final arrears invoice and
 *      the workspace goes CANCELLED.
 *   4. Dunning: emails on day 0, 3 and 7, card retries on day 3 and 7,
 *      READ_ONLY with an email on day 14.
 *   5. Retention: warnings 30 and 7 days before deletion, and the list of
 *      workspaces due (deletes wait for B's course delete helper).
 *   6. Sends queued email.
 *
 * Not yet: usage metering and cap emails (they need B's AI-marking rows),
 * and the retention deletes themselves (retention.ts).
 */

import "server-only";

import { prisma } from "@/lib/db";
import { drainEmailQueue } from "@/lib/email/queue";
import type { PaymentProvider } from "@/features/payments/provider";
import { markInvoicePaid } from "@/features/payments/settle";
import { addCalendarMonths, dunningStep, firstRetryAt, type DunningStage } from "@/features/payments/settlement-rules";

import { chargeSavedCard } from "./charge";
import { getBillingConfig } from "./data";
import { dayLabel, queueBillingEmail } from "./emails";
import { isBillingEnabled } from "./errors";
import { buildRenewalInvoice } from "./invoice";
import { deleteWorkspaceData, planRetention, retentionDeletesEnabled, sendRetentionWarnings } from "./retention";

const DAY = 24 * 60 * 60 * 1000;
const TRIAL_EMAIL_DAYS = [4, 1] as const; // design: day 10 and day 13 of 14

export type BillingRunResult = {
  skipped?: string;
  trialEmails: number;
  trialsEnded: number;
  compsEnded: number;
  cancelled: number;
  renewalsPaid: number;
  renewalsZero: number;
  renewalsPending: number;
  dunningStarted: number;
  retriesPaid: number;
  retriesFailed: number;
  locked: number;
  retentionWarnings: number;
  /** Workspaces past their retention date; nothing is deleted yet (see retention.ts). */
  retentionDue: number;
  retentionDeleted: number;
  emailsSent: number;
  emailsSuppressed: number;
  errors: number;
  more: boolean;
};

export async function runBillingJob(opts: { provider?: PaymentProvider; now?: Date; budgetMs?: number; batch?: number } = {}): Promise<BillingRunResult> {
  const r: BillingRunResult = {
    trialEmails: 0, trialsEnded: 0, compsEnded: 0, cancelled: 0, renewalsPaid: 0, renewalsZero: 0, renewalsPending: 0,
    dunningStarted: 0, retriesPaid: 0, retriesFailed: 0, locked: 0, retentionWarnings: 0, retentionDue: 0, retentionDeleted: 0, emailsSent: 0, emailsSuppressed: 0, errors: 0, more: false,
  };
  if (!isBillingEnabled()) return { ...r, skipped: "BILLING is off" };

  const now = opts.now ?? new Date();
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const batch = opts.batch ?? 50;
  const config = await getBillingConfig();
  const fail = (step: string, id: string, e: unknown) => {
    r.errors++;
    console.error(`[billing] ${step} ${id}:`, (e as Error).message);
  };

  // 1. Trials.
  const trials = await prisma.workspace.findMany({
    where: { billingState: "TRIAL", trialEndsAt: { lte: new Date(now.getTime() + TRIAL_EMAIL_DAYS[0] * DAY) } },
    select: { id: true, name: true, timezone: true, trialEndsAt: true },
    orderBy: { trialEndsAt: "asc" },
    take: batch,
  });
  for (const ws of trials) {
    try {
      const ends = ws.trialEndsAt!;
      if (ends <= now) {
        await prisma.$transaction(async (tx) => {
          const w = await tx.workspace.updateMany({ where: { id: ws.id, billingState: "TRIAL" }, data: { billingState: "READ_ONLY" } });
          if (w.count === 0) return;
          await tx.subscription.updateMany({ where: { workspaceId: ws.id }, data: { readOnlySince: now, deleteAfter: addCalendarMonths(ends, 2) } });
          await queueBillingEmail(tx, { workspaceId: ws.id, template: "trial-ended", event: ws.id, data: { workspaceName: ws.name } });
          r.trialsEnded++;
        }, { timeout: 30_000 });
        continue;
      }
      const daysLeft = Math.ceil((ends.getTime() - now.getTime()) / DAY);
      const mark = TRIAL_EMAIL_DAYS.filter((d) => daysLeft <= d).at(-1);
      if (mark != null) {
        r.trialEmails += await queueBillingEmail(prisma, {
          workspaceId: ws.id, template: "trial-ending", event: `${ws.id}:${mark}`,
          data: { workspaceName: ws.name, daysLeft, trialEndsOn: dayLabel(ends, ws.timezone) },
        });
      }
    } catch (e) {
      fail("trial", ws.id, e);
    }
  }

  // 2. Comps that end.
  const comps = await prisma.subscription.findMany({
    where: { compedUntil: { lte: now }, workspace: { billingState: "COMPED" } },
    select: { workspaceId: true, renewsAt: true, lastPaidAt: true },
    take: batch,
  });
  for (const c of comps) {
    try {
      const everPaid = c.lastPaidAt != null || c.renewsAt != null;
      await prisma.$transaction([
        prisma.workspace.update({ where: { id: c.workspaceId }, data: { billingState: everPaid ? "ACTIVE" : "READ_ONLY" } }),
        prisma.subscription.update({
          where: { workspaceId: c.workspaceId },
          data: everPaid ? { compedUntil: null } : { compedUntil: null, readOnlySince: now },
        }),
      ]);
      r.compsEnded++;
    } catch (e) {
      fail("comp", c.workspaceId, e);
    }
  }

  // 3. Renewals due.
  const due = await prisma.subscription.findMany({
    where: { renewsAt: { lte: now }, workspace: { billingState: { in: ["ACTIVE", "COMPED"] } } },
    select: { workspaceId: true, renewsAt: true, cancelAtPeriodEnd: true, workspace: { select: { billingState: true, name: true, timezone: true } } },
    orderBy: { renewsAt: "asc" },
    take: batch,
  });
  for (const sub of due) {
    if (Date.now() > deadline) { r.more = true; break; }
    try {
      const renewAt = sub.renewsAt!;
      const ws = sub.workspace;
      if (sub.cancelAtPeriodEnd) {
        await cancelAtRenewal(sub.workspaceId, renewAt, now, config.periodDays, opts.provider);
        r.cancelled++;
        continue;
      }
      const inv = await buildRenewalInvoice(sub.workspaceId, renewAt, { comped: ws.billingState === "COMPED", now });
      if (inv.status !== "OPEN") continue;

      if (inv.totalCents <= 0) {
        await prisma.$transaction(
          (tx) => markInvoicePaid(tx, {
            invoiceId: inv.id, paidAt: now, paidVia: ws.billingState === "COMPED" ? "COMPED" : "CREDIT", periodDays: config.periodDays,
          }),
          { timeout: 30_000 },
        );
        r.renewalsZero++;
        continue;
      }
      // One charge per renewal; a pending one is left to the webhook and reconciliation.
      const pending = await prisma.payment.count({ where: { platformInvoiceId: inv.id, status: "PENDING" } });
      if (pending > 0) { r.renewalsPending++; continue; }
      if (inv.attemptCount === 0) {
        const c = await chargeSavedCard({ invoice: inv, workspaceId: sub.workspaceId, userId: null, provider: opts.provider });
        if (c.status === "SUCCEEDED") { r.renewalsPaid++; continue; }
        if (c.status === "PENDING") { r.renewalsPending++; continue; }
      }
      await startDunning({ id: inv.id, number: inv.number, totalCents: inv.totalCents }, sub.workspaceId, renewAt, ws);
      r.dunningStarted++;
    } catch (e) {
      fail("renewal", sub.workspaceId, e);
    }
  }

  // 4. Dunning retries and locks.
  const overdue = await prisma.platformInvoice.findMany({
    where: { status: "PAST_DUE", dunningStage: { in: ["DAY0", "DAY3", "DAY7"] } },
    select: { id: true, number: true, workspaceId: true, totalCents: true, dueAt: true, dunningStage: true, workspace: { select: { name: true, timezone: true } } },
    orderBy: { dueAt: "asc" },
    take: batch * 4,
  });
  for (const inv of overdue) {
    if (Date.now() > deadline) { r.more = true; break; }
    const step = dunningStep(inv.dunningStage as DunningStage, inv.dueAt, now);
    if (step.action === "none") continue;
    try {
      if (step.action === "lock") {
        await prisma.$transaction(async (tx) => {
          await tx.platformInvoice.update({ where: { id: inv.id }, data: { dunningStage: "LOCKED", nextAttemptAt: null } });
          await tx.workspace.updateMany({ where: { id: inv.workspaceId, billingState: "PAST_DUE" }, data: { billingState: "READ_ONLY" } });
          await tx.subscription.updateMany({ where: { workspaceId: inv.workspaceId }, data: { readOnlySince: now } });
          await queueBillingEmail(tx, {
            workspaceId: inv.workspaceId, template: "read-only", event: inv.id,
            data: { workspaceName: inv.workspace.name, invoiceNumber: inv.number, totalCents: inv.totalCents },
          });
        }, { timeout: 30_000 });
        r.locked++;
        continue;
      }
      const pending = await prisma.payment.count({ where: { platformInvoiceId: inv.id, status: "PENDING" } });
      if (pending > 0) continue;
      const c = await chargeSavedCard({ invoice: inv, workspaceId: inv.workspaceId, userId: null, provider: opts.provider });
      if (c.status === "SUCCEEDED") { r.retriesPaid++; continue; }
      if (c.status === "PENDING") continue;
      await prisma.$transaction(async (tx) => {
        await tx.platformInvoice.update({ where: { id: inv.id }, data: { dunningStage: step.stageIfFails, nextAttemptAt: step.nextAttemptAt } });
        await queueBillingEmail(tx, {
          workspaceId: inv.workspaceId, template: "dunning", event: `${inv.id}:${step.stageIfFails}`,
          data: {
            workspaceName: inv.workspace.name, day: step.stageIfFails === "DAY3" ? 3 : 7, invoiceNumber: inv.number,
            totalCents: inv.totalCents, readOnlyOn: dayLabel(new Date(inv.dueAt.getTime() + 14 * DAY), inv.workspace.timezone),
          },
        });
      }, { timeout: 30_000 });
      r.retriesFailed++;
    } catch (e) {
      fail("dunning", inv.id, e);
    }
  }

  // 5. Retention: warnings, then the workspaces past their date. Deleted
  // only with RETENTION_DELETES=1, a few per run; otherwise only reported.
  try {
    r.retentionWarnings = await sendRetentionWarnings(now, batch);
    const plan = await planRetention(now);
    r.retentionDue = plan.length;
    if (plan.length && retentionDeletesEnabled()) {
      for (const p of plan.slice(0, 3)) {
        if (Date.now() > deadline) { r.more = true; break; }
        try {
          const c = await deleteWorkspaceData(p.workspaceId, { dryRun: false, now });
          r.retentionDeleted++;
          console.warn("[billing] retention: deleted", p.workspaceId, JSON.stringify(c));
        } catch (e) {
          fail("retention delete", p.workspaceId, e);
        }
      }
    } else if (plan.length) {
      console.warn("[billing] retention due, deletes switched off:", JSON.stringify(plan));
    }
  } catch (e) {
    fail("retention", "plan", e);
  }

  // 6. Email.
  try {
    const sent = await drainEmailQueue({ limit: 50, now });
    r.emailsSent = sent.sent;
    r.emailsSuppressed = sent.suppressed;
  } catch (e) {
    fail("email", "queue", e);
  }

  if (trials.length === batch || due.length === batch) r.more = true;
  return r;
}

/** Renewal unpaid on day 0: the invoice and workspace go PAST_DUE, retry on day 3, email the owners. */
async function startDunning(
  inv: { id: string; number: string; totalCents: number },
  workspaceId: string,
  dueAt: Date,
  ws: { name: string; timezone: string },
) {
  await prisma.$transaction(async (tx) => {
    const moved = await tx.platformInvoice.updateMany({
      where: { id: inv.id, status: "OPEN" },
      data: { status: "PAST_DUE", dunningStage: "DAY0", nextAttemptAt: firstRetryAt(dueAt) },
    });
    if (moved.count === 0) return;
    await tx.workspace.updateMany({ where: { id: workspaceId, billingState: "ACTIVE" }, data: { billingState: "PAST_DUE" } });
    await queueBillingEmail(tx, {
      workspaceId, template: "dunning", event: `${inv.id}:DAY0`,
      data: {
        workspaceName: ws.name, day: 0, invoiceNumber: inv.number, totalCents: inv.totalCents,
        readOnlyOn: dayLabel(new Date(dueAt.getTime() + 14 * DAY), ws.timezone),
      },
    });
  }, { timeout: 30_000 });
}

/**
 * The owner cancelled: the paid period has ended, so the workspace goes
 * CANCELLED and gets a final invoice for the closing period's arrears
 * (catch-ups and usage, no seats in advance), charged to the saved card.
 * An unpaid final invoice stays OPEN; there is no dunning after cancel.
 */
async function cancelAtRenewal(workspaceId: string, renewAt: Date, now: Date, periodDays: number, provider?: PaymentProvider) {
  await prisma.$transaction([
    prisma.workspace.update({ where: { id: workspaceId }, data: { billingState: "CANCELLED" } }),
    prisma.subscription.update({ where: { workspaceId }, data: { cancelledAt: now, renewsAt: null } }),
  ]);
  const inv = await buildRenewalInvoice(workspaceId, renewAt, { arrearsOnly: true, now });
  await prisma.billingPeriod.updateMany({ where: { workspaceId, status: "OPEN" }, data: { status: "CLOSED" } });
  if (inv.status !== "OPEN") return;
  if (inv.totalCents <= 0) {
    await prisma.$transaction((tx) => markInvoicePaid(tx, { invoiceId: inv.id, paidAt: now, paidVia: "CREDIT", periodDays }), { timeout: 30_000 });
    return;
  }
  if (inv.attemptCount === 0) await chargeSavedCard({ invoice: inv, workspaceId, userId: null, provider });
}
