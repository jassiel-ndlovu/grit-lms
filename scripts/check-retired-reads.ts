/**
 * The old read URLs stay off: their GET does nothing but answer 410.
 *
 *   npx tsx scripts/check-retired-reads.ts
 */

import { existsSync, readFileSync } from "node:fs";

const RETIRED = ["courses", "events", "submission-entry", "submission-entry/[id]", "submissions"];

let failures = 0;
for (const url of RETIRED) {
  const file = `src/app/api/${url}/route.ts`;
  if (!existsSync(file)) {
    console.log(`PASS  /api/${url} is gone`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  const off = /export function GET[(][)] [{]\s+return gone[(]"[^"]+"[)];\s+[}]/.test(source) && source.split("GET(").length === 2;
  if (!off) failures++;
  console.log(`${off ? "PASS" : "FAIL"}  GET /api/${url} answers 410`);
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
