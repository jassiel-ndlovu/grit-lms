import "server-only";

/**
 * Server half of `lib/course-access.ts`: the signed-in viewer's course
 * scope, and the "can manage this course" check that replaces
 * `courseBelongsToTutor` on B's teaching pages and actions.
 */

import { cache } from "react";

import { prisma } from "@/lib/db";
import { effectiveRole } from "@/lib/roles";
import { getViewer } from "@/lib/viewer";
import type { Permission } from "@/lib/viewer-core";

import { courseScopeFor, manageableBy, tutorScope, type CourseScope } from "./lib/course-access";

/**
 * The scope for the signed-in user (`userId` from their session). Cached
 * per request, so query helpers that take the scope dedupe across a page.
 * Falls back to "courses they teach" when there is no viewer.
 */
export const getCourseScope = cache(async (userId: string, permission: Permission = "courses.edit"): Promise<CourseScope> => {
  const viewer = await getViewer();
  if (!viewer || viewer.user.id !== userId) return tutorScope(userId);
  return courseScopeFor(viewer, permission);
});

/** Can the viewer with this scope manage the course? Workspace owner or admin, branch role, or teaches it. */
export const canManageCourse = cache(async (courseId: string, scope: CourseScope): Promise<boolean> => {
  const n = await prisma.course.count({ where: { AND: [{ id: courseId }, manageableBy(scope)] } });
  return n > 0;
});

/**
 * Does the user's role in the course's own workspace hold `permission`?
 * For what `managesCourse` alone doesn't settle (an assistant tutor edits
 * courses but can't delete one). A course from before workspaces passes.
 */
export async function holdsInWorkspace(userId: string, workspaceId: string | null, permission: Permission): Promise<boolean> {
  if (!workspaceId) return true;
  const m = await prisma.membership.findFirst({
    where: { userId, workspaceId, status: "ACTIVE" },
    select: { role: true, presetRole: true, customRole: { select: { id: true, name: true, permissions: true, scope: true } } },
  });
  return m != null && effectiveRole(m).permissions.includes(permission);
}
