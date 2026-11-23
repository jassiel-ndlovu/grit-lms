/**
 * Pure helpers for the role, member-role, and branches-and-teams screens
 * (viewer.md, "Roles and branches"). No database or session, so
 * scripts/check-role-ui.ts can run them. The limits here only hide what A's
 * actions (features/workspaces/role-actions.ts) would refuse anyway.
 */

import { CUSTOM_ROLE_CEILING, isPresetKey, ROLE_PRESETS, type RoleScope } from "@/lib/roles";
import { staffScope, type Permission, type Viewer } from "@/lib/viewer-core";

export const roleRoutes = {
  index: "/dashboard/settings/roles",
  new: (from: string) => `/dashboard/settings/roles/new?from=${encodeURIComponent(from)}`,
  edit: (roleId: string) => `/dashboard/settings/roles/${roleId}`,
  branches: "/dashboard/settings/branches",
  team: (teamId: string) => `/dashboard/settings/branches/teams/${teamId}`,
};

/* ───── Permissions and scope in words ───── */

export interface PermissionOption {
  key: Permission;
  label: string;
  /** No screen uses it yet: ticking it changes nothing today. */
  soon?: boolean;
}

/** Every permission an organisation's own role can hold, each once (the check script compares with A's ceiling). */
export const PERMISSION_GROUPS: Array<{ title: string; items: PermissionOption[] }> = [
  {
    title: "Courses",
    items: [
      { key: "courses.create", label: "Create and delete courses" },
      { key: "courses.edit", label: "Edit courses, set and mark work" },
      { key: "courses.services", label: "Switch course services on and off" },
      { key: "content.view", label: "See course content" },
      { key: "grades.view", label: "See marks" },
      { key: "cover.manage", label: "Arrange cover for sessions", soon: true },
    ],
  },
  {
    title: "Students and parents",
    items: [
      { key: "learners.invite", label: "Add students and handle join requests" },
      { key: "guardians.link", label: "Link parents to students" },
      { key: "learners.paymentVisibility", label: "Choose which adult students see their fees", soon: true },
      { key: "enquiries.manage", label: "Handle enquiries", soon: true },
    ],
  },
  {
    title: "Messages",
    items: [
      { key: "messages.announce", label: "Send announcements", soon: true },
      { key: "messages.direct", label: "Send direct messages", soon: true },
    ],
  },
  {
    title: "Staff",
    items: [
      { key: "members.invite", label: "Invite staff" },
      { key: "members.role", label: "Change roles" },
      { key: "teams.manage", label: "Manage branches and teams" },
      { key: "timesheets.manage", label: "Manage timesheets", soon: true },
      { key: "staff.reviews", label: "Review staff", soon: true },
    ],
  },
  {
    title: "Money",
    items: [
      { key: "fees.manage", label: "Manage student fees" },
      { key: "fees.markOffsite", label: "Record cash and EFT payments" },
      { key: "billing.view", label: "See billing" },
      { key: "billing.manage", label: "Manage billing and plans" },
      { key: "ai.credits.allocate", label: "Share out AI credits", soon: true },
    ],
  },
  {
    title: "Organisation",
    items: [
      { key: "reports.view", label: "See reports", soon: true },
      { key: "workspace.settings", label: "Change organisation settings" },
      { key: "workspace.branding", label: "Change branding", soon: true },
    ],
  },
];

const LABELS = new Map(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key as string, i.label] as const)));

/** The labels of the permissions held, in the order the editor lists them. Keys without a label (an owner's two) are left out. */
export function permissionLabels(held: readonly string[]): string[] {
  return [...LABELS].filter(([k]) => held.includes(k)).map(([, label]) => label);
}

export const SCOPES: Array<{ value: RoleScope; label: string; description: string }> = [
  { value: "WORKSPACE", label: "Whole organisation", description: "Every course, student and member of staff." },
  { value: "BRANCHES", label: "Chosen branches", description: "The courses in their branches' teams. You pick the branches per person." },
  { value: "OWN_COURSES", label: "Own courses", description: "Only the courses they teach or own." },
];

