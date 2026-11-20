/**
 * What the home page's "Finish setting up" list shows (a/ux/01, section 4),
 * worked out from the workspace itself until A's getOnboarding exists.
 * Only for someone who runs a workspace in its trial. Server only.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { getPayoutSettings } from "@/features/payments/fee-queries";
import { placeholderName } from "@/features/workspaces/onboarding";
import { prisma } from "@/lib/db";
import { can, type Viewer } from "@/lib/viewer";

import { checklist } from "./lib/onboarding-ui";

export async function setupChecklistFor(viewer: Viewer | null) {
  if (!viewer || !isBillingEnabled()) return null;
  const ws = viewer.workspace;
  if (!ws || ws.billingState !== "TRIAL" || !can(viewer, "workspace.settings")) return null;
  const connects = can(viewer, "payouts.connect");
  const [courses, payouts] = await Promise.all([
    prisma.course.count({ where: { workspaceId: ws.id } }),
    connects ? getPayoutSettings().catch(() => null) : Promise.resolve(null),
  ]);
  const list = checklist({
    named: ws.name !== placeholderName(viewer.user.name, ws.kind),
    hasCourse: courses > 0,
    payouts: !connects ? "not-mine" : payouts?.accounts.some((a) => a.status !== "DISABLED") ? "done" : "todo",
  });
  return { workspaceId: ws.id, items: list.items };
}
