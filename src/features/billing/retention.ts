/**
 * Data retention (design 03, section 5; owner approval 2026-11-19).
 * A workspace's data is kept until 2 months after its last payment
 * (`Subscription.deleteAfter`); a payment before then keeps everything.
 *
 * Built here:
 *   - Warnings 30 and 7 days before deleteAfter, to owners, admins and the
 *     billing email (once each per deleteAfter date).
 *   - `planRetention`: which workspaces are due and what would go.
 *
 * Not yet: the deletes themselves. Deleting a course needs B's content
 * tables to cascade or a delete helper from B, and the Blob files they
 * point to (issue filed for B). Until then the billing job reports the plan
 * and deletes nothing. Kept for tax law: PlatformInvoice, lines, Payment,
 * Refund, OffsitePayment and AuditLog rows.
 */

import "server-only";

import { prisma } from "@/lib/db";

import { dayLabel, queueBillingEmail } from "./emails";

const DAY = 24 * 60 * 60 * 1000;
export const RETENTION_WARNING_DAYS = [30, 7] as const;

/** Never deleted, whatever its dates say. */
const PROTECTED_WORKSPACES = new Set(["ws_nexa_legacy"]);

/** Which warning (30 or 7) is due at `daysLeft`, if any. */
export function retentionWarningDue(daysLeft: number): 30 | 7 | null {
  if (daysLeft <= 0) return null;
  const due = RETENTION_WARNING_DAYS.filter((d) => daysLeft <= d);
  return (due.at(-1) as 30 | 7 | undefined) ?? null;
}

export async function sendRetentionWarnings(now: Date, batch = 50): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: {
      deleteAfter: { gt: now, lte: new Date(now.getTime() + RETENTION_WARNING_DAYS[0] * DAY) },
      workspace: { billingState: { in: ["READ_ONLY", "CANCELLED"] } },
    },
    select: { workspaceId: true, deleteAfter: true, workspace: { select: { name: true, timezone: true } } },
    take: batch,
  });
  let queued = 0;
  for (const s of subs) {
    if (PROTECTED_WORKSPACES.has(s.workspaceId)) continue;
    const daysLeft = Math.ceil((s.deleteAfter!.getTime() - now.getTime()) / DAY);
    const mark = retentionWarningDue(daysLeft);
    if (mark == null) continue;
    queued += await queueBillingEmail(prisma, {
      workspaceId: s.workspaceId,
      template: "deletion-warning",
      // A later payment moves deleteAfter, so warnings start over for the new date.
      event: `${s.workspaceId}:${s.deleteAfter!.toISOString().slice(0, 10)}:${mark}`,
      data: { workspaceName: s.workspace.name, daysLeft, deleteOn: dayLabel(s.deleteAfter!, s.workspace.timezone) },
    });
  }
  return queued;
}

export type RetentionPlanItem = { workspaceId: string; courses: number; enrollments: number; learners: number; memberships: number };

/** Workspaces past deleteAfter and what deleting them would remove. Reads only. */
export async function planRetention(now: Date, batch = 20): Promise<RetentionPlanItem[]> {
  const due = await prisma.subscription.findMany({
    where: { deleteAfter: { lte: now }, workspace: { billingState: { in: ["READ_ONLY", "CANCELLED"] } } },
    select: { workspaceId: true },
    take: batch,
  });
  const out: RetentionPlanItem[] = [];
  for (const { workspaceId } of due) {
    if (PROTECTED_WORKSPACES.has(workspaceId)) continue;
    const [courses, enrollments, learners, memberships] = await Promise.all([
      prisma.course.count({ where: { workspaceId } }),
      prisma.enrollment.count({ where: { workspaceId } }),
      prisma.learner.count({ where: { workspaceId } }),
      prisma.membership.count({ where: { workspaceId } }),
    ]);
    out.push({ workspaceId, courses, enrollments, learners, memberships });
  }
  return out;
}
