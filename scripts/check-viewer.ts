/**
 * Checks the pure half of getViewer() against the permission matrix in
 * docs/revamp/a/design/01-tenancy-roles.md and the contract in
 * docs/revamp/contracts/viewer.md.
 *
 *   npx tsx scripts/check-viewer.ts
 */

import {
  buildLegacyViewer,
  buildTenancyViewer,
  hasTenancy,
  type TenancyInput,
  type TenancyWorkspaceRow,
  can,
  LEGACY_WORKSPACE,
  needsScope,
  PERMISSIONS,
  permissionsFor,
  type LegacyRole,
  type Permission,
} from "../src/lib/viewer-core";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const user = (role: LegacyRole) => ({
  id: "u1", name: "Test User", email: "test@example.invalid", role, emailVerified: true, imageUrl: null,
});
const has = (perms: Permission[], p: Permission) => perms.includes(p);

// Shape per legacy role
const tutor = buildLegacyViewer({ user: user("TUTOR"), profileId: "t1" });
check("tutor: persona staff", tutor.persona, "staff");
check("tutor: in the legacy workspace", tutor.workspace?.id, LEGACY_WORKSPACE.id);
check("tutor: membership role TUTOR", tutor.membership?.role, "TUTOR");
check("tutor: can create courses", can(tutor, "courses.create"), true);
check("tutor: cannot see billing", can(tutor, "billing.view"), false);
check("tutor: cannot delete the workspace", can(tutor, "workspace.delete"), false);
check("tutor: no payouts in an organisation", can(tutor, "payouts.connect"), false);
check("tutor: editing a course needs a scope", needsScope(tutor, "courses.edit"), true);
check("tutor: creating a course needs no scope", needsScope(tutor, "courses.create"), false);

const student = buildLegacyViewer({ user: user("STUDENT"), profileId: "s1" });
check("student: persona learner", student.persona, "learner");
check("student: learner id is the Student profile", student.learner?.id, "s1");
check("student: minor, payments hidden", [student.learner?.isMinor, student.learner?.paymentVisible], [true, false]);
check("student: cannot pay (payments hidden)", can(student, "fees.pay"), false);
check("student: can view content (scoped)", [can(student, "content.view"), needsScope(student, "content.view")], [true, true]);
check("student: no staff permissions", can(student, "courses.create"), false);

const parent = buildLegacyViewer({ user: user("PARENT"), profileId: null });
check("parent: persona guardian, no workspace", [parent.persona, parent.workspace], ["guardian", null]);
check("parent: no children before Phase 1", parent.children.length, 0);
check("parent: can pay (own children only)", can(parent, "fees.pay"), true);

const admin = buildLegacyViewer({ user: user("ADMIN"), profileId: null });
check("admin: persona admin, platform role NEXA_ADMIN", [admin.persona, admin.user.platformRole], ["admin", "NEXA_ADMIN"]);
check("admin: console and overrides", ["admin.console", "admin.override", "admin.impersonate"].every((p) => can(admin, p as Permission)), true);
check("admin: never scoped", needsScope(admin, "content.view"), false);
check("admin: does not pay fees", can(admin, "fees.pay"), false);

// Matrix rules
const owner = permissionsFor({ persona: "staff", membershipRole: "OWNER", workspaceKind: "ORGANISATION", learnerPaymentVisible: false, hasActiveGuardian: false });
const orgAdmin = permissionsFor({ persona: "staff", membershipRole: "ADMIN", workspaceKind: "ORGANISATION", learnerPaymentVisible: false, hasActiveGuardian: false });
check("owner: can delete the workspace; admin cannot", [has(owner, "workspace.delete"), has(orgAdmin, "workspace.delete")], [true, false]);
check("owner and admin: no admin.* permissions", [owner, orgAdmin].some((ps) => ps.some((p) => p.startsWith("admin."))), false);
const soloTutor = permissionsFor({ persona: "staff", membershipRole: "TUTOR", workspaceKind: "SOLO", learnerPaymentVisible: false, hasActiveGuardian: false });
check("solo tutor: can connect payouts", has(soloTutor, "payouts.connect"), true);
const adultPaying = permissionsFor({ persona: "learner", membershipRole: null, workspaceKind: "ORGANISATION", learnerPaymentVisible: true, hasActiveGuardian: false });
const adultGuarded = permissionsFor({ persona: "learner", membershipRole: null, workspaceKind: "ORGANISATION", learnerPaymentVisible: true, hasActiveGuardian: true });
check("adult student pays only when visible and no guardian", [has(adultPaying, "fees.pay"), has(adultGuarded, "fees.pay")], [true, false]);
check("none persona has nothing", permissionsFor({ persona: "none", membershipRole: null, workspaceKind: null, learnerPaymentVisible: false, hasActiveGuardian: false }), []);
check("permissions come back in catalogue order", owner, PERMISSIONS.filter((p) => owner.includes(p)));
check("no mode field (owner removed modes)", "mode" in tutor, false);

