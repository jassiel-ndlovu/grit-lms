/**
 * Checks the pure half of getViewer() against the permission matrix in
 * docs/revamp/a/design/01-tenancy-roles.md and the contract in
 * docs/revamp/contracts/viewer.md.
 *
 *   npx tsx scripts/check-viewer.ts
 */

import {
  buildLegacyViewer,
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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
