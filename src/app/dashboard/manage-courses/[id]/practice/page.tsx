/**
 * /dashboard/manage-courses/[id]/practice — the course's practice sets
 * (contracts/practice.md): what students can practise, untimed and without
 * marks, with questions coming back until they're known.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { NewPracticeSetButton } from "@/features/assessments/components/practice-set-editor";
import { hasPractice, listPracticeSets } from "@/features/assessments/practice-queries";
import { CourseFrame, courseRoutes } from "@/features/courses/components/course-frame";
import { loadTutorCourse } from "@/features/courses/tutor-course";

export const metadata = { title: "Practice" };

export default async function CoursePracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) {
    return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Practice" }]}>{loaded.message}</PageMessage>;
  }
  const { course } = loaded;
  // The tab is hidden without the service, so the page doesn't exist either.
  if (!(await hasPractice(course.id))) notFound();
  const sets = await listPracticeSets(course.id);

  return (
    <CourseFrame course={course} page="Practice" actions={<NewPracticeSetButton courseId={course.id} />}>
      <PageTitle
        title="Practice"
        description="Questions from your bank that students practise at their own pace. Missed questions come back sooner, known ones later. Practice never counts for marks."
      />
      {sets.length === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="empty-tests" />}
          title="No practice sets yet"
          description="Make a set, add questions from your bank and publish it."
        />
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {sets.map((s) => (
            <li key={s.id}>
              <Link
                href={courseRoutes.practice(course.id, s.id)}
                className="hover:bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3 transition-colors"
              >
                <span className="min-w-0 flex-1 basis-56 space-y-0.5">
                  <span className="text-foreground block truncate text-sm font-medium">{s.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {s.questions} {s.questions === 1 ? "question" : "questions"}
                    {s.students ? ` · ${s.students} ${s.students === 1 ? "student has" : "students have"} practised` : ""}
                  </span>
                </span>
                <StatusChip tone={s.isPublished ? "success" : "neutral"}>{s.isPublished ? "Published" : "Draft"}</StatusChip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CourseFrame>
  );
}
