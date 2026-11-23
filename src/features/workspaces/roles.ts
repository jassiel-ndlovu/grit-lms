/**
 * Roles, branches and teams (owner decision 22 Nov; #216 phase 1).
 * Contract: viewer.md, "Roles and branches". Server only; the permission
 * checks that need the viewer are in ./role-actions.ts.
 *
 * Rules:
 *   - Nobody gives a role holding a permission they don't hold themselves,
 *     or a wider scope than their own. Owners are never changed here.
 *   - An organisation's own role never holds more than an admin.
 *   - A branch role needs at least one branch; a branch can't be deleted
 *     while teams or people are in it.
 */

import "server-only";

import type { MembershipRole } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { actorCourseWhere } from "@/lib/viewer-core";
import { ASSIGNABLE_PRESETS, CUSTOM_ROLE_CEILING, effectiveRole, isPresetKey, ROLE_PRESETS, type RoleScope } from "@/lib/roles";
import { UserError } from "@/lib/user-error";
import type { Permission } from "@/lib/viewer-core";

export type RoleActor = { userId: string; workspaceId: string; membershipId: string; permissions: Permission[]; scope: RoleScope; branchIds: string[] };

const SCOPE_RANK: Record<RoleScope, number> = { OWN_COURSES: 0, BRANCHES: 1, WORKSPACE: 2 };
const baseRoleFor = (scope: RoleScope): MembershipRole => (scope === "OWN_COURSES" ? "TUTOR" : "ADMIN");

function audit(actor: RoleActor, action: string, targetType: string, targetId: string, data: object) {
  return prisma.auditLog.create({ data: { workspaceId: actor.workspaceId, actorUserId: actor.userId, action, targetType, targetId, data } });
}

/** Refuses a role the actor couldn't hold themselves. */
function assertWithinActor(actor: RoleActor, permissions: readonly string[], scope: RoleScope) {
  const missing = permissions.filter((p) => !actor.permissions.includes(p as Permission));
  if (missing.length) throw new UserError(`You can't give permissions you don't have yourself (${missing.join(", ")}).`);
  if (SCOPE_RANK[scope] > SCOPE_RANK[actor.scope]) throw new UserError("You can't give a wider reach than your own.");
}

/* -------------------------------- Roles --------------------------------- */

export async function listRolesFor(workspaceId: string) {
  const [custom, counts] = await Promise.all([
    prisma.workspaceRole.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, basedOn: true, permissions: true, scope: true, updatedAt: true } }),
    prisma.membership.groupBy({ by: ["presetRole", "customRoleId", "role"], where: { workspaceId, status: "ACTIVE" }, _count: true }),
  ]);
  const membersOf = (key: string) =>
    counts.filter((c) => (c.customRoleId ? `custom:${c.customRoleId}` : (c.presetRole ?? c.role)) === key).reduce((n, c) => n + c._count, 0);
  return {
    presets: ["OWNER", ...ASSIGNABLE_PRESETS].map((k) => {
      const p = ROLE_PRESETS[k as keyof typeof ROLE_PRESETS];
      return { key: p.key, name: p.name, description: p.description, scope: p.scope, permissions: [...p.permissions], assignable: k !== "OWNER", members: membersOf(p.key) };
    }),
    custom: custom.map((r) => ({ key: `custom:${r.id}`, id: r.id, name: r.name, basedOn: r.basedOn, scope: r.scope, permissions: r.permissions, updatedAt: r.updatedAt.toISOString(), members: membersOf(`custom:${r.id}`) })),
  };
}

type RoleInput = { name: string; basedOn: string; permissions: string[]; scope: RoleScope };

function cleanRole(input: RoleInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new UserError("Give the role a name of 2 to 60 characters.");
  if (isPresetKey(name.toUpperCase().replace(/\s+/g, "_"))) throw new UserError("That name belongs to a built-in role. Choose another.");
  const permissions = [...new Set(input.permissions)];
  const outside = permissions.filter((p) => !CUSTOM_ROLE_CEILING.has(p as Permission));
  if (outside.length) throw new UserError(`An organisation's own role can't hold ${outside.join(", ")}.`);
  if (!permissions.length) throw new UserError("Tick at least one permission.");
  return { name, permissions, basedOn: isPresetKey(input.basedOn) ? input.basedOn : "ADMIN" };
}

