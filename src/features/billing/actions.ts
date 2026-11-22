"use server";

/**
 * Billing actions (docs/revamp/contracts/billing.md, section 1). Behind the
 * BILLING flag. Built here: setCourseServices, startFirstPayment,
 * payPlatformInvoice, getBillingPaymentStatus, startCardReplacement.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getProvider } from "@/features/payments/provider";
import { settlePayment } from "@/features/payments/settle";
import { safeReturnPath } from "@/features/payments/settlement-rules";
import { prisma } from "@/lib/db";
import { viewerActionClient } from "@/lib/safe-action";
import { requireViewer } from "@/lib/viewer";

import { chargeSavedCard, createInvoicePayment } from "./charge";
import { assertBillingEnabled, BillingError } from "./errors";
import { loadOpenPeriod } from "./data";
import { createFirstInvoice } from "./invoice";
import { capStatuses } from "./queries";
import { restartWorkspaceFor } from "./restart";
import { addDays, applyServiceChange, billedTier, derivedTier, holdUntilFor, tierAbove } from "./pricing";
import { assertSwitchable, loadServiceChangeContext, requireCourseServicesAccess } from "./queries";

const keyList = z.array(z.string().min(1).max(64)).max(32);

export const setCourseServices = viewerActionClient
  .schema(z.object({ courseId: z.string().min(1), enable: keyList.default([]), disable: keyList.default([]) }))
  .action(async ({ parsedInput: { courseId, enable, disable } }) => {
    const { viewer, course } = await requireCourseServicesAccess(courseId);
    assertSwitchable([...enable, ...disable]);
    const ws = viewer.workspace!;
    const state = ws.billingState;
    if (state === "READ_ONLY" || state === "CANCELLED" || ws.readOnly) {
      throw new BillingError("READ_ONLY", "The workspace is read-only until the bill is paid");
    }

    const now = new Date();
    const before = derivedTier(course.enabledKeys);
    const after = derivedTier(applyServiceChange(course.enabledKeys, enable, disable));
    const billedNow = billedTier({ derived: before, holds: course.holds, override: course.override, at: now });
    if (state === "PAST_DUE" && tierAbove(after, billedNow)) {
      throw new BillingError("PAST_DUE", "Pay the overdue bill before raising a course's tier");
    }

    const ctx = await loadServiceChangeContext(course, state, now);
    const raised = !ctx.inTrial && tierAbove(after, before);
    const newHold = raised ? { tierKey: after, raisedAt: now, holdUntil: addDays(now, ctx.holdDays) } : null;

    await prisma.$transaction(async (tx) => {
      const rows = [
        ...enable.map((k) => ({ key: k, enabled: true })),
        ...disable.filter((k) => !enable.includes(k)).map((k) => ({ key: k, enabled: false })),
      ];
      for (const r of rows) {
        await tx.courseService.upsert({
          where: { courseId_serviceKey: { courseId, serviceKey: r.key } },
          create: {
            workspaceId: course.workspaceId, courseId, serviceKey: r.key, enabled: r.enabled,
            changedAt: now, changedByUserId: viewer.user.id,
          },
          update: { enabled: r.enabled, changedAt: now, changedByUserId: viewer.user.id },
        });
      }
      if (newHold) {
        await tx.courseTierHold.create({
          data: { workspaceId: course.workspaceId, courseId, raisedByUserId: viewer.user.id, ...newHold },
        });
      }
      await tx.auditLog.create({
        data: {
          workspaceId: course.workspaceId,
          actorUserId: viewer.user.id,
          impersonatorUserId: viewer.impersonatedBy?.userId ?? null,
          action: "billing.services.set",
          targetType: "Course",
          targetId: courseId,
          data: { enable, disable, derivedBefore: before, derivedAfter: after, holdUntil: newHold?.holdUntil.toISOString() ?? null },
        },
      });
    });

    const holds = newHold ? [...course.holds, newHold] : course.holds;
    const billed = billedTier({ derived: after, holds, override: course.override, at: now });
    revalidatePath("/dashboard", "layout");
    return {
      derivedTierKey: after,
      billedTierKey: billed,
      holdUntil: holdUntilFor({ billed, holds, at: now })?.toISOString() ?? null,
    };
  });

/* ------------------------------------------------------------------------- */
/* Payments (Gate 1): design 04, section 4                                    */
/* ------------------------------------------------------------------------- */

async function billingManager() {
  assertBillingEnabled();
  const viewer = await requireViewer({ permission: "billing.manage", workspace: true });
  return { viewer, workspace: viewer.workspace! };
}

