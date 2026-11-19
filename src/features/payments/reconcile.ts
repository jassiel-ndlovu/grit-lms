/**
 * Nightly payment reconciliation (design 04, section 7), run by
 * /api/cron/payments-reconcile:
 *
 *   1. PENDING payments older than 30 minutes: ask Paystack and apply.
 *      Still unpaid after 24 hours: ABANDONED.
 *   2. Webhook events left FAILED: reprocess, up to 5 attempts, then alert.
 *   3. Refunds not yet sent to Paystack (the call failed): send them.
 *   4. Paystack's own list of the last two days: a successful Nexa
 *      transaction we hold as unpaid is settled; one we have no row for is
 *      reported to Sentry.
 *   5. The sole-proprietor lifetime limit: warn at 70% and 90%.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/db";

import { getProvider, type PaymentProvider } from "./provider";
import { issueRefund, settlePayment } from "./settle";

const MIN = 60_000;
const MAX_EVENT_ATTEMPTS = 5;

export type ReconcileResult = {
  checked: number;
  settled: number;
  abandoned: number;
  eventsRetried: number;
  eventsGaveUp: number;
  refundsSent: number;
  /** Partial refunds left for a person to check (never resent automatically). */
  refundsHeld: number;
  providerListed: number;
  providerFixed: number;
  providerUnknown: number;
  lifetimeUsedBps: number;
  errors: number;
};

export async function runReconcile(opts: { provider?: PaymentProvider; now?: Date } = {}): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  const r: ReconcileResult = { checked: 0, settled: 0, abandoned: 0, eventsRetried: 0, eventsGaveUp: 0, refundsSent: 0, refundsHeld: 0, providerListed: 0, providerFixed: 0, providerUnknown: 0, lifetimeUsedBps: 0, errors: 0 };
  const lazyProvider = () => opts.provider ?? getProvider();

  // 1. Stale PENDING payments.
  const stale = await prisma.payment.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 30 * MIN) } },
    select: { reference: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  for (const p of stale) {
    r.checked++;
    try {
      const s = await settlePayment(p.reference, { provider: lazyProvider() });
      if (s.applied) r.settled++;
      if (s.status === "PENDING" && p.createdAt < new Date(now.getTime() - 24 * 60 * MIN)) {
        const u = await prisma.payment.updateMany({ where: { reference: p.reference, status: "PENDING" }, data: { status: "ABANDONED" } });
        r.abandoned += u.count;
      }
    } catch (e) {
      r.errors++;
      console.error("[reconcile] payment", p.reference, (e as Error).message);
    }
  }

  // 2. Webhook events that failed.
  const failed = await prisma.paymentEvent.findMany({
    where: { status: "FAILED", attempts: { lt: MAX_EVENT_ATTEMPTS }, reference: { not: null } },
    select: { id: true, reference: true, type: true, attempts: true },
    take: 100,
  });
  for (const ev of failed) {
    if (!ev.type.startsWith("charge.")) continue;
    try {
      await settlePayment(ev.reference!, { provider: lazyProvider() });
      await prisma.paymentEvent.update({ where: { id: ev.id }, data: { status: "PROCESSED", processedAt: now, attempts: { increment: 1 }, error: null } });
      r.eventsRetried++;
    } catch (e) {
      const attempts = ev.attempts + 1;
      await prisma.paymentEvent.update({ where: { id: ev.id }, data: { attempts, error: (e as Error).message.slice(0, 500) } });
      if (attempts >= MAX_EVENT_ATTEMPTS) {
        r.eventsGaveUp++;
        Sentry.captureMessage(`Payment event ${ev.id} failed ${attempts} times`, { level: "error", tags: { job: "payments-reconcile" } });
      }
    }
  }

  // 3. Refunds whose provider call never went through. Only full refunds
  // are resent: Paystack refuses a second full refund, but a timed-out
  // partial one may have gone through, and resending it could pay twice.
  const unsent = await prisma.refund.findMany({
    where: { status: "PENDING", providerRefundId: null, createdAt: { lt: new Date(now.getTime() - 5 * MIN) } },
    select: { id: true, amountCents: true, payment: { select: { amountCents: true } } },
    take: 50,
  });
  for (const rf of unsent) {
    if (rf.amountCents < rf.payment.amountCents) {
      r.refundsHeld++;
      Sentry.captureMessage(`Partial refund ${rf.id} not confirmed by Paystack; check it by hand`, { level: "warning", tags: { job: "payments-reconcile" } });
      continue;
    }
    try {
      await issueRefund(rf.id, lazyProvider());
      r.refundsSent++;
    } catch (e) {
      r.errors++;
      console.error("[reconcile] refund", rf.id, (e as Error).message);
    }
  }

  // 4. Paystack's list against ours. Only our references (nx-...); other
  // integrations on the same Paystack account are not ours to judge.
  try {
    const listed = await lazyProvider().listTransactions({ from: new Date(now.getTime() - 48 * 60 * MIN), to: now });
    const ours = listed.filter((t) => t.reference.startsWith("nx-") && t.status === "success");
    r.providerListed = ours.length;
    const rows = await prisma.payment.findMany({ where: { reference: { in: ours.map((t) => t.reference) } }, select: { reference: true, status: true } });
    const byRef = new Map(rows.map((p) => [p.reference, p.status]));
    for (const t of ours) {
      const status = byRef.get(t.reference);
      if (!status) {
        r.providerUnknown++;
        Sentry.captureMessage(`Paystack has a paid transaction ${t.reference} with no Payment row`, { level: "error", tags: { job: "payments-reconcile" } });
        continue;
      }
      if (status === "SUCCEEDED" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED") continue;
      try {
        const s = await settlePayment(t.reference, { provider: lazyProvider() });
        if (s.applied) r.providerFixed++;
      } catch (e) {
        r.errors++;
        console.error("[reconcile] provider list", t.reference, (e as Error).message);
      }
    }
  } catch (e) {
    r.errors++;
    console.error("[reconcile] could not list Paystack transactions:", (e as Error).message);
  }

  // 5. Lifetime collection limit of the sole-proprietor Paystack account.
  const alertBps = Number(process.env.PAYSTACK_CAP_ALERT_BPS ?? 7_000);
  r.lifetimeUsedBps = (await lifetimeVolume()).usedBps;
  if (r.lifetimeUsedBps >= alertBps) {
    Sentry.captureMessage(`Paystack lifetime limit at ${(r.lifetimeUsedBps / 100).toFixed(1)}%`, {
      level: r.lifetimeUsedBps >= 9_000 ? "error" : "warning",
      tags: { job: "payments-reconcile" },
    });
  }
  return r;
}

/**
 * Money collected through Paystack so far (payments less processed refunds)
 * against the sole-proprietor lifetime limit (design 04, section 3).
 */
export async function lifetimeVolume(): Promise<{ lifetimeCents: number; capCents: number; usedBps: number }> {
  const capCents = Number(process.env.PAYSTACK_LIFETIME_CAP_CENTS ?? 100_000_000);
  const [paid, refunded] = await Promise.all([
    prisma.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] } }, _sum: { amountCents: true } }),
    prisma.refund.aggregate({ where: { status: "PROCESSED" }, _sum: { amountCents: true } }),
  ]);
  const lifetimeCents = (paid._sum.amountCents ?? 0) - (refunded._sum.amountCents ?? 0);
  return { lifetimeCents, capCents, usedBps: capCents > 0 ? Math.floor((lifetimeCents / capCents) * 10_000) : 0 };
}
