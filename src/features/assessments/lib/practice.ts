/**
 * Practice sets (contracts/practice.md): which questions can be practised,
 * marking an answer, and when a question comes back. Pure: no I/O.
 *
 * Spaced repetition is a Leitner system with six boxes. A question answered
 * fully moves up a box and comes back after a longer gap; a missed one goes
 * back to box 0 and is due again at once.
 */

import { autoGradeSubmission, isAutoMarkable, type AutoGradeQuestion, type MathsChecker } from "./auto-grade";
import type { ImportQuestion } from "./test-io";

/* ─── Scheduling ────────────────────────────────────────────────────────── */

/** Days until a question comes back, by box. Box 0 is due at once. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const TOP_BOX = BOX_DAYS.length - 1;
/** From this box a question counts as known: three clean answers spread over days. */
export const KNOWN_BOX = 3;
/** Questions in one sitting, and how many of them may be new. */
export const SESSION_SIZE = 20;
export const NEW_PER_SESSION = 10;

const DAY_MS = 86_400_000;
/** South Africa is UTC+2 all year. */
const SCHOOL_OFFSET_MS = 2 * 3_600_000;

/** Midnight in South Africa, `days` after today, so "tomorrow" means tomorrow at any hour. */
export function schoolMidnight(now: Date, days: number): Date {
  const today = Math.floor((now.getTime() + SCHOOL_OFFSET_MS) / DAY_MS);
  return new Date((today + days) * DAY_MS - SCHOOL_OFFSET_MS);
}

export type ReviewState = { box: number; dueAt: Date };

/**
 * The next state after an answer. `share` is the answer's share of the
 * marks. Full marks move up one box, but only when the question was due:
 * practising early never stretches the gap. Half marks or more: back
 * tomorrow, at box 1 or lower. Less sends it back to box 0.
 */
export function nextReview(prev: ReviewState | null, share: number, now: Date): ReviewState {
  if (share < 0.5) return { box: 0, dueAt: now };
  if (share < 1) return { box: Math.min(prev?.box ?? 0, 1), dueAt: schoolMidnight(now, 1) };
  if (prev && prev.dueAt.getTime() > now.getTime()) return { box: prev.box, dueAt: prev.dueAt };
  const box = Math.min(TOP_BOX, (prev?.box ?? 0) + 1);
  return { box, dueAt: schoolMidnight(now, BOX_DAYS[box]) };
}

/**
 * One sitting: questions that are due, longest overdue first, then new ones
 * in the set's order.
 */
export function buildQueue<T extends { id: string; order: number }>(
  items: T[],
  reviews: Array<{ itemId: string; dueAt: Date }>,
  now: Date,
): T[] {
  const byItem = new Map(reviews.map((r) => [r.itemId, r]));
  const due = items
    .filter((i) => byItem.has(i.id) && byItem.get(i.id)!.dueAt.getTime() <= now.getTime())
    .sort((a, b) => byItem.get(a.id)!.dueAt.getTime() - byItem.get(b.id)!.dueAt.getTime() || a.order - b.order);
  const fresh = items.filter((i) => !byItem.has(i.id)).sort((a, b) => a.order - b.order);
  return [...due, ...fresh.slice(0, NEW_PER_SESSION)].slice(0, SESSION_SIZE);
}

export type PracticeSummary = {
  questions: number;
  answered: number;
  known: number;
  due: number;
  fresh: number;
  /** Share of all answers that were fully right, or null before any. */
  accuracy: number | null;
  lastAt: Date | null;
  /** The next question due in future, when nothing is due now. */
  nextDue: Date | null;
};

/** How one student stands on a list of questions. */
export function summarise(
  items: Array<{ id: string }>,
  reviews: Array<{ itemId: string; box: number; dueAt: Date; lastAnsweredAt: Date; answered: number; correct: number }>,
  now: Date,
): PracticeSummary {
  const ids = new Set(items.map((i) => i.id));
  const mine = reviews.filter((r) => ids.has(r.itemId));
  const answers = mine.reduce((n, r) => n + r.answered, 0);
  const due = mine.filter((r) => r.dueAt.getTime() <= now.getTime()).length;
  const later = mine.map((r) => r.dueAt.getTime()).filter((t) => t > now.getTime());
  return {
    questions: ids.size,
    answered: mine.length,
    known: mine.filter((r) => r.box >= KNOWN_BOX).length,
    due,
    fresh: ids.size - mine.length,
    accuracy: answers ? mine.reduce((n, r) => n + r.correct, 0) / answers : null,
    lastAt: mine.length ? new Date(Math.max(...mine.map((r) => r.lastAnsweredAt.getTime()))) : null,
    nextDue: due === 0 && later.length ? new Date(Math.min(...later)) : null,
  };
}

/* ─── Questions ─────────────────────────────────────────────────────────── */

