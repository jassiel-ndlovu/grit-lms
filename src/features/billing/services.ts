/**
 * hasService (docs/revamp/contracts/services.md, "API" and "Rules").
 * Server only. The static catalogue is re-exported for clients from
 * ./catalogue.ts.
 *
 * With BILLING off (production today) every v1 key is on and parked or
 * later keys are off, so gating a feature with hasService changes nothing
 * until billing ships.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import type { Viewer } from "@/lib/viewer";

import { SERVICES, isServiceKey, type ServiceKey } from "./catalogue";
import { loadCourseBilling } from "./data";
import { isBillingEnabled } from "./errors";
import { addDays } from "./pricing";

export { SERVICES, type ServiceInfo, type ServiceKey, type Tier } from "./catalogue";

function viewerSeesWorkspace(viewer: Viewer, workspaceId: string): boolean {
  return (
    viewer.workspace?.id === workspaceId ||
    viewer.workspaces.some((w) => w.id === workspaceId) ||
    viewer.children.some((c) => c.workspaces.some((w) => w.id === workspaceId))
  );
}

/** Hard-stop caps reached this period, per workspace and meter. Cached per request. */
const capReached = cache(async (workspaceId: string, meter: "AI_MARKS" | "API_REQUESTS"): Promise<boolean> => {
  const cap = await prisma.usageCap.findFirst({
    where: { workspaceId, meter, hardStop: true },
    orderBy: { limitQuantity: "asc" },
  });
  if (!cap) return false;
  const now = new Date();
  const period = await prisma.billingPeriod.findFirst({
    where: { workspaceId, start: { lte: now }, end: { gt: now } },
    select: { start: true },
  });
  const from = period?.start ?? addDays(now, -30);
  const used = await prisma.usageRecord.aggregate({
    where: { workspaceId, meter, day: { gte: from } },
    _sum: { quantity: true },
  });
  return (used._sum.quantity ?? 0) >= cap.limitQuantity;
});

/**
 * True when the service is usable on this course for this viewer right now.
 * Never throws for a missing course: returns false. Does not check
 * READ_ONLY (rule 5): it answers "is the feature on".
 */
export async function hasService(viewer: Viewer, courseId: string, key: ServiceKey): Promise<boolean> {
  if (!isServiceKey(key)) return false;
  const s = SERVICES[key];
  if (s.status !== "v1") return false;
  if (!isBillingEnabled()) return true;

  const course = await loadCourseBilling(courseId);
  if (!course || !viewerSeesWorkspace(viewer, course.workspaceId)) return false;
  if (s.kind === "basic") return true;
  if (!course.enabledKeys.includes(key)) return false;
  if (s.meter === "AI_MARKS" || s.meter === "API_REQUESTS") {
    return !(await capReached(course.workspaceId, s.meter));
  }
  return true;
}
