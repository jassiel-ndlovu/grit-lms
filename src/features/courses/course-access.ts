import "server-only";

/**
 * Server half of `lib/course-access.ts`: the signed-in viewer's course
 * scope, and the "can manage this course" check that replaces
 * `courseBelongsToTutor` on B's teaching pages and actions.
 */

import { cache } from "react";

import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

import { courseScopeFor, manageableBy, tutorScope, type CourseScope } from "./lib/course-access";

/**
 * The scope for the signed-in user (`userId` from their session). Cached
 * per request, so query helpers that take the scope dedupe across a page.
 * Falls back to "courses they teach" when there is no viewer.
 */
export const getCourseScope = cache(async (userId: string): Promise<CourseScope> => {
  const viewer = await getViewer();
  if (!viewer || viewer.user.id !== userId) return tutorScope(userId);
  return courseScopeFor(viewer);
});

/** Can the viewer with this scope manage the course? Workspace owner or admin, or teaches it. */
export const canManageCourse = cache(async (courseId: string, scope: CourseScope): Promise<boolean> => {
  const n = await prisma.course.count({ where: { AND: [{ id: courseId }, manageableBy(scope)] } });
  return n > 0;
});
