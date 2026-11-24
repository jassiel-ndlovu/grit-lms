/**
 * Wording guard (docs/revamp/copy.md): text people read never names a
 * supplier, and never shows an error code. Scans string literals and JSX
 * text in src/, skipping comments, Nexa-admin screens, provider code and
 * the developer API.
 *   npx tsx scripts/check-copy.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "src");

/** Where a supplier may be named: internal code, Nexa staff screens, developer docs. */
const SKIP = [
  /[\\/]features[\\/]payments[\\/]/, // provider, reconcile, settlement (server; messages to people go through safe-action)
  /[\\/]features[\\/]api[\\/]/,
  /[\\/]features[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]/,
  /[\\/]app[\\/]design-system[\\/]/,
  /[\\/]app[\\/]dashboard[\\/]admin[\\/]/,
  /[\\/]components[\\/]site[\\/]/,
  /admin-[a-z-]+\.tsx?$/,
  /[\\/]lib[\\/](db|better-auth|blob|jobs|sentry|email[\\/](send|queue|config))/,
  /[\\/]generated[\\/]/,
  /[\\/]instrumentation/,
  /\.test\.tsx?$/,
];

const SUPPLIERS = ["Paystack", "Resend", "Vercel", "Anthropic", "Neon", "QStash", "Upstash", "Sentry", "Prisma"];
const CODES = /\b(FORBIDDEN|NOT_FOUND|UNAUTHENTICATED|PROVIDER_ERROR|BILLING_DISABLED)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** The parts of a line people could read: quoted strings, template text and JSX text. */
function readable(line: string, isTsx: boolean): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/"((?:[^"\\]|\\.){6,})"|`((?:[^`\\]|\\.){6,})`/g)) {
    const s = m[1] ?? m[2] ?? "";
    // Sentences only: at least two words and a lower-case letter.
    if (/\s/.test(s.trim()) && /[a-z]/.test(s) && !/^[\w./@-]+$/.test(s)) out.push(s);
  }
  if (isTsx) for (const m of line.matchAll(/>([^<>{}]{6,})</g)) out.push(m[1]);
  return out;
}

const problems: string[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(join(ROOT, ".."), file);
  if (SKIP.some((r) => r.test(file))) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inBlock = false;
  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlock) {
      if (!line.includes("*/")) return;
      line = line.slice(line.indexOf("*/") + 2);
      inBlock = false;
    }
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (line.includes("/*") && !line.includes("*/")) { inBlock = true; line = line.slice(0, line.indexOf("/*")); }
    line = line.replace(/\/\*.*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/, "$1");
    // Server logs, monitoring and env names aren't read by people.
    if (/console\.|Sentry\.|captureMessage|captureException|process\.env|throw new Error\(|new ProviderError|import /.test(line)) return;
    for (const text of readable(line, file.endsWith(".tsx"))) {
      // "Resend link" (at the start) is the verb; anywhere else it names the company.
      for (const s of SUPPLIERS) if (new RegExp(s === "Resend" ? "(?<!^\\s*)\\bResend\\b" : `\\b${s}\\b`).test(text)) problems.push(`${rel}:${i + 1}  names ${s}: "${text.slice(0, 90)}"`);
      if (CODES.test(text) && !/^[A-Z_]+$/.test(text.trim())) problems.push(`${rel}:${i + 1}  shows an error code: "${text.slice(0, 90)}"`);
    }
  });
}

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} problem(s). See docs/revamp/copy.md.`);
  process.exit(1);
}
console.log("Wording: no supplier names or error codes in text people read.");
