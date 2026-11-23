import "server-only";

/**
 * The workspace's students, for the Students pages (#174; a/ux/01,
 * sections 6 and 7). Owners and admins see every learner in the
 * workspace; a tutor sees the learners on courses they teach, a branch role
 * also those on its branches' courses. A's actions (account-actions.ts) check permissions again for every change.
 */

import { DELETION_GRACE_DAYS } from "@/features/users/deletion";
import { prisma } from "@/lib/db";
import { effectiveRole, type RoleScope } from "@/lib/roles";
import { can, courseScopeOf, needsScope, scopedCourseWhere, type Viewer } from "@/lib/viewer-core";

export interface RosterCourse {
  id: string;
  name: string;
}

export interface RosterStudent {
  learnerId: string;
  userId: string;
  name: string;
  /** Null when the account has a placeholder address (no email). */
  email: string | null;
  username: string | null;
  isMinor: boolean;
  /** Still on the tutor-issued code: hasn't set their own password. */
  awaitingFirstSignIn: boolean;
  /** Made by this workspace's staff (viewer contract Draft 1.13). False: they manage it themself. */
  managed: boolean;
  /** When a pending deletion takes effect (ISO), or null. */
  deleteOn: string | null;
  courses: RosterCourse[];
}

/** Courses the viewer may add students to: all in the workspace, or the ones they teach. */
export async function coursesForAdding(viewer: Viewer): Promise<RosterCourse[]> {
  if (!viewer.workspace || !can(viewer, "learners.invite")) return [];
  const scope = courseScopeOf(viewer, "learners.invite");
  if (!scope && needsScope(viewer, "learners.invite")) return [];
  return prisma.course.findMany({
    where: {
      workspaceId: viewer.workspace.id,
      ...(scope ? scopedCourseWhere(scope) : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

function learnerWhere(viewer: Viewer, courseIds: string[] | null) {
  return {
    workspaceId: viewer.workspace!.id,
    status: "ACTIVE" as const,
    ...(courseIds ? { enrollments: { some: { endedAt: null, courseId: { in: courseIds } } } } : {}),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const learnerSelect = {
  id: true,
  isMinor: true,
  workspaceId: true,
  user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true, username: true, mustChangePassword: true, managedByWorkspaceId: true, deletionRequestedAt: true } },
  enrollments: { where: { endedAt: null }, select: { course: { select: { id: true, name: true } } } },
} as const;

type LearnerRow = {
  id: string;
  isMinor: boolean;
  workspaceId: string;
  user: {
    id: string; name: string; email: string; emailIsPlaceholder: boolean; username: string | null; mustChangePassword: boolean;
    managedByWorkspaceId: string | null; deletionRequestedAt: Date | null;
  };
  enrollments: Array<{ course: { id: string; name: string } }>;
};

/** `scope` hides courses a scoped tutor doesn't teach (null: show all). */
function toStudent(l: LearnerRow, scope: string[] | null): RosterStudent {
  return {
    learnerId: l.id,
    userId: l.user.id,
    name: l.user.name,
    email: l.user.emailIsPlaceholder ? null : l.user.email,
    username: l.user.username,
    isMinor: l.isMinor,
    awaitingFirstSignIn: l.user.mustChangePassword,
    managed: l.user.managedByWorkspaceId === l.workspaceId,
    deleteOn: l.user.deletionRequestedAt ? new Date(l.user.deletionRequestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS).toISOString() : null,
    courses: l.enrollments.map((e) => e.course).filter((c) => !scope || scope.includes(c.id)),
  };
}

/** The viewer's courses as a filter, or null for "every learner in the workspace". */
async function scopeFor(viewer: Viewer): Promise<string[] | null> {
  if (!needsScope(viewer, "learners.invite")) return null;
  return (await coursesForAdding(viewer)).map((c) => c.id);
}

export async function listRoster(viewer: Viewer): Promise<RosterStudent[]> {
  if (!viewer.workspace || !can(viewer, "learners.invite")) return [];
  const scope = await scopeFor(viewer);
  if (scope && scope.length === 0) return [];
  const rows = await prisma.learner.findMany({
    where: learnerWhere(viewer, scope),
    select: learnerSelect,
    orderBy: { user: { name: "asc" } },
    take: 500,
  });
  return rows.map((r) => toStudent(r, scope));
}

/** One student the viewer manages, or null (not theirs, or not found). */
export async function getRosterStudent(viewer: Viewer, learnerId: string): Promise<RosterStudent | null> {
  if (!viewer.workspace || !can(viewer, "learners.invite")) return null;
  const scope = await scopeFor(viewer);
  if (scope && scope.length === 0) return null;
  const row = await prisma.learner.findFirst({ where: { id: learnerId, ...learnerWhere(viewer, scope) }, select: learnerSelect });
  return row ? toStudent(row, scope) : null;
}

export interface MemberRow {
  membershipId: string;
  name: string;
  email: string;
  isSelf: boolean;
  /** The effective role (viewer.md, "Roles and branches"). */
  roleKey: string;
  roleName: string;
  scope: RoleScope;
  permissions: string[];
  /** For a branch role: where it applies. */
  branches: Array<{ id: string; name: string }>;
}

/** Active staff in the viewer's workspace, owners then admins first. For the Members page. */
export async function listMembers(viewer: Viewer): Promise<MemberRow[]> {
  if (!viewer.workspace || !(can(viewer, "members.invite") || can(viewer, "members.role"))) return [];
  const [rows, branches] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: viewer.workspace.id, status: "ACTIVE" },
      select: {
        id: true, role: true, presetRole: true, branchIds: true,
        customRole: { select: { id: true, name: true, permissions: true, scope: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      take: 500,
    }),
    prisma.branch.findMany({ where: { workspaceId: viewer.workspace.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const order: Record<string, number> = { OWNER: 0, ADMIN: 1 };
  return rows
    .map((m) => {
      const r = effectiveRole(m);
      return {
        membershipId: m.id, name: m.user.name, email: m.user.email, isSelf: m.user.id === viewer.user.id,
        roleKey: r.key, roleName: r.name, scope: r.scope, permissions: r.permissions,
        branches: r.scope === "BRANCHES" ? branches.filter((b) => m.branchIds.includes(b.id)) : [],
      };
    })
    .sort((a, b) => (order[a.roleKey] ?? 9) - (order[b.roleKey] ?? 9) || a.name.localeCompare(b.name));
}