export async function createRoleFor(actor: RoleActor, input: RoleInput) {
  const r = cleanRole(input);
  assertWithinActor(actor, r.permissions, input.scope);
  try {
    const role = await prisma.workspaceRole.create({
      data: { workspaceId: actor.workspaceId, name: r.name, basedOn: r.basedOn, baseRole: baseRoleFor(input.scope), permissions: r.permissions, scope: input.scope, createdById: actor.userId },
      select: { id: true },
    });
    await audit(actor, "role.create", "WorkspaceRole", role.id, { name: r.name, scope: input.scope, permissions: r.permissions });
    return { key: `custom:${role.id}`, id: role.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new UserError("A role with that name already exists.");
    throw e;
  }
}

export async function updateRoleFor(actor: RoleActor, roleId: string, input: RoleInput) {
  const existing = await prisma.workspaceRole.findFirst({ where: { id: roleId, workspaceId: actor.workspaceId }, select: { permissions: true, scope: true } });
  if (!existing) throw new UserError("Role not found.");
  const r = cleanRole(input);
  assertWithinActor(actor, [...r.permissions, ...existing.permissions], SCOPE_RANK[input.scope] > SCOPE_RANK[existing.scope] ? input.scope : existing.scope);
  await prisma.workspaceRole.update({ where: { id: roleId }, data: { name: r.name, permissions: r.permissions, scope: input.scope, baseRole: baseRoleFor(input.scope) } });
  // People on a role that stopped being a branch role keep no branches; one that became one keeps theirs empty until set.
  if (input.scope !== "BRANCHES") await prisma.membership.updateMany({ where: { customRoleId: roleId }, data: { branchIds: [] } });
  await prisma.membership.updateMany({ where: { customRoleId: roleId }, data: { role: baseRoleFor(input.scope) } });
  await audit(actor, "role.update", "WorkspaceRole", roleId, { name: r.name, scope: input.scope, permissions: r.permissions });
  return { key: `custom:${roleId}` };
}

export async function deleteRoleFor(actor: RoleActor, roleId: string) {
  const role = await prisma.workspaceRole.findFirst({ where: { id: roleId, workspaceId: actor.workspaceId }, select: { name: true, permissions: true, scope: true, _count: { select: { memberships: true } } } });
  if (!role) throw new UserError("Role not found.");
  if (role._count.memberships) throw new UserError(`${role._count.memberships} ${role._count.memberships === 1 ? "person has" : "people have"} this role. Give them another role first.`);
  assertWithinActor(actor, role.permissions, role.scope);
  await prisma.workspaceRole.delete({ where: { id: roleId } });
  await audit(actor, "role.delete", "WorkspaceRole", roleId, { name: role.name });
  return { deleted: true };
}

/** Gives a member a preset (by key) or the organisation's own role ("custom:<id>"), with branches for a branch role. */
export async function setMemberRoleFor(actor: RoleActor, membershipId: string, input: { roleKey: string; branchIds?: string[] }) {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: actor.workspaceId, status: "ACTIVE" },
    select: { userId: true, role: true, presetRole: true, branchIds: true, customRole: { select: { id: true, name: true, permissions: true, scope: true } } },
  });
  if (!m) throw new UserError("Member not found.");
  if (m.userId === actor.userId) throw new UserError("You can't change your own role.");
  if (m.role === "OWNER") throw new UserError("An owner's role can't be changed here.");
  // The actor must be able to hold both the role the person has now and the one they're getting.
  const current = effectiveRole(m);
  assertWithinActor(actor, current.permissions, current.scope);

  let next: { presetRole: string | null; customRoleId: string | null; permissions: readonly string[]; scope: RoleScope; base: MembershipRole; name: string };
  if (input.roleKey.startsWith("custom:")) {
    const role = await prisma.workspaceRole.findFirst({ where: { id: input.roleKey.slice(7), workspaceId: actor.workspaceId }, select: { id: true, name: true, permissions: true, scope: true, baseRole: true } });
    if (!role) throw new UserError("Role not found.");
    next = { presetRole: null, customRoleId: role.id, permissions: role.permissions, scope: role.scope, base: role.baseRole, name: role.name };
  } else if (isPresetKey(input.roleKey) && (ASSIGNABLE_PRESETS as readonly string[]).includes(input.roleKey)) {
    const p = ROLE_PRESETS[input.roleKey];
    next = { presetRole: ["ADMIN", "TUTOR"].includes(p.key) ? null : p.key, customRoleId: null, permissions: p.permissions, scope: p.scope, base: p.baseRole, name: p.name };
  } else {
    throw new UserError("Choose a role.");
  }
  assertWithinActor(actor, next.permissions, next.scope);

  let branchIds: string[] = [];
  if (next.scope === "BRANCHES") {
    branchIds = [...new Set(input.branchIds ?? [])];
    if (!branchIds.length) throw new UserError("Choose at least one branch for this role.");
    const found = await prisma.branch.count({ where: { id: { in: branchIds }, workspaceId: actor.workspaceId } });
    if (found !== branchIds.length) throw new UserError("One of those branches isn't in this organisation.");
    if (actor.scope === "BRANCHES" && branchIds.some((b) => !actor.branchIds.includes(b))) throw new UserError("You can only give branches you manage.");
  }
  await prisma.membership.update({ where: { id: membershipId }, data: { role: next.base, presetRole: next.presetRole, customRoleId: next.customRoleId, branchIds } });
  await audit(actor, "members.role", "Membership", membershipId, { from: current.key, to: input.roleKey, branches: branchIds.length });
  return { roleKey: input.roleKey, roleName: next.name, scope: next.scope, branchIds };
}

