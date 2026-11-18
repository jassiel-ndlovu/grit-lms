/**
 * Checks the migration guard in scripts/vercel-build.mjs.
 *
 *   node scripts/check-vercel-build.mjs
 */

import { migrationStep, PREVIEW_ENDPOINT, PRODUCTION_ENDPOINTS } from "./vercel-build.mjs";

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got ${got}, want ${want}`}`);
}

const previewUrl = `postgresql://role:pw@${PREVIEW_ENDPOINT}.us-east-1.aws.neon.tech/neondb`;
const prodUrl = `postgresql://role:pw@${PRODUCTION_ENDPOINTS[0]}.us-east-1.aws.neon.tech/neondb`;

check("production build never migrates", migrationStep({ VERCEL_ENV: "production", DIRECT_URL: prodUrl }).action, "skip");
check("local build never migrates", migrationStep({ DIRECT_URL: previewUrl }).action, "skip");
check("preview without DIRECT_URL skips", migrationStep({ VERCEL_ENV: "preview" }).action, "skip");
check("preview with the preview branch migrates", migrationStep({ VERCEL_ENV: "preview", DIRECT_URL: previewUrl }).action, "migrate");
check("preview pointed at production refuses", migrationStep({ VERCEL_ENV: "preview", DIRECT_URL: prodUrl }).action, "refuse");
check("preview pointed elsewhere refuses", migrationStep({ VERCEL_ENV: "preview", DIRECT_URL: "postgresql://x@localhost/db" }).action, "refuse");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
