/**
 * Assessment/submission filter helpers — used by the tabs on
 * /dashboard/tests, /dashboard/submissions, and the tutor mirrors.
 *
 * Buckets:
 *   - upcoming  — due in the future AND not yet graded/submitted
 *   - missed    — due date has passed AND no submission (or NOT_STARTED)
 *   - submitted — submitted or awaiting grade (SUBMITTED / IN_PROGRESS
 *                 past-due)
 *   - graded    — final grade issued
 *   - all       — no filter
 *
 * Each bucket is exclusive (a row belongs to exactly one) except `all`
 * which shows everything. This mirrors what most students expect when
 * they open the page: "what haven't I done?" -> upcoming/missed;
 * "how did I do?" -> graded.
 */

export type FilterBucket =
  | "all"
  | "upcoming"
  | "missed"
  | "submitted"
  | "graded";

export const FILTER_LABELS: Record<FilterBucket, string> = {
  all: "All",
  upcoming: "Upcoming",
  missed: "Missed",
  submitted: "Submitted",
  graded: "Graded",
};

export interface FilterableItem {
  dueDate: Date;
  status?: string | null;
}

/**
 * Which bucket does an item belong to? Only one match.
 */
export function bucketFor(
  item: FilterableItem,
  now: Date = new Date(),
): Exclude<FilterBucket, "all"> {
  const status = (item.status ?? "").toUpperCase();
  const past = item.dueDate.getTime() < now.getTime();

  if (status === "GRADED") return "graded";
  if (status === "SUBMITTED" || status === "LATE") return "submitted";
  // IN_PROGRESS past-due behaves like SUBMITTED-in-limbo for display —
  // it's technically still open server-side, but from the student's
  // perspective they've started something they can't finish.
  if (status === "IN_PROGRESS" && past) return "submitted";
  if (past) return "missed";
  return "upcoming";
}

/**
 * Filter a list by bucket. `all` returns the original list.
 */
export function filterByBucket<T extends FilterableItem>(
  items: T[],
  bucket: FilterBucket,
  now: Date = new Date(),
): T[] {
  if (bucket === "all") return items;
  return items.filter((i) => bucketFor(i, now) === bucket);
}

/**
 * Counts per bucket — useful for pill badges on tab triggers.
 */
export function bucketCounts<T extends FilterableItem>(
  items: T[],
  now: Date = new Date(),
): Record<FilterBucket, number> {
  const counts: Record<FilterBucket, number> = {
    all: items.length,
    upcoming: 0,
    missed: 0,
    submitted: 0,
    graded: 0,
  };
  for (const item of items) {
    counts[bucketFor(item, now)]++;
  }
  return counts;
}
