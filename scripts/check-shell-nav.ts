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
// viewer, plus Find courses (learners, guardians), Calendar for guardians
// (#149), Join requests (staff
// with learners.invite) from #206, referrals (learners and guardians), and
// At risk (staff with grades.view), and Bookings after Calendar (staff with
// content.view), and Cover and Timesheets (an organisation's staff).
const BEFORE: Record<LegacyRole, string[]> = {
  STUDENT: ["/dashboard", "/dashboard/notifications", "/dashboard/courses", "/dashboard/courses/browse", "/dashboard/calendar", "/dashboard/bookings", "/dashboard/tests", "/dashboard/assignments", "/dashboard/grades", "/dashboard/referrals"],
  TUTOR: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-courses", "/dashboard/calendar", "/dashboard/bookings", "/dashboard/cover", "/dashboard/tutor-tests", "/dashboard/assignments", "/dashboard/gradebook", "/dashboard/analytics", "/dashboard/students", "/dashboard/at-risk", "/dashboard/join-requests", "/dashboard/timesheets"],
  ADMIN: ["/dashboard", "/dashboard/notifications", "/dashboard/manage-users"],
  PARENT: ["/dashboard", "/dashboard/notifications", "/dashboard/calendar", "/dashboard/bookings", "/dashboard/courses/browse", "/dashboard/referrals"],
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
const inviter = (role: "ADMIN" | "TUTOR", scope?: "WORKSPACE" | "BRANCHES" | "OWN_COURSES", mode: "organisation" | "tutor" = "organisation") =>
  hrefsOf(
    navSectionsFor({
      persona: "staff", permissions: ["learners.invite", "members.invite"], mode,
      membership: { id: "m", role, teamIds: [], leadTeamIds: [], scope },
    }),
  ).includes("/dashboard/referrals");
check("a tutor gets no Referrals link", inviter("TUTOR"), false);
check("an owner or admin does", inviter("ADMIN", "WORKSPACE"), true);
check("a branch manager doesn't", inviter("ADMIN", "BRANCHES"), false);
check("an owner in tutor mode doesn't", inviter("ADMIN", "WORKSPACE", "tutor"), false);
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
check("business: needs reports.view", [["reports.view" as const], ["grades.view" as const]].map((permissions) => hrefsOf(navSectionsFor({ persona: "staff", permissions })).includes("/dashboard/business")), [true, false]);
const staffIn = (kind: "SOLO" | "ORGANISATION" | null, persona: "staff" | "learner" = "staff") =>
  hrefsOf(navSectionsFor({ persona, permissions: [], workspace: kind ? { kind } : null })).filter((h) => h === "/dashboard/cover" || h === "/dashboard/timesheets");
check("an organisation's staff get Cover and Timesheets", staffIn("ORGANISATION"), ["/dashboard/cover", "/dashboard/timesheets"]);
check("a solo tutor doesn't", [staffIn("SOLO"), staffIn(null)], [[], []]);
check("a student in an organisation doesn't", staffIn("ORGANISATION", "learner"), []);
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
