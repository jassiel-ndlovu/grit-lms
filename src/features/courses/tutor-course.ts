import "server-only";

/**
 * Loads a course for the tutor's course pages (overview, lessons,
 * settings, services) and checks the signed-in user may manage it: they
 * teach it (CourseStaff), or they own or administer its workspace
 * (`canManageCourse`, issue #192).
 */

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { canManageCourse, getCourseScope } from "./course-access";
import { getCourseDetailById, type CourseDetail } from "./queries";
import { teacherFrom } from "@/features/courses/lib/teacher";

export type TutorCourseResult =
  | { ok: true; course: CourseDetail; tutorId: string; userId: string }
  | { ok: false; message: string };

export async function loadTutorCourse(id: string): Promise<TutorCourseResult> {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = teacherFrom(session.user);

  const scope = await getCourseScope(session.user.id);
  const [course, owns] = await Promise.all([getCourseDetailById(id), canManageCourse(id, scope)]);
  if (!course) notFound();
  // Someone else's course looks the same as a missing one (the 404 page).
  if (!owns) notFound();

  return { ok: true, course, tutorId: tutor.id, userId: session.user.id };
}
