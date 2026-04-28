/**
 * /dashboard/manage-courses/lessons/[id] — tutor's lesson manager.
 *
 * The `[id]` segment is the COURSE id (legacy URL — kept for backwards
 * compatibility). Selected lesson is driven by `?lesson=<lessonId>` in the
 * search params; without it the page shows a "select or create a lesson"
 * empty state.
 *
 * Server Component shell. The sidebar uses `<Link>` items so navigation is
 * shareable; the editor pane is a Client Component (LessonForm) hydrated
 * with the selected lesson's defaults. Sidebar actions (delete) and the
 * "+ Add lesson" trigger are also Client Components.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  courseBelongsToTutor,
  getCourseDetailById,
} from "@/features/courses/queries";
import {
  getLessonDetailById,
  listLessonsByCourseId,
} from "@/features/lessons/queries";
import { LessonSidebar } from "@/features/lessons/components/lesson-sidebar";
import { LessonForm } from "@/features/lessons/components/lesson-form";
import { LessonActions } from "@/features/lessons/components/lesson-actions";
import { CreateLessonButton } from "@/features/lessons/components/create-lesson-button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}

export const metadata = { title: "Manage lessons" };

export default async function ManageLessonsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: courseId }, { lesson: selectedLessonParam }] = await Promise.all(
    [params, searchParams],
  );

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const [course, lessons, owns] = await Promise.all([
    getCourseDetailById(courseId),
    listLessonsByCourseId(courseId),
    courseBelongsToTutor(courseId, tutor.id),
  ]);

  if (!course) notFound();
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this course.
      </div>
    );
  }

  // Resolve the selected lesson — the URL param wins; fall back to first.
  const selectedLessonId =
    selectedLessonParam &&
    lessons.some((l) => l.id === selectedLessonParam)
      ? selectedLessonParam
      : null;

  const selectedLesson = selectedLessonId
    ? await getLessonDetailById(selectedLessonId)
    : null;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/manage-courses/${courseId}`}>
            <ArrowLeft className="size-4" /> Back to course
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{course.name}</h1>
          <p className="text-muted-foreground text-xs">Manage lessons</p>
        </div>
        <Separator />
        <LessonSidebar
          courseId={courseId}
          lessons={lessons}
          selectedLessonId={selectedLessonId}
          mode="tutor"
          renderActions={(lesson) => (
            <LessonActions
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              isSelected={lesson.id === selectedLessonId}
              courseId={courseId}
            />
          )}
          footer={
            <CreateLessonButton
              courseId={courseId}
              nextOrder={lessons.length}
              label={lessons.length === 0 ? "Create first lesson" : "Add lesson"}
            />
          }
        />
      </aside>

      {/* Main pane */}
      <main className="min-w-0">
        {selectedLesson ? (
          <Card className="space-y-6 p-6">
            <div>
              <h2 className="text-base font-medium">Edit lesson</h2>
              <p className="text-muted-foreground text-sm">
                Changes save immediately when you click &ldquo;Save changes&rdquo;.
              </p>
            </div>
            <Separator />
            <LessonForm
              courseId={courseId}
              defaultValues={{
                id: selectedLesson.id,
                title: selectedLesson.title,
                description: selectedLesson.description,
                order: selectedLesson.order,
                duration: selectedLesson.duration,
                videoUrl: selectedLesson.videoUrl,
                attachments: selectedLesson.attachmentUrls.map((a) => ({
                  title: a.title,
                  url: a.url,
                })),
              }}
            />
          </Card>
        ) : (
          <EmptyEditorState courseId={courseId} totalLessons={lessons.length} />
        )}
      </main>
    </div>
  );
}

function EmptyEditorState({
  courseId,
  totalLessons,
}: {
  courseId: string;
  totalLessons: number;
}) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <BookOpenText className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-medium">
          {totalLessons === 0 ? "No lessons yet" : "Select a lesson"}
        </h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {totalLessons === 0
            ? "Create your first lesson using the button on the left."
            : "Pick a lesson from the sidebar to edit its content, videos, and attachments."}
        </p>
      </div>
      {totalLessons === 0 && (
        <CreateLessonButton
          courseId={courseId}
          nextOrder={0}
          label="Create first lesson"
        />
      )}
    </Card>
  );
}
