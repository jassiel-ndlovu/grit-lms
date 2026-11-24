"use server";

/**
 * AI credit top-ups (#216; owner decisions 24 Nov). Contract: billing.md,
 * "AI credit top-ups". Behind BILLING=1 (January).
 *
 *   getTopupOffer          the packs, priced now
 *   startTopupAction       organisation (billing.manage), adult paying student, or parent for a child
 *   getTopupStatus         for the return page; settles it if Paystack has
 *   getMyStudyCredits      a student's (or a child's) study credits
 */

import { headers } from "next/headers";
import { z } from "zod";

import { assertBillingEnabled, BillingError } from "@/features/billing/errors";
import { settlePayment } from "@/features/payments/settle";
import { safeReturnPath } from "@/features/payments/settlement-rules";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import { myStudyCredits, startTopup, topupOffer, topupStatusFor } from "./topups";

const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
const forWhom = z.enum(["WORKSPACE", "STUDENT"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new BillingError("PROVIDER_ERROR", "No host header");
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

export const getTopupOffer = viewerActionClient.schema(z.object({ forWhom })).action(async ({ parsedInput }) => topupOffer(parsedInput.forWhom));

export const startTopupAction = writableViewerActionClient
  .schema(z.object({
    forWhom,
    priceCents: z.number().int().positive(),
    studentUserId: z.string().min(1).max(64).optional(),
    workspaceId: z.string().min(1).max(64).optional(),
    returnPath: z.string().max(512).default("/dashboard/credits/return"),
  }))
  .action(async ({ parsedInput, ctx }) => {
    assertBillingEnabled();
    const path = safeReturnPath(parsedInput.returnPath);
    if (!path) throw new BillingError("FORBIDDEN", "returnPath must be a same-site path");
    return startTopup(v(ctx), { ...parsedInput, callbackUrl: `${await origin()}${path}` });
  });

export const getTopupStatus = viewerActionClient
  .schema(z.object({ reference: z.string().min(1).max(128) }))
  .action(async ({ parsedInput: { reference }, ctx }) => {
    assertBillingEnabled();
    const viewer = v(ctx);
    const before = await topupStatusFor(viewer.user.id, reference);
    if (before.status !== "PENDING") return before;
    try {
      await settlePayment(reference);
    } catch (e) {
      console.error("[ai-credits] top-up status check failed:", (e as Error).message);
    }
    return topupStatusFor(viewer.user.id, reference);
  });

export const getMyStudyCredits = viewerActionClient
  .schema(z.object({ studentUserId: z.string().min(1).max(64).optional(), workspaceId: z.string().min(1).max(64).optional() }))
  .action(async ({ parsedInput, ctx }) => myStudyCredits(v(ctx), parsedInput));
