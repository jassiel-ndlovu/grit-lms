/**
 * Guards the multi-file Prisma schema (Phase 0, docs/revamp/a/WRITEUP.md).
 *
 * - The old single file is gone and package.json points Prisma at the folder.
 * - Exactly one generator and one datasource, in core.prisma, with directUrl.
 * - Every model and enum is declared once, in the file its owner holds
 *   (docs/revamp/AGENTS.md, section 2).
 * - Migrations live next to the datasource, starting with 0_baseline.
 *
 *   npx tsx scripts/check-schema-split.ts
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n        ${detail}` : ""}`);
}

const root = process.cwd();
const dir = join(root, "prisma", "schema");

const OWNER: Record<string, "A" | "B"> = {
  "core.prisma": "A",
  "tenancy.prisma": "A",
  "billing.prisma": "A",
  "messaging.prisma": "A",
  "learning.prisma": "B",
  "assessments.prisma": "B",
  "coding.prisma": "B",
  "calendar.prisma": "B",
};

check("old prisma/schema.prisma is gone", !existsSync(join(root, "prisma", "schema.prisma")));

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
check("package.json points Prisma at prisma/schema", pkg.prisma?.schema === "prisma/schema");

const files = readdirSync(dir).filter((f) => f.endsWith(".prisma"));
const unknown = files.filter((f) => !(f in OWNER));
check("only the agreed schema files exist", unknown.length === 0, `unexpected: ${unknown.join(", ")}`);
const missing = Object.keys(OWNER).filter((f) => !files.includes(f));
check("every agreed schema file exists", missing.length === 0, `missing: ${missing.join(", ")}`);

const seen = new Map<string, string>();
const dupes: string[] = [];
let generators = 0;
let datasources = 0;
for (const f of files) {
  const src = readFileSync(join(dir, f), "utf8");
  for (const m of src.matchAll(/^(model|enum|generator|datasource)\s+(\w+)/gm)) {
    const [, kind, name] = m;
    if (kind === "generator") {
      generators++;
      check(`generator is in core.prisma`, f === "core.prisma", `found in ${f}`);
      // `output` is relative to the file holding the generator, which now
      // sits one folder deeper than the old prisma/schema.prisma.
      check(
        "client is generated to src/generated/prisma",
        /output\s*=\s*"\.\.\/\.\.\/src\/generated\/prisma"/.test(src),
      );
      continue;
    }
    if (kind === "datasource") {
      datasources++;
      check(`datasource is in core.prisma`, f === "core.prisma", `found in ${f}`);
      check("datasource has directUrl", /directUrl\s*=\s*env\("DIRECT_URL"\)/.test(src));
      continue;
    }
    const key = `${kind} ${name}`;
    if (seen.has(key)) dupes.push(`${key} in ${seen.get(key)} and ${f}`);
    seen.set(key, f);
  }
}
check("exactly one generator", generators === 1, `found ${generators}`);
check("exactly one datasource", datasources === 1, `found ${datasources}`);
check("no model or enum is declared twice", dupes.length === 0, dupes.join("; "));
check("models and enums found", seen.size >= 30, `found ${seen.size}`);

const migrations = join(dir, "migrations");
check("migrations sit next to the datasource", existsSync(join(migrations, "migration_lock.toml")));
check("0_baseline migration exists", existsSync(join(migrations, "0_baseline", "migration.sql")));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