export type PracticeNode = {
  /** Position in the tree: "0", "0.1"… */
  id: string;
  type: string;
  question: string;
  points: number;
  options: string[];
  language: string | null;
  matchPairs: Array<{ left: string; right: string }>;
  reorderItems: string[];
  blankCount: number | null;
  depth: number;
};

function walk(node: ImportQuestion, id: string, depth: number, visit: (n: ImportQuestion, id: string, depth: number) => void) {
  visit(node, id, depth);
  (node.subQuestions ?? []).forEach((c, i) => walk(c, `${id}.${i}`, depth + 1, visit));
}

/** The tree as the auto-marker reads it. */
function gradeRows(root: ImportQuestion): AutoGradeQuestion[] {
  const rows: AutoGradeQuestion[] = [];
  walk(root, "0", 0, (n, id) => {
    rows.push({
      id,
      parentId: id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null,
      order: null,
      type: n.type,
      // Every part weighs something, or a question worth 0 marks could never be missed.
      points: Math.max(1, n.points ?? 1),
      options: n.options ?? [],
      answer: n.answer ?? null,
      matchPairs: n.matchPairs ?? null,
      reorderItems: n.reorderItems ?? [],
      blankCount: n.blankCount ?? null,
      mathMode: n.mathMode ?? null,
    });
  });
  return rows;
}

/** Whether a student can practise it: every part marked automatically, with an answer saved. */
export function canPractise(root: ImportQuestion): boolean {
  const rows = gradeRows(root).filter((r) => r.type !== "NONE");
  if (rows.length === 0 || rows.some((r) => !isAutoMarkable(r.type))) return false;
  // Key-less parts come back as pending. Maths is decided when it's answered, so it counts as keyed here.
  const r = autoGradeSubmission(rows, {}, { checkMaths: () => "not-equal" });
  return r.pendingCount === 0;
}

/** The parts to show, in order, without the answers. */
export function practiceNodes(root: ImportQuestion): PracticeNode[] {
  const out: PracticeNode[] = [];
  walk(root, "0", 0, (n, id, depth) => {
    out.push({
      id,
      type: n.type,
      question: n.question,
      points: n.points ?? 0,
      options: n.options ?? [],
      language: n.language ?? null,
      matchPairs: n.matchPairs ?? [],
      reorderItems: n.reorderItems ?? [],
      blankCount: n.blankCount ?? null,
      depth,
    });
  });
  return out;
}

export type PracticeAnswerKey = { id: string; type: string; text: string[]; pairs: Array<{ left: string; right: string }> };

/** The saved answers, for showing after the student answers. */
export function practiceKeys(root: ImportQuestion): PracticeAnswerKey[] {
  const out: PracticeAnswerKey[] = [];
  walk(root, "0", 0, (n, id) => {
    if (n.type === "NONE") return;
    const text =
      n.type === "REORDER"
        ? (n.reorderItems ?? [])
        : n.type === "MATCHING"
          ? []
          : (Array.isArray(n.answer) ? n.answer : [n.answer]).filter((v) => v != null && v !== "").map(String);
    out.push({ id, type: n.type, text, pairs: n.type === "MATCHING" ? (n.matchPairs ?? []) : [] });
  });
  return out;
}

export type PracticeMark = {
  /** Share of the marks, 0 to 1, over the parts that could be marked. */
  share: number;
  /** Parts by id: true right, false wrong, null couldn't be decided (maths). */
  parts: Record<string, boolean | null>;
  /** A maths answer the checker couldn't decide: the student says if it matches. */
  undecided: boolean;
};

const isBlank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

/** Marks one answer. A blank maths answer is wrong, not undecided. */
export function markPractice(root: ImportQuestion, answers: Record<string, unknown>, checkMaths: MathsChecker): PracticeMark {
  const rows = gradeRows(root).filter((r) => r.type !== "NONE");
  const r = autoGradeSubmission(rows, answers, {
    checkMaths: (answer, key, mode) => (isBlank(answer) ? "not-equal" : checkMaths(answer, key, mode)),
  });
  const parts: Record<string, boolean | null> = Object.fromEntries(rows.map((row) => [row.id, null]));
  for (const g of r.grades) parts[g.questionId] = g.score >= g.outOf;
  return { share: r.autoOutOf ? r.autoScore / r.autoOutOf : 0, parts, undecided: r.pendingCount > 0 };
}

/**
 * The share after the student judged the undecided parts themself: the
 * parts the checker marked keep their marks.
 */
export function withSelfMark(root: ImportQuestion, mark: PracticeMark, gotIt: boolean): PracticeMark {
  const rows = gradeRows(root).filter((r) => r.type !== "NONE");
  const parts = Object.fromEntries(Object.entries(mark.parts).map(([id, v]) => [id, v ?? gotIt]));
  const total = rows.reduce((n, r) => n + r.points, 0);
  const got = rows.reduce((n, r) => n + (parts[r.id] ? r.points : 0), 0);
  return { share: total ? got / total : 0, parts, undecided: false };
}
