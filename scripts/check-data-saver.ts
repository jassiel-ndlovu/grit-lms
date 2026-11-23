/**
 * Checks the data saver's boot script (stock photos on static pages).
 *
 *   npx tsx scripts/check-data-saver.ts
 *
 * Pure: runs the script against a fake document and navigator. Exits 1 on
 * any failure. The cookie and header rules are in check-rubrics-a11y.ts.
 */

import vm from "node:vm";

import { DATA_SAVER_COOKIE, dataSaverBootScript } from "../src/lib/data-saver";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` (got ${String(got)}, want ${String(want)})`}`);
}

function run(cookie: string, connection: unknown): string | undefined {
  const dataset: Record<string, string> = {};
  vm.runInNewContext(dataSaverBootScript, { document: { cookie, documentElement: { dataset } }, navigator: { connection } });
  return dataset.saver;
}

check("no cookie, no hint: off", run("", { saveData: false }), undefined);
check("no cookie, no connection API: off", run("", undefined), undefined);
check("browser data saver: on", run("", { saveData: true }), "on");
check("cookie on", run(`${DATA_SAVER_COOKIE}=on`, undefined), "on");
check("cookie on among others", run(`a=1; ${DATA_SAVER_COOKIE}=on; b=2`, undefined), "on");
check("cookie off beats the browser", run(`${DATA_SAVER_COOKIE}=off`, { saveData: true }), undefined);
check("another cookie's suffix doesn't count", run(`x${DATA_SAVER_COOKIE}=on`, undefined), undefined);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
