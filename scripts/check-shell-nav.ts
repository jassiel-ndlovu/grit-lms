/**
 * Check the revamp shell's nav rules: npx tsx scripts/check-shell-nav.ts
 */
import { FOOTER_LINKS, activeHref, navSectionsFor, type NavSection } from "../src/components/shell/nav-config";
import { buildLegacyViewer, type LegacyRole } from "../src/lib/viewer-core";

const viewerFor = (role: LegacyRole) =>
  buildLegacyViewer({
    user: { id: "u1", name: "Test", email: "t@example.test", role, emailVerified: true, imageUrl: null },
    profileId: "p1",
  });
const hrefsOf = (sections: NavSection[]) => sections.flatMap((s) => s.items.map((l) => l.href));

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
// Each legacy role, through today's bridge viewer, keeps exactly the links it had.
const BEFORE: Record<LegacyRole, string[]> = {
  STUDENT: ["/dashboard", "/dashboard/notifications", "/dashboard/courses", "/dashboard/calendar", "/dashboard/tests", "/dashboard/assignments", "/dashboard/grades"],
  TUTOR: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-courses", "/dashboard/calendar", "/dashboard/tutor-tests", "/dashboard/assignments", "/dashboard/gradebook", "/dashboard/analytics", "/dashboard/manage-users"],
  ADMIN: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-users"],
  PARENT: ["/dashboard", "/dashboard/notifications"],
};
for (const role of Object.keys(BEFORE) as LegacyRole[]) {
  check(`${role}: same links as before the viewer`, hrefsOf(navSectionsFor(viewerFor(role))), BEFORE[role]);
}
check("signed out: home and notifications only", hrefsOf(navSectionsFor(null)), BEFORE.PARENT);
check(
  "a missing permission hides its link",
  hrefsOf(navSectionsFor({ persona: "staff", permissions: ["courses.edit"] })).includes("/dashboard/gradebook"),
  false,
);
check(
  "a section with no links left is dropped",
  navSectionsFor({ persona: "admin", permissions: [] }).map((s) => s.label ?? ""),
  [""],
);

for (const role of Object.keys(BEFORE) as LegacyRole[]) {
  const all = [...hrefsOf(navSectionsFor(viewerFor(role))), ...FOOTER_LINKS.map((l) => l.href)];
  check(`${role}: no duplicate links`, all.length, new Set(all).size);
  check(`${role}: every link under /dashboard`, all.every((h) => h.startsWith("/dashboard")), true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
