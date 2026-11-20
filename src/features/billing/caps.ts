/**
 * Usage limits (design 03, sections 6 and 8).
 *
 *   assertCanAddLearners  a hard-stop ACTIVE_STUDENTS limit (the trial's
 *                         20, or the owner's own) blocks the learner that
 *                         would go over it. Called wherever enrolments open.
 *   sendCapWarnings       the daily billing job emails owners once at 80%
 *                         and once at 100% of each limit per period.
 *
 * AI marks are checked where they are made (features/ai-marking/jobs.ts).
 * Behind BILLING=1. Server only.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { queueBillingEmail } from "./emails";
import { BillingError, isBillingEnabled } from "./errors";

type Db = Prisma.TransactionClient | typeof prisma;

const WHAT: Record<string, string> = { ACTIVE_STUDENTS: "active students", AI_MARKS: "AI marks", STORAGE_MB: "storage (MB)", API_REQUESTS: "API requests", LIVE_ROOM_MINUTES: "live-room minutes" };

async function activeLearnerIds(db: Db, workspaceId: string): Promise<Set<string>> {
  const rows = await db.enrollment.findMany({ where: { workspaceId, status: "ACTIVE", endedAt: null }, select: { learnerId: true }, distinct: ["learnerId"] });
  return new Set(rows.map((r) => r.learnerId));
}

/** Throws TRIAL_CAP_REACHED (or FORBIDDEN for an owner's own limit) when `learnerIds` would take the workspace over a hard-stop student limit. */
export async function assertCanAddLearners(db: Db, workspaceId: string, learnerIds: string[]) {
  if (!isBillingEnabled() || learnerIds.length === 0) return;
  const caps = await db.usageCap.findMany({ where: { workspaceId, meter: "ACTIVE_STUDENTS", hardStop: true }, orderBy: { limitQuantity: "asc" } });
  if (caps.length === 0) return;
  const active = await activeLearnerIds(db, workspaceId);
  const after = active.size + new Set(learnerIds.filter((id) => !active.has(id))).size;
  const cap = caps[0];
  if (after > cap.limitQuantity) {
    throw cap.source === "TRIAL"
      ? new BillingError("TRIAL_CAP_REACHED", `The trial allows ${cap.limitQuantity} students. Pay for your first 30 days to add more.`)
      : new BillingError("FORBIDDEN", `This workspace's limit is ${cap.limitQuantity} active students. Raise it in billing to add more.`);
  }
}

/** Once per period and level per cap. Returns how many warnings were queued. */
export async function sendCapWarnings(now: Date = new Date()): Promise<number> {
  if (!isBillingEnabled()) return 0;
  const caps = await prisma.usageCap.findMany({ select: { id: true, workspaceId: true, meter: true, limitQuantity: true, hardStop: true, source: true, notifiedLevel: true, notifiedPeriodStart: true, workspace: { select: { name: true, billingState: true, trialEndsAt: true } } } });
  let sent = 0;
  for (const c of caps) {
    if (c.limitQuantity <= 0) continue;
    const period = await prisma.billingPeriod.findFirst({ where: { workspaceId: c.workspaceId, start: { lte: now }, end: { gt: now } }, select: { start: true } });
    const windowStart = period?.start ?? (c.workspace.trialEndsAt ? new Date(c.workspace.trialEndsAt.getTime() - 14 * 864e5) : new Date(now.getTime() - 30 * 864e5));
    const level = c.notifiedPeriodStart && c.notifiedPeriodStart.getTime() === windowStart.getTime() ? c.notifiedLevel : 0;
    let used: number;
    if (c.meter === "ACTIVE_STUDENTS") used = (await activeLearnerIds(prisma, c.workspaceId)).size;
    else used = (await prisma.usageRecord.aggregate({ where: { workspaceId: c.workspaceId, meter: c.meter, day: { gte: windowStart } }, _sum: { quantity: true } }))._sum.quantity ?? 0;
    const pct = (used / c.limitQuantity) * 100;
    const due = pct >= 100 && level < 100 ? 100 : pct >= 80 && level < 80 ? 80 : 0;
    if (!due) continue;
    await prisma.$transaction(async (tx) => {
      await tx.usageCap.update({ where: { id: c.id }, data: { notifiedLevel: due, notifiedPeriodStart: windowStart } });
      await queueBillingEmail(tx, {
        workspaceId: c.workspaceId, template: "cap-warning", event: `${c.id}:${windowStart.toISOString().slice(0, 10)}:${due}`,
        data: { workspaceName: c.workspace.name, what: WHAT[c.meter] ?? c.meter, used, limit: c.limitQuantity, level: due as 80 | 100, hardStop: c.hardStop, trial: c.source === "TRIAL" },
      });
    }, { timeout: 30_000 });
    sent++;
  }
  return sent;
}