// Phase 1: from the tenancy tables
const ws = (id: string, over: Partial<TenancyWorkspaceRow> = {}): TenancyWorkspaceRow => ({
  id, slug: id, name: "WS " + id, kind: "ORGANISATION", timezone: "Africa/Johannesburg",
  logoUrl: null, accentColor: null, billingState: "ACTIVE", trialEndsAt: null, ...over,
});
const base = { id: "u1", name: "Test User", email: "test@example.invalid", emailVerified: true, platformRole: "USER" as const, imageUrl: null };
const tin = (over: Partial<TenancyInput>): TenancyInput => ({
  user: base, memberships: [], learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null, ...over,
});

const ownerV = buildTenancyViewer(tin({ memberships: [{ id: "m1", role: "OWNER", workspace: ws("a"), teams: [] }] }));
check("tenancy owner: staff in its workspace", [ownerV.persona, ownerV.workspace?.id, ownerV.membership?.role], ["staff", "a", "OWNER"]);
check("tenancy owner: billing and delete", [can(ownerV, "billing.manage"), can(ownerV, "workspace.delete")], [true, true]);
check("tenancy owner: no scope needed", needsScope(ownerV, "courses.edit"), false);

const two = tin({
  memberships: [{ id: "m1", role: "TUTOR", workspace: ws("a"), teams: [{ teamId: "t1", isLead: true }, { teamId: "t2", isLead: false }] }],
  learners: [{ id: "l1", isMinor: false, paymentVisible: true, workspace: ws("b") }],
});
check("two workspaces listed, staff first", buildTenancyViewer(two).workspaces.map((w) => [w.id, w.as]), [["a", "staff"], ["b", "learner"]]);
check("default active = first membership", buildTenancyViewer(two).persona, "staff");
check("team ids and lead team ids", [buildTenancyViewer(two).membership?.teamIds, buildTenancyViewer(two).membership?.leadTeamIds], [["t1", "t2"], ["t1"]]);
const asLearner = buildTenancyViewer({ ...two, activeWorkspaceId: "b" });
check("cookie switches to the learner workspace", [asLearner.persona, asLearner.learner?.id, asLearner.membership], ["learner", "l1", null]);
check("adult learner with payment visible can pay", can(asLearner, "fees.pay"), true);
check("cookie for a foreign workspace is ignored", buildTenancyViewer({ ...two, activeWorkspaceId: "zzz" }).workspace?.id, "a");

const minor = buildTenancyViewer(tin({ learners: [{ id: "l2", isMinor: true, paymentVisible: true, workspace: ws("a") }] }));
check("a minor never sees payments, even if the flag is set", [minor.learner?.paymentVisible, can(minor, "fees.pay")], [false, false]);
const guarded = buildTenancyViewer(tin({ learners: [{ id: "l3", isMinor: false, paymentVisible: true, workspace: ws("a") }], hasActiveGuardian: true }));
check("an adult with an active guardian does not pay", can(guarded, "fees.pay"), false);

const parentV = buildTenancyViewer(tin({ children: [{ userId: "c1", name: "Child", imageUrl: null, workspaces: [{ id: "a", name: "WS a" }] }] }));
check("guardian: no workspace, sees children", [parentV.persona, parentV.workspace, parentV.children.length], ["guardian", null, 1]);

const adminV = buildTenancyViewer(tin({ user: { ...base, platformRole: "NEXA_ADMIN" } }));
check("Nexa admin with no workspace: admin persona", [adminV.persona, can(adminV, "admin.console")], ["admin", true]);
const teachingAdmin = buildTenancyViewer(tin({ user: { ...base, platformRole: "NEXA_ADMIN" }, memberships: [{ id: "m9", role: "TUTOR", workspace: ws("a"), teams: [] }] }));
check("Nexa admin who teaches: staff, keeps the console", [teachingAdmin.persona, can(teachingAdmin, "admin.console")], ["staff", true]);

const ro = buildTenancyViewer(tin({ memberships: [{ id: "m1", role: "OWNER", workspace: ws("a", { billingState: "READ_ONLY", trialEndsAt: new Date("2027-01-01T00:00:00Z") }), teams: [] }] }));
check("read-only billing state sets readOnly", [ro.workspace?.readOnly, ro.workspace?.trialEndsAt], [true, "2027-01-01T00:00:00.000Z"]);
check("hasTenancy false with no rows", hasTenancy({ user: base, memberships: [], learners: [], children: [] }), false);
check("hasTenancy true for a Nexa admin", hasTenancy({ user: { ...base, platformRole: "NEXA_ADMIN" }, memberships: [], learners: [], children: [] }), true);
check("tenancy viewer has no mode field", "mode" in ownerV, false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
