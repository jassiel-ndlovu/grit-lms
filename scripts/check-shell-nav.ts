/**
 * Check the revamp shell's nav rules: npx tsx scripts/check-shell-nav.ts
 */
import { FOOTER_LINKS, activeHref, isFocusRoute, navSectionsFor, type NavSection } from "../src/components/shell/nav-config";
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
// Each legacy role, through today's bridge viewer: the links it had before the
// viewer, plus Find courses (learners, guardians) and Join requests (staff
// with learners.invite) from #206.
const BEFORE: Record<LegacyRole, string[]> = {
  STUDENT: ["/dashboard", "/dashboard/notifications", "/dashboard/courses", "/dashboard/courses/browse", "/dashboard/calendar", "/dashboard/tests", "/dashboard/assignments", "/dashboard/grades"],
  TUTOR: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-courses", "/dashboard/calendar", "/dashboard/tutor-tests", "/dashboard/assignments", "/dashboard/gradebook", "/dashboard/analytics", "/dashboard/students", "/dashboard/join-requests"],
  ADMIN: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-users"],
  PARENT: ["/dashboard", "/dashboard/notifications", "/dashboard/courses/browse"],
};
for (const role of Object.keys(BEFORE) as LegacyRole[]) {
  check(`${role}: expected links`, hrefsOf(navSectionsFor(viewerFor(role))), BEFORE[role]);
}
check("signed out: home and notifications only", hrefsOf(navSectionsFor(null)), ["/dashboard", "/dashboard/notifications"]);
check("Find courses lights itself, not Courses", activeHref("/dashboard/courses/browse", ["/dashboard/courses", "/dashboard/courses/browse"]), "/dashboard/courses/browse");
check("a course page still lights Courses", activeHref("/dashboard/courses/abc", ["/dashboard/courses", "/dashboard/courses/browse"]), "/dashboard/courses");
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
const owner = { persona: "staff" as const, permissions: ["billing.view" as const] };
check("billing off: no Billing link", hrefsOf(navSectionsFor(owner)).includes("/dashboard/settings/billing"), false);
check("billing on, billing.view: Billing link", hrefsOf(navSectionsFor(owner, { billing: true })).includes("/dashboard/settings/billing"), true);
check(
  "billing on, no billing.view: no Billing link",
  hrefsOf(navSectionsFor({ persona: "staff", permissions: ["courses.edit"] }, { billing: true })).includes("/dashboard/settings/billing"),
  false,
);
const feesTutor = { persona: "staff" as const, permissions: ["fees.manage" as const] };
check("fees: billing off hides Fees", hrefsOf(navSectionsFor(feesTutor)).includes("/dashboard/fees"), false);
check("fees: billing on, fees.manage shows Fees", hrefsOf(navSectionsFor(feesTutor, { billing: true })).includes("/dashboard/fees"), true);
const nexaAdmin = { persona: "admin" as const, permissions: ["admin.console" as const] };
check("admin, billing off: no billing admin link", hrefsOf(navSectionsFor(nexaAdmin)).includes("/dashboard/admin/billing"), false);
check("admin, billing on: billing admin link", hrefsOf(navSectionsFor(nexaAdmin, { billing: true })).includes("/dashboard/admin/billing"), true);
check("Find courses lights itself, not Courses", activeHref("/dashboard/courses/browse", ["/dashboard/courses", "/dashboard/courses/browse"]), "/dashboard/courses/browse");
check("a course page still lights Courses", activeHref("/dashboard/courses/abc", ["/dashboard/courses", "/dashboard/courses/browse"]), "/dashboard/courses");
check("billing page lights Billing, not Settings", activeHref("/dashboard/settings/billing", ["/dashboard/settings", "/dashboard/settings/billing"]), "/dashboard/settings/billing");

check("focus: the runner", isFocusRoute("/dashboard/tests/abc123"), true);
check("focus: trailing slash", isFocusRoute("/dashboard/tests/abc123/"), true);
check("focus: not the tests list", isFocusRoute("/dashboard/tests"), false);
check("focus: not pre-test", isFocusRoute("/dashboard/tests/pre-test/abc123"), false);
check("focus: not review", isFocusRoute("/dashboard/tests/review/abc123"), false);
check("focus: not the tutor side", isFocusRoute("/dashboard/tutor-tests/abc123"), false);
check("focus: onboarding", [isFocusRoute("/dashboard/onboarding"), isFocusRoute("/dashboard/onboarding/course")], [true, true]);
check("focus: not a look-alike", isFocusRoute("/dashboard/onboarding-help"), false);

for (const role of Object.keys(BEFORE) as LegacyRole[]) {
  const all = [...hrefsOf(navSectionsFor(viewerFor(role))), ...FOOTER_LINKS.map((l) => l.href)];
  check(`${role}: no duplicate links`, all.length, new Set(all).size);
  check(`${role}: every link under /dashboard`, all.every((h) => h.startsWith("/dashboard")), true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
