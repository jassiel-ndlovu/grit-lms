/**
 * A workspace's plan for workspace-wide features (#216): the highest tier
 * among the v1 premium services switched on in any of its courses. Comped
 * workspaces, and every workspace before billing is switched on, count as
 * Pro. Used by branding (Plus), white-label and the API (Pro).
 */

import "server-only";

import { prisma } from "@/lib/db";

import { SERVICES, TIER_RANK, type TierKey } from "./catalogue";
import { isBillingEnabled } from "./errors";

export async function workspacePlan(workspaceId: string): Promise<TierKey> {
  if (!isBillingEnabled()) return "PRO";
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { billingState: true } });
  if (!ws || ws.billingState === "CANCELLED") return "CORE";
  if (ws.billingState === "COMPED") return "PRO";
  const on = await prisma.courseService.findMany({ where: { workspaceId, enabled: true }, distinct: ["serviceKey"], select: { serviceKey: true } });
  let best: TierKey = "CORE";
  for (const { serviceKey } of on) {
    const s = SERVICES[serviceKey as keyof typeof SERVICES];
    if (s && s.kind === "premium" && s.status === "v1" && TIER_RANK[s.tier] > TIER_RANK[best]) best = s.tier;
  }
  return best;
}

export const planAtLeast = (plan: TierKey, min: TierKey) => TIER_RANK[plan] >= TIER_RANK[min];
