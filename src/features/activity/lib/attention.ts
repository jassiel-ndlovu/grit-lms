/**
 * "Needs your attention" on the tutor home (UI draft, Main): one row per
 * test or assignment that wants the tutor now. Pure, so the rules are
 * checked by scripts/check-tutor-attention.ts.
 *
 * Each item lands in at most one bucket, first match wins:
 *   1. mark  — has hand-ins waiting for a grade (SUBMITTED or LATE)
 *   2. draft — hidden from students, due date still ahead
 *   3. due   — visible, due within the window (default 7 days)
 * Items with none of these are left out.
 */

export type AttentionBucket = "mark" | "draft" | "due";
export type AttentionFilter = "all" | AttentionBucket;

export interface AttentionSource {
  kind: "test" | "assignment";
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  /** Drafts are hidden from students. */
  isActive: boolean;
  /** Hand-ins waiting for a grade. */
  toMark: number;
}

export interface AttentionRow extends AttentionSource {
  bucket: AttentionBucket;
}

const DAY = 24 * 60 * 60 * 1000;
const ORDER: Record<AttentionBucket, number> = { mark: 0, due: 1, draft: 2 };

export function bucketFor(item: AttentionSource, now: Date, windowDays = 7): AttentionBucket | null {
  if (item.toMark > 0) return "mark";
  const t = item.dueDate.getTime();
  if (!item.isActive) return t >= now.getTime() ? "draft" : null;
  return t >= now.getTime() && t <= now.getTime() + windowDays * DAY ? "due" : null;
}

/** Rows in display order: to mark, then due, then drafts; soonest first in each. */
export function attentionRows(items: AttentionSource[], now: Date, windowDays = 7): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const item of items) {
    const bucket = bucketFor(item, now, windowDays);
    if (bucket) rows.push({ ...item, bucket });
  }
  return rows.sort(
    (a, b) => ORDER[a.bucket] - ORDER[b.bucket] || a.dueDate.getTime() - b.dueDate.getTime() || a.title.localeCompare(b.title),
  );
}

export function parseAttentionFilter(value: string | string[] | undefined): AttentionFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "mark" || v === "due" || v === "draft" ? v : "all";
}

export function filterRows(rows: AttentionRow[], filter: AttentionFilter): AttentionRow[] {
  return filter === "all" ? rows : rows.filter((r) => r.bucket === filter);
}
