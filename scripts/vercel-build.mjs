/**
 * Vercel runs `npm run vercel-build` instead of `build` when it exists.
 *
 * Preview builds apply pending migrations to the Neon `preview` branch
 * first, so a PR with a migration needs no hand step (B's HANDOFF,
 * 2026-11-16). Production builds never migrate: production takes
 * `prisma migrate deploy` by hand (docs/revamp/a/ops/prisma-baseline.md).
 *
 * Preview needs DIRECT_URL (the preview branch's direct URL, role
 * `nexa_preview`) in Vercel's Preview environment. Without it the step is
 * skipped with a warning. A DIRECT_URL that is not the preview endpoint
 * stops the build.
 */

import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Neon endpoint ids (not secrets). Project grit-lms-sb.
export const PRODUCTION_ENDPOINTS = ["ep-aged-scene-a4fhpg0t"];
export const PREVIEW_ENDPOINT = "ep-wandering-sea-a4bvyaiw";

/** What the build should do about migrations. Pure, for scripts/check-vercel-build.mjs. */
export function migrationStep(env) {
  if (env.VERCEL_ENV !== "preview") return { action: "skip", reason: `not a preview build (${env.VERCEL_ENV ?? "local"})` };
  const url = env.DIRECT_URL ?? "";
  if (!url) return { action: "skip", reason: "DIRECT_URL is not set for Preview" };
  if (PRODUCTION_ENDPOINTS.some((e) => url.includes(e))) return { action: "refuse", reason: "DIRECT_URL points at production" };
  if (!url.includes(PREVIEW_ENDPOINT)) return { action: "refuse", reason: "DIRECT_URL is not the preview branch" };
  return { action: "migrate", reason: "preview branch" };
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  run("npx prisma generate");
  const step = migrationStep(process.env);
  if (step.action === "refuse") {
    console.error(`[vercel-build] refusing to migrate: ${step.reason}`);
    process.exit(1);
  }
  if (step.action === "migrate") {
    console.log("[vercel-build] applying migrations to the preview branch");
    run("npx prisma migrate deploy");
  } else {
    console.log(`[vercel-build] no migrations: ${step.reason}`);
  }
  run("npx next build");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
