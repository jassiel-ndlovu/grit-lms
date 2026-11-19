/**
 * The billing job (design 03, section 7), run hourly by /api/cron/billing.
 * Every step is idempotent, so a late or repeated run is safe:
 *
 *   1. Trials that ended unpaid go READ_ONLY.
 *   2. Renewals due: build the renewal invoice, charge the saved card. A
 *      zero total (comp) is marked paid without a charge. A failed or
 *      missing card starts dunning. Owners who cancelled go CANCELLED.
 *   3. Dunning: retry the card on day 3 and day 7; READ_ONLY on day 14.
 *
 * Not yet: usage metering (needs B's AI-marking rows), cap and trial
 * emails, dunning emails, the final arrears invoice on cancel, ending comps,
 * and retention deletes (owner-only, AGENTS.md 4.2).
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { PaymentProvider } from "@/features/payments/provider";
import { markInvoicePaid } from "@/features/payments/settle";
import { addCalendarMonths, dunningStep, firstRetryAt, type DunningStage } from "@/features/payments/settlement-rules";

import { chargeSavedCard } from "./charge";
import { getBillingConfig } from "./data";
import { isBillingEnabled } from "./errors";
import { buildRenewalInvoice } from "./invoice";

export type BillingRunResult = {
  skipped?: string;
  trialsEnded: number;
  cancelled: number;
  renewalsPaid: number;
  renewalsZero: number;
  renewalsPending: number;
  dunningStarted: number;
  retriesPaid: number;
  retriesFailed: number;
  locked: number;
  errors: number;
  more: boolean;
};

export async function runBillingJob(opts: { provider?: PaymentProvider; now?: Date; budgetMs?: number; batch?: number } = {}): Promise<BillingRunResult> {
  const r: BillingRunResult = {
    trialsEnded: 0, cancelled: 0, renewalsPaid: 0, renewalsZero: 0, renewalsPending: 0,
    dunningStarted: 0, retriesPaid: 0, retriesFailed: 0, locked: 0, errors: 0, more: false,
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

  // 1. Trials that ended unpaid.
  const ended = await prisma.workspace.findMany({
    where: { billingState: "TRIAL", trialEndsAt: { lte: now } },
    select: { id: true, trialEndsAt: true },
    take: batch,
  });
  for (const ws of ended) {
    await prisma.$transaction(async (tx) => {
      const w = await tx.workspace.updateMany({ where: { id: ws.id, billingState: "TRIAL" }, data: { billingState: "READ_ONLY" } });
      if (w.count === 0) return;
      await tx.subscription.updateMany({
        where: { workspaceId: ws.id },
        data: { readOnlySince: now, deleteAfter: addCalendarMonths(ws.trialEndsAt!, 2) },
      });
      r.trialsEnded++;
    });
  }

  // 2. Renewals due.
  const due = await prisma.subscription.findMany({
    where: { renewsAt: { lte: now }, workspace: { billingState: { in: ["ACTIVE", "COMPED"] } } },
    select: { workspaceId: true, renewsAt: true, cancelAtPeriodEnd: true, workspace: { select: { billingState: true } } },
    orderBy: { renewsAt: "asc" },
    take: batch,
  });
  for (const sub of due) {
    if (Date.now() > deadline) { r.more = true; break; }
    try {
      if (sub.cancelAtPeriodEnd) {
        await prisma.$transaction([
          prisma.workspace.update({ where: { id: sub.workspaceId }, data: { billingState: "CANCELLED" } }),
          prisma.subscription.update({ where: { workspaceId: sub.workspaceId }, data: { cancelledAt: now, renewsAt: null } }),
        ]);
        r.cancelled++;
        continue;
      }
      const renewAt = sub.renewsAt!;
      const inv = await buildRenewalInvoice(sub.workspaceId, renewAt, { comped: sub.workspace.billingState === "COMPED", now });
      if (inv.status !== "OPEN") continue;

      if (inv.totalCents <= 0) {
        await prisma.$transaction(
          (tx) => markInvoicePaid(tx, {
            invoiceId: inv.id, paidAt: now, paidVia: sub.workspace.billingState === "COMPED" ? "COMPED" : "CREDIT", periodDays: config.periodDays,
          }),
          { timeout: 15_000 },
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
      await startDunning(inv.id, sub.workspaceId, renewAt);
      r.dunningStarted++;
    } catch (e) {
      fail("renewal", sub.workspaceId, e);
    }
  }

  // 3. Dunning retries and locks.
  const overdue = await prisma.platformInvoice.findMany({
    where: { status: "PAST_DUE", dunningStage: { in: ["DAY0", "DAY3", "DAY7"] } },
    select: { id: true, workspaceId: true, totalCents: true, dueAt: true, dunningStage: true },
    orderBy: { dueAt: "asc" },
    take: batch * 4,
  });
  for (const inv of overdue) {
    if (Date.now() > deadline) { r.more = true; break; }
    const step = dunningStep(inv.dunningStage as DunningStage, inv.dueAt, now);
    if (step.action === "none") continue;
    try {
      if (step.action === "lock") {
        await prisma.$transaction([
          prisma.platformInvoice.update({ where: { id: inv.id }, data: { dunningStage: "LOCKED", nextAttemptAt: null } }),
          prisma.workspace.updateMany({ where: { id: inv.workspaceId, billingState: "PAST_DUE" }, data: { billingState: "READ_ONLY" } }),
          prisma.subscription.updateMany({ where: { workspaceId: inv.workspaceId }, data: { readOnlySince: now } }),
        ]);
        r.locked++;
        continue;
      }
      const pending = await prisma.payment.count({ where: { platformInvoiceId: inv.id, status: "PENDING" } });
      if (pending > 0) continue;
      const c = await chargeSavedCard({ invoice: inv, workspaceId: inv.workspaceId, userId: null, provider: opts.provider });
      if (c.status === "SUCCEEDED") { r.retriesPaid++; continue; }
      if (c.status === "PENDING") continue;
      await prisma.platformInvoice.update({
        where: { id: inv.id },
        data: { dunningStage: step.stageIfFails, nextAttemptAt: step.nextAttemptAt },
      });
      r.retriesFailed++;
    } catch (e) {
      fail("dunning", inv.id, e);
    }
  }

  if (ended.length === batch || due.length === batch) r.more = true;
  return r;
}

/** Renewal unpaid on day 0: the invoice and workspace go PAST_DUE; retry on day 3. */
async function startDunning(invoiceId: string, workspaceId: string, dueAt: Date) {
  await prisma.$transaction([
    prisma.platformInvoice.updateMany({
      where: { id: invoiceId, status: "OPEN" },
      data: { status: "PAST_DUE", dunningStage: "DAY0", nextAttemptAt: firstRetryAt(dueAt) },
    }),
    prisma.workspace.updateMany({ where: { id: workspaceId, billingState: "ACTIVE" }, data: { billingState: "PAST_DUE" } }),
  ]);
}
