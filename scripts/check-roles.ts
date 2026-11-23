/**
 * Checks roles as permission sets and branch scope (src/lib/roles.ts and
 * the viewer, #216). Pure; runs in CI.
 *
 *   npx tsx scripts/check-roles.ts
 */

import { CUSTOM_ROLE_CEILING, effectiveRole, ROLE_PRESETS } from "../src/lib/roles";
import { actorCourseWhere, buildTenancyViewer, calendarCourseWhere, can, courseScopeOf, needsScope, scopedCourseWhere, seesAllPayoutRecoveries, staffScope, type TenancyInput } from "../src/lib/viewer-core";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const ws = { id: "w", slug: "w", name: "W", kind: "ORGANISATION" as const, timezone: "Africa/Johannesburg", logoUrl: null, accentColor: null, billingState: "ACTIVE" as const, trialEndsAt: null };
function viewerWith(m: Partial<TenancyInput["memberships"][number]> & { role: "OWNER" | "ADMIN" | "TUTOR" }, mode: "organisation" | "tutor" | null = null) {
  return buildTenancyViewer({
    user: { id: "u", name: "U", email: "u@example.test", emailVerified: true, platformRole: "USER", imageUrl: null },
    memberships: [{ id: "m1", workspace: ws, teams: [], ...m }],
    learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: "w", mode,
  });
}

// Presets.
check("owner holds everything an admin does, plus closing and payouts", ROLE_PRESETS.ADMIN.permissions.every((p) => ROLE_PRESETS.OWNER.permissions.includes(p)) && ROLE_PRESETS.OWNER.permissions.includes("workspace.delete"), true);
check("every preset except owner stays within an admin", Object.values(ROLE_PRESETS).filter((p) => p.key !== "OWNER").every((p) => p.permissions.every((x) => CUSTOM_ROLE_CEILING.has(x))), true);
check("base roles keep their scopes", [ROLE_PRESETS.OWNER.scope, ROLE_PRESETS.ADMIN.scope, ROLE_PRESETS.TUTOR.scope], ["WORKSPACE", "WORKSPACE", "OWN_COURSES"]);

// The base roles are unchanged for existing members.
const tutor = viewerWith({ role: "TUTOR" });
check("a tutor: own courses, scoped edit, no billing", [tutor.membership?.roleKey, staffScope(tutor), needsScope(tutor, "courses.edit"), can(tutor, "billing.view")], ["TUTOR", "OWN_COURSES", true, false]);
const admin = viewerWith({ role: "ADMIN" });
check("an admin: whole workspace, unscoped, gets the new reports permission", [staffScope(admin), needsScope(admin, "courses.edit"), can(admin, "reports.view"), can(admin, "workspace.delete")], ["WORKSPACE", false, true, false]);

// Presets beyond the base roles.
const exec = viewerWith({ role: "ADMIN", presetRole: "EXECUTIVE" });
check("an executive reads reports and billing but can't edit or invite", [can(exec, "reports.view"), can(exec, "billing.view"), can(exec, "courses.edit"), can(exec, "members.invite"), exec.membership?.roleName], [true, true, false, false, "Executive"]);
const bm = viewerWith({ role: "ADMIN", presetRole: "BRANCH_MANAGER", branchIds: ["b1"], branchTeamIds: ["t1", "t2"] });
check("a branch manager: branch scope with their branches and teams", [staffScope(bm), bm.membership?.branchIds, bm.membership?.branchTeamIds, needsScope(bm, "courses.edit"), can(bm, "billing.manage")], ["BRANCHES", ["b1"], ["t1", "t2"], true, false]);
check("their course scope includes the branches", courseScopeOf(bm, "courses.edit"), { membershipId: "m1", branchIds: ["b1"] });
check("course filter: own, taught, or in a branch's team", scopedCourseWhere({ membershipId: "m1", branchIds: ["b1"] }), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }, { team: { branchId: { in: ["b1"] } } }] });
check("a tutor's filter has no branch part", scopedCourseWhere({ membershipId: "m1", branchIds: [] }), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }] });
const fin = viewerWith({ role: "ADMIN", presetRole: "FINANCE" });
check("finance: money and timesheets, no courses", [can(fin, "fees.manage"), can(fin, "timesheets.manage"), can(fin, "courses.edit"), needsScope(fin, "fees.manage")], [true, true, false, false]);
check("an owner preset name is ignored on a non-owner", effectiveRole({ role: "ADMIN", presetRole: "OWNER" }).key, "ADMIN");

// #243: role scope in course teams, the calendar and payout recoveries.
check("team move: a branch actor holds own, taught and branch courses", actorCourseWhere({ scope: "BRANCHES", membershipId: "m1", branchIds: ["b1"] }), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }, { team: { branchId: { in: ["b1"] } } }] });
check("team move: an own-courses actor ignores branch ids", actorCourseWhere({ scope: "OWN_COURSES", membershipId: "m1", branchIds: ["b1"] }), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }] });
check("team move: whole workspace is unrestricted", actorCourseWhere({ scope: "WORKSPACE", membershipId: "m1", branchIds: [] }), null);
check("calendar: a branch manager sees own, taught and branch courses", calendarCourseWhere(bm), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }, { team: { branchId: { in: ["b1"] } } }] });
check("calendar: an admin sees the whole workspace", calendarCourseWhere(admin), null);
check("calendar: a tutor sees own and taught only", calendarCourseWhere(tutor), { OR: [{ ownerMembershipId: "m1" }, { staff: { some: { membershipId: "m1" } } }] });
check("payout recoveries: a branch manager sees only their own account's", seesAllPayoutRecoveries(bm), false);
check("payout recoveries: finance (whole organisation) sees all", seesAllPayoutRecoveries(fin), true);
check("payout recoveries: a tutor sees only their own", seesAllPayoutRecoveries(tutor), false);

// An organisation's own role.
const custom = viewerWith({ role: "ADMIN", customRole: { id: "r1", name: "Coordinator", permissions: ["courses.edit", "reports.view", "workspace.delete", "admin.console"], scope: "BRANCHES" }, branchIds: ["b2"] });
check("a custom role: its own name and scope, and never more than an admin", [custom.membership?.roleKey, custom.membership?.roleName, staffScope(custom), can(custom, "courses.edit"), can(custom, "workspace.delete"), can(custom, "admin.console")], ["custom:r1", "Coordinator", "BRANCHES", true, false, false]);

// Tutor mode still narrows an owner who teaches.
const ownerTutorMode = viewerWith({ role: "OWNER", teaches: true }, "tutor");
check("tutor mode: own courses whatever the role", [ownerTutorMode.mode, staffScope(ownerTutorMode), can(ownerTutorMode, "billing.view")], ["tutor", "OWN_COURSES", false]);

// Read-only keeps permissions (pages stay; writes are refused on the server).
const ro = buildTenancyViewer({
  user: { id: "u", name: "U", email: "u@example.test", emailVerified: true, platformRole: "USER", imageUrl: null },
  memberships: [{ id: "m1", role: "ADMIN", presetRole: "BRANCH_MANAGER", branchIds: ["b1"], workspace: { ...ws, billingState: "READ_ONLY" }, teams: [] }],
  learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: "w",
});
check("read-only branch manager keeps the role's permissions", [ro.workspace?.readOnly, can(ro, "courses.edit")], [true, true]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll role checks passed.");
