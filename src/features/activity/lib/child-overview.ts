/**
 * Pure helpers for the parent's per-child view (/dashboard/children/[userId]).
 *
 * No database, no React: the server module (../child-overview.ts) loads
 * rows with the existing student queries and hands them here.
 * Checked by scripts/check-child-overview.ts.
 */

/** How far ahead "upcoming work" looks. */
export const UPCOMING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const childRoutes = {
  home: "/dashboard",
  child: (userId: string) => `/dashboard/children/${encodeURIComponent(userId)}`,
};

/**
 * Where a parent lands when they open a student-only page (courses,
 * assignments, calendar) by URL: the child's own view when there is
 * exactly one child, otherwise the parent home that lists them.
 */
export function parentLanding(children: ReadonlyArray<{ userId: string }>): string {
  return children.length === 1 ? childRoutes.child(children[0].userId) : childRoutes.home;
}

export type Progress = { done: number; total: number; percent: number };

/** Lesson progress. Group headings (type NONE) hold nothing to complete. */
export function lessonProgress(
  lessons: ReadonlyArray<{ id: string; type: string }>,
  completions: ReadonlyArray<{ lessonId: string }>,
): Progress {
  const readable = new Set(lessons.filter((l) => l.type !== "NONE").map((l) => l.id));
  const done = new Set(completions.map((c) => c.lessonId).filter((id) => readable.has(id))).size;
  return { done, total: readable.size, percent: percentOf(done, readable.size) };
}

/** Sums course progress into one figure. */
export function overallProgress(parts: ReadonlyArray<Progress>): Progress {
  const done = parts.reduce((s, p) => s + p.done, 0);
  const total = parts.reduce((s, p) => s + p.total, 0);
  return { done, total, percent: percentOf(done, total) };
}

export function percentOf(score: number, outOf: number): number {
  return outOf > 0 ? Math.round((score / outOf) * 100) : 0;
}

/** The fields of a Grade row that decide whether the student may see it. */
export type GradeRelease = {
  testSubmission: { status: string; test: { releaseAutoMarksToStudent: boolean } } | null;
  submissionEntry: { status: string } | null;
};

/**
 * True when the mark has been released to the student, so a parent may see
 * it too. A tutor can auto-mark a test before releasing it; that Grade row
 * exists but stays hidden until the submission is GRADED, unless the test
 * releases auto-marks at submit time. An assignment mark shows once the
 * entry is GRADED. A grade linked to neither is a manual entry, already
 * released.
 */
export function isReleased(g: GradeRelease): boolean {
  if (g.testSubmission) {
    return g.testSubmission.status === "GRADED" || g.testSubmission.test.releaseAutoMarksToStudent;
  }
  if (g.submissionEntry) return g.submissionEntry.status === "GRADED";
  return true;
}

export type UpcomingItem = {
  kind: "test" | "assignment";
  id: string;
  title: string;
  courseName: string;
  dueDate: Date;
  /** The child's latest attempt status, or null when not started. */
  status: string | null;
};

/** Statuses that mean the child has handed the work in. */
const HANDED_IN = new Set(["SUBMITTED", "GRADED", "LATE"]);

export function isHandedIn(status: string | null): boolean {
  return status != null && HANDED_IN.has(status);
}

/**
 * Tests and assignments due from now until UPCOMING_DAYS ahead, soonest
 * first. Work already handed in stays in the list (a parent wants to see it
 * was done); overdue work is not "upcoming" and is left out.
 */
export function dueSoon<T extends { dueDate: Date }>(items: ReadonlyArray<T>, now: Date, days = UPCOMING_DAYS): T[] {
  const from = now.getTime();
  const to = from + days * DAY_MS;
  return items
    .filter((i) => i.dueDate.getTime() >= from && i.dueDate.getTime() <= to)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/** A short label for an upcoming item's status, in the parent's words. */
export function upcomingStatusLabel(item: Pick<UpcomingItem, "kind" | "status">): string {
  if (item.status === "GRADED") return "Marked";
  if (isHandedIn(item.status)) return "Handed in";
  if (item.status === "IN_PROGRESS") return item.kind === "test" ? "Started" : "In progress";
  return "Not started";
}

/**
 * Courses grouped by the workspace they belong to, in the order of the
 * child's workspaces. A course with no workspace, or one outside the list,
 * goes under "Other courses" at the end.
 */
export function groupByWorkspace<C extends { workspaceId: string | null }>(
  courses: ReadonlyArray<C>,
  workspaces: ReadonlyArray<{ id: string; name: string }>,
): Array<{ id: string | null; name: string; courses: C[] }> {
  const groups = workspaces.map((w) => ({ id: w.id as string | null, name: w.name, courses: [] as C[] }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const other: C[] = [];
  for (const c of courses) {
    const g = c.workspaceId ? byId.get(c.workspaceId) : undefined;
    if (g) g.courses.push(c);
    else other.push(c);
  }
  if (other.length) groups.push({ id: null, name: "Other courses", courses: other });
  return groups;
}
