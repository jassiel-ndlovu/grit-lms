/**
 * getViewer() — who is looking, in which workspace, with which permissions.
 *
 * Contract: docs/revamp/contracts/viewer.md (owned by Agent A).
 *
 * Phase 1: built from the tenancy tables (Membership, Learner,
 * Guardianship, Workspace), with the active workspace taken from the
 * `nexa_ws` cookie that `switchWorkspace` sets. A user the tenancy backfill
 * has not reached yet falls back to the Phase 0 bridge (one comped
 * organisation, persona from `User.role`), so nobody loses access.
 */

import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { enrolledStudent, taughtByEmail } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";

import {
  buildLegacyViewer,
  buildTenancyViewer,
  can,
  hasTenancy,
  needsScope,
  type LegacyRole,
  type Permission,
  type Persona,
  type Viewer,
} from "./viewer-core";

export * from "./viewer-core";

export const ACTIVE_WORKSPACE_COOKIE = "nexa_ws";

export class ViewerError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN", message?: string) {
    super(message ?? code);
    this.name = "ViewerError";
  }
}

const workspaceSelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  timezone: true,
  logoUrl: true,
  accentColor: true,
  billingState: true,
  trialEndsAt: true,
} as const;

const loadViewer = cache(
  async (userId: string, role: LegacyRole, activeWorkspaceId: string | null): Promise<Viewer | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        emailConfirmed: true,
        roleUnconfirmed: true,
        createdAt: true,
        platformRole: true,
        tutorProfile: { select: { profileImageUrl: true } },
        studentProfile: { select: { id: true, imageUrl: true } },
        memberships: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "asc" },
          select: {
            id: true,
            role: true,
            workspace: { select: workspaceSelect },
            teams: { select: { teamId: true, isLead: true } },
          },
        },
        learners: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true, isMinor: true, paymentVisible: true, workspace: { select: workspaceSelect } },
        },
        guardianOf: {
          where: { status: "ACTIVE" },
          select: {
            student: {
              select: {
                id: true,
                name: true,
                studentProfile: { select: { imageUrl: true } },
                learners: { where: { status: "ACTIVE" }, select: { workspace: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        guardedBy: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
      },
    });
    if (!user) return null;

    const imageUrl = user.tutorProfile?.profileImageUrl ?? user.studentProfile?.imageUrl ?? null;
    const children = user.guardianOf.map((g) => ({
      userId: g.student.id,
      name: g.student.name,
      imageUrl: g.student.studentProfile?.imageUrl ?? null,
      workspaces: g.student.learners.map((l) => ({ id: l.workspace.id, name: l.workspace.name })),
    }));
    const base = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified != null || user.emailConfirmed,
      roleConfirmed: !user.roleUnconfirmed,
      platformRole: user.platformRole,
      imageUrl,
    };

    if (hasTenancy({ user: base, memberships: user.memberships, learners: user.learners, children })) {
      return buildTenancyViewer({
        user: base,
        memberships: user.memberships,
        learners: user.learners,
        children,
        hasActiveGuardian: user.guardedBy.length > 0,
        activeWorkspaceId,
      });
    }

    // Not backfilled yet: the Phase 0 bridge, but only for accounts from
    // before tenancy. Anyone newer with no workspace yet (a fresh sign-up,
    // even with a Student profile) gets persona "none" until a tutor adds
    // them or onboarding creates a workspace.
    if (user.createdAt >= LEGACY_ACCOUNTS_BEFORE) return buildNewUserViewer(base);
    let profileId: string | null = null;
    if (role === "TUTOR") {
      const tutor = await prisma.tutor.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" } },
        select: { id: true },
      });
      profileId = tutor?.id ?? null;
    } else if (role === "STUDENT") {
      profileId = user.studentProfile?.id ?? null;
      if (!profileId) {
        const student = await prisma.student.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
          select: { id: true },
        });
        profileId = student?.id ?? null;
      }
    }
    if (!profileId && (role === "TUTOR" || role === "STUDENT")) return buildNewUserViewer(base);
    return buildLegacyViewer({ user: { ...base, role }, profileId });
  },
);

