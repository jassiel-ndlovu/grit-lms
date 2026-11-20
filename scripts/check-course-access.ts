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
const ownerScope = { userId: "o", workspaceId: "w1" };
check("teaches it", managesCourse(tutorScope("t"), { workspaceId: "w1", staff: [{ membershipId: "m" }] }), true);
check("tutor, someone else's course: no (the 404)", managesCourse(tutorScope("t"), { workspaceId: "w1", staff: [] }), false);
check("owner, a tutor's course in their workspace", managesCourse(ownerScope, { workspaceId: "w1", staff: [] }), true);
check("owner, a course in another workspace", managesCourse(ownerScope, { workspaceId: "w2", staff: [] }), false);
check("owner, a course with no workspace", managesCourse(ownerScope, { workspaceId: null, staff: [] }), false);

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
