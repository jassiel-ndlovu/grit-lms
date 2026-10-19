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
import { LessonTreeTools } from "@/features/lessons/components/lesson-tree-tools";
import {
  buildLessonTree,
  flattenLessonTree,
  subtreeIds,
  type LessonTreeNode,
} from "@/features/lessons/lib/lesson-tree";
import type { ReorderNode } from "@/components/tree-reorder-dialog";

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

  // Hierarchy + labels for the sidebar tools, the parent pickers and the
  // reorder dialog.
  const labelScheme = course.lessonLabelScheme;
  const tree = buildLessonTree(lessons);
  const flat = flattenLessonTree(tree, labelScheme);
  const toReorder = (list: LessonTreeNode<(typeof lessons)[number]>[]): ReorderNode[] =>
    list.map((l) => ({ id: l.id, children: toReorder(l.children) }));
  const titles = Object.fromEntries(
    flat.map((f) => [f.lesson.id, `${f.label} · ${f.lesson.title}`]),
  );
  const parentOptions = flat.map((f) => ({
    id: f.lesson.id,
    label: f.label,
    title: f.lesson.title,
    depth: f.depth,
  }));
  // A lesson can't be nested under itself or anything inside it.
  const blocked = selectedLessonId ? subtreeIds(lessons, selectedLessonId) : new Set<string>();
  const editParentOptions = parentOptions.filter((p) => !blocked.has(p.id));
  const nextTopOrder = tree.length;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-4 sm:px-6 py-6 sm:py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar — sticky + independently scrollable so it stays visible
          while editing long lesson bodies on the right. */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/manage-courses/${courseId}`}>
            <ArrowLeft className="size-4" /> Back to course
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-lg leading-tight tracking-tight text-foreground">
            {course.name}
          </h1>
          <p className="text-muted-foreground text-xs">Manage lessons</p>
        </div>
        <Separator />
        <LessonSidebar
          courseId={courseId}
          lessons={lessons}
          selectedLessonId={selectedLessonId}
          mode="tutor"
          labelScheme={labelScheme}
          toolbar={
            <LessonTreeTools
              courseId={courseId}
              labelScheme={labelScheme}
              tree={toReorder(tree)}
              titles={titles}
            />
          }
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
              nextOrder={nextTopOrder}
              parentOptions={parentOptions}
              label={lessons.length === 0 ? "Create first lesson" : "Add lesson or group"}
            />
          }
        />
      </aside>

      {/* Main pane */}
      <main className="min-w-0">
        {selectedLesson ? (
          <Card className="space-y-6 p-6">
            <div>
              <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
                {selectedLesson.type === "NONE" ? "Edit group" : "Edit lesson"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Changes save immediately when you click &ldquo;Save changes&rdquo;.
              </p>
            </div>
            <Separator />
            <LessonForm
              courseId={courseId}
              parentOptions={editParentOptions}
              defaultValues={{
                type: selectedLesson.type,
                parentId: selectedLesson.parentId,
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
    <Card className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 sm:p-12 text-center">
      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
        <BookOpenText className="size-6" />
      </div>
      <div>
        <h3 className="font-display text-xl leading-tight text-foreground">
          {totalLessons === 0 ? "No lessons yet" : "Select a lesson"}
        </h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
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
