/**
 * npx tsx scripts/check-seed-fake-guard.ts
 *
 * The fake-data seed must never reach production. This checks the target
 * guard in scripts/seed-fake.ts without touching any database.
 */

import { checkTarget } from "./seed-fake";

let failures = 0;
function check(name: string, got: boolean, want: boolean) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}

const PROD = "postgresql://u:p@ep-aged-scene-a4fhpg0t-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const PROD_DIRECT = "postgresql://u:p@ep-aged-scene-a4fhpg0t.us-east-1.aws.neon.tech/neondb";
const PREVIEW = "postgresql://u:p@ep-wandering-sea-a4bvyaiw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const LOCAL = "postgresql://u:p@localhost:5432/nexa";

check("preview branch runs", checkTarget(PREVIEW, {}).ok, true);
check("production pooled refused", checkTarget(PROD, {}).ok, false);
check("production direct refused", checkTarget(PROD_DIRECT, {}).ok, false);
check("production refused even with SEED_FAKE_ALLOW=1", checkTarget(PROD, { SEED_FAKE_ALLOW: "1" }).ok, false);
check("other host refused without the flag", checkTarget(LOCAL, {}).ok, false);
check("other host runs with SEED_FAKE_ALLOW=1", checkTarget(LOCAL, { SEED_FAKE_ALLOW: "1" }).ok, true);
check("SEED_FAKE_ALLOW must be exactly 1", checkTarget(LOCAL, { SEED_FAKE_ALLOW: "true" }).ok, false);
check("VERCEL_ENV=production refused", checkTarget(PREVIEW, { VERCEL_ENV: "production" }).ok, false);
check("missing URL refused", checkTarget(undefined, {}).ok, false);
check("garbage URL refused", checkTarget("not a url", { SEED_FAKE_ALLOW: "1" }).ok, false);

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
