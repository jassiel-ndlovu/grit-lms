/** /dashboard/courses/lessons/[id]/[lessonId] — one lesson of a course, at the address it's saved under for offline. */

import { LessonReader } from "../reader";

export const metadata = { title: "Lesson" };

export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  return <LessonReader courseId={id} lessonId={lessonId} />;
}
