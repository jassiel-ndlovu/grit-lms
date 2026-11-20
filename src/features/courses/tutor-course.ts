import "server-only";

/**
 * Loads a course for the tutor's course pages (overview, lessons,
 * settings) and checks the signed-in tutor owns it.
 *
 * Ownership comes from CourseStaff via `courseBelongsToTutor` (issue #93,
 * step 4).
 */

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { courseBelongsToTutor, getCourseDetailById, type CourseDetail } from "./queries";
import { teacherFrom } from "@/features/courses/lib/teacher";

export type TutorCourseResult =
  | { ok: true; course: CourseDetail; tutorId: string; userId: string }
  | { ok: false; message: string };

export async function loadTutorCourse(id: string): Promise<TutorCourseResult> {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = teacherFrom(session.user);

  const [course, owns] = await Promise.all([getCourseDetailById(id), courseBelongsToTutor(id, tutor.id)]);
  if (!course) notFound();
  // Someone else's course looks the same as a missing one (the 404 page).
  if (!owns) notFound();

  return { ok: true, course, tutorId: tutor.id, userId: session.user.id };
}
