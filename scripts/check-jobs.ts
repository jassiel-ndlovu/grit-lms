/**
 * Checks the scheduled-job setup (design 06 §5, design 07 Batch 5):
 * - verifyJobRequest accepts only the right Bearer secret and fails closed;
 * - every job in the registry has a route that uses defineJob;
 * - the GitHub workflow calls every registry path, on the registry schedule.
 *
 *   npx tsx scripts/check-jobs.ts
 */

import { createHash, createHmac } from "node:crypto";
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

const headers = (h: Record<string, string> = {}) => new Headers(h);
const req = (h: Record<string, string> = {}, path = "/api/cron/auto-submit") => ({ headers: headers(h), body: "", path });
const prod = { CRON_SECRET: "s3cret-value", NODE_ENV: "production" };
const qenv = { ...prod, QSTASH_CURRENT_SIGNING_KEY: "k1", QSTASH_NEXT_SIGNING_KEY: "k2", APP_URL: "https://app.example.invalid/" };

// A fake QStash receiver: records the URL it was asked to check.
let seenUrl = "";
const fakeReceiver = (valid: boolean | "throw") => ({
  verify: async ({ url }: { url?: string }) => {
    seenUrl = url ?? "";
    if (valid === "throw") throw new Error("SignatureError");
    return valid;
  },
});

async function verifyChecks() {
  // Bearer
  check("right secret", await verifyJobRequest(req({ authorization: "Bearer s3cret-value" }), prod), { ok: true, trigger: "bearer" });
  check("wrong secret", (await verifyJobRequest(req({ authorization: "Bearer nope" }), prod)).ok, false);
  check("secret with a different length", (await verifyJobRequest(req({ authorization: "Bearer s3cret-value-x" }), prod)).ok, false);
  check("missing header", await verifyJobRequest(req(), prod), { ok: false, status: 401, error: "Unauthorized" });
  check("not a Bearer header", (await verifyJobRequest(req({ authorization: "s3cret-value" }), prod)).ok, false);
  check("no secret in production fails closed", (await verifyJobRequest(req({ authorization: "Bearer x" }), { NODE_ENV: "production" })).ok, false);
  check("no secret in development lets through", await verifyJobRequest(req(), { NODE_ENV: "development" }), { ok: true, trigger: "dev" });

  // QStash
  check("valid QStash signature", await verifyJobRequest(req({ "upstash-signature": "sig" }), qenv, fakeReceiver(true)), { ok: true, trigger: "qstash" });
  check("signature checked against the public URL of the route", seenUrl, "https://app.example.invalid/api/cron/auto-submit");
  check("invalid QStash signature", (await verifyJobRequest(req({ "upstash-signature": "sig" }), qenv, fakeReceiver(false))).ok, false);
  check("QStash verify throwing is a refusal", (await verifyJobRequest(req({ "upstash-signature": "sig" }), qenv, fakeReceiver("throw"))).ok, false);
  check("signature without keys is refused", (await verifyJobRequest(req({ "upstash-signature": "sig" }), prod, fakeReceiver(true))).ok, false);
  const vercelOrigin = { ...qenv, APP_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: "grit-lms.vercel.app" };
  await verifyJobRequest(req({ "upstash-signature": "sig" }, "/api/cron/notifications"), vercelOrigin, fakeReceiver(true));
  check("falls back to the Vercel production domain", seenUrl, "https://grit-lms.vercel.app/api/cron/notifications");
  const noOrigin = { ...qenv, APP_URL: undefined };
  check("signature without a known origin is refused", (await verifyJobRequest(req({ "upstash-signature": "sig" }), noOrigin, fakeReceiver(true))).ok, false);
  check("a bad signature does not fall back to Bearer", (await verifyJobRequest(req({ "upstash-signature": "sig", authorization: "Bearer s3cret-value" }), qenv, fakeReceiver(false))).ok, false);

  // The real Receiver, with a token signed here the way QStash signs:
  // HS256, iss "Upstash", sub = destination URL, body = sha256(body), base64url.
  const b64url = (b: Buffer) => b.toString("base64url");
  const sign = (key: string, sub: string) => {
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const body = b64url(Buffer.from(JSON.stringify({
      iss: "Upstash", sub, iat: now, nbf: now, exp: now + 300, jti: "check",
      body: b64url(createHash("sha256").update("").digest()),
    })));
    const sig = b64url(createHmac("sha256", key).update(`${head}.${body}`).digest());
    return `${head}.${body}.${sig}`;
  };
  const realEnv = { NODE_ENV: "production", QSTASH_CURRENT_SIGNING_KEY: "test-current", QSTASH_NEXT_SIGNING_KEY: "test-next", APP_URL: "https://app.example.invalid" };
  const route = "https://app.example.invalid/api/cron/auto-submit";
  check("real Receiver: signed for this route", await verifyJobRequest(req({ "upstash-signature": sign("test-current", route) }), realEnv), { ok: true, trigger: "qstash" });
  check("real Receiver: next signing key also works", (await verifyJobRequest(req({ "upstash-signature": sign("test-next", route) }), realEnv)).ok, true);
  check("real Receiver: signed for another route is refused", (await verifyJobRequest(req({ "upstash-signature": sign("test-current", "https://app.example.invalid/api/cron/notifications") }), realEnv)).ok, false);
  check("real Receiver: wrong key is refused", (await verifyJobRequest(req({ "upstash-signature": sign("other-key", route) }), realEnv)).ok, false);
}

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

verifyChecks().then(() => {
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
});
