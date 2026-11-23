"use server";

/**
 * API keys and webhooks, for the workspace settings screen (#216 phase 3,
 * Pro). Owners and admins (`workspace.settings`). Contract: contracts/api.md.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import { API_SCOPES, SCOPE_LABEL, WEBHOOK_EVENTS } from "./api-math";
import * as m from "./manage";

const id = z.string().min(1).max(64);
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
function done<T>(r: T): T {
  revalidatePath("/dashboard", "layout");
  return r;
}

/** The scopes and events to offer, and whether the workspace has API access. */
export const getApiSettings = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => {
  const viewer = v(ctx);
  const available = viewer.workspace ? await m.apiAccessAvailable(viewer.workspace.id) : false;
  return { available, scopes: API_SCOPES.map((s) => ({ key: s, label: SCOPE_LABEL[s] })), events: [...WEBHOOK_EVENTS] };
});

export const listApiKeysAction = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => m.listApiKeys(v(ctx)));

export const createApiKeyAction = writableViewerActionClient
  .schema(z.object({ name: z.string().max(80), scopes: z.array(z.string()).min(1).max(API_SCOPES.length), expiresInDays: z.number().int().nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await m.createApiKey(v(ctx), parsedInput)));

export const revokeApiKeyAction = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => done(await m.revokeApiKey(v(ctx), parsedInput)));

export const listWebhooksAction = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => m.listWebhookEndpoints(v(ctx)));

export const createWebhookAction = writableViewerActionClient
  .schema(z.object({ url: z.string().max(500), events: z.array(z.string()).min(1).max(WEBHOOK_EVENTS.length), description: z.string().max(120).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await m.createWebhookEndpoint(v(ctx), parsedInput)));

export const updateWebhookAction = writableViewerActionClient
  .schema(z.object({ id, events: z.array(z.string()).max(WEBHOOK_EVENTS.length).optional(), description: z.string().max(120).nullable().optional(), active: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await m.updateWebhookEndpoint(v(ctx), parsedInput)));

export const rotateWebhookSecretAction = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => done(await m.rotateWebhookSecret(v(ctx), parsedInput)));

export const deleteWebhookAction = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => done(await m.deleteWebhookEndpoint(v(ctx), parsedInput)));

export const testWebhookAction = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => m.testWebhookEndpoint(v(ctx), parsedInput));

export const listWebhookDeliveriesAction = viewerActionClient
  .schema(z.object({ id, limit: z.number().int().min(1).max(100).optional() }))
  .action(async ({ parsedInput, ctx }) => m.listWebhookDeliveries(v(ctx), parsedInput));

export const retryWebhookDeliveryAction = writableViewerActionClient
  .schema(z.object({ deliveryId: id }))
  .action(async ({ parsedInput, ctx }) => done(await m.retryWebhookDelivery(v(ctx), parsedInput)));
