/**
 * API keys and webhook endpoints (#216 phase 3, Pro): management for owners
 * and admins (`workspace.settings`), and key authentication for /api/v1.
 * Contract: contracts/api.md. Actions: ./actions.ts.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { SERVICES } from "@/features/billing/catalogue";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import {
  API_LIMITS, bearerKey, hashKey, newApiKey, newWebhookSecret, rateStep, validScopes, WEBHOOK_EVENTS,
  webhookUrlProblem, type ApiScope, type WebhookEvent,
} from "./api-math";
import { openWebhookSecret, postSigned, sealWebhookSecret } from "./webhooks";

export const API_UPSELL = "API keys and webhooks are part of the Pro plan.";

/** Pro workspaces: any course with a v1 Pro service on, a comped workspace, or billing not yet on. */
export async function apiAccessAvailable(workspaceId: string): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { billingState: true } });
  if (!ws || ws.billingState === "CANCELLED") return false;
  if (ws.billingState === "COMPED") return true;
  const pro = Object.values(SERVICES).filter((s) => s.kind === "premium" && s.tier === "PRO" && s.status === "v1").map((s) => s.key);
  return (await prisma.courseService.count({ where: { workspaceId, enabled: true, serviceKey: { in: pro } } })) > 0;
}

async function manager(viewer: Viewer) {
  if (!viewer.workspace || (viewer.persona !== "staff" && viewer.persona !== "admin") || !can(viewer, "workspace.settings")) throw new ViewerError("FORBIDDEN");
  if (!(await apiAccessAvailable(viewer.workspace.id))) throw new UserError(API_UPSELL);
  return viewer.workspace.id;
}

function audit(workspaceId: string, userId: string, action: string, targetType: string, targetId: string, data: object) {
  return prisma.auditLog.create({ data: { workspaceId, actorUserId: userId, action, targetType, targetId, data } });
}

/* ------------------------------------------------------------------------- */
/* Keys                                                                      */
/* ------------------------------------------------------------------------- */

export async function listApiKeys(viewer: Viewer) {
  const workspaceId = await manager(viewer);
  return prisma.apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
  });
}

/** Returns the key once; only its hash is kept. */
export async function createApiKey(viewer: Viewer, input: { name: string; scopes: string[]; expiresInDays?: number | null }) {
  const workspaceId = await manager(viewer);
  const scopes = validScopes(input.scopes);
  if (!scopes.length) throw new UserError("Choose what the key may read.");
  const active = await prisma.apiKey.count({ where: { workspaceId, revokedAt: null } });
  if (active >= API_LIMITS.keysPerWorkspace) throw new UserError(`You can have ${API_LIMITS.keysPerWorkspace} active keys. Revoke one first.`);
  const days = input.expiresInDays ?? null;
  if (days != null && (!Number.isInteger(days) || days < 1 || days > 730)) throw new UserError("Keys can last 1 to 730 days, or never expire.");
  const k = newApiKey();
  const row = await prisma.apiKey.create({
    data: { workspaceId, name: input.name.trim().slice(0, 80) || "API key", prefix: k.prefix, hash: k.hash, scopes, createdByUserId: viewer.user.id, expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, expiresAt: true },
  });
  await audit(workspaceId, viewer.user.id, "api.key.create", "ApiKey", row.id, { name: row.name, scopes });
  return { ...row, key: k.key };
}

export async function revokeApiKey(viewer: Viewer, input: { id: string }) {
  const workspaceId = await manager(viewer);
  const r = await prisma.apiKey.updateMany({ where: { id: input.id, workspaceId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count) await audit(workspaceId, viewer.user.id, "api.key.revoke", "ApiKey", input.id, {});
  return { ok: true as const };
}

export type ApiAuth = { ok: true; workspaceId: string; keyId: string; scopes: ApiScope[]; remaining: number; resetSeconds: number } | { ok: false; status: 401 | 403 | 429; error: string; resetSeconds?: number };

/** Authenticates an /api/v1 request: the key, its scope, the plan, and the rate limit (120 a minute per key). */
export async function authenticateApi(authorization: string | null, scope: ApiScope, now: Date = new Date()): Promise<ApiAuth> {
  const key = bearerKey(authorization);
  if (!key) return { ok: false, status: 401, error: "Send your API key as: Authorization: Bearer nexa_live_…" };
  const row = await prisma.apiKey.findUnique({ where: { hash: hashKey(key) }, select: { id: true, workspaceId: true, scopes: true, revokedAt: true, expiresAt: true, minuteStart: true, minuteCount: true } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) return { ok: false, status: 401, error: "This API key isn't valid. It may have been revoked or expired." };
  const scopes = validScopes(row.scopes);
  if (!scopes.includes(scope)) return { ok: false, status: 403, error: `This key can't read that. It needs the "${scope}" permission.` };
  if (!(await apiAccessAvailable(row.workspaceId))) return { ok: false, status: 403, error: API_UPSELL };
  const step = rateStep(row, now);
  await prisma.apiKey.update({ where: { id: row.id }, data: { minuteStart: step.minuteStart, minuteCount: step.minuteCount, lastUsedAt: now } });
  if (!step.ok) return { ok: false, status: 429, error: `Too many requests. The limit is ${API_LIMITS.perMinute} a minute per key.`, resetSeconds: step.resetSeconds };
  return { ok: true, workspaceId: row.workspaceId, keyId: row.id, scopes, remaining: Math.max(0, API_LIMITS.perMinute - step.minuteCount), resetSeconds: step.resetSeconds };
}

/* ------------------------------------------------------------------------- */
/* Webhook endpoints                                                         */
/* ------------------------------------------------------------------------- */

function validEvents(events: string[]): WebhookEvent[] {
  return [...new Set(events)].filter((e): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e));
}

const endpointSelect = { id: true, url: true, description: true, events: true, secretPrefix: true, active: true, createdAt: true, lastSuccessAt: true, failingSince: true, disabledReason: true } as const;

export async function listWebhookEndpoints(viewer: Viewer) {
  const workspaceId = await manager(viewer);
  return prisma.webhookEndpoint.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: endpointSelect });
}

