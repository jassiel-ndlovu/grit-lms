/**
 * Fails if the old product name ("Grit") is back in a file Agent A owns.
 *
 * The product is Nexa. Some infrastructure still carries the old name and
 * is renamed only by the owner, if ever: the GitHub repo, the Vercel
 * project and its `grit-lms.vercel.app` URL, the Blob store and the Neon
 * project. Those names are allowed below; anything else is a leftover.
 *
 * Scope is the A-owned paths in docs/revamp/AGENTS.md section 2. Agent B's
 * screens and components are B's to check. Docs are left alone because
 * they describe the history.
 *
 * Run: npx tsx scripts/check-branding.ts
 * (or: node --experimental-strip-types scripts/check-branding.ts)
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Path prefixes and exact files that Agent A owns. */
const A_OWNED: readonly string[] = [
  "src/lib/auth",
  "src/lib/db",
  "src/lib/safe-action",
  "src/lib/api-guard",
  "src/lib/email",
  "src/lib/blob",
  "src/lib/viewer",
  "src/lib/branding",
  "src/lib/next-auth.d.ts",
  "src/features/auth/",
  "src/features/users/",
  "src/features/tutors/",
  "src/features/students/",
  "src/features/parents/",
  "src/features/workspaces/",
  "src/features/billing/",
  "src/features/payments/",
  "src/features/admin/",
  "src/features/notifications/",
  "src/features/messaging/",
  "src/features/email/",
  "src/app/api/",
  "src/app/auth/",
  "src/app/admin/",
  "src/app/verify-email/",
  "src/app/forgot-password/",
  "prisma/",
  "scripts/",
  ".github/",
  "package.json",
  "next.config.",
  "tsconfig.json",
  ".gitignore",
  ".env.example",
  "README.md",
];

/** This file names the old brand on purpose. */
const SKIP = new Set(["scripts/check-branding.ts"]);

/**
 * Infrastructure names that keep the old brand. Each entry is removed from
 * a line before the line is checked, so the rest of the line still counts.
 */
const ALLOWED: readonly RegExp[] = [
  /grit-lms\.vercel\.app/gi, // Vercel project URL
  /github\.com\/[\w.-]+\/grit-lms/gi, // GitHub repo URL
  /\bcd grit-lms\b/gi, // clone folder named after the repo
];

const OLD_NAME = /grit/i;

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

function isAOwned(path: string): boolean {
  if (SKIP.has(path)) return false;
  return A_OWNED.some((p) => path === p || path.startsWith(p));
}

const hits: string[] = [];
let checked = 0;

for (const path of trackedFiles().filter(isAOwned)) {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  if (text.includes("\0")) continue; // binary
  checked++;
  text.split(/\r?\n/).forEach((line, i) => {
    let rest = line;
    for (const re of ALLOWED) rest = rest.replace(re, "");
    if (OLD_NAME.test(rest)) hits.push(`${path}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length > 0) {
  console.log(`FAIL  "Grit" found in ${hits.length} line(s) of A-owned files:`);
  for (const h of hits) console.log(`        ${h}`);
  console.log(
    "\nRename it to Nexa (use src/lib/branding.ts), or, if it is an " +
      "infrastructure name, add it to ALLOWED in scripts/check-branding.ts.",
  );
  process.exit(1);
}

console.log(`PASS  no "Grit" in ${checked} A-owned files`);