/* ------------------------------ Branches -------------------------------- */

export async function listBranchesFor(workspaceId: string) {
  const [branches, unassigned, members] = await Promise.all([
    prisma.branch.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, teams: { orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { courses: true, members: true } } } } } }),
    prisma.team.findMany({ where: { workspaceId, branchId: null }, orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { courses: true, members: true } } } }),
    prisma.membership.findMany({ where: { workspaceId, status: "ACTIVE", branchIds: { isEmpty: false } }, select: { branchIds: true } }),
  ]);
  const people = (id: string) => members.filter((m) => m.branchIds.includes(id)).length;
  const team = (t: { id: string; name: string; _count: { courses: number; members: number } }) => ({ id: t.id, name: t.name, courses: t._count.courses, members: t._count.members });
  return {
    branches: branches.map((b) => ({ id: b.id, name: b.name, teams: b.teams.map(team), people: people(b.id) })),
    teamsWithoutBranch: unassigned.map(team),
  };
}

function cleanName(name: string, what: string) {
  const n = name.trim();
  if (n.length < 2 || n.length > 60) throw new UserError(`Give the ${what} a name of 2 to 60 characters.`);
  return n;
}

export async function createBranchFor(actor: RoleActor, name: string) {
  if (actor.scope !== "WORKSPACE") throw new UserError("Only people who run the whole organisation can add branches.");
  try {
    const b = await prisma.branch.create({ data: { workspaceId: actor.workspaceId, name: cleanName(name, "branch") }, select: { id: true } });
    await audit(actor, "branch.create", "Branch", b.id, { name });
    return { id: b.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new UserError("A branch with that name already exists.");
    throw e;
  }
}

export async function renameBranchFor(actor: RoleActor, branchId: string, name: string) {
  if (actor.scope === "BRANCHES" ? !actor.branchIds.includes(branchId) : actor.scope !== "WORKSPACE") throw new UserError("You can't rename that branch.");
  const r = await prisma.branch.updateMany({ where: { id: branchId, workspaceId: actor.workspaceId }, data: { name: cleanName(name, "branch") } });
  if (!r.count) throw new UserError("Branch not found.");
  await audit(actor, "branch.rename", "Branch", branchId, { name });
  return { id: branchId };
}

export async function deleteBranchFor(actor: RoleActor, branchId: string) {
  if (actor.scope !== "WORKSPACE") throw new UserError("Only people who run the whole organisation can remove branches.");
  const b = await prisma.branch.findFirst({ where: { id: branchId, workspaceId: actor.workspaceId }, select: { name: true, _count: { select: { teams: true } } } });
  if (!b) throw new UserError("Branch not found.");
  if (b._count.teams) throw new UserError("Move or remove this branch's teams first.");
  const people = await prisma.membership.count({ where: { workspaceId: actor.workspaceId, status: "ACTIVE", branchIds: { has: branchId } } });
  if (people) throw new UserError(`${people} ${people === 1 ? "person works" : "people work"} in this branch. Change their branches first.`);
  await prisma.branch.delete({ where: { id: branchId } });
  await audit(actor, "branch.delete", "Branch", branchId, { name: b.name });
  return { deleted: true };
}

/* -------------------------------- Teams --------------------------------- */

async function assertBranchReach(actor: RoleActor, branchId: string | null) {
  if (branchId && !(await prisma.branch.count({ where: { id: branchId, workspaceId: actor.workspaceId } }))) throw new UserError("Branch not found.");
  if (actor.scope === "BRANCHES" && (!branchId || !actor.branchIds.includes(branchId))) throw new UserError("You can only manage teams in your branches.");
  if (actor.scope === "OWN_COURSES") throw new UserError("You can't manage teams.");
}

export async function createTeamFor(actor: RoleActor, input: { name: string; branchId?: string | null }) {
  await assertBranchReach(actor, input.branchId ?? null);
  const t = await prisma.team.create({ data: { workspaceId: actor.workspaceId, name: cleanName(input.name, "team"), branchId: input.branchId ?? null }, select: { id: true } });
  await audit(actor, "team.create", "Team", t.id, { name: input.name, branchId: input.branchId ?? null });
  return { id: t.id };
}

async function loadTeam(actor: RoleActor, teamId: string) {
  const t = await prisma.team.findFirst({ where: { id: teamId, workspaceId: actor.workspaceId }, select: { id: true, name: true, branchId: true, _count: { select: { courses: true } } } });
  if (!t) throw new UserError("Team not found.");
  await assertBranchReach(actor, t.branchId);
  return t;
}

export async function updateTeamFor(actor: RoleActor, teamId: string, input: { name?: string; branchId?: string | null }) {
  await loadTeam(actor, teamId);
  if (input.branchId !== undefined) await assertBranchReach(actor, input.branchId);
  await prisma.team.update({ where: { id: teamId }, data: { ...(input.name !== undefined ? { name: cleanName(input.name, "team") } : {}), ...(input.branchId !== undefined ? { branchId: input.branchId } : {}) } });
  await audit(actor, "team.update", "Team", teamId, input);
  return { id: teamId };
}

export async function deleteTeamFor(actor: RoleActor, teamId: string) {
  const t = await loadTeam(actor, teamId);
  if (t._count.courses) throw new UserError("Move this team's courses to another team first.");
  await prisma.team.delete({ where: { id: teamId } });
  await audit(actor, "team.delete", "Team", teamId, { name: t.name });
  return { deleted: true };
}

/** Adds or removes a member on a team, and whether they lead it. */
export async function setTeamMemberFor(actor: RoleActor, teamId: string, input: { membershipId: string; member: boolean; isLead?: boolean }) {
  await loadTeam(actor, teamId);
  const m = await prisma.membership.findFirst({ where: { id: input.membershipId, workspaceId: actor.workspaceId, status: "ACTIVE" }, select: { id: true } });
  if (!m) throw new UserError("Member not found.");
  if (input.member) {
    await prisma.teamMember.upsert({ where: { teamId_membershipId: { teamId, membershipId: m.id } }, create: { teamId, membershipId: m.id, isLead: !!input.isLead }, update: { isLead: !!input.isLead } });
  } else {
    await prisma.teamMember.deleteMany({ where: { teamId, membershipId: m.id } });
  }
  await audit(actor, "team.member", "Team", teamId, input);
  return { teamId, ...input };
}

/** Puts a course in a team (and so in that team's branch), or takes it out. */
export async function setCourseTeamFor(actor: RoleActor, courseId: string, teamId: string | null) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId: actor.workspaceId }, select: { teamId: true } });
  if (!course) throw new UserError("Course not found.");
  // Below WORKSPACE scope the actor must already hold the course (#243), team or no team.
  const held = actorCourseWhere(actor);
  if (held && !(await prisma.course.findFirst({ where: { AND: [{ id: courseId }, held] }, select: { id: true } }))) {
    throw new UserError("You can only move courses you run or teach, or that are in your branches.");
  }
  // The actor must reach the course's current team (if any) and the new one.
  if (course.teamId) await loadTeam(actor, course.teamId);
  if (teamId) await loadTeam(actor, teamId);
  else if (actor.scope !== "WORKSPACE") throw new UserError("Only people who run the whole organisation can take a course out of every team.");
  await prisma.course.update({ where: { id: courseId }, data: { teamId } });
  await audit(actor, "course.team", "Course", courseId, { teamId });
  return { courseId, teamId };
}