/** Accounts created before this were backfilled into tenancy (design 01, section 8); only they may use the Phase 0 bridge. */
const LEGACY_ACCOUNTS_BEFORE = new Date("2026-11-20T00:00:00Z");

/** A signed-in user with no workspace, learner or child yet: persona "none" until onboarding. */
function buildNewUserViewer(base: Parameters<typeof buildTenancyViewer>[0]["user"]): Viewer {
  return buildTenancyViewer({ user: base, memberships: [], learners: [], children: [], hasActiveGuardian: false, activeWorkspaceId: null });
}

/** Cached per request. Null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const active = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  return loadViewer(session.user.id, session.user.role as LegacyRole, active);
}

/** Throws ViewerError("UNAUTHENTICATED") or ViewerError("FORBIDDEN"). */
export async function requireViewer(opts: {
  persona?: Persona | Persona[];
  permission?: Permission;
  workspace?: true;
} = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new ViewerError("UNAUTHENTICATED");
  if (opts.persona) {
    const allowed = Array.isArray(opts.persona) ? opts.persona : [opts.persona];
    if (!allowed.includes(viewer.persona)) throw new ViewerError("FORBIDDEN");
  }
  if (opts.permission && !can(viewer, opts.permission)) throw new ViewerError("FORBIDDEN");
  if (opts.workspace && !viewer.workspace) throw new ViewerError("FORBIDDEN");
  return viewer;
}

/**
 * Workspace-level check plus a resource scope, for the "◐" cells of the
 * permission matrix. Async because the scope is checked in the database.
 *
 * A course is always checked against the active workspace, owners and
 * admins included, so one workspace can never act on another's course.
 */
export async function canIn(
  viewer: Viewer,
  permission: Permission,
  scope: { courseId?: string; teamId?: string; childUserId?: string },
): Promise<boolean> {
  if (!can(viewer, permission)) return false;
  if (viewer.persona === "admin") return true;

  if (scope.courseId) {
    if (viewer.persona === "staff") return isCourseStaff(viewer, scope.courseId, needsScope(viewer, permission));
    if (viewer.persona === "learner") return isEnrolled(viewer, scope.courseId);
    if (viewer.persona === "guardian") return childEnrolled(viewer, scope.courseId);
    return false;
  }
  if (!needsScope(viewer, permission)) return true;
  if (scope.teamId) return viewer.membership?.leadTeamIds.includes(scope.teamId) ?? false;
  if (scope.childUserId) return viewer.children.some((c) => c.userId === scope.childUserId);
  // A scoped permission with no scope given is never enough.
  return false;
}

const isLegacy = (viewer: Viewer) => viewer.membership?.id.startsWith("legacy_") ?? false;

async function isCourseStaff(viewer: Viewer, courseId: string, mustTeach: boolean): Promise<boolean> {
  if (!viewer.workspace || !viewer.membership) return false;
  if (isLegacy(viewer)) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...taughtByEmail(viewer.user.email) },
      select: { id: true },
    });
    return course != null;
  }
  const membershipId = viewer.membership.id;
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      workspaceId: viewer.workspace.id,
      ...(mustTeach
        ? { OR: [{ ownerMembershipId: membershipId }, { staff: { some: { membershipId } } }] }
        : {}),
    },
    select: { id: true },
  });
  return course != null;
}

async function isEnrolled(viewer: Viewer, courseId: string): Promise<boolean> {
  if (!viewer.learner || !viewer.workspace) return false;
  const enrolment = await prisma.enrollment.findFirst({
    where: { courseId, learnerId: viewer.learner.id, endedAt: null, workspaceId: viewer.workspace.id },
    select: { id: true },
  });
  if (enrolment) return true;
  // Phase 0 bridge: learner.id is the Student profile id.
  const legacy = await prisma.course.findFirst({
    where: { id: courseId, ...enrolledStudent(viewer.learner.id) },
    select: { id: true },
  });
  return legacy != null;
}

async function childEnrolled(viewer: Viewer, courseId: string): Promise<boolean> {
  if (viewer.children.length === 0) return false;
  const enrolment = await prisma.enrollment.findFirst({
    where: { courseId, endedAt: null, learner: { userId: { in: viewer.children.map((c) => c.userId) } } },
    select: { id: true },
  });
  return enrolment != null;
}