/** This deployment's origin, for Paystack's callback (Preview URLs differ per deploy). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new BillingError("PROVIDER_ERROR", "No host header");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The workspace's Paystack customer, created on first use. */
async function ensureProviderCustomer(workspaceId: string, email: string, name: string): Promise<string> {
  const existing = await prisma.providerCustomer.findFirst({
    where: { provider: "PAYSTACK", ownerType: "WORKSPACE", workspaceId, userId: null },
    select: { customerCode: true },
  });
  if (existing) return existing.customerCode;
  const { customerCode } = await getProvider().createCustomer({ email, name, metadata: { workspaceId } });
  await prisma.providerCustomer.create({
    data: { provider: "PAYSTACK", ownerType: "WORKSPACE", workspaceId, customerCode, email },
  });
  return customerCode;
}

/** Payment row plus Paystack checkout for an open invoice; card only. */
async function checkoutInvoice(input: {
  invoice: { id: string; totalCents: number };
  workspaceId: string;
  userId: string;
  email: string;
  returnPath: string;
}) {
  const reference = await createInvoicePayment(input);
  try {
    const { authorizationUrl } = await getProvider().initializeCheckout({
      reference,
      email: input.email,
      amountCents: input.invoice.totalCents,
      callbackUrl: `${await requestOrigin()}${input.returnPath}`,
      channels: ["card"],
      metadata: { workspaceId: input.workspaceId, invoiceId: input.invoice.id, purpose: "PLATFORM_INVOICE" },
    });
    return { authorizationUrl, reference };
  } catch (e) {
    await prisma.payment.update({ where: { reference }, data: { status: "FAILED" } });
    throw e;
  }
}

const returnPathSchema = z.string().min(1).max(512).refine((p) => safeReturnPath(p) !== null, "Must be a same-site path");

/**
 * Ends the trial (or a READ_ONLY or CANCELLED spell): invoices 30 days of
 * seats in advance and sends the owner to Paystack. The webhook, or the
 * return page's status poll, applies the payment.
 */
export const startFirstPayment = viewerActionClient
  .schema(z.object({ returnPath: returnPathSchema }))
  .action(async ({ parsedInput: { returnPath } }) => {
    const { viewer, workspace } = await billingManager();
    if (!["TRIAL", "READ_ONLY", "CANCELLED"].includes(workspace.billingState)) {
      throw new BillingError("FORBIDDEN", `No first payment in state ${workspace.billingState}`);
    }
    const customerCode = await ensureProviderCustomer(workspace.id, viewer.user.email, workspace.name);
    await prisma.subscription.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, billingEmail: viewer.user.email, providerCustomerCode: customerCode },
      update: { providerCustomerCode: customerCode },
    });

    const invoice = await createFirstInvoice(workspace.id);
    if (invoice.totalCents <= 0) {
      await prisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
      throw new BillingError("NOTHING_TO_BILL", "No learners are enrolled yet");
    }
    const { authorizationUrl, reference } = await checkoutInvoice({
      invoice, workspaceId: workspace.id, userId: viewer.user.id, email: viewer.user.email, returnPath,
    });
    return { authorizationUrl, reference, amountCents: invoice.totalCents };
  });

/**
 * Restarts a cancelled or read-only workspace (#191). Returns the next step:
 * PAY_OUTSTANDING (invoiceIds), PAY_FIRST_PERIOD (call startFirstPayment),
 * CARD_REQUIRED (call startCardReplacement, then this again) or RESTARTED.
 */
export const restartWorkspace = viewerActionClient
  .schema(z.object({}))
  .action(async () => {
    const { viewer, workspace } = await billingManager();
    const r = await restartWorkspaceFor(workspace.id, viewer.user.id);
    if (r.status === "RESTARTED") revalidatePath("/", "layout");
    return r;
  });

/**
 * Pays an open or overdue invoice: with the saved card if there is one,
 * otherwise through Paystack checkout (the new card is then saved).
 */
