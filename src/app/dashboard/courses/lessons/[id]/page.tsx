/**
 * /dashboard/courses/lessons/[id] — student's lesson viewer.
 *
 * The `[id]` segment is the COURSE id. Selected lesson is driven by
 * `?lesson=<lessonId>` (or falls back to the first lesson). The page is a
 * Server Component shell — sidebar + read-only LessonContent are RSC; the
 * Mark Complete toggle and prev/next navigation use Client Components.
 *
 * Enrolment is checked here so a student can't view lessons for a course
 * they aren't enrolled in by typing the URL directly.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { getCourseDetailById } from "@/features/courses/queries";
import {
  getLessonDetailById,
  listCompletionsForStudentInCourse,
  listLessonsByCourseId,
} from "@/features/lessons/queries";
import { LessonContent } from "@/features/lessons/components/lesson-content";
import { LessonSidebar } from "@/features/lessons/components/lesson-sidebar";
import { MarkCompleteButton } from "@/features/lessons/components/mark-complete-button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}

export const metadata = { title: "Lesson" };

export default async function CourseLessonsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: courseId }, { lesson: selectedLessonParam }] = await Promise.all(
    [params, searchParams],
  );

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
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
      <div className="text-muted-foreground p-8 text-sm">
        You aren&apos;t enrolled in this course.
      </div>
    );
  }

  // Resolve the selected lesson: explicit param → first lesson → null.
  const fallbackId = lessons[0]?.id ?? null;
  const selectedLessonId =
    selectedLessonParam && lessons.some((l) => l.id === selectedLessonParam)
      ? selectedLessonParam
      : fallbackId;

  const selectedLesson = selectedLessonId
    ? await getLessonDetailById(selectedLessonId)
    : null;

  const completedIds = new Set(completions.map((c) => c.lessonId));
  const completedCount = completedIds.size;
  const total = lessons.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Prev/next navigation — based on lesson order in the list.
  const selectedIndex = selectedLessonId
    ? lessons.findIndex((l) => l.id === selectedLessonId)
    : -1;
  const prevLessonId = selectedIndex > 0 ? lessons[selectedIndex - 1].id : null;
  const nextLessonId =
    selectedIndex >= 0 && selectedIndex < lessons.length - 1
      ? lessons[selectedIndex + 1].id
      : null;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/courses/${courseId}`}>
            <ArrowLeft className="size-4" /> Back to course
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{course.name}</h1>
          <p className="text-muted-foreground text-xs">
            with {course.tutor.fullName}
          </p>
        </div>
        <div className="bg-muted/50 space-y-2 rounded-md p-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount}/{total} ({progressPct}%)
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <Separator />
        <LessonSidebar
          courseId={courseId}
          lessons={lessons}
          selectedLessonId={selectedLessonId}
          mode="student"
          completedLessonIds={completedIds}
        />
      </aside>

      {/* Main pane */}
      <main className="min-w-0 space-y-6">
        {selectedLesson ? (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  Lesson {selectedIndex + 1} of {total}
                </Badge>
                {selectedLesson.duration != null && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Clock className="size-3" />
                    {selectedLesson.duration} min
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {selectedLesson.title}
              </h2>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    disabled={!prevLessonId}
                  >
                    {prevLessonId ? (
                      <Link
                        href={`/dashboard/courses/lessons/${courseId}?lesson=${prevLessonId}`}
                      >
                        <ChevronLeft className="size-4" /> Previous
                      </Link>
                    ) : (
                      <span>
                        <ChevronLeft className="size-4" /> Previous
                      </span>
                    )}
                  </Button>
                  <Button asChild size="sm" disabled={!nextLessonId}>
                    {nextLessonId ? (
                      <Link
                        href={`/dashboard/courses/lessons/${courseId}?lesson=${nextLessonId}`}
                      >
                        Next <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <span>
                        Next <ChevronRight className="size-4" />
                      </span>
                    )}
                  </Button>
                </div>
                <MarkCompleteButton
                  lessonId={selectedLesson.id}
                  initialCompleted={completedIds.has(selectedLesson.id)}
                />
              </div>
            </div>

            <LessonContent lesson={selectedLesson} />
          </>
        ) : (
          <Card className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-12 text-center">
            <h3 className="text-base font-medium">No lessons yet</h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              Your tutor hasn&apos;t published any lessons for this course yet.
              Check back soon.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
