/**
 * Creates or overwrites one QStash schedule per job in
 * src/lib/jobs/registry.ts (design 06 §5).
 *
 *   QSTASH_TOKEN=... npx tsx scripts/qstash-sync-schedules.ts            # dry run
 *   QSTASH_TOKEN=... npx tsx scripts/qstash-sync-schedules.ts --apply
 *
 * Env:
 *   QSTASH_TOKEN  from the Upstash console (never commit it)
 *   QSTASH_URL    the region's QStash URL from the console, if not the default
 *   APP_URL       public origin the routes live on; default https://grit-lms.vercel.app.
 *                 Must equal what the app uses to verify signatures
 *                 (src/lib/jobs/verify.ts publicOrigin).
 *
 * Schedule ids are `nexa-<job>`, so re-running updates in place. Schedules
 * on the account that are not in the registry are listed, never deleted.
 */

import { Client } from "@upstash/qstash";

import { JOBS } from "../src/lib/jobs/registry";

const apply = process.argv.includes("--apply");
const token = process.env.QSTASH_TOKEN;
if (!token) throw new Error("QSTASH_TOKEN is not set");
const origin = (process.env.APP_URL ?? "https://grit-lms.vercel.app").replace(/\/+$/, "");

const client = new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });

async function main() {
  const existing = await client.schedules.list();
  const byId = new Map(existing.map((s) => [s.scheduleId, s]));

  for (const job of Object.values(JOBS)) {
    const scheduleId = `nexa-${job.name}`;
    const destination = `${origin}${job.path}`;
    const current = byId.get(scheduleId);
    const same = current && current.destination === destination && current.cron === job.schedule;
    console.log(`${scheduleId}: ${destination} "${job.schedule}" ${same ? "(up to date)" : current ? "(update)" : "(create)"}`);
    if (apply && !same) {
      await client.schedules.create({ scheduleId, destination, cron: job.schedule, method: "POST", retries: 3 });
    }
  }

  const known = new Set(Object.values(JOBS).map((j) => `nexa-${j.name}`));
  const extra = existing.filter((s) => !known.has(s.scheduleId));
  if (extra.length) {
    console.log(`Not in the registry (left alone): ${extra.map((s) => `${s.scheduleId} -> ${s.destination}`).join(", ")}`);
  }
  console.log(apply ? "Applied." : "Dry run. Add --apply to create or update.");
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e).slice(0, 300));
  process.exitCode = 1;
});
