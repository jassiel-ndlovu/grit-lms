"use server";

/**
 * Help and contact centre actions (owner 24 Nov). Contract:
 * docs/revamp/contracts/support.md, "Actions".
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { actionClient, viewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import {
  getQuery,
  getQueryByToken,
  helpContext,
  listInbox,
  listMyQueries,
  moveQuery,
  rateAnswer,
  replyByToken,
  replyToQuery,
  setQueryStatus,
  submitPublicQuery,
  submitQuery,
} from "./support";
import { publicQuerySchema, querySchema, replySchema, SUPPORT_ROUTES, SUPPORT_STATUSES, SUPPORT_TOPICS } from "./support-rules";

const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
const id = z.string().min(1).max(64);
const token = z.string().min(32).max(64);

async function requestMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim(),
    userAgent: h.get("user-agent"),
  };
}

const refresh = (queryId?: string) => {
  revalidatePath("/dashboard/help");
  if (queryId) revalidatePath(`/dashboard/help/${queryId}`);
};

export const getHelpContext = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => helpContext(v(ctx)));

export const submitQueryAction = viewerActionClient.schema(querySchema).action(async ({ parsedInput, ctx }) => {
  const out = await submitQuery(v(ctx), parsedInput, { userAgent: (await requestMeta()).userAgent });
  refresh();
  return out;
});

export const submitPublicQueryAction = actionClient.schema(publicQuerySchema).action(async ({ parsedInput }) => {
  const meta = await requestMeta();
  return submitPublicQuery(parsedInput, meta.ip, { userAgent: meta.userAgent });
});

export const listMyQueriesAction = viewerActionClient
  .schema(z.object({ status: z.enum(SUPPORT_STATUSES).optional() }))
  .action(async ({ parsedInput, ctx }) => listMyQueries(v(ctx), parsedInput));

export const getQueryAction = viewerActionClient.schema(z.object({ id })).action(async ({ parsedInput, ctx }) => getQuery(v(ctx), parsedInput.id));

export const replyToQueryAction = viewerActionClient.schema(replySchema).action(async ({ parsedInput, ctx }) => {
  const msg = await replyToQuery(v(ctx), parsedInput);
  refresh(parsedInput.id);
  return msg;
});

export const setQueryStatusAction = viewerActionClient
  .schema(z.object({ id, status: z.enum(SUPPORT_STATUSES) }))
  .action(async ({ parsedInput, ctx }) => {
    const out = await setQueryStatus(v(ctx), parsedInput);
    refresh(parsedInput.id);
    return out;
  });

export const rateAnswerAction = viewerActionClient
  .schema(z.object({ id, helpful: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => rateAnswer(v(ctx), parsedInput));

export const listInboxAction = viewerActionClient
  .schema(z.object({ route: z.enum(SUPPORT_ROUTES), status: z.enum(SUPPORT_STATUSES).optional(), topic: z.enum(SUPPORT_TOPICS).optional(), cursor: z.string().max(64).optional(), limit: z.number().int().min(1).max(100).optional() }))
  .action(async ({ parsedInput, ctx }) => listInbox(v(ctx), parsedInput));

export const moveQueryAction = viewerActionClient
  .schema(z.object({ id, route: z.enum(SUPPORT_ROUTES), workspaceId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const out = await moveQuery(v(ctx), parsedInput);
    refresh(parsedInput.id);
    return out;
  });

/* The public requester, through the private link in their email. */

export const getPublicQueryAction = actionClient.schema(z.object({ token })).action(async ({ parsedInput }) => getQueryByToken(parsedInput.token));

export const replyByTokenAction = actionClient
  .schema(z.object({ token, body: replySchema.shape.body }))
  .action(async ({ parsedInput }) => replyByToken(parsedInput.token, { body: parsedInput.body }));
