/**
 * Restarting a cancelled or read-only workspace (#191; owner decisions
 * 2026-11-20 and 2026-11-21). The owner pays what the restart costs before
 * the workspace comes back:
 *
 *   PAY_OUTSTANDING   unpaid invoices first (payPlatformInvoice)
 *   PAY_FIRST_PERIOD  students enrolled: the usual first payment for 30
 *                     days of seats (startFirstPayment)
 *   CARD_REQUIRED     no students and no saved card: save one first
 *                     (startCardReplacement), then restart again
 *   RESTARTED         no students and a saved card: free. The workspace
 *                     reopens now with a R0 first period; students added
 *                     later are billed as catch-up at the renewal.
 *
 * Server only; takes ids so scripts can test it.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { markInvoicePaid } from "@/features/payments/settle";

import { getBillingConfig } from "./data";
import { BillingError } from "./errors";
import { createFirstInvoice } from "./invoice";

export type RestartResult =
  | { status: "PAY_OUTSTANDING"; invoiceIds: string[] }
  | { status: "PAY_FIRST_PERIOD"; activeStudents: number }
  | { status: "CARD_REQUIRED" }
  | { status: "RESTARTED"; renewsAt: string };

export async function restartWorkspaceFor(workspaceId: string, actorUserId: string, now: Date = new Date()): Promise<RestartResult> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { billingState: true } });
  if (ws.billingState !== "CANCELLED" && ws.billingState !== "READ_ONLY") {
    throw new BillingError("FORBIDDEN", "Only a cancelled or locked organisation can be restarted");
  }
  const outstanding = await prisma.platformInvoice.findMany({ where: { workspaceId, status: { in: ["OPEN", "PAST_DUE"] }, totalCents: { gt: 0 } }, select: { id: true } });
  if (outstanding.length) return { status: "PAY_OUTSTANDING", invoiceIds: outstanding.map((i) => i.id) };

  const active = (await prisma.enrollment.findMany({ where: { workspaceId, status: "ACTIVE", endedAt: null }, distinct: ["learnerId"], select: { learnerId: true } })).length;
  if (active > 0) return { status: "PAY_FIRST_PERIOD", activeStudents: active };

  const sub = await prisma.subscription.findUnique({ where: { workspaceId }, select: { status: true, authorizationCodeEnc: true } });
  if (sub?.status !== "AUTHORISED" || !sub.authorizationCodeEnc) return { status: "CARD_REQUIRED" };

  const config = await getBillingConfig();
  const invoice = await createFirstInvoice(workspaceId, now);
  if (invoice.totalCents > 0) {
    // Someone enrolled a student meanwhile: back to a normal first payment.
    await prisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
    return { status: "PAY_FIRST_PERIOD", activeStudents: 1 };
  }
  await prisma.$transaction(async (tx) => {
    // markInvoicePaid treats a CANCELLED workspace's empty invoice as its
    // final one (no new period), so leave CANCELLED first.
    await tx.workspace.update({ where: { id: workspaceId }, data: { billingState: "READ_ONLY" } });
    await tx.subscription.update({ where: { workspaceId }, data: { cancelAtPeriodEnd: false } });
    await markInvoicePaid(tx, {
      invoiceId: invoice.id, paidAt: now, paidVia: "CARD", card: null, periodDays: config.periodDays, actorUserId,
      audit: { restart: true, reason: "No students enrolled: restarted free with a saved card" },
    });
  }, { timeout: 30_000 });
  const after = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId }, select: { renewsAt: true } });
  return { status: "RESTARTED", renewsAt: (after.renewsAt ?? now).toISOString() };
}