export const payPlatformInvoice = viewerActionClient
  .schema(z.object({ invoiceId: z.string().min(1), returnPath: returnPathSchema.default("/dashboard/settings/billing") }))
  .action(async ({ parsedInput: { invoiceId, returnPath } }) => {
    const { viewer, workspace } = await billingManager();
    const invoice = await prisma.platformInvoice.findFirst({
      where: { id: invoiceId, workspaceId: workspace.id, status: { in: ["OPEN", "PAST_DUE"] } },
      select: { id: true, totalCents: true },
    });
    if (!invoice) throw new BillingError("NOT_FOUND", "No open invoice with that id");
    if (invoice.totalCents <= 0) throw new BillingError("NOTHING_TO_BILL", "The invoice total is zero");

    const charged = await chargeSavedCard({ invoice, workspaceId: workspace.id, userId: viewer.user.id });
    if (charged.status === "SUCCEEDED") {
      revalidatePath("/dashboard", "layout");
      return { status: "CHARGED" as const };
    }
    // Still processing: the return page polls this reference.
    if (charged.status === "PENDING") return { status: "PENDING" as const, reference: charged.reference };
    // No saved card, or it was declined: checkout with a new card.

    const { authorizationUrl, reference } = await checkoutInvoice({
      invoice, workspaceId: workspace.id, userId: viewer.user.id, email: viewer.user.email, returnPath,
    });
    return { status: "REDIRECT" as const, authorizationUrl, reference };
  });

/**
 * For the return page's poll. Asks Paystack directly while the payment is
 * pending, so the page settles even if the webhook is late or (on Preview)
 * points at another deployment.
 */
export const getBillingPaymentStatus = viewerActionClient
  .schema(z.object({ reference: z.string().min(1).max(128) }))
  .action(async ({ parsedInput: { reference } }) => {
    const { workspace } = await billingManager();
    const payment = await prisma.payment.findFirst({
      where: { reference, workspaceId: workspace.id },
      select: { status: true, purpose: true },
    });
    if (!payment) throw new BillingError("NOT_FOUND", "No payment with that reference");
    // CARD (a refunded R10 card check) or INVOICE, so the return page can word it.
    const purpose = payment.purpose === "CARD_AUTHORISATION" ? ("CARD" as const) : ("INVOICE" as const);

    let status: string = payment.status;
    if (status === "PENDING") {
      try {
        status = (await settlePayment(reference)).status;
      } catch (e) {
        console.error("[billing] payment status check failed:", (e as Error).message);
      }
    }
    // A card check is refunded straight after it succeeds; that still counts as success.
    const succeeded = status === "SUCCEEDED" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED";
    if (succeeded) revalidatePath("/dashboard", "layout");
    return {
      status: succeeded ? ("SUCCEEDED" as const) : status === "PENDING" ? ("PENDING" as const) : ("FAILED" as const),
      purpose,
    };
  });

/** R10, refunded as soon as it succeeds (design 04, section 4). */
const CARD_CHECK_CENTS = 1_000;

/**
 * Saves a new card without paying an invoice: a R10 card check through
 * Paystack checkout, refunded once it succeeds. Poll getBillingPaymentStatus
 * on the return page as for a payment.
 */
export const startCardReplacement = viewerActionClient
  .schema(z.object({ returnPath: returnPathSchema }))
  .action(async ({ parsedInput: { returnPath } }) => {
    const { viewer, workspace } = await billingManager();
    const customerCode = await ensureProviderCustomer(workspace.id, viewer.user.email, workspace.name);
    await prisma.subscription.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, billingEmail: viewer.user.email, providerCustomerCode: customerCode },
      update: { providerCustomerCode: customerCode },
    });
    const reference = `nx-card-${workspace.id}-${Date.now().toString(36)}`;
    await prisma.payment.create({
      data: {
        provider: "PAYSTACK", reference, purpose: "CARD_AUTHORISATION", workspaceId: workspace.id,
        payerUserId: viewer.user.id, amountCents: CARD_CHECK_CENTS,
      },
    });
    try {
      const { authorizationUrl } = await getProvider().initializeCheckout({
        reference,
        email: viewer.user.email,
        amountCents: CARD_CHECK_CENTS,
        callbackUrl: `${await requestOrigin()}${returnPath}`,
        channels: ["card"],
        metadata: { workspaceId: workspace.id, purpose: "CARD_AUTHORISATION" },
      });
      return { authorizationUrl, reference };
    } catch (e) {
      await prisma.payment.update({ where: { reference }, data: { status: "FAILED" } });
      throw e;
    }
  });

/**
 * Applies a Nexa discount code to the workspace's bills (design 03,
 * section 8). One WORKSPACE_BILL code at a time; each code once per
 * workspace. It is used from the next invoice; a period is counted when
 * an invoice that used it is paid.
 */
