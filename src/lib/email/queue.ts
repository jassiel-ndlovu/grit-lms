/**
 * Email send queue (design 05, section 6). `enqueueEmail` writes an
 * OutboundEmail row keyed by an idempotency key, so the same event never
 * queues twice; pass a transaction client to queue with the change that
 * caused it. `drainEmailQueue` claims due rows (FOR UPDATE SKIP LOCKED),
 * renders and sends them, and retries after 1 min, 5 min, 30 min, 2 h and
 * 12 h. Outside production only EMAIL_ALLOWLIST recipients are mailed; the
 * rest are SUPPRESSED.
 *
 * Today the billing job drains it each hour. A 5-minute trigger can come
 * later without changing the table.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { renderBillingEmail, type BillingTemplate, type BillingTemplateData, type Rendered } from "./billing-templates";
import { recipientAllowed, sendEmail } from "./send";

type Db = Prisma.TransactionClient | typeof prisma;

export type EmailPriority = "AUTH" | "BILLING" | "NORMAL" | "DIGEST";

/** Minutes to wait before attempt n+1 (index = attempts so far - 1). */
export const RETRY_MINUTES = [1, 5, 30, 120, 720] as const;

export function retryDelayMinutes(attempts: number): number | null {
  return attempts >= 1 && attempts <= RETRY_MINUTES.length ? RETRY_MINUTES[attempts - 1] : null;
}

/** Resend answers worth retrying: rate limit, concurrent idempotent request, server errors, no answer. */
export function isRetryable(httpStatus: number | undefined): boolean {
  return httpStatus === undefined || httpStatus === 429 || httpStatus === 409 || httpStatus >= 500;
}

export async function enqueueEmail(
  db: Db,
  input: {
    key: string;
    template: string;
    to: string;
    userId?: string | null;
    workspaceId?: string | null;
    category: string;
    priority?: EmailPriority;
    data: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.outboundEmail.upsert({
    where: { idempotencyKey: input.key.slice(0, 256) },
    create: {
      idempotencyKey: input.key.slice(0, 256),
      template: input.template,
      toEmail: input.to,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      category: input.category,
      priority: input.priority ?? "NORMAL",
      data: input.data,
    },
    update: {},
  });
}

function renderRow(template: string, data: unknown): Rendered {
  if (template.startsWith("billing:")) {
    const t = template.slice("billing:".length) as BillingTemplate;
    return renderBillingEmail(t, data as BillingTemplateData[typeof t]);
  }
  throw new Error(`No renderer for template ${template}`);
}

export type DrainResult = { claimed: number; sent: number; suppressed: number; retrying: number; failed: number };

export async function drainEmailQueue(opts: { limit?: number; now?: Date } = {}): Promise<DrainResult> {
  const limit = opts.limit ?? 50;
  const now = opts.now ?? new Date();
  const r: DrainResult = { claimed: 0, sent: 0, suppressed: 0, retrying: 0, failed: 0 };

  // Daily budget (Resend Free caps at 100 a day): past it only AUTH and BILLING go out.
  const budget = Number(process.env.EMAIL_DAILY_BUDGET ?? 90);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sentToday = await prisma.outboundEmail.count({ where: { status: "SENT", sentAt: { gte: dayStart } } });
  const urgentOnly = sentToday >= budget;

  // Claim by the real clock (a job may pass a simulated `now`), so rows
  // queued a moment ago are due.
  const at = new Date(Math.max(now.getTime(), Date.now()));
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "OutboundEmail" SET "status" = 'SENDING', "lockedUntil" = ${new Date(at.getTime() + 2 * 60_000)}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "OutboundEmail"
      WHERE (("status" = 'QUEUED' AND "nextAttemptAt" <= ${at}) OR ("status" = 'SENDING' AND "lockedUntil" < ${at}))
        AND (${urgentOnly} = false OR "priority" IN ('AUTH', 'BILLING'))
      ORDER BY "priority" ASC, "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  r.claimed = claimed.length;

  for (const { id } of claimed) {
    const row = await prisma.outboundEmail.findUniqueOrThrow({ where: { id } });
    if (!recipientAllowed(row.toEmail)) {
      await prisma.outboundEmail.update({ where: { id }, data: { status: "SUPPRESSED", lockedUntil: null, lastError: "non-production" } });
      r.suppressed++;
      continue;
    }
    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      const msg = renderRow(row.template, row.data);
      result = await sendEmail({ to: row.toEmail, ...msg }, { idempotencyKey: row.idempotencyKey });
    } catch (e) {
      result = { ok: false, error: (e as Error).message, httpStatus: 400 }; // a render error never fixes itself
    }
    if (result.ok) {
      await prisma.outboundEmail.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), providerMessageId: result.id, lockedUntil: null, lastError: null },
      });
      r.sent++;
      continue;
    }
    const delay = isRetryable(result.httpStatus) ? retryDelayMinutes(row.attempts) : null;
    if (delay != null) {
      await prisma.outboundEmail.update({
        where: { id },
        data: { status: "QUEUED", nextAttemptAt: new Date(Date.now() + delay * 60_000), lockedUntil: null, lastError: result.error.slice(0, 500) },
      });
      r.retrying++;
    } else {
      await prisma.outboundEmail.update({ where: { id }, data: { status: "FAILED", lockedUntil: null, lastError: result.error.slice(0, 500) } });
      r.failed++;
      Sentry.captureMessage(`Email ${row.template} failed: ${result.error.slice(0, 120)}`, { level: "warning", tags: { emailTemplate: row.template } });
    }
  }
  return r;
}
