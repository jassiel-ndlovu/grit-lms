/**
 * Plan prices for the public landing page (#216). Prices come from the
 * current Tier rows, never from code; what each plan includes comes from
 * the catalogue (contracts/services.md). Contract: viewer.md, "Landing page".
 *
 * `live` is false until BILLING=1 (January). B shows prices only when it is
 * true; before that the page says plans are coming.
 */

import "server-only";

import { unstable_cache } from "next/cache";

import type { TierKey } from "@/features/billing/catalogue";
import { isBillingEnabled } from "@/features/billing/errors";
import { prisma } from "@/lib/db";

import { buildPublicPlans, type PublicPlans } from "./plans-math";

export { randLabel, TRIAL_DAYS, type PublicPlan, type PublicPlans } from "./plans-math";

const currentTiers = unstable_cache(
  async () => {
    const now = new Date();
    const rows = await prisma.tier.findMany({
      where: { activeFrom: { lte: now }, OR: [{ activeTo: null }, { activeTo: { gt: now } }] },
      orderBy: [{ rank: "asc" }, { activeFrom: "desc" }],
      select: { key: true, name: true, priceCents: true },
    });
    // The newest row per key.
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
  },
  ["public-tiers"],
  { revalidate: 3600, tags: ["tiers"] },
);

/** For the landing page (a server component). Never throws: no rows gives no plans. */
export async function getPublicPlans(): Promise<PublicPlans> {
  const tiers = await currentTiers().catch((e) => {
    console.error("[plans] tier read failed:", e);
    return [] as Awaited<ReturnType<typeof currentTiers>>;
  });
  return buildPublicPlans(tiers as Array<{ key: TierKey; name: string; priceCents: number }>, isBillingEnabled());
}
