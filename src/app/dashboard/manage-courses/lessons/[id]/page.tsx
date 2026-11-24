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
import { PageMessage } from "@/components/shell/page-frame";
import { aiHelpFor } from "@/features/courses/ai-help";
import { courseRoutes } from "@/features/courses/components/course-frame";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { LessonsWorkspace } from "@/features/lessons/components/lessons-workspace";
import { getLessonDetailById, listLessonsByCourseId } from "@/features/lessons/queries";
import { getViewer } from "@/lib/viewer";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}

/** Drafting lessons from a long document with AI can take minutes. */
export const maxDuration = 300;

export const metadata = { title: "Lessons" };

export default async function ManageLessonsPage({ params, searchParams }: PageProps) {
  const [{ id: courseId }, { lesson: selectedLessonParam }] = await Promise.all([params, searchParams]);

  const [loaded, lessons] = await Promise.all([loadTutorCourse(courseId), listLessonsByCourseId(courseId)]);
  if (!loaded.ok) return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Lessons" }]}>{loaded.message}</PageMessage>;
  const { course } = loaded;

  const selectedLessonId =
    selectedLessonParam && lessons.some((l) => l.id === selectedLessonParam) ? selectedLessonParam : null;
  const selectedLesson = selectedLessonId ? await getLessonDetailById(selectedLessonId) : null;

  // Graphs and visual maths input are Plus services (contracts/services.md),
  // offered only where the course has them. Graphs already in a lesson still
  // show, and TeX input stays for everyone.
  const viewer = await getViewer();
  const [graph, mathInput, ai] = viewer
    ? await Promise.all([hasService(viewer, courseId, "graphing"), hasService(viewer, courseId, "math-input"), aiHelpFor(viewer, courseId)])
    : [false, false, null];

  return <LessonsWorkspace course={course} lessons={lessons} selectedLesson={selectedLesson} editorFeatures={{ graph, mathInput }} ai={ai} />;
}
