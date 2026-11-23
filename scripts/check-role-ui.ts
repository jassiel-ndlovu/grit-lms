/**
 * Checks the pure parts of the role, member-role, and branches-and-teams
 * screens (viewer.md, "Roles and branches"): every permission has a label,
 * and the screens offer only what A's actions would accept.
 *
 *   npx tsx scripts/check-role-ui.ts
 */

import {
  assignableRoles, branchesWithin, copyName, count, grantsOf, managesTeam, mayGrant, memberRoleLine, NOT_NARROWED, PERMISSION_GROUPS,
  permissionLabels, roleLock, roleRows, scopeWithin, withinGrants, type Grants,
} from "../src/components/settings/roles/role-ui";
import { editingMembership } from "../src/features/courses/lib/tenancy-where";
import { ASSIGNABLE_PRESETS, CUSTOM_ROLE_CEILING, ROLE_PRESETS } from "../src/lib/roles";
import { buildTenancyViewer, SCOPED_FOR_TUTOR, type MembershipRole } from "../src/lib/viewer-core";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// --- Permissions ---------------------------------------------------------------
const listed = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
check("every permission a role can hold is listed once", [...listed].sort(), [...CUSTOM_ROLE_CEILING].sort());
check("no label twice", new Set(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.label))).size, listed.length);
check("every permission of every preset has a label", Object.values(ROLE_PRESETS).filter((p) => permissionLabels(p.permissions).length !== p.permissions.length).map((p) => p.key), []);
check("labels in the editor's order", permissionLabels(["grades.view", "courses.edit"]), ["Edit courses, set and mark work", "See marks"]);
check("a narrowed permission isn't marked organisation-wide", [...NOT_NARROWED].filter((p) => SCOPED_FOR_TUTOR.has(p)), []);

// --- What the viewer may give -------------------------------------------------
const grants = (key: keyof typeof ROLE_PRESETS, branchIds: string[] = []): Grants => ({ permissions: ROLE_PRESETS[key].permissions, scope: ROLE_PRESETS[key].scope, branchIds });
const rows = roleRows({
  presets: ["OWNER" as const, ...ASSIGNABLE_PRESETS].map((k) => ({ ...ROLE_PRESETS[k], permissions: [...ROLE_PRESETS[k].permissions], assignable: k !== "OWNER", members: 0 })),
  custom: [{ key: "custom:x", id: "x", name: "Marker", basedOn: "TUTOR", scope: "OWN_COURSES", permissions: ["courses.edit"], members: 2 }],
});
check("an owner gives everything but Owner", assignableRoles(grants("OWNER"), rows).map((r) => r.key), [...ASSIGNABLE_PRESETS, "custom:x"]);
check("an admin gives Admin too", assignableRoles(grants("ADMIN"), rows).some((r) => r.key === "ADMIN"), true);
const bm = grants("BRANCH_MANAGER", ["b1"]);
const bmKeys = assignableRoles(bm, rows).map((r) => r.key);
check("a branch manager can't give Admin or Executive", ["ADMIN", "EXECUTIVE", "FINANCE"].some((k) => bmKeys.includes(k)), false);
check("a branch manager gives Tutor and Support", ["TUTOR", "SUPPORT"].every((k) => bmKeys.includes(k)), true);
check("the organisation's role names what it came from", rows.find((r) => r.id === "x")?.basedOn, "Tutor");
check("scope: narrower is fine, wider isn't", [scopeWithin("BRANCHES", "OWN_COURSES"), scopeWithin("BRANCHES", "BRANCHES"), scopeWithin("BRANCHES", "WORKSPACE")], [true, true, false]);
check("same permissions, wider scope: no", withinGrants(bm, { permissions: ["courses.edit"], scope: "WORKSPACE" }), false);
check("tick: held", mayGrant(bm, "courses.edit"), true);
check("tick: not held", mayGrant(bm, "billing.manage"), false);
check("tick: never an owner's own", mayGrant(grants("OWNER"), "workspace.delete"), false);