export const redeemDiscountCode = viewerActionClient
  .schema(z.object({ code: z.string().trim().min(1).max(64) }))
  .action(async ({ parsedInput }) => {
    const { workspace } = await billingManager();
    const now = new Date();
    const code = await prisma.discountCode.findUnique({ where: { code: parsedInput.code.toUpperCase() } });
    if (!code || !code.active || code.issuerWorkspaceId || code.scope === "PARENT_INVOICE") {
      throw new BillingError("CODE_INVALID", "That code isn't valid for Nexa bills");
    }
    if (code.startsAt > now || (code.endsAt && code.endsAt <= now)) throw new BillingError("CODE_EXPIRED", "That code has expired");
    const redeemerKey = `ws:${workspace.id}`;
    if (await prisma.redemption.findUnique({ where: { discountCodeId_redeemerKey: { discountCodeId: code.id, redeemerKey } } })) {
      throw new BillingError("CODE_USED", "This workspace has already used that code");
    }
    if (code.scope === "WORKSPACE_BILL") {
      const other = await prisma.redemption.count({
        where: { workspaceId: workspace.id, exhaustedAt: null, discountCode: { scope: "WORKSPACE_BILL", active: true } },
      });
      if (other > 0) throw new BillingError("CODE_USED", "Another whole-bill discount is already running");
    }

    await prisma.$transaction(async (tx) => {
      // Counts the redemption only while there is room, so two workspaces
      // racing for the last use can't both get it.
      const room = await tx.discountCode.updateMany({
        where: { id: code.id, ...(code.maxRedemptions != null ? { redemptionCount: { lt: code.maxRedemptions } } : {}) },
        data: { redemptionCount: { increment: 1 } },
      });
      if (room.count === 0) throw new BillingError("CODE_USED", "That code has been used up");
      await tx.redemption.create({ data: { discountCodeId: code.id, redeemerKey, workspaceId: workspace.id } });
    });
    revalidatePath("/dashboard", "layout");
    return { description: code.description, scope: code.scope, periodsLeft: code.durationPeriods };
  });

const CAP_METERS = { "active-students": "ACTIVE_STUDENTS", "ai-marks": "AI_MARKS", "storage-gb": "STORAGE_MB", "api-pass-through": "API_REQUESTS", "live-room-minutes": "LIVE_ROOM_MINUTES" } as const;

/**
 * The owner's own limit on a meter for each period (design 03, section 8).
 * `limitQuantity: null` removes it. Storage is set in GB and stored in MB.
 * Returns the CapStatus the usage page shows, or null once removed. Trial
 * and Nexa-admin caps are separate rows and are not touched.
 */
export const setUsageCap = viewerActionClient
  .schema(z.object({
    meter: z.enum(["active-students", "ai-marks", "storage-gb", "api-pass-through", "live-room-minutes"]),
    limitQuantity: z.number().int().positive().max(10_000_000).nullable(),
    hardStop: z.boolean().default(true),
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspace } = await billingManager();
    const meter = CAP_METERS[parsedInput.meter];
    const where = { workspaceId_meter_source: { workspaceId: workspace.id, meter, source: "TUTOR" as const } };
    await prisma.$transaction(async (tx) => {
      if (parsedInput.limitQuantity == null) {
        await tx.usageCap.deleteMany({ where: { workspaceId: workspace.id, meter, source: "TUTOR" } });
      } else {
        const limit = meter === "STORAGE_MB" ? parsedInput.limitQuantity * 1024 : parsedInput.limitQuantity;
        await tx.usageCap.upsert({
          where,
          create: { workspaceId: workspace.id, meter, limitQuantity: limit, hardStop: parsedInput.hardStop, source: "TUTOR" },
          update: { limitQuantity: limit, hardStop: parsedInput.hardStop, notifiedLevel: 0, notifiedPeriodStart: null },
        });
      }
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id, actorUserId: viewer.user.id, impersonatorUserId: viewer.impersonatedBy?.userId ?? null,
          action: "billing.cap.set", targetType: "Workspace", targetId: workspace.id,
          data: { meter: parsedInput.meter, limitQuantity: parsedInput.limitQuantity, hardStop: parsedInput.hardStop },
        },
      });
    });
    revalidatePath("/dashboard", "layout");
    if (parsedInput.limitQuantity == null) return null;
    const period = await loadOpenPeriod(workspace.id, new Date());
    const caps = await capStatuses(workspace.id, period?.start ?? new Date(Date.now() - 30 * 864e5), meter);
    return caps.find((c) => c.source === "TUTOR") ?? null;
  });
