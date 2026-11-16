/**
 * Check the revamp shell's nav rules: npx tsx scripts/check-shell-nav.ts
 */
import { FOOTER_LINKS, activeHref, navSectionsForRole } from "../src/components/shell/nav-config";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const hrefs = ["/dashboard", "/dashboard/tests", "/dashboard/tutor-tests", "/dashboard/settings"];
check("home only on itself", activeHref("/dashboard", hrefs), "/dashboard");
check("home not lit on a child page", activeHref("/dashboard/notifications", hrefs), null);
check("nested route lights its section", activeHref("/dashboard/tests/abc/review", hrefs), "/dashboard/tests");
check("no false prefix (tests vs tutor-tests)", activeHref("/dashboard/tutor-tests/1/edit", hrefs), "/dashboard/tutor-tests");
check("trailing segment boundary", activeHref("/dashboard/testsuite", hrefs), null);
check("unknown role falls back to student", navSectionsForRole("ROBOT"), navSectionsForRole("STUDENT"));

for (const role of ["STUDENT", "TUTOR", "ADMIN", "PARENT"]) {
  const all = [...navSectionsForRole(role).flatMap((s) => s.items), ...FOOTER_LINKS].map((l) => l.href);
  check(`${role}: no duplicate links`, all.length, new Set(all).size);
  check(`${role}: every link under /dashboard`, all.every((h) => h.startsWith("/dashboard")), true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
