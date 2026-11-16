/**
 * Checks the scheduled-job setup (design 06 §5, design 07 Batch 5):
 * - verifyJobRequest accepts only the right Bearer secret and fails closed;
 * - every job in the registry has a route that uses defineJob;
 * - the GitHub workflow calls every registry path, on the registry schedule.
 *
 *   npx tsx scripts/check-jobs.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { JOBS } from "../src/lib/jobs/registry";
import { verifyJobRequest } from "../src/lib/jobs/verify";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const headers = (auth?: string) => new Headers(auth ? { authorization: auth } : {});
const prod = { CRON_SECRET: "s3cret-value", NODE_ENV: "production" };

// verifyJobRequest
check("right secret", verifyJobRequest(headers("Bearer s3cret-value"), prod), { ok: true, trigger: "bearer" });
check("wrong secret", verifyJobRequest(headers("Bearer nope"), prod).ok, false);
check("secret with a different length", verifyJobRequest(headers("Bearer s3cret-value-x"), prod).ok, false);
check("missing header", verifyJobRequest(headers(), prod), { ok: false, status: 401, error: "Unauthorized" });
check("not a Bearer header", verifyJobRequest(headers("s3cret-value"), prod).ok, false);
check("no secret in production fails closed", verifyJobRequest(headers("Bearer x"), { NODE_ENV: "production" }).ok, false);
check("no secret in development lets through", verifyJobRequest(headers(), { NODE_ENV: "development" }), { ok: true, trigger: "dev" });

// Routes
const root = process.cwd();
for (const job of Object.values(JOBS)) {
  const file = join(root, "src/app", job.path, "route.ts");
  const src = existsSync(file) ? readFileSync(file, "utf8") : "";
  check(`${job.name}: route exists at ${job.path}`, src.length > 0, true);
  check(`${job.name}: uses defineJob("${job.name}")`, src.includes(`defineJob("${job.name}"`), true);
}
const alias = readFileSync(join(root, "src/app/api/auto-submit/route.ts"), "utf8");
check("old /api/auto-submit re-exports the new route", alias.includes(`from "../cron/auto-submit/route"`), true);

// Workflow matches the registry
const wf = readFileSync(join(root, ".github/workflows/scheduled-jobs.yml"), "utf8");
for (const job of Object.values(JOBS)) {
  check(`workflow calls ${job.path}`, wf.includes(`$APP_URL${job.path}`), true);
}
check("workflow no longer calls the alias", /\$APP_URL\/api\/auto-submit"/.test(wf), false);
check("workflow runs notifications on the hour", wf.includes(`cron: "${JOBS.notifications.schedule}"`), true);
check("workflow runs housekeeping daily", wf.includes(`cron: "${JOBS.housekeeping.schedule}"`), true);
check("workflow has no literal \\n", wf.includes("\\n"), false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
