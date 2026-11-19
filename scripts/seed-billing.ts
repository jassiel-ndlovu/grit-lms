/**
 * Seeds the Phase 2 billing catalogue (docs/revamp/a/design/03-billing.md,
 * docs/revamp/contracts/services.md):
 *   - Tier rows CORE 9900, PLUS 13900, PRO 17900 cents (aiMarksPerStudent 0, 0, 30)
 *   - every service key and add-on, with its status (v1, later, parked, retired)
 *   - the BillingConfig singleton (30-day periods, 80% margin, 14-day trial, no VAT)
 *
 *   npx tsx scripts/seed-billing.ts            # dry run: prints what would change
 *   npx tsx scripts/seed-billing.ts --apply
 *
 * Idempotent upserts only; never deletes. A price change is a new Tier row
 * with a later activeFrom, so this script never edits an existing price.
 * Refuses production's endpoint unless --allow-production is given
 * (AGENTS.md 4.1: an idempotent insert-only backfill, backup branch first).
 */

import { PrismaClient } from "../src/generated/prisma";

import { ADDONS, dbStatus, SEED_TIERS, SERVICES } from "../src/features/billing/catalogue";

const PRODUCTION_ENDPOINTS = ["ep-aged-scene-a4fhpg0t"];
/** activeFrom of the first price list: the owner decision date. */
const PRICES_FROM = new Date("2026-11-16T00:00:00.000Z");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowProduction = args.includes("--allow-production");

const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL is not set");
if (PRODUCTION_ENDPOINTS.some((e) => url.includes(e)) && !allowProduction) {
  throw new Error("This is production. Re-run with --allow-production (backup branch first, AGENTS.md 4.1).");
}

const prisma = new PrismaClient({ datasourceUrl: url });

type ServiceRow = {
  key: string;
  name: string;
  kind: "BASIC" | "PREMIUM" | "ADDON";
  tier: "CORE" | "PLUS" | "PRO";
  status: "ACTIVE" | "LATER" | "PARKED" | "RETIRED";
  meter: "ACTIVE_STUDENTS" | "AI_MARKS" | "LIVE_ROOM_MINUTES" | "STORAGE_MB" | "API_REQUESTS" | null;
};

const serviceRows: ServiceRow[] = [
  ...Object.values(SERVICES).map((s) => ({
    key: s.key,
    name: s.name,
    kind: s.kind === "basic" ? ("BASIC" as const) : ("PREMIUM" as const),
    tier: s.tier,
    status: dbStatus(s.status),
    meter: s.meter,
  })),
  // Add-ons are bought, not switched on per course, and never count toward a tier.
  ...Object.values(ADDONS).map((a) => ({
    key: a.key,
    name: a.name,
    kind: "ADDON" as const,
    tier: "CORE" as const,
    status: dbStatus(a.status),
    meter: a.meter,
  })),
];

async function main() {
  const counts = { tiersNew: 0, tiersSame: 0, servicesNew: 0, servicesChanged: 0, servicesSame: 0, config: "" };

  for (const t of SEED_TIERS) {
    const existing = await prisma.tier.findUnique({ where: { key_activeFrom: { key: t.key, activeFrom: PRICES_FROM } } });
    if (existing) {
      counts.tiersSame++;
      if (existing.priceCents !== t.priceCents) {
        console.warn(`Tier ${t.key} from ${PRICES_FROM.toISOString()} has ${existing.priceCents}, seed says ${t.priceCents}. Not changed: add a new row for a price change.`);
      }
      continue;
    }
    counts.tiersNew++;
    if (apply) {
      await prisma.tier.create({ data: { ...t, activeFrom: PRICES_FROM } });
    }
  }

  for (const s of serviceRows) {
    const existing = await prisma.service.findUnique({ where: { key: s.key } });
    if (!existing) counts.servicesNew++;
    else if (
      existing.name !== s.name || existing.kind !== s.kind || existing.tier !== s.tier ||
      existing.status !== s.status || existing.meter !== s.meter
    ) counts.servicesChanged++;
    else { counts.servicesSame++; continue; }
    if (apply) {
      await prisma.service.upsert({ where: { key: s.key }, create: s, update: s });
    }
  }

  const config = await prisma.billingConfig.findUnique({ where: { id: "singleton" } });
  counts.config = config ? "exists (left as is)" : "new";
  if (!config && apply) {
    await prisma.billingConfig.create({
      data: { id: "singleton", periodDays: 30, apiMarginBps: 8000, trialDays: 14, vatRegistered: false },
    });
  }

  console.log(apply ? "Applied:" : "Dry run (pass --apply to write):");
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
