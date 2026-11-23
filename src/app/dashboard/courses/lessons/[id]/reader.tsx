/**
 * The student's lesson reader. Two addresses render it:
 *
 *   /dashboard/courses/lessons/<course>            the first lesson
 *   /dashboard/courses/lessons/<course>/<lesson>   that lesson
 *
 * Each lesson has its own path (not a query) because offline reading keeps
 * a page per path (A's public/sw.js). A Server Component shell: the sidebar
 * and the lesson are RSC; Mark complete, Save for offline and the rest are
 * Client Components.
 *
 * Enrolment is checked here, so a student can't read a course they aren't
 * on by typing its address.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tutorOf } from "@/features/courses/lib/tenancy-where";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SaveOffline } from "@/components/offline/save-offline";
import { lessonVersion, savedTitle } from "@/components/offline/saved";
import { MobileCollapsible } from "@/components/mobile-collapsible";
import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StudentCourseFrame, studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { SIDE_PANEL_STICKY_CLASS } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

import { getCourseDetailById } from "@/features/courses/queries";
import {
  getLessonDetailById,
  listCompletionsForStudentInCourse,
  listLessonsByCourseId,
} from "@/features/lessons/queries";
import { LessonContent } from "@/features/lessons/components/lesson-content";
import { LessonSidebar } from "@/features/lessons/components/lesson-sidebar";
import { MarkCompleteButton } from "@/features/lessons/components/mark-complete-button";
import {
  buildLessonTree,
  flattenLessonTree,
} from "@/features/lessons/lib/lesson-tree";
import { EmptyState, Scene } from "@/components/ui/empty-state";

/** A lesson of a course; without `lessonId`, the first one. */
export async function LessonReader({ courseId, lessonId = null }: { courseId: string; lessonId?: string | null }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!student) {
    return <PageMessage breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: "Lessons" }]}>No student profile found for this account.</PageMessage>;
  }

  const [course, lessons, completions] = await Promise.all([
    getCourseDetailById(courseId),
    listLessonsByCourseId(courseId),
    listCompletionsForStudentInCourse(student.id, courseId),
  ]);

  if (!course) notFound();

  // Enrolment check — RSC equivalent of the legacy CourseContext gate.
  const isEnrolled = course.students.some((s) => s.id === student.id);
  if (!isEnrolled) {
    return (
      <PageMessage breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: course.name }]}>
        You aren&apos;t enrolled in this course.
      </PageMessage>
    );
  }

  // Reading order is the lesson tree, depth-first. Group headings (NONE)
  // have nothing to read, so they're skipped for navigation and progress.
  const flat = flattenLessonTree(buildLessonTree(lessons), course.lessonLabelScheme);
  const readable = flat.filter((f) => f.lesson.type !== "NONE");

  // A lesson that's gone (or a group heading): the course's first lesson.
  if (lessonId && !readable.some((f) => f.lesson.id === lessonId)) redirect(studentCourseRoutes.lessons(courseId));
  const selectedLessonId = lessonId ?? readable[0]?.lesson.id ?? null;

  const selectedLesson = selectedLessonId
    ? await getLessonDetailById(selectedLessonId)
    : null;

  const completedIds = new Set(completions.map((c) => c.lessonId));
  const completedCount = readable.filter((f) => completedIds.has(f.lesson.id)).length;
  const total = readable.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Prev/next navigation — based on lesson order in the list.
  const selectedIndex = selectedLessonId
    ? readable.findIndex((f) => f.lesson.id === selectedLessonId)
    : -1;
  const selectedLabel = selectedIndex >= 0 ? readable[selectedIndex].label : null;
  const prevLessonId = selectedIndex > 0 ? readable[selectedIndex - 1].lesson.id : null;
  const nextLessonId =
    selectedIndex >= 0 && selectedIndex < readable.length - 1
      ? readable[selectedIndex + 1].lesson.id
      : null;

  const lessonHref = (id: string) => studentCourseRoutes.lessons(courseId, id);

  // Previous, Next and Mark complete sit in the sticky header, so they stay
  // in reach through a long lesson on every screen size.
  const actions = selectedLesson ? (
    <>
      <Button asChild variant="outline" size="sm" disabled={!prevLessonId}>
        {prevLessonId ? (
          <Link href={lessonHref(prevLessonId)} aria-label="Previous lesson">
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
          </Link>
        ) : (
          <span aria-label="Previous lesson">
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
          </span>
        )}
      </Button>
      <Button asChild variant="outline" size="sm" disabled={!nextLessonId}>
        {nextLessonId ? (
          <Link href={lessonHref(nextLessonId)} aria-label="Next lesson">
            <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span aria-label="Next lesson">
            <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
          </span>
        )}
      </Button>
      <MarkCompleteButton lessonId={selectedLesson.id} initialCompleted={completedIds.has(selectedLesson.id)} />
    </>
  ) : undefined;

  return (
    <StudentCourseFrame course={course} page="Lessons" type="editor" actions={actions}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {/* The lesson list stays in view (with its own overflow) so long
            lessons never orphan it; collapsed on phones so the lesson
            itself comes first. */}
        <aside aria-label="Lessons" className={cn(SIDE_PANEL_STICKY_CLASS, "space-y-4 lg:pr-1")}>
          <div className="bg-muted/50 space-y-2 rounded-md p-3">
            <p className="text-muted-foreground text-xs">with {tutorOf(course)?.fullName ?? "your tutor"}</p>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">
                {completedCount}/{total} ({progressPct}%)
              </span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-brand-terracotta h-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <Separator className="hidden lg:block" />
          <MobileCollapsible label={`All lessons (${total})`}>
            <LessonSidebar
              courseId={courseId}
              lessons={lessons}
              selectedLessonId={selectedLessonId}
              mode="student"
              labelScheme={course.lessonLabelScheme}
              completedLessonIds={completedIds}
            />
          </MobileCollapsible>
        </aside>

        {/* The lesson text at Reading width (#205). */}
        <div className="flex max-w-(--frame-reading) min-w-0 flex-col gap-6">
          {selectedLesson ? (
            <>
              <PageTitle
                eyebrow={
                  <span className="inline-flex flex-wrap items-center gap-2 tracking-normal normal-case">
                    <Badge variant="secondary">
                      Lesson {selectedLabel ?? selectedIndex + 1} · {selectedIndex + 1} of {total}
                    </Badge>
                    {selectedLesson.duration != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {selectedLesson.duration} min
                      </span>
                    ) : null}
                  </span>
                }
                title={selectedLesson.title}
                properties={
                  <SaveOffline
                    path={lessonHref(selectedLesson.id)}
                    title={savedTitle(course.name, selectedLesson.title)}
                    version={lessonVersion([
                      selectedLesson.title, selectedLesson.description, selectedLesson.descriptionJson, selectedLesson.videoUrl,
                      selectedLesson.attachmentUrls.map((a) => [a.title, a.url]),
                    ])}
                  />
                }
              />
              <LessonContent lesson={selectedLesson} />
            </>
          ) : (
            <>
              <PageTitle eyebrow="Lessons" title={course.name} />
              <Card className="flex min-h-[400px] items-center justify-center p-8 sm:p-12">
                <EmptyState
                  illustration={<Scene name="empty-lessons" />}
                  title="No lessons yet"
                  description="Your tutor hasn't published any lessons for this course yet. Check back soon."
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </StudentCourseFrame>
  );
}
