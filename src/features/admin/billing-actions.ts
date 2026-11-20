"use server";

/**
 * Nexa admin billing actions (docs/revamp/contracts/billing.md, section 4).
 * Each needs the Nexa admin persona and `admin.override`, takes a note or
 * reason, and writes an AuditLog row (./billing-overrides.ts).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { can } from "@/lib/viewer-core";
import { ViewerError } from "@/lib/viewer";
import { adminActionClient } from "@/lib/safe-action";

import * as o from "./billing-overrides";

const note = z.string().trim().min(3).max(500);
const id = z.string().min(1).max(64);
const tier = z.enum(["CORE", "PLUS", "PRO"]);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Must be a date");

// next-safe-action's ctx carries the viewer for the admin client.
type Ctx = { viewer: { user: { id: string }; impersonatedBy: { userId: string } | null } & Parameters<typeof can>[0] };

function actor(ctx: Ctx): o.Actor {
  if (!can(ctx.viewer, "admin.override")) throw new ViewerError("FORBIDDEN");
  return { userId: ctx.viewer.user.id, impersonatorUserId: ctx.viewer.impersonatedBy?.userId ?? null };
}

function done<T>(r: T): T {
  revalidatePath("/dashboard/admin", "layout");
  return r;
}

export const adminExtendTrial = adminActionClient
  .schema(z.object({ workspaceId: id, days: z.number().int().min(1).max(90), note }))
  .action(async ({ parsedInput, ctx }) => done(await o.extendTrial(actor(ctx as Ctx), parsedInput)));

export const adminSetComp = adminActionClient
  .schema(z.object({ workspaceId: id, until: isoDate.nullable(), note, end: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await o.setComp(actor(ctx as Ctx), parsedInput)));

export const adminOverrideCourseTier = adminActionClient
  .schema(z.object({ courseId: id, tierKey: tier.nullable(), until: isoDate.nullable().optional(), note }))
  .action(async ({ parsedInput, ctx }) => done(await o.overrideCourseTier(actor(ctx as Ctx), parsedInput)));

export const adminIssueCreditNote = adminActionClient
  .schema(z.object({ workspaceId: id, amountCents: z.number().int().positive().max(100_000_000), reason: note }))
  .action(async ({ parsedInput, ctx }) => done(await o.issueCreditNote(actor(ctx as Ctx), parsedInput)));

export const adminVoidPlatformInvoice = adminActionClient
  .schema(z.object({ invoiceId: id, note }))
  .action(async ({ parsedInput, ctx }) => done(await o.voidPlatformInvoice(actor(ctx as Ctx), parsedInput)));

export const adminMarkPaidOffsite = adminActionClient
  .schema(z.object({
    platformInvoiceId: id,
    method: z.enum(["CASH", "EFT", "OTHER"]),
    amountCents: z.number().int().positive(),
    receivedOn: isoDate,
    reference: z.string().max(120).nullable().optional(),
    note,
  }))
  .action(async ({ parsedInput, ctx }) => done(await o.markPaidOffsite(actor(ctx as Ctx), parsedInput)));

export const adminRefundPayment = adminActionClient
  .schema(z.object({ paymentId: id, amountCents: z.number().int().positive().optional(), reason: note }))
  .action(async ({ parsedInput, ctx }) => done(await o.refundPayment(actor(ctx as Ctx), parsedInput)));

export const adminRefundFeeInvoice = adminActionClient
  .schema(z.object({ invoiceId: id, amountCents: z.number().int().positive().optional(), reason: note }))
  .action(async ({ parsedInput, ctx }) => done(await o.refundFeeInvoice(actor(ctx as Ctx), parsedInput)));

export const adminWaiveRecovery = adminActionClient
  .schema(z.object({ recoveryId: id, note }))
  .action(async ({ parsedInput, ctx }) => done(await o.waiveRecovery(actor(ctx as Ctx), parsedInput)));

export const adminHoldRecovery = adminActionClient
  .schema(z.object({ recoveryId: id, until: isoDate, note }))
  .action(async ({ parsedInput, ctx }) => done(await o.holdRecovery(actor(ctx as Ctx), parsedInput)));

export const adminSettleRecoveryOffsite = adminActionClient
  .schema(z.object({ recoveryId: id, note }))
  .action(async ({ parsedInput, ctx }) => done(await o.settleRecoveryOffsite(actor(ctx as Ctx), parsedInput)));

export const adminCreateDiscountCode = adminActionClient
  .schema(z.object({
    code: z.string().min(3).max(32),
    description: z.string().trim().min(1).max(200),
    kind: z.enum(["PERCENT", "FIXED"]),
    percentBps: z.number().int().min(1).max(10_000).nullable().optional(),
    amountCents: z.number().int().positive().nullable().optional(),
    scope: z.enum(["WORKSPACE_BILL", "TIER", "ADDON"]),
    scopeTierKey: tier.nullable().optional(),
    scopeServiceKey: z.string().max(64).nullable().optional(),
    startsAt: isoDate,
    endsAt: isoDate.nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    durationPeriods: z.number().int().positive().nullable().optional(),
  }))
  .action(async ({ parsedInput, ctx }) => done(await o.createDiscountCode(actor(ctx as Ctx), parsedInput)));

export const adminDeactivateDiscountCode = adminActionClient
  .schema(z.object({ id, note }))
  .action(async ({ parsedInput, ctx }) => done(await o.deactivateDiscountCode(actor(ctx as Ctx), parsedInput)));