/** Returns the signing secret once. */
export async function createWebhookEndpoint(viewer: Viewer, input: { url: string; events: string[]; description?: string | null }) {
  const workspaceId = await manager(viewer);
  const problem = webhookUrlProblem(input.url);
  if (problem) throw new UserError(problem);
  const events = validEvents(input.events);
  if (!events.length) throw new UserError("Choose at least one event.");
  if ((await prisma.webhookEndpoint.count({ where: { workspaceId } })) >= API_LIMITS.endpointsPerWorkspace) throw new UserError(`You can have ${API_LIMITS.endpointsPerWorkspace} webhook addresses. Remove one first.`);
  const s = newWebhookSecret();
  const row = await prisma.webhookEndpoint.create({
    data: { workspaceId, url: input.url.trim(), description: input.description?.trim().slice(0, 120) || null, events, secretSealed: sealWebhookSecret(s.secret), secretPrefix: s.prefix, createdByUserId: viewer.user.id },
    select: endpointSelect,
  });
  await audit(workspaceId, viewer.user.id, "api.webhook.create", "WebhookEndpoint", row.id, { url: row.url, events });
  return { ...row, secret: s.secret };
}

async function ownEndpoint(workspaceId: string, id: string) {
  const e = await prisma.webhookEndpoint.findUnique({ where: { id }, select: { id: true, workspaceId: true, url: true, secretSealed: true } });
  if (!e || e.workspaceId !== workspaceId) throw new UserError("That webhook no longer exists.");
  return e;
}

/** Changes events, description or on/off. Switching on clears the failure state. */
export async function updateWebhookEndpoint(viewer: Viewer, input: { id: string; events?: string[]; description?: string | null; active?: boolean }) {
  const workspaceId = await manager(viewer);
  await ownEndpoint(workspaceId, input.id);
  const events = input.events ? validEvents(input.events) : undefined;
  if (events && !events.length) throw new UserError("Choose at least one event.");
  const row = await prisma.webhookEndpoint.update({
    where: { id: input.id },
    data: {
      ...(events ? { events } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim().slice(0, 120) || null } : {}),
      ...(input.active !== undefined ? { active: input.active, ...(input.active ? { failingSince: null, disabledReason: null } : {}) } : {}),
    },
    select: endpointSelect,
  });
  await audit(workspaceId, viewer.user.id, "api.webhook.update", "WebhookEndpoint", input.id, { events, active: input.active });
  return row;
}

/** A new signing secret, shown once; the old one stops working at once. */
export async function rotateWebhookSecret(viewer: Viewer, input: { id: string }) {
  const workspaceId = await manager(viewer);
  await ownEndpoint(workspaceId, input.id);
  const s = newWebhookSecret();
  await prisma.webhookEndpoint.update({ where: { id: input.id }, data: { secretSealed: sealWebhookSecret(s.secret), secretPrefix: s.prefix } });
  await audit(workspaceId, viewer.user.id, "api.webhook.rotate", "WebhookEndpoint", input.id, {});
  return { secret: s.secret, secretPrefix: s.prefix };
}

export async function deleteWebhookEndpoint(viewer: Viewer, input: { id: string }) {
  const workspaceId = await manager(viewer);
  await ownEndpoint(workspaceId, input.id);
  await prisma.webhookEndpoint.delete({ where: { id: input.id } });
  await audit(workspaceId, viewer.user.id, "api.webhook.delete", "WebhookEndpoint", input.id, {});
  return { ok: true as const };
}

/** Sends a signed "ping" now and reports what came back. Not queued, not retried. */
export async function testWebhookEndpoint(viewer: Viewer, input: { id: string }) {
  const workspaceId = await manager(viewer);
  const e = await ownEndpoint(workspaceId, input.id);
  const now = new Date();
  const body = JSON.stringify({ id: `evt_test_${now.getTime()}`, type: "ping", created: now.toISOString(), workspace: workspaceId, data: { message: "A test from Nexa." } });
  return postSigned(e.url, openWebhookSecret(e.secretSealed), body, now);
}

export async function listWebhookDeliveries(viewer: Viewer, input: { id: string; limit?: number }) {
  const workspaceId = await manager(viewer);
  await ownEndpoint(workspaceId, input.id);
  return prisma.webhookDelivery.findMany({
    where: { endpointId: input.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    select: { id: true, event: true, status: true, attempts: true, lastStatus: true, lastError: true, createdAt: true, deliveredAt: true, nextAttemptAt: true },
  });
}

/** Queues a failed delivery again, now. */
export async function retryWebhookDelivery(viewer: Viewer, input: { deliveryId: string }) {
  const workspaceId = await manager(viewer);
  const d = await prisma.webhookDelivery.findUnique({ where: { id: input.deliveryId }, select: { status: true, endpoint: { select: { workspaceId: true } } } });
  if (!d || d.endpoint.workspaceId !== workspaceId) throw new UserError("That delivery no longer exists.");
  if (d.status !== "FAILED") throw new UserError("Only failed deliveries can be sent again.");
  await prisma.webhookDelivery.update({ where: { id: input.deliveryId }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null } });
  return { ok: true as const };
}
