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
import { prisma } from "@/lib/db";

import { courseBelongsToTutor, getCourseDetailById, type CourseDetail } from "./queries";

export type TutorCourseResult =
  | { ok: true; course: CourseDetail; tutorId: string; userId: string }
  | { ok: false; message: string };

export async function loadTutorCourse(id: string): Promise<TutorCourseResult> {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!tutor) return { ok: false, message: "No tutor profile found for this account." };

  const [course, owns] = await Promise.all([getCourseDetailById(id), courseBelongsToTutor(id, tutor.id)]);
  if (!course) notFound();
  if (!owns) return { ok: false, message: "You don't own this course." };

  return { ok: true, course, tutorId: tutor.id, userId: session.user.id };
}
