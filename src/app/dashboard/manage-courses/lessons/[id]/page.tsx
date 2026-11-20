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

import { hasService } from "@/features/billing/services";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { LessonsWorkspace } from "@/features/lessons/components/lessons-workspace";
import { getLessonDetailById, listLessonsByCourseId } from "@/features/lessons/queries";
import { getViewer } from "@/lib/viewer";

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

  // Graphs are a Plus service (contracts/services.md): the block is offered
  // only where the course has it. Graphs already in a lesson still show.
  const viewer = await getViewer();
  const graph = viewer ? await hasService(viewer, courseId, "graphing") : false;

  return <LessonsWorkspace course={course} lessons={lessons} selectedLesson={selectedLesson} editorFeatures={{ graph }} />;
}