// --- Whose role can be changed -------------------------------------------------
const member = (key: keyof typeof ROLE_PRESETS, over: object = {}) => ({ isSelf: false, roleKey: key as string, scope: ROLE_PRESETS[key].scope, permissions: ROLE_PRESETS[key].permissions, branches: [] as Array<{ id: string }>, ...over });
check("own role: locked", roleLock(grants("OWNER"), member("ADMIN", { isSelf: true })), "You can't change your own role.");
check("another owner: locked", roleLock(grants("OWNER"), member("OWNER")), "An owner's role can't be changed here.");
check("an admin changes an admin", roleLock(grants("ADMIN"), member("ADMIN")), null);
check("a branch manager can't change an admin", roleLock(bm, member("ADMIN")), "This role holds more than yours.");
check("nor someone also in a branch they don't manage", roleLock(bm, member("SUPPORT", { branches: [{ id: "b1" }, { id: "b2" }] })), "They also work in a branch you don't manage.");
check("someone in their branch is fine", roleLock(bm, member("SUPPORT", { branches: [{ id: "b1" }] })), null);

// --- Branches and teams --------------------------------------------------------
const branches = [{ id: "b1" }, { id: "b2" }];
check("whole organisation: every branch", branchesWithin(grants("ADMIN"), branches).length, 2);
check("branch manager: their own", branchesWithin(bm, branches), [{ id: "b1" }]);
check("tutor: none", branchesWithin(grants("TUTOR"), branches), []);
check("teams: admin manages one without a branch", managesTeam(grants("ADMIN"), null), true);
check("teams: branch manager only in their branch", [managesTeam(bm, "b1"), managesTeam(bm, "b2"), managesTeam(bm, null)], [true, false, false]);
check("teams: finance doesn't", managesTeam(grants("FINANCE"), "b1"), false);

// --- The viewer's grants -------------------------------------------------------
const viewer = (kind: "ORGANISATION" | "SOLO", role: MembershipRole, presetRole: string | null = null, mode?: "tutor") =>
  buildTenancyViewer({
    user: { id: "u", name: "u", email: "u@example.test", emailVerified: true, platformRole: "USER", imageUrl: null, twoFactorEnabled: true },
    memberships: [{
      id: "m", role, presetRole, branchIds: ["b1"], branchTeamIds: ["t1"], teams: [], teaches: true,
      workspace: { id: "w", slug: "w", name: "w", kind, timezone: "Africa/Johannesburg", logoUrl: null, accentColor: null, billingState: "ACTIVE", trialEndsAt: null },
    }],
    learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null, mode,
  });
check("solo practice: no grants", grantsOf(viewer("SOLO", "OWNER")), null);
check("owner: whole organisation", grantsOf(viewer("ORGANISATION", "OWNER"))?.scope, "WORKSPACE");
check("branch manager: their branches", grantsOf(viewer("ORGANISATION", "ADMIN", "BRANCH_MANAGER"))?.branchIds, ["b1"]);
check("owner in tutor mode: can't change roles", grantsOf(viewer("ORGANISATION", "OWNER", null, "tutor"))?.permissions.includes("members.role"), false);

// --- Words ---------------------------------------------------------------------
check("one and many", [count(1, "person", "people"), count(3, "person", "people"), count(2, "team")], ["1 person", "3 people", "2 teams"]);
check("role line: plain", memberRoleLine({ roleName: "Tutor", scope: "OWN_COURSES", branches: [] }), "Tutor");
check("role line: branches", memberRoleLine({ roleName: "Branch manager", scope: "BRANCHES", branches: [{ name: "Durban" }, { name: "Cape Town" }] }), "Branch manager · Durban, Cape Town");
check("role line: no branches", memberRoleLine({ roleName: "Support staff", scope: "BRANCHES", branches: [] }), "Support staff · no branches yet");
check("copy name", copyName("Tutor", ["Tutor"]), "Tutor (copy)");
check("copy name, taken", copyName("Tutor", ["tutor (COPY)"]), "Tutor (copy 2)");
check("copy name is at most 60 letters, and free", (() => {
  const long = "x".repeat(58);
  const first = copyName(long, []);
  const second = copyName(long, [first]);
  return [first.length <= 60, second.length <= 60, first !== second];
})(), [true, true, true]);

// --- Teaching needs a role that edits courses ----------------------------------
check(
  "presets without courses.edit don't teach",
  (editingMembership.OR as Array<{ OR?: Array<{ presetRole?: { in: string[] } | null }> }>)[1].OR?.[1].presetRole?.in,
  (Object.keys(ROLE_PRESETS) as Array<keyof typeof ROLE_PRESETS>).filter((k) => ROLE_PRESETS[k].permissions.includes("courses.edit")),
);
check("every base role edits courses, so a null preset counts", (["OWNER", "ADMIN", "TUTOR"] as const).every((k) => ROLE_PRESETS[k].permissions.includes("courses.edit")), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
