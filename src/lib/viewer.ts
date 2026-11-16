/**
 * getViewer() — who is looking, in which workspace, with which permissions.
 *
 * Contract: docs/revamp/contracts/viewer.md (owned by Agent A).
 *
 * Phase 0: there are no workspaces, memberships or guardianships in the
 * database yet, so the viewer is built from today's single `User.role` plus
 * the Tutor/Student profile, inside the one comped organisation the Phase 1
 * migration will create (`LEGACY_WORKSPACE`). The shape is final; Phase 1
 * replaces the internals of `loadViewer` and `canIn` without changing it.
 */

import "server-only";

import { cache } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  buildLegacyViewer,
  can,
  needsScope,
  type LegacyRole,
  type Permission,
  type Persona,
  type Viewer,
} from "./viewer-core";

export * from "./viewer-core";

export class ViewerError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN", message?: string) {
    super(message ?? code);
    this.name = "ViewerError";
  }
}

const loadViewer = cache(async (userId: string, role: LegacyRole): Promise<Viewer | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!user) return null;

  // Profiles still match users by email (design 01, section 8; fixed in Phase 1).
  let profileId: string | null = null;
  let imageUrl: string | null = null;
  if (role === "TUTOR") {
    const tutor = await prisma.tutor.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
      select: { id: true, profileImageUrl: true },
    });
    profileId = tutor?.id ?? null;
    imageUrl = tutor?.profileImageUrl ?? null;
  } else if (role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
      select: { id: true, imageUrl: true },
    });
    profileId = student?.id ?? null;
    imageUrl = student?.imageUrl ?? null;
  }

  return buildLegacyViewer({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      emailVerified: user.emailVerified != null,
      imageUrl,
    },
    profileId,
  });
});

/** Cached per request. Null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return loadViewer(session.user.id, session.user.role as LegacyRole);
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
 */
export async function canIn(
  viewer: Viewer,
  permission: Permission,
  scope: { courseId?: string; teamId?: string; childUserId?: string },
): Promise<boolean> {
  if (!can(viewer, permission)) return false;
  if (!needsScope(viewer, permission)) return true;

  if (scope.teamId) {
    return viewer.membership?.leadTeamIds.includes(scope.teamId) ?? false;
  }
  if (scope.childUserId) {
    return viewer.children.some((c) => c.userId === scope.childUserId);
  }
  if (scope.courseId) {
    if (viewer.persona === "staff") return isCourseStaff(viewer, scope.courseId);
    if (viewer.persona === "learner") return isEnrolled(viewer, scope.courseId);
    // Guardians: no children before Phase 1, so no course is in scope.
    return false;
  }
  // A scoped permission with no scope given is never enough.
  return false;
}

async function isCourseStaff(viewer: Viewer, courseId: string): Promise<boolean> {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      tutor: { email: { equals: viewer.user.email, mode: "insensitive" } },
    },
    select: { id: true },
  });
  return course != null;
}

async function isEnrolled(viewer: Viewer, courseId: string): Promise<boolean> {
  if (!viewer.learner) return false;
  const course = await prisma.course.findFirst({
    where: { id: courseId, students: { some: { id: viewer.learner.id } } },
    select: { id: true },
  });
  return course != null;
}
