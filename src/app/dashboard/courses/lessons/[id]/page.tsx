/**
 * /dashboard/courses/lessons/[id] — a course's lessons, from the first one.
 * The `[id]` segment is the COURSE id. Old `?lesson=` links go to the
 * lesson's own address.
 */

import { redirect } from "next/navigation";

import { studentCourseRoutes } from "@/features/courses/components/student-course-frame";

import { LessonReader } from "./reader";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string | string[] }>;
}

export const metadata = { title: "Lesson" };

export default async function CourseLessonsPage({ params, searchParams }: PageProps) {
  const [{ id }, { lesson }] = await Promise.all([params, searchParams]);
  if (typeof lesson === "string" && /^[\w-]{1,64}$/.test(lesson)) redirect(studentCourseRoutes.lessons(id, lesson));
  return <LessonReader courseId={id} />;
}
