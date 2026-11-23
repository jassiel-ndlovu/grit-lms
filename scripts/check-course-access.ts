/**
 * Checks the pure parts of owner course access (issue #192, finding F3):
 * who gets the whole workspace, the Prisma filter, the row check the
 * actions use, and the "taught by" name.
 *
 *   npx tsx scripts/check-course-access.ts
 */

import {
  courseScopeFor,
  manageableBy,
  managesCourse,
  managesWholeWorkspace,
  otherTeacherName,
  tutorScope,
} from "../src/features/courses/lib/course-access";
import { taughtByUser } from "../src/features/courses/lib/tenancy-where";
import {
  buildLegacyViewer,
  buildTenancyViewer,
  type MembershipRole,
  type TenancyWorkspaceRow,
} from "../src/lib/viewer-core";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const ws = (id: string): TenancyWorkspaceRow => ({
  id, slug: id, name: id, kind: "ORGANISATION", timezone: "Africa/Johannesburg",
  logoUrl: null, accentColor: null, billingState: "ACTIVE", trialEndsAt: null,
});
const user = (id: string, platformRole: "USER" | "NEXA_ADMIN" = "USER") => ({
  id, name: id, email: `${id}@example.test`, emailVerified: true, platformRole, imageUrl: null, twoFactorEnabled: true,
});
const staff = (id: string, role: MembershipRole, workspaces = ["w1"], active: string | null = null) =>
  buildTenancyViewer({
    user: user(id),
    memberships: workspaces.map((w, i) => ({ id: `m${i}_${id}`, role: i === 0 ? role : "TUTOR", workspace: ws(w), teams: [] })),
    learners: [],
    children: [],
    hasActiveGuardian: false,
    activeWorkspaceId: active,
  });

// Who manages the whole workspace.
check("owner: whole workspace", courseScopeFor(staff("o", "OWNER")), { userId: "o", workspaceId: "w1" });
check("admin: whole workspace", courseScopeFor(staff("a", "ADMIN")), { userId: "a", workspaceId: "w1" });
check("tutor: own courses only", courseScopeFor(staff("t", "TUTOR")), { userId: "t", workspaceId: null });
check("owner of w1 acting in w2, where they tutor: own courses only",
  courseScopeFor(staff("o", "OWNER", ["w1", "w2"], "w2")), { userId: "o", workspaceId: null });
check("owner of w1 with w1 active", courseScopeFor(staff("o", "OWNER", ["w1", "w2"], "w1")), { userId: "o", workspaceId: "w1" });

// Organisation / Tutor mode (#192): only for an owner or admin who teaches.
const teachingOwner = (mode: "organisation" | "tutor") =>
  buildTenancyViewer({
    user: user("o"),
    memberships: [{ id: "m_o", role: "OWNER", workspace: ws("w1"), teams: [], teaches: true }],
    learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null, mode,
  });
check("teaching owner, Organisation mode: whole workspace", courseScopeFor(teachingOwner("organisation")).workspaceId, "w1");
check("teaching owner, Tutor mode: own courses only", courseScopeFor(teachingOwner("tutor")).workspaceId, null);

const learner = buildTenancyViewer({
  user: user("s"), memberships: [],
  learners: [{ id: "l1", isMinor: false, paymentVisible: true, workspace: ws("w1") }],
  children: [], hasActiveGuardian: false, activeWorkspaceId: null,
});
check("learner: never", managesWholeWorkspace(learner), false);
const nexaAdmin = buildTenancyViewer({
  user: user("n", "NEXA_ADMIN"), memberships: [], learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null,
});
check("Nexa admin with no workspace: never", managesWholeWorkspace(nexaAdmin), false);
const legacyTutor = buildLegacyViewer({
  user: { id: "lt", name: "lt", email: "lt@example.test", role: "TUTOR", emailVerified: true, imageUrl: null },
  profileId: "tp1",
});
check("legacy tutor: own courses only", courseScopeFor(legacyTutor).workspaceId, null);
check("tutorScope", tutorScope("u"), { userId: "u", workspaceId: null });

// The Prisma filter.
check("tutor filter is taughtByUser", manageableBy(tutorScope("t")), taughtByUser("t"));
check("owner filter: workspace or teaches", manageableBy({ userId: "o", workspaceId: "w1" }), {
  OR: [{ workspaceId: "w1" }, taughtByUser("o")],
});

