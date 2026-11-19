/**
 * Pure helpers for the tutor's course pages (UI draft "Course page").
 * Checked by scripts/check-course-overview.ts.
 */

/** Up to two letters for the course tile: "Information Technology 12" → "IT". */
export function courseInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  const pick = lettered.length ? lettered : words;
  if (pick.length === 0) return "?";
  if (pick.length === 1) return pick[0].slice(0, 2).toUpperCase();
  return (pick[0][0] + pick[1][0]).toUpperCase();
}

export type WorkStatus = "draft" | "open" | "closed";

/** A test or assignment: hidden is a draft, then open until its due date. */
export function workStatus(item: { isActive: boolean | null; dueDate: Date }, now: Date): WorkStatus {
  if (item.isActive === false) return "draft";
  return item.dueDate.getTime() >= now.getTime() ? "open" : "closed";
}

export interface WorkItem {
  kind: "test" | "assignment";
  id: string;
  title: string;
  dueDate: Date;
  isActive: boolean | null;
}

/** Open first (soonest due), then drafts (soonest), then closed (latest first). */
export function sortWork<T extends WorkItem>(items: T[], now: Date): (T & { status: WorkStatus })[] {
  const rank: Record<WorkStatus, number> = { open: 0, draft: 1, closed: 2 };
  return items
    .map((i) => ({ ...i, status: workStatus(i, now) }))
    .sort((a, b) => {
      if (a.status !== b.status) return rank[a.status] - rank[b.status];
      const d = a.dueDate.getTime() - b.dueDate.getTime();
      if (d !== 0) return a.status === "closed" ? -d : d;
      return a.title.localeCompare(b.title);
    });
}

/** "1 lesson", "12 lessons in 3 groups". */
export function lessonSummary(lessons: { type: "CONTENT" | "NONE" }[]): string {
  const groups = lessons.filter((l) => l.type === "NONE").length;
  const content = lessons.length - groups;
  const head = `${content} lesson${content === 1 ? "" : "s"}`;
  return groups ? `${head} in ${groups} group${groups === 1 ? "" : "s"}` : head;
}
