/**
 * Outgoing webhooks (#216 phase 3, Pro). Contract: contracts/api.md.
 *
 *   emitWebhook(db, workspaceId, event, data)  from A's code (and B's, for
 *     grade.released): writes one delivery row per subscribed endpoint, in
 *     the caller's transaction when given one. No network here.
 *   drainWebhooks()  from the notifications job (every 5 minutes): POSTs
 *     due deliveries, signed, with retries; switches off an endpoint after
 *     three days of failures.
 */

import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";

import { decryptSecret, encryptSecret } from "@/features/payments/secrets";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import { API_LIMITS, isPrivateAddress, signPayload, webhookRetryMinutes, type WebhookEvent } from "./api-math";

type Db = typeof prisma | Prisma.TransactionClient;

/** The key that seals webhook secrets at rest: derived from NEXTAUTH_SECRET, so no new production secret. */
function sealKey(): string {
  const base = process.env.NEXTAUTH_SECRET;
  if (!base) throw new Error("NEXTAUTH_SECRET is not set");
  return createHash("sha256").update(`nexa-webhook-secret:${base}`).digest("base64");
}
export const sealWebhookSecret = (s: string) => encryptSecret(s, sealKey());
export const openWebhookSecret = (s: string) => decryptSecret(s, sealKey());

/**
 * Queues `event` for every active endpoint of the workspace subscribed to it.
 * Never throws: a webhook problem must not fail the change that caused it.
 */
export async function emitWebhook(db: Db, workspaceId: string, event: WebhookEvent, data: Record<string, unknown>, at: Date = new Date()): Promise<number> {
  try {
    const endpoints = await db.webhookEndpoint.findMany({ where: { workspaceId, active: true, events: { has: event } }, select: { id: true } });
    if (!endpoints.length) return 0;
    const id = `evt_${randomUUID().replace(/-/g, "")}`;
    const payload = { id, type: event, created: at.toISOString(), workspace: workspaceId, data } as Prisma.InputJsonValue;
    await db.webhookDelivery.createMany({ data: endpoints.map((e) => ({ endpointId: e.id, event, payload })) });
    return endpoints.length;
  } catch (e) {
    console.error("[webhooks] emit failed:", event, e);
    return 0;
  }
}

/** Resolves the host and refuses private addresses (DNS rebinding and internal targets). */
async function publicHost(url: URL): Promise<boolean> {
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

export type SendOutcome = { ok: boolean; status: number | null; error: string | null; ms: number };

/** One signed POST. Exported for the "send a test" button. */
export async function postSigned(url: string, secret: string, body: string, now: Date = new Date()): Promise<SendOutcome> {
  const started = Date.now();
  const u = new URL(url);
  if (!(await publicHost(u))) return { ok: false, status: null, error: "The address doesn't resolve to a public server.", ms: 0 };
  try {
    const res = await fetch(u, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(API_LIMITS.webhookTimeoutMs),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Nexa-Webhooks/1",
        "Nexa-Signature": signPayload(secret, body, Math.floor(now.getTime() / 1000)),
      },
      body,
    });
    await res.body?.cancel().catch(() => undefined);
    const ok = res.status >= 200 && res.status < 300;
    return { ok, status: res.status, error: ok ? null : `HTTP ${res.status}`, ms: Date.now() - started };
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "Timed out after 8 seconds" : (e as Error).message;
    return { ok: false, status: null, error: msg.slice(0, 300), ms: Date.now() - started };
  }
}

export type DrainResult = { sent: number; retrying: number; failed: number; disabled: number };

export async function drainWebhooks(opts: { now?: Date; limit?: number } = {}): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const out: DrainResult = { sent: 0, retrying: 0, failed: 0, disabled: 0 };
  const due = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "WebhookDelivery" SET "status" = 'SENDING', "lockedUntil" = ${new Date(now.getTime() + 2 * 60_000)}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT d."id" FROM "WebhookDelivery" d JOIN "WebhookEndpoint" e ON e."id" = d."endpointId"
      WHERE e."active" = true AND (
        (d."status" = 'PENDING' AND d."nextAttemptAt" <= ${now})
        OR (d."status" = 'SENDING' AND d."lockedUntil" < ${now})
      )
      ORDER BY d."nextAttemptAt" ASC
      LIMIT ${opts.limit ?? 100}
      FOR UPDATE OF d SKIP LOCKED
    )
    RETURNING "id"`;
  for (const { id } of due) {
    const d = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { id },
      select: { id: true, attempts: true, payload: true, endpoint: { select: { id: true, url: true, secretSealed: true, failingSince: true, active: true } } },
    });
    let secret: string;
    try {
      secret = openWebhookSecret(d.endpoint.secretSealed);
    } catch {
      await prisma.webhookDelivery.update({ where: { id }, data: { status: "FAILED", lockedUntil: null, lastError: "Signing secret unreadable" } });
      out.failed++;
      continue;
    }
    const r = await postSigned(d.endpoint.url, secret, JSON.stringify(d.payload), now);
    if (r.ok) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({ where: { id }, data: { status: "SENT", deliveredAt: now, lockedUntil: null, lastStatus: r.status, lastError: null } }),
        prisma.webhookEndpoint.update({ where: { id: d.endpoint.id }, data: { lastSuccessAt: now, failingSince: null } }),
      ]);
      out.sent++;
      continue;
    }
    const retryIn = webhookRetryMinutes(d.attempts);
    await prisma.webhookDelivery.update({
      where: { id },
      data: retryIn != null
        ? { status: "PENDING", nextAttemptAt: new Date(now.getTime() + retryIn * 60_000), lockedUntil: null, lastStatus: r.status, lastError: r.error }
        : { status: "FAILED", lockedUntil: null, lastStatus: r.status, lastError: r.error },
    });
    if (retryIn != null) out.retrying++; else out.failed++;
    const since = d.endpoint.failingSince ?? now;
    if (!d.endpoint.failingSince) await prisma.webhookEndpoint.update({ where: { id: d.endpoint.id }, data: { failingSince: now } });
    if (now.getTime() - since.getTime() >= API_LIMITS.disableAfterMs && d.endpoint.active) {
      await prisma.webhookEndpoint.update({ where: { id: d.endpoint.id }, data: { active: false, disabledReason: `Switched off after failing for 3 days (last: ${r.error ?? "no answer"}).` } });
      out.disabled++;
    }
  }
  return out;
}

/** Housekeeping: deliveries older than 30 days. */
export async function pruneWebhookDeliveries(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - API_LIMITS.keepDeliveriesDays * 86_400_000) } } });
  return count;
}
