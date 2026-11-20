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
 * The planned "Organisation / Tutor mode" switch (#192) narrows this in one
 * place: in Tutor mode `courseScopeFor` returns no workspace, so an owner
 * sees only what they teach. It waits on `viewer.mode` from Agent A.
 */

import type { Prisma } from "@/generated/prisma";
import { can, needsScope, type Viewer } from "@/lib/viewer-core";

import { taughtByUser } from "./tenancy-where";

export interface CourseScope {
  /** The signed-in user's id: courses they teach are always in scope. */
  userId: string;
  /** Set when every course in this workspace is in scope (owners and admins); null for tutors. */
  workspaceId: string | null;
}

/** True when the viewer manages every course in their active workspace. */
export function managesWholeWorkspace(viewer: Viewer): boolean {
  if (viewer.persona !== "staff" || !viewer.workspace) return false;
  // #192: when A adds `viewer.mode`, return false here in Tutor mode.
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
  course: { ownerMembership: { user: { id: string; name: string; tutorProfile: { fullName: string } | null } } | null },
): string | null {
  const user = course.ownerMembership?.user;
  if (!user || user.id === userId) return null;
  return user.tutorProfile?.fullName || user.name || null;
}
