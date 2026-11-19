/**
 * Queues billing emails for a workspace: to its active owners and admins,
 * plus the subscription's billing email if that is someone else. One row
 * per recipient, keyed so each event mails each person once.
 */

import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma";
import type { BillingTemplate, BillingTemplateData } from "@/lib/email/billing-templates";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";

type Db = Prisma.TransactionClient | typeof prisma;

/** "5 March 2027" in the workspace's time zone. */
export function dayLabel(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
}

export async function billingRecipients(db: Db, workspaceId: string): Promise<Array<{ email: string; userId: string | null }>> {
  const [members, sub] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
      select: { user: { select: { id: true, email: true } } },
    }),
    db.subscription.findUnique({ where: { workspaceId }, select: { billingEmail: true } }),
  ]);
  const out = new Map<string, { email: string; userId: string | null }>();
  for (const m of members) out.set(m.user.email.toLowerCase(), { email: m.user.email, userId: m.user.id });
  if (sub?.billingEmail && !out.has(sub.billingEmail.toLowerCase())) out.set(sub.billingEmail.toLowerCase(), { email: sub.billingEmail, userId: null });
  return [...out.values()];
}

/**
 * `event` identifies the occurrence (e.g. the invoice id plus the dunning
 * day), so a rerun of the job queues nothing new.
 */
export async function queueBillingEmail<T extends BillingTemplate>(
  db: Db,
  input: { workspaceId: string; template: T; event: string; data: BillingTemplateData[T] },
): Promise<number> {
  const recipients = await billingRecipients(db, input.workspaceId);
  for (const r of recipients) {
    const who = createHash("sha256").update(r.email.toLowerCase()).digest("hex").slice(0, 16);
    await enqueueEmail(db, {
      key: `billing:${input.template}:${input.event}:${who}`,
      template: `billing:${input.template}`,
      to: r.email,
      userId: r.userId,
      workspaceId: input.workspaceId,
      category: "BILLING",
      priority: "BILLING",
      data: input.data as Prisma.InputJsonValue,
    });
  }
  return recipients.length;
}
