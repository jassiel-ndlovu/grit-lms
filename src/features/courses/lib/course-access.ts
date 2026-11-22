/**
 * Which courses a signed-in staff member may manage on B's teaching pages
 * (issue #192, finding F3 of the 2026-11-20 Preview pass).
 *
 * - A tutor manages the courses they teach (an active CourseStaff row).
 * - A viewer whose grants are unscoped in the active workspace (OWNER or
 *   ADMIN: `needsScope(viewer, "courses.edit")` is false) also manages every
 *   course in that workspace, whoever teaches it.
 *
 * Pure: no database or session, so scripts/check-course-access.ts can run
 * it. The server half (`getCourseScope`, `canManageCourse`) is in
 * `features/courses/course-access.ts`.
 *
 * Organisation / Tutor mode (#192): in Tutor mode `needsScope` is true for
 * an owner or admin (A's viewer, PR 198), so `courseScopeFor` returns no
 * workspace and they see only what they teach.
 */

import type { Prisma } from "@/generated/prisma";
import { can, needsScope, type Viewer } from "@/lib/viewer-core";

import { taughtByUser, teachesAsOwner, type TeachingMembership } from "./tenancy-where";

export interface CourseScope {
  /** The signed-in user's id: courses they teach are always in scope. */
  userId: string;
  /** Set when every course in this workspace is in scope (owners and admins); null for tutors. */
  workspaceId: string | null;
}

/** True when the viewer manages every course in their active workspace. */
export function managesWholeWorkspace(viewer: Viewer): boolean {
  if (viewer.persona !== "staff" || !viewer.workspace) return false;
  // Tutor mode (#192) makes needsScope true, so this is false there.
  return can(viewer, "courses.edit") && !needsScope(viewer, "courses.edit");
}

export function courseScopeFor(viewer: Viewer): CourseScope {
  return {
    userId: viewer.user.id,
    workspaceId: managesWholeWorkspace(viewer) ? viewer.workspace!.id : null,
  };
}

/** A tutor-only scope, for callers with a user id and no viewer. */
export function tutorScope(userId: string): CourseScope {
  return { userId, workspaceId: null };
}

/** Prisma filter for the courses in scope. Replaces `taughtByUser(userId)` on B's teaching pages. */
export function manageableBy(scope: CourseScope): Prisma.CourseWhereInput {
  if (!scope.workspaceId) return taughtByUser(scope.userId);
  return { OR: [{ workspaceId: scope.workspaceId }, taughtByUser(scope.userId)] };
}

/**
 * The same check on a course row already loaded with
 * `{ workspaceId, staff: staffFor(email) }`: the signed-in user's own staff
 * row, or the workspace they manage.
 */
export function managesCourse(
  scope: CourseScope,
  course: { workspaceId: string | null; staff: readonly unknown[] },
): boolean {
  if (course.staff.length > 0) return true;
  return scope.workspaceId != null && course.workspaceId === scope.workspaceId;
}

/**
 * The teacher's name to show beside a course the viewer doesn't teach
 * (an owner looking at a tutor's course); null when they teach it or it
 * has no teacher.
 */
export function otherTeacherName(
  userId: string,
  course: { ownerMembership: ({ user: { id: string; name: string; tutorProfile: { fullName: string } | null } } & TeachingMembership) | null },
): string | null {
  const user = course.ownerMembership?.user;
  if (!user || user.id === userId || !teachesAsOwner(course.ownerMembership!)) return null;
  return user.tutorProfile?.fullName || user.name || null;
}
