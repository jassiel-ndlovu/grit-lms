/**
 * Email send queue (design 05, section 6). `enqueueEmail` writes an
 * OutboundEmail row keyed by an idempotency key, so the same event never
 * queues twice; pass a transaction client to queue with the change that
 * caused it. `drainEmailQueue` claims due rows (FOR UPDATE SKIP LOCKED),
 * renders and sends them, and retries after 1 min, 5 min, 30 min, 2 h and
 * 12 h. Outside production only EMAIL_ALLOWLIST recipients are mailed; the
 * rest are SUPPRESSED.
 *
 * Auth and notification mail is also tried at once (sendQueuedNow); the
 * hourly notification and billing jobs drain the rest and the retries.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { createHash } from "node:crypto";

import { decryptSecret, encryptSecret } from "@/features/payments/secrets";

import { renderBillingEmail, type BillingTemplate, type BillingTemplateData, type Rendered } from "./billing-templates";
import { recipientAllowed, sendEmail } from "./send";
import { digestEmail, notificationEmail, passwordResetEmail, verificationEmail, type EmailNotificationItem } from "./templates";

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

/**
 * Secrets in queued data (a verification token) are sealed with a key
 * derived from NEXTAUTH_SECRET, so no new production secret is needed, and
 * removed from the row once it is sent or given up.
 */
function queueKey(): string {
  const base = process.env.NEXTAUTH_SECRET;
  if (!base) throw new Error("NEXTAUTH_SECRET is not set");
  return createHash("sha256").update(`nexa-email-queue:${base}`).digest("base64");
}
export function sealForQueue(secret: string): string {
  return encryptSecret(secret, queueKey());
}
function unseal(sealed: string): string {
  return decryptSecret(sealed, queueKey());
}

type VerifyData = { name: string; tokenSealed?: string };
type NotificationData = { item: EmailNotificationItem; notificationIds: string[] };
type DigestData = { period: "daily" | "weekly"; items: EmailNotificationItem[]; notificationIds: string[] };

function renderRow(template: string, to: string, data: unknown): Rendered {
  if (template.startsWith("billing:")) {
    const t = template.slice("billing:".length) as BillingTemplate;
    return renderBillingEmail(t, data as BillingTemplateData[typeof t]);
  }
  if (template === "auth:verify") {
    const d = data as VerifyData;
    if (!d.tokenSealed) throw new Error("Verification token already removed");
    return verificationEmail({ to, name: d.name, token: unseal(d.tokenSealed) });
  }
  if (template === "auth:reset") {
    const d = data as VerifyData;
    if (!d.tokenSealed) throw new Error("Reset token already removed");
    return passwordResetEmail({ to, name: d.name, token: unseal(d.tokenSealed) });
  }
  if (template === "notification") return notificationEmail({ to, item: (data as NotificationData).item });
  if (template === "digest") {
    const d = data as DigestData;
    return digestEmail({ to, period: d.period, items: d.items });
  }
  throw new Error(`No renderer for template ${template}`);
}

/** What a template does once its row is SENT, or finished without sending. */
async function afterRow(template: string, data: unknown, sent: boolean): Promise<{ data?: Prisma.InputJsonValue }> {
  if (template === "auth:verify" || template === "auth:reset") {
    // Drop the sealed token whatever happened; a new request mints a new one.
    const { name } = data as VerifyData;
    return { data: { name } };
  }
  if (sent && (template === "notification" || template === "digest")) {
    const ids = (data as { notificationIds?: string[] }).notificationIds ?? [];
    if (ids.length) await prisma.notification.updateMany({ where: { id: { in: ids }, emailedAt: null }, data: { emailedAt: new Date() } });
  }
  return {};
}

export type DrainResult = { claimed: number; sent: number; suppressed: number; retrying: number; failed: number };

type RowOutcome = "sent" | "suppressed" | "retrying" | "failed";

/** Sends one claimed (SENDING) row and records the outcome. */
async function processRow(id: string): Promise<{ outcome: RowOutcome; error?: string }> {
  const row = await prisma.outboundEmail.findUniqueOrThrow({ where: { id } });
  if (!recipientAllowed(row.toEmail)) {
    const extra = await afterRow(row.template, row.data, false);
    await prisma.outboundEmail.update({ where: { id }, data: { status: "SUPPRESSED", lockedUntil: null, lastError: "non-production", ...extra } });
    return { outcome: "suppressed", error: "Not sent outside production (recipient not on EMAIL_ALLOWLIST)" };
  }
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    const msg = renderRow(row.template, row.toEmail, row.data);
    result = await sendEmail({ ...msg, to: row.toEmail }, { idempotencyKey: row.idempotencyKey });
  } catch (e) {
    result = { ok: false, error: (e as Error).message, httpStatus: 400 }; // a render error never fixes itself
  }
  if (result.ok) {
    const extra = await afterRow(row.template, row.data, true);
    await prisma.outboundEmail.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: result.id, lockedUntil: null, lastError: null, ...extra },
    });
    return { outcome: "sent" };
  }
  const delay = isRetryable(result.httpStatus) ? retryDelayMinutes(row.attempts) : null;
  if (delay != null) {
    await prisma.outboundEmail.update({
      where: { id },
      data: { status: "QUEUED", nextAttemptAt: new Date(Date.now() + delay * 60_000), lockedUntil: null, lastError: result.error.slice(0, 500) },
    });
    return { outcome: "retrying", error: result.error };
  }
  const extra = await afterRow(row.template, row.data, false);
  await prisma.outboundEmail.update({ where: { id }, data: { status: "FAILED", lockedUntil: null, lastError: result.error.slice(0, 500), ...extra } });
  Sentry.captureMessage(`Email ${row.template} failed: ${result.error.slice(0, 120)}`, { level: "warning", tags: { emailTemplate: row.template } });
  return { outcome: "failed", error: result.error };
}

export type ImmediateOutcome = { key: string; outcome: RowOutcome | "skipped"; error?: string };

/**
 * Tries the given queued rows now (the immediate attempt for auth and
 * notification mail). Rows another worker holds are skipped; anything not
 * sent stays queued for the drain.
 */
export async function sendQueuedNow(keys: string[]): Promise<ImmediateOutcome[]> {
  const out: ImmediateOutcome[] = [];
  for (const key of keys) {
    const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "OutboundEmail" SET "status" = 'SENDING', "lockedUntil" = ${new Date(Date.now() + 2 * 60_000)}, "attempts" = "attempts" + 1
      WHERE "idempotencyKey" = ${key.slice(0, 256)} AND "status" = 'QUEUED'
      RETURNING "id"`;
    if (claimed.length === 0) {
      out.push({ key, outcome: "skipped" });
      continue;
    }
    out.push({ key, ...(await processRow(claimed[0].id)) });
  }
  return out;
}

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
  for (const { id } of claimed) r[(await processRow(id)).outcome]++;
  return r;
}
