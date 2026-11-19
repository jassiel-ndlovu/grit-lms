"use server";

/**
 * Parent checkout actions (contract section 2). The payer is a guardian
 * (their children's invoices) or an adult student allowed to see their own
 * fees. Behind BILLING=1.
 */

import { headers } from "next/headers";
import { z } from "zod";

import { assertBillingEnabled, BillingError } from "@/features/billing/errors";
import { safeReturnPath } from "@/features/payments/settlement-rules";
import { viewerActionClient } from "@/lib/safe-action";
import { requireViewer, ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { checkoutStatusFor, startCheckoutFor, type Payer } from "./checkout";
import { settlePayment } from "./settle";

function payerOf(viewer: Viewer): Payer {
  const childUserIds = viewer.children.map((c) => c.userId);
  const selfVisible = viewer.learner?.paymentVisible === true;
  if (!(childUserIds.length > 0 && can(viewer, "fees.pay")) && !selfVisible) throw new ViewerError("FORBIDDEN");
  return { userId: viewer.user.id, email: viewer.user.email, childUserIds: can(viewer, "fees.pay") ? childUserIds : [], selfVisible };
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new BillingError("PROVIDER_ERROR", "No host header");
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

export const startCheckout = viewerActionClient
  .schema(z.object({
    invoiceIds: z.array(z.string().min(1)).min(1).max(30),
    discountCode: z.string().max(64).optional(),
    returnPath: z.string().max(512).default("/dashboard/fees/return"),
  }))
  .action(async ({ parsedInput }) => {
    assertBillingEnabled();
    const viewer = await requireViewer();
    const path = safeReturnPath(parsedInput.returnPath);
    if (!path) throw new BillingError("FORBIDDEN", "returnPath must be a same-site path");
    return startCheckoutFor(payerOf(viewer), { invoiceIds: parsedInput.invoiceIds, discountCode: parsedInput.discountCode, callbackUrl: `${await origin()}${path}` });
  });

/** For the return page's poll: asks Paystack while the payment is pending, so it settles even if the webhook is late. */
export const getCheckoutStatus = viewerActionClient
  .schema(z.object({ reference: z.string().min(1).max(128) }))
  .action(async ({ parsedInput: { reference } }) => {
    assertBillingEnabled();
    const viewer = await requireViewer();
    const before = await checkoutStatusFor(viewer.user.id, reference);
    if (before.status === "PENDING") {
      try {
        await settlePayment(reference);
      } catch (e) {
        console.error("[payments] checkout status check failed:", (e as Error).message);
      }
      return checkoutStatusFor(viewer.user.id, reference);
    }
    return before;
  });
