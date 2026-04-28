/**
 * LessonSidebar — navigable list of lessons for both tutor manage and student
 * course views.
 *
 * Server Component. Each row is a `<Link>` so navigation is instant and
 * shareable. The sidebar is intentionally dumb — completion state and
 * tutor actions are passed in by the caller so the same component renders
 * for both roles.
 *
 * Mode selection:
 *   - mode="tutor"   — links to /dashboard/manage-courses/lessons/{courseId}?lesson={id}
 *                      Optionally renders an `actions` slot (LessonActions)
 *                      next to each row.
 *   - mode="student" — links to /dashboard/courses/lessons/{courseId}?lesson={id}
 *                      Renders a check-mark for completed lessons.
 */

import Link from "next/link";
import { CheckCircle2, Circle, FileText, Video } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LessonSidebarLesson {
  id: string;
  title: string;
  order: number;
  duration: number | null;
  videoUrl: string[];
  attachmentUrls: { id: string }[];
}

export interface LessonSidebarProps {
  courseId: string;
  lessons: LessonSidebarLesson[];
  selectedLessonId: string | null;
  mode: "tutor" | "student";
  /** Set of completed lesson IDs — only used in student mode. */
  completedLessonIds?: Set<string>;
  /** Render-prop for tutor actions (edit/delete dropdown) per row. */
  renderActions?: (lesson: LessonSidebarLesson) => React.ReactNode;
  /** Optional slot rendered at the bottom of the list (e.g. CreateLessonButton). */
  footer?: React.ReactNode;
}

export function LessonSidebar({
  courseId,
  lessons,
  selectedLessonId,
  mode,
  completedLessonIds,
  renderActions,
  footer,
}: LessonSidebarProps) {
  const basePath =
    mode === "tutor"
      ? `/dashboard/manage-courses/lessons/${courseId}`
      : `/dashboard/courses/lessons/${courseId}`;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Lessons</h2>
        <span className="text-muted-foreground text-xs">
          {lessons.length} total
        </span>
      </div>

      {lessons.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
          No lessons yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {lessons.map((lesson, i) => {
            const isActive = lesson.id === selectedLessonId;
            const isCompleted =
              mode === "student" && completedLessonIds?.has(lesson.id);
            const href = `${basePath}?lesson=${lesson.id}`;

            return (
              <li key={lesson.id} className="group relative">
                <Link
                  href={href}
                  className={cn(
                    "hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                    isActive && "bg-muted text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center text-xs tabular-nums",
                      isActive ? "text-brand-terracotta" : "text-muted-foreground",
                    )}
                  >
                    {mode === "student" ? (
                      isCompleted ? (
                        <CheckCircle2 className="text-brand-terracotta size-4" />
                      ) : (
                        <Circle className="size-4" />
                      )
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1">
                    {lesson.videoUrl.length > 0 && (
                      <Video className="size-3" />
                    )}
                    {lesson.attachmentUrls.length > 0 && (
                      <FileText className="size-3" />
                    )}
                  </span>
                </Link>
                {renderActions && (
                  <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {renderActions(lesson)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {footer && <div className="pt-2">{footer}</div>}
    </div>
  );
}
