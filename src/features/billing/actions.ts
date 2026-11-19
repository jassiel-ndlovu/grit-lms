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
import { createFirstInvoice } from "./invoice";
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
 * Pays an open or overdue invoice: with the saved card if there is one,
 * otherwise through Paystack checkout (the new card is then saved).
 */
export const payPlatformInvoice = viewerActionClient
  .schema(z.object({ invoiceId: z.string().min(1), returnPath: returnPathSchema.default("/dashboard/billing") }))
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
      select: { status: true },
    });
    if (!payment) throw new BillingError("NOT_FOUND", "No payment with that reference");

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
