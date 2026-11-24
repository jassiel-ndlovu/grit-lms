/**
 * Marking a pile of scripts with the keyboard (owner, 24 Nov). Pure, so
 * scripts/check-marking-flow.ts covers it.
 */

type Script = { studentId: string; status: string };

/** How far the marker is. Attempts still in progress don't count. */
export function markingProgress(all: readonly Script[]): { marked: number; total: number; toMark: number } {
  const marked = all.filter((s) => s.status === "GRADED").length;
  const toMark = all.filter((s) => s.status === "SUBMITTED").length;
  return { marked, total: marked + toMark, toMark };
}

/** The next script to mark in list order, going round to the start; never this one. */
export function nextToMark<T extends Script>(all: readonly T[], studentId: string): T | null {
  const at = all.findIndex((s) => s.studentId === studentId);
  const order = at < 0 ? all : [...all.slice(at + 1), ...all.slice(0, at)];
  return order.find((s) => s.status === "SUBMITTED") ?? null;
}

export type MarkKey = "next" | "previous" | "full" | "comment" | "save-next";

/**
 * What a key does. Single letters work only in a score box, where letters
 * are never typed (WCAG 2.1.4); Ctrl or ⌘ with Enter works anywhere in the
 * form.
 */
export function markKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }, inScore: boolean): MarkKey | null {
  if (e.altKey) return null;
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return "save-next";
  if (!inScore || e.ctrlKey || e.metaKey) return null;
  if (e.key === "Enter") return e.shiftKey ? "previous" : "next";
  if (e.shiftKey) return null;
  if (e.key === "f" || e.key === "F") return "full";
  if (e.key === "c" || e.key === "C") return "comment";
  return null;
}

export const MARK_SHORTCUTS: Array<{ keys: string[]; does: string }> = [
  { keys: ["Enter"], does: "Next question" },
  { keys: ["Shift", "Enter"], does: "Previous question" },
  { keys: ["F"], does: "Full marks" },
  { keys: ["C"], does: "Write a comment" },
  { keys: ["Ctrl", "Enter"], does: "Save and open the next script" },
];

/** Longer comments are written for one student. */
export const COMMENT_REUSE_MAX = 160;
export const COMMENTS_PER_QUESTION = 5;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a comment mentions one of these people by any part of their name. */
export function namesSomeone(comment: string, names: readonly string[]): boolean {
  const parts = new Set(names.flatMap((n) => n.split(/[\s'’-]+/)).filter((p) => p.length >= 3));
  return [...parts].some((p) => new RegExp(`(?<![\\p{L}])${escape(p)}(?![\\p{L}])`, "iu").test(comment));
}

/**
 * Comments already written on a question, most used first, for one click
 * reuse. Leaves out long ones and any that name a student, so nothing
 * personal moves from one script to another.
 */
export function reusableComments(
  rows: ReadonlyArray<{ questionId: string | null; feedback: string | null }>,
  names: readonly string[],
): Record<string, string[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const { questionId, feedback } of rows) {
    const text = feedback?.trim();
    if (!questionId || !text || text.length > COMMENT_REUSE_MAX || text.includes("\n")) continue;
    if (namesSomeone(text, names)) continue;
    const q = counts.get(questionId) ?? new Map<string, number>();
    q.set(text, (q.get(text) ?? 0) + 1);
    counts.set(questionId, q);
  }
  const out: Record<string, string[]> = {};
  for (const [q, m] of counts) {
    out[q] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, COMMENTS_PER_QUESTION).map(([t]) => t);
  }
  return out;
}

/** Add a comment to what is already typed; once only. */
export function withComment(current: string, comment: string): string {
  if (current.trim() === "") return comment;
  return current.includes(comment) ? current : `${current.trimEnd()}\n${comment}`;
}
