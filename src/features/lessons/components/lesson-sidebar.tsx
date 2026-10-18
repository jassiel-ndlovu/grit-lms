/**
 * LessonSidebar — navigable list of lessons for both tutor manage and student
 * course views.
 *
 * Server Component. Each row is a `<Link>` so navigation is instant and
 * shareable. The sidebar is intentionally dumb — completion state and
 * tutor actions are passed in by the caller so the same component renders
 * for both roles.
 *
 * Lessons render as a tree (parentId + per-sibling `order`), each labelled
 * from the course's enumitem-style `labelScheme` (see lib/enum-labels.ts).
 * NONE lessons are group headings: tutors can still open them to rename or
 * re-parent them; students see them as plain headings.
 *
 * Mode selection:
 *   - mode="tutor"   — links to /dashboard/manage-courses/lessons/{courseId}?lesson={id}
 *                      Optionally renders an `actions` slot (LessonActions)
 *                      next to each row.
 *   - mode="student" — links to /dashboard/courses/lessons/{courseId}?lesson={id}
 *                      Renders a check-mark for completed lessons.
 */

import Link from "next/link";
import { CheckCircle2, Circle, FileText, FolderOpen, Video } from "lucide-react";

import { cn } from "@/lib/utils";

import { buildLessonTree, flattenLessonTree } from "../lib/lesson-tree";

export interface LessonSidebarLesson {
  id: string;
  title: string;
  order: number;
  duration: number | null;
  videoUrl: string[];
  attachmentUrls: { id: string }[];
  parentId: string | null;
  type: "CONTENT" | "NONE";
  createdAt: Date;
}

export interface LessonSidebarProps {
  courseId: string;
  lessons: LessonSidebarLesson[];
  selectedLessonId: string | null;
  mode: "tutor" | "student";
  /** Course.lessonLabelScheme; empty = default numbering. */
  labelScheme?: string[];
  /** Set of completed lesson IDs — only used in student mode. */
  completedLessonIds?: Set<string>;
  /** Render-prop for tutor actions (edit/delete dropdown) per row. */
  renderActions?: (lesson: LessonSidebarLesson) => React.ReactNode;
  /** Optional slot rendered above the list (e.g. numbering / rearrange tools). */
  toolbar?: React.ReactNode;
  /** Optional slot rendered at the bottom of the list (e.g. CreateLessonButton). */
  footer?: React.ReactNode;
}

export function LessonSidebar({
  courseId,
  lessons,
  selectedLessonId,
  mode,
  labelScheme,
  completedLessonIds,
  renderActions,
  toolbar,
  footer,
}: LessonSidebarProps) {
  const basePath =
    mode === "tutor"
      ? `/dashboard/manage-courses/lessons/${courseId}`
      : `/dashboard/courses/lessons/${courseId}`;
  const rows = flattenLessonTree(buildLessonTree(lessons), labelScheme);
  const contentCount = lessons.filter((l) => l.type !== "NONE").length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Lessons</h2>
        <span className="text-muted-foreground text-xs">
          {contentCount} total
        </span>
      </div>

      {toolbar}

      {lessons.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
          No lessons yet.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map(({ lesson, depth, label }) => {
            const isActive = lesson.id === selectedLessonId;
            const isGroup = lesson.type === "NONE";
            const isCompleted =
              mode === "student" && completedLessonIds?.has(lesson.id);
            const href = `${basePath}?lesson=${lesson.id}`;
            const indent = { paddingLeft: `${0.5 + depth * 0.875}rem` };

            if (isGroup && mode === "student") {
              return (
                <li
                  key={lesson.id}
                  style={indent}
                  className="text-muted-foreground flex items-center gap-2 pt-3 pr-2 pb-1 text-[11px] font-medium uppercase tracking-wide"
                >
                  <span className="tabular-nums normal-case">{label}</span>
                  <span className="truncate">{lesson.title}</span>
                </li>
              );
            }

            return (
              <li key={lesson.id} className="group relative">
                <Link
                  href={href}
                  style={indent}
                  className={cn(
                    "hover:bg-muted/60 flex items-center gap-2 rounded-md py-2 pr-2 text-sm transition-colors",
                    isActive && "bg-muted text-foreground",
                    isGroup && "text-muted-foreground font-medium",
                  )}
                >
                  <span
                    className={cn(
                      "flex min-w-5 shrink-0 items-center justify-center text-xs tabular-nums",
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
                      label
                    )}
                  </span>
                  {mode === "student" && (
                    <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                      {label}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1">
                    {isGroup && <FolderOpen className="size-3" aria-label="Group" />}
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
