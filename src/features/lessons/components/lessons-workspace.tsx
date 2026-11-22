/**
 * The course's Lessons view: the lesson tree beside the editor (UI draft
 * "Course page"). Server component; the page
 * (manage-courses/lessons/[id]) loads the course, lessons and the selected
 * lesson.
 */

import { BookOpenText } from "lucide-react";

import { EmptyState, Scene } from "@/components/ui/empty-state";
import type { ReorderNode } from "@/components/tree-reorder-dialog";
import { CourseFrame } from "@/features/courses/components/course-frame";
import { SIDE_PANEL_STICKY_CLASS } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";
import { CreateLessonButton } from "./create-lesson-button";
import { LessonActions } from "./lesson-actions";
import { TopicsContext } from "@/features/courses/components/topic-picker";
import { topicsFor, type CourseCurriculum } from "@/features/courses/lib/curriculum";
import { LessonForm } from "./lesson-form";
import { LessonSidebar } from "./lesson-sidebar";
import { LessonTreeFold } from "./lesson-tree-fold";
import { LessonTreeTools } from "./lesson-tree-tools";
import {
  buildLessonTree,
  flattenLessonTree,
  subtreeIds,
  type LessonTreeNode,
} from "../lib/lesson-tree";
import type { EditorFeatures } from "@/components/editor/commands";

import type { getLessonDetailById, listLessonsByCourseId } from "../queries";

export interface LessonsWorkspaceProps {
  course: { id: string; name: string; lessonLabelScheme: string[] } & CourseCurriculum;
  lessons: Awaited<ReturnType<typeof listLessonsByCourseId>>;
  selectedLesson: Awaited<ReturnType<typeof getLessonDetailById>>;
  /** Editor blocks this course may use, for example the Plus graph block. */
  editorFeatures?: Partial<EditorFeatures>;
}

export function LessonsWorkspace({ course, lessons, selectedLesson, editorFeatures }: LessonsWorkspaceProps) {
  const courseId = course.id;
  const selectedLessonId = selectedLesson?.id ?? null;

  // Hierarchy and labels for the tree tools, the parent pickers and the
  // reorder dialog.
  const labelScheme = course.lessonLabelScheme;
  const tree = buildLessonTree(lessons);
  const flat = flattenLessonTree(tree, labelScheme);
  const toReorder = (list: LessonTreeNode<(typeof lessons)[number]>[]): ReorderNode[] =>
    list.map((l) => ({ id: l.id, children: toReorder(l.children) }));
  const titles = Object.fromEntries(flat.map((f) => [f.lesson.id, `${f.label} · ${f.lesson.title}`]));
  const parentOptions = flat.map((f) => ({ id: f.lesson.id, label: f.label, title: f.lesson.title, depth: f.depth }));
  // A lesson can't be nested under itself or anything inside it.
  const blocked = selectedLessonId ? subtreeIds(lessons, selectedLessonId) : new Set<string>();
  const editParentOptions = parentOptions.filter((p) => !blocked.has(p.id));
  const selectedLabel = selectedLessonId ? flat.find((f) => f.lesson.id === selectedLessonId)?.label : undefined;
  const isGroup = selectedLesson?.type === "NONE";
  // The topics lessons can be tagged with (contracts/curriculum.md).
  const topics = topicsFor(course);

  return (
    <TopicsContext.Provider value={topics}>
    <CourseFrame course={course} page="Lessons" type="editor">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-0">
        {/* The tree stays in view while a long lesson scrolls. */}
        <aside
          aria-label="Lesson tree"
          className={cn(SIDE_PANEL_STICKY_CLASS, "lg:pr-6")}
        >
          {/* Folded on phones once a lesson is open (lesson-tree-fold.tsx). */}
          <LessonTreeFold
            key={selectedLessonId ?? "none"}
            defaultOpen={!selectedLesson}
            summary={selectedLesson ? [selectedLabel, selectedLesson.title].filter(Boolean).join(" · ") : ""}
          >
          <LessonSidebar
            courseId={courseId}
            lessons={lessons}
            selectedLessonId={selectedLessonId}
            mode="tutor"
            labelScheme={labelScheme}
            toolbar={
              <LessonTreeTools courseId={courseId} labelScheme={labelScheme} tree={toReorder(tree)} titles={titles} />
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
                nextOrder={tree.length}
                parentOptions={parentOptions}
                editorFeatures={editorFeatures}
                label={lessons.length === 0 ? "Create first lesson" : "Add lesson or group"}
              />
            }
          />
          </LessonTreeFold>
        </aside>

        <section aria-label="Lesson editor" className="border-border min-w-0 lg:min-h-[60vh] lg:border-l lg:pl-8">
          {selectedLesson ? (
            // Keyed by lesson id: LessonForm (react-hook-form) reads its
            // defaultValues only on mount, so switching ?lesson= without a
            // remount kept the previous lesson's content.
            <div key={selectedLesson.id} className="space-y-2">
              <div>
                <p className="text-muted-foreground font-mono text-xs">
                  {[selectedLabel, isGroup ? "Group" : "Lesson", !isGroup && selectedLesson.duration ? `${selectedLesson.duration} min` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h1 className="sr-only">{selectedLesson.title}</h1>
              </div>
              <LessonForm
                layout="document"
                courseId={courseId}
                editorFeatures={editorFeatures}
                parentOptions={editParentOptions}
                defaultValues={{
                  type: selectedLesson.type,
                  parentId: selectedLesson.parentId,
                  id: selectedLesson.id,
                  title: selectedLesson.title,
                  description: selectedLesson.description,
                  descriptionJson: selectedLesson.descriptionJson,
                  order: selectedLesson.order,
                  duration: selectedLesson.duration,
                  videoUrl: selectedLesson.videoUrl,
                  topics: selectedLesson.topics,
                  attachments: selectedLesson.attachmentUrls.map((a) => ({ title: a.title, url: a.url })),
                }}
              />
            </div>
          ) : (
            <>
              <h1 className="sr-only">Lessons in {course.name}</h1>
              <div className="flex min-h-[400px] items-center justify-center">
                {lessons.length === 0 ? (
                  <EmptyState
                    illustration={<Scene name="empty-lessons" />}
                    title="No lessons yet"
                    description="Create the first lesson for this course."
                    action={<CreateLessonButton courseId={courseId} nextOrder={0} editorFeatures={editorFeatures} label="Create first lesson" />}
                  />
                ) : (
                  <EmptyState
                    compact
                    illustration={
                      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
                        <BookOpenText className="size-6" />
                      </div>
                    }
                    title="Pick a lesson"
                    description="Choose a lesson from the tree to edit its content, videos and attachments."
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </CourseFrame>
    </TopicsContext.Provider>
  );
}