// The row check the server actions use.
const row = (workspaceId: string | null, staff: unknown[], over: { ownerMembershipId?: string; branchId?: string | null } = {}) => ({
  workspaceId, staff, ownerMembershipId: over.ownerMembershipId ?? null, team: over.branchId === undefined ? null : { branchId: over.branchId },
});
const ownerScope = { userId: "o", workspaceId: "w1" };
check("teaches it", managesCourse(tutorScope("t"), row("w1", [{ membershipId: "m" }])), true);
check("tutor, someone else's course: no (the 404)", managesCourse(tutorScope("t"), row("w1", [])), false);
check("owner, a tutor's course in their workspace", managesCourse(ownerScope, row("w1", [])), true);
check("owner, a course in another workspace", managesCourse(ownerScope, row("w2", [])), false);
check("owner, a course with no workspace", managesCourse(ownerScope, row(null, [])), false);

// Branch roles (viewer.md, "Roles and branches").
const withRole = (presetRole: string, branchIds: string[] = [], role: MembershipRole = "ADMIN", mode?: "tutor") =>
  buildTenancyViewer({
    user: user("p"),
    memberships: [{ id: "m_p", role, presetRole, branchIds, branchTeamIds: [], workspace: ws("w1"), teams: [], teaches: true }],
    learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null, mode,
  });
const branchScope = courseScopeFor(withRole("BRANCH_MANAGER", ["b1"]));
check("branch manager: not the whole workspace", branchScope.workspaceId, null);
check("branch manager: their branches", branchScope.branches, { workspaceId: "w1", membershipId: "m_p", branchIds: ["b1"] });
check("branch manager with no branches: what they teach", courseScopeFor(withRole("BRANCH_MANAGER")).branches, undefined);
check("branch manager in Tutor mode: what they teach", courseScopeFor(withRole("BRANCH_MANAGER", ["b1"], "ADMIN", "tutor")).branches, undefined);
check("support staff edit no courses", courseScopeFor(withRole("SUPPORT", ["b1"])), { userId: "p", workspaceId: null });
check("executive edits no courses", courseScopeFor(withRole("EXECUTIVE")).workspaceId, null);
check("executive reads every course's marks", courseScopeFor(withRole("EXECUTIVE"), "grades.view").workspaceId, "w1");
check("finance reads no marks", courseScopeFor(withRole("FINANCE"), "grades.view"), { userId: "p", workspaceId: null });
check("branch manager reads their branches' marks", courseScopeFor(withRole("BRANCH_MANAGER", ["b1"]), "grades.view").branches?.branchIds, ["b1"]);
check("branch filter: in this workspace, owned, taught or in the branch; or taught anywhere", manageableBy(branchScope), {
  OR: [
    { workspaceId: "w1", OR: [{ ownerMembershipId: "m_p" }, { staff: { some: { membershipId: "m_p" } } }, { team: { branchId: { in: ["b1"] } } }] },
    taughtByUser("p"),
  ],
});
check("branch course", managesCourse(branchScope, row("w1", [], { branchId: "b1" })), true);
check("another branch's course", managesCourse(branchScope, row("w1", [], { branchId: "b2" })), false);
check("a course in a team without a branch", managesCourse(branchScope, row("w1", [], { branchId: null })), false);
check("a course in no team", managesCourse(branchScope, row("w1", [])), false);
check("a course they own in no team", managesCourse(branchScope, row("w1", [], { ownerMembershipId: "m_p" })), true);
check("the same branch id in another workspace", managesCourse(branchScope, row("w2", [], { branchId: "b1" })), false);
check("teaches a course elsewhere", managesCourse(branchScope, row("w2", [{ membershipId: "x" }])), true);

// "Taught by" on courses the viewer doesn't teach.
const course = (id: string, name: string, fullName: string | null) => ({
  ownerMembership: { user: { id, name, tutorProfile: fullName == null ? null : { fullName } } },
});
check("own course: no name", otherTeacherName("o", course("o", "Nomvula", null)), null);
check("tutor's course: their name", otherTeacherName("o", course("t1", "Ayanda Zulu", null)), "Ayanda Zulu");
check("Tutor profile name wins", otherTeacherName("o", course("t1", "ayanda", "Ayanda Zulu")), "Ayanda Zulu");
check("no teacher", otherTeacherName("o", { ownerMembership: null }), null);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
