/**
 * The tutor's course overview (UI draft "Course page"): the course tile,
 * title and properties, the lesson outline, and the tests and assignments.
 *
 * Server component; the page (manage-courses/[id]) loads the data.
 */

import Link from "next/link";
import { BookOpenText } from "lucide-react";

import { PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { assignmentRoutes } from "@/features/assignments/routes";
import { formatDate } from "@/lib/datetime";

import { courseInitials, type WorkItem, type WorkStatus } from "../lib/course-overview";
import { WriteGuard } from "@/components/shell/workspace-access";

import { CourseFrame, courseRoutes } from "./course-frame";

export interface CourseOverviewProps {
  course: { id: string; name: string; description: string | null };
  /** Label and value rows under the title. */
  props: [string, React.ReactNode][];
  /** The lesson tree, flattened and labelled. */
  outline: { lesson: { id: string; title: string; type: "CONTENT" | "NONE"; duration: number | null }; depth: number; label: string }[];
  work: (WorkItem & { status: WorkStatus })[];
  ctx: { timeZone: string; locale: string };
}

const WORK_CHIP: Record<WorkStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
  closed: { label: "Closed", tone: "success" },
};

function workHref(w: WorkItem & { status: WorkStatus }) {
  if (w.kind === "test") {
    return w.status === "draft" ? `/dashboard/tutor-tests/${w.id}/edit` : `/dashboard/tutor-tests/${w.id}/submissions`;
  }
  return w.status === "draft" ? assignmentRoutes.edit(w.id) : assignmentRoutes.detail(w.id);
}

export function CourseOverview({ course, props, outline, work, ctx }: CourseOverviewProps) {
  return (
    <CourseFrame
      course={course}
      actions={
        <Button asChild size="sm" variant="brand">
          <Link href={courseRoutes.lessons(course.id)}>Edit lessons</Link>
        </Button>
      }
    >
      <PageTitle
        icon={
          <span className="bg-muted text-foreground flex size-8 items-center justify-center rounded-lg font-mono text-xs font-medium">
            {courseInitials(course.name)}
          </span>
        }
        title={course.name}
        description={course.description}
        properties={
          <dl className="text-sm">
            {props.map(([k, v]) => (
              <div key={k} className="flex min-h-8 flex-col py-1 sm:flex-row sm:items-center">
                <dt className="text-muted-foreground sm:w-36 sm:shrink-0">{k}</dt>
                <dd className="text-foreground min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="outline-heading" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="outline-heading" className="text-foreground text-base font-semibold">
              Lessons
            </h2>
            {outline.length > 0 ? (
              <Link href={courseRoutes.lessons(course.id)} className="text-muted-foreground hover:text-foreground text-xs hover:underline">
                Open editor
              </Link>
            ) : null}
          </div>
          {outline.length === 0 ? (
            <EmptyState
              compact
              illustration={<Scene name="empty-lessons" />}
              title="No lessons yet"
              description="Lessons and groups you add show up here as the course outline."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={courseRoutes.lessons(course.id)}>
                    <BookOpenText className="size-4" /> Add the first lesson
                  </Link>
                </Button>
              }
            />
          ) : (
            <ol className="space-y-px">
              {outline.map(({ lesson, depth, label }) => {
                const group = lesson.type === "NONE";
                return (
                  <li key={lesson.id}>
                    <Link
                      href={courseRoutes.lessons(course.id, lesson.id)}
                      style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                      className="hover:bg-muted/60 flex h-9 items-center gap-3 rounded-md pr-2 text-sm"
                    >
                      <span className="text-muted-foreground w-9 shrink-0 font-mono text-xs tabular-nums">{label}</span>
                      <span className={group ? "text-foreground min-w-0 flex-1 truncate font-semibold" : "text-foreground min-w-0 flex-1 truncate"}>
                        {lesson.title}
                      </span>
                      {!group && lesson.duration ? (
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{lesson.duration} min</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="work-heading" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="work-heading" className="text-foreground text-base font-semibold">
              Tests and assignments
            </h2>
            <div className="flex gap-3 text-xs">
              <WriteGuard label="New test" as="link">
                <Link href="/dashboard/tutor-tests/new" className="text-muted-foreground hover:text-foreground hover:underline">
                New test
              </Link>
              </WriteGuard>
              <WriteGuard label="New assignment" as="link">
                <Link href={assignmentRoutes.new} className="text-muted-foreground hover:text-foreground hover:underline">
                New assignment
              </Link>
              </WriteGuard>
            </div>
          </div>
          {work.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tests or assignments in this course yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {work.map((w) => (
                <li key={`${w.kind}-${w.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={workHref(w)} className="text-foreground block truncate font-medium hover:underline">
                      {w.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {w.kind === "test" ? "Test" : "Assignment"} · due{" "}
                      {formatDate(w.dueDate, ctx, { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <StatusChip tone={WORK_CHIP[w.status].tone} className="whitespace-nowrap">
                    {WORK_CHIP[w.status].label}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CourseFrame>
  );
}