export function scopeLabel(scope: RoleScope): string {
  return SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

/** Permissions that only reach the whole organisation, whatever the role's scope: they aren't narrowed to branches or courses. */
export const NOT_NARROWED: ReadonlySet<Permission> = new Set([
  "workspace.settings", "workspace.branding", "members.invite", "billing.view", "billing.manage",
]);

/* ───── What the viewer may give (mirrors A's assertWithinActor) ───── */

export interface Grants {
  permissions: readonly string[];
  scope: RoleScope;
  branchIds: readonly string[];
}

/** The viewer's own grants, as A's actorFor reads them. Null outside an organisation or for anyone but its staff. */
export function grantsOf(viewer: Viewer): Grants | null {
  if (viewer.persona !== "staff" || viewer.workspace?.kind !== "ORGANISATION") return null;
  const scope = staffScope(viewer);
  return { permissions: viewer.permissions, scope, branchIds: scope === "BRANCHES" ? (viewer.membership?.branchIds ?? []) : [] };
}

const RANK: Record<RoleScope, number> = { OWN_COURSES: 0, BRANCHES: 1, WORKSPACE: 2 };

export function scopeWithin(mine: RoleScope, other: RoleScope): boolean {
  return RANK[other] <= RANK[mine];
}

/** Nobody gives a role holding more than they do, or reaching wider. */
export function withinGrants(mine: Grants, role: { permissions: readonly string[]; scope: RoleScope }): boolean {
  return scopeWithin(mine.scope, role.scope) && role.permissions.every((p) => mine.permissions.includes(p));
}

/** Can the viewer tick this permission on an organisation's own role? */
export function mayGrant(mine: Grants, permission: Permission): boolean {
  return CUSTOM_ROLE_CEILING.has(permission) && mine.permissions.includes(permission);
}

export interface RoleOption {
  key: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  permissions: readonly string[];
}

export interface RoleRow extends RoleOption {
  /** Set for an organisation's own role; null for a built-in one. */
  id: string | null;
  basedOn: string | null;
  members: number;
  assignable: boolean;
}

/** A's listRolesFor as rows: built-in roles first, then the organisation's own. */
export function roleRows(list: {
  presets: ReadonlyArray<{ key: string; name: string; description: string; scope: RoleScope; permissions: string[]; assignable: boolean; members: number }>;
  custom: ReadonlyArray<{ key: string; id: string; name: string; basedOn: string; scope: RoleScope; permissions: string[]; members: number }>;
}): RoleRow[] {
  return [
    ...list.presets.map((r) => ({ ...r, id: null, basedOn: null })),
    ...list.custom.map(({ key, id, name, basedOn, scope, permissions, members }) => ({
      key, id, name, scope, permissions, members, description: null, assignable: true,
      basedOn: isPresetKey(basedOn) ? ROLE_PRESETS[basedOn].name : null,
    })),
  ];
}

/** The roles the viewer may give someone, built-in first. */
export function assignableRoles(mine: Grants, roles: readonly RoleRow[]): RoleOption[] {
  return roles.filter((r) => r.assignable && withinGrants(mine, r)).map(({ key, name, description, scope, permissions }) => ({ key, name, description, scope, permissions }));
}

/** Why a member's role can't be changed by the viewer, or null when it can. */
export function roleLock(mine: Grants, member: { isSelf: boolean; roleKey: string; scope: RoleScope; permissions: readonly string[]; branches: readonly { id: string }[] }): string | null {
  if (member.isSelf) return "You can't change your own role.";
  if (member.roleKey === "OWNER") return "An owner's role can't be changed here.";
  if (!withinGrants(mine, member)) return "This role holds more than yours.";
  // Saving replaces someone's branches, so a branch manager would drop the ones they can't see.
  if (mine.scope === "BRANCHES" && member.branches.some((b) => !mine.branchIds.includes(b.id))) return "They also work in a branch you don't manage.";
  return null;
}

/** Branches the viewer may put people in. */
export function branchesWithin<T extends { id: string }>(mine: Grants, branches: readonly T[]): T[] {
  if (mine.scope === "WORKSPACE") return [...branches];
  return mine.scope === "BRANCHES" ? branches.filter((b) => mine.branchIds.includes(b.id)) : [];
}

/** May the viewer change a team (by its branch)? */
export function managesTeam(mine: Grants, branchId: string | null): boolean {
  if (!mine.permissions.includes("teams.manage")) return false;
  if (mine.scope === "WORKSPACE") return true;
  return mine.scope === "BRANCHES" && branchId != null && mine.branchIds.includes(branchId);
}

/* ───── Words ───── */

export const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "Branch manager · Cape Town, Durban", or the role's name alone. */
export function memberRoleLine(m: { roleName: string; scope: RoleScope; branches: readonly { name: string }[] }): string {
  if (m.scope !== "BRANCHES") return m.roleName;
  return `${m.roleName} · ${m.branches.length ? m.branches.map((b) => b.name).join(", ") : "no branches yet"}`;
}

/** The name a copied role starts with, not taken by another. */
export function copyName(from: string, taken: readonly string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  for (let i = 1; ; i++) {
    const suffix = i === 1 ? " (copy)" : ` (copy ${i})`;
    const name = from.slice(0, 60 - suffix.length) + suffix;
    if (!used.has(name.toLowerCase())) return name;
  }
}
