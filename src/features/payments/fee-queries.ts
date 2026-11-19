/**
 * Gate 2 tutor-side queries (contract section 3). Server only, behind
 * BILLING=1.
 */

import "server-only";

import { assertBillingEnabled } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { requireViewer, ViewerError } from "@/lib/viewer";
import { can, needsScope } from "@/lib/viewer-core";

import { listPayableInvoicesFor } from "./checkout";
import { listFeeInvoicesFor, payoutSettingsFor } from "./fees";
import { getProvider } from "./provider";

export async function getPayoutSettings() {
  assertBillingEnabled();
  const viewer = await requireViewer({ workspace: true });
  if (!can(viewer, "payouts.connect") && !can(viewer, "fees.manage")) throw new ViewerError("FORBIDDEN");
  return payoutSettingsFor(viewer.workspace!.id);
}

/** South African banks Paystack can pay out to. */
export async function listBanks() {
  assertBillingEnabled();
  await requireViewer({ workspace: true });
  return getProvider().listBanks();
}

/** A tutor sees invoices for the courses they teach; owners and admins see all. */
export async function listFeeInvoices(input: { courseId?: string; learnerId?: string; status?: "OPEN" | "PAID" | "VOID" | "REFUNDED" | "PARTIALLY_REFUNDED"; cursor?: string } = {}) {
  assertBillingEnabled();
  const viewer = await requireViewer({ permission: "fees.manage", workspace: true });
  let courseIds: string[] | undefined;
  if (needsScope(viewer, "fees.manage")) {
    const membershipId = viewer.membership?.id;
    const rows = await prisma.course.findMany({
      where: { workspaceId: viewer.workspace!.id, OR: [{ ownerMembershipId: membershipId }, { staff: { some: { membershipId } } }] },
      select: { id: true },
    });
    courseIds = rows.map((r) => r.id);
    if (input.courseId && !courseIds.includes(input.courseId)) throw new ViewerError("FORBIDDEN");
  }
  return listFeeInvoicesFor(viewer.workspace!.id, { ...input, courseIds });
}

/** Invoices a guardian (their children's) or an adult student (their own) may pay. */
export async function listPayableInvoices(input: { status?: "OPEN" | "PAID" } = {}) {
  assertBillingEnabled();
  const viewer = await requireViewer();
  const childUserIds = can(viewer, "fees.pay") ? viewer.children.map((c) => c.userId) : [];
  const selfVisible = viewer.learner?.paymentVisible === true;
  if (childUserIds.length === 0 && !selfVisible) throw new ViewerError("FORBIDDEN");
  return listPayableInvoicesFor({ userId: viewer.user.id, email: viewer.user.email, childUserIds, selfVisible }, input);
}
