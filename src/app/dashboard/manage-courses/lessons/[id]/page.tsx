/**
 * /dashboard/manage-courses/lessons/[id] — the course's Lessons view: the
 * lesson tree beside the editor (UI draft "Course page").
 *
 * The `[id]` segment is the COURSE id (legacy URL, kept). The selected
 * lesson is `?lesson=<lessonId>`; without it the editor side shows an
 * empty state.
 *
 * Server component. The tree rows are links, so a lesson can be linked to;
 * the editor (LessonForm), the row actions and "Add lesson" are client
 * components.
 */

import { loadTutorCourse } from "@/features/courses/tutor-course";
import { LessonsWorkspace } from "@/features/lessons/components/lessons-workspace";
import { getLessonDetailById, listLessonsByCourseId } from "@/features/lessons/queries";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}

export const metadata = { title: "Lessons" };

export default async function ManageLessonsPage({ params, searchParams }: PageProps) {
  const [{ id: courseId }, { lesson: selectedLessonParam }] = await Promise.all([params, searchParams]);

  const [loaded, lessons] = await Promise.all([loadTutorCourse(courseId), listLessonsByCourseId(courseId)]);
  if (!loaded.ok) return <div className="text-muted-foreground p-8 text-sm">{loaded.message}</div>;
  const { course } = loaded;

  const selectedLessonId =
    selectedLessonParam && lessons.some((l) => l.id === selectedLessonParam) ? selectedLessonParam : null;
  const selectedLesson = selectedLessonId ? await getLessonDetailById(selectedLessonId) : null;

  return <LessonsWorkspace course={course} lessons={lessons} selectedLesson={selectedLesson} />;
}
