/**
 * Pure auto-grader for TestSubmission answers.
 *
 * Given the question tree stored on the DB and the student's answer record
 * keyed by questionId, this walks every gradable node and decides:
 *
 *   - Auto-mark it: full points if the answer matches the key, 0 if not.
 *   - Skip: subjective (ESSAY, CODE, FILE_UPLOAD) or NONE, or the tutor
 *     didn't supply a correct-answer key.
 *
 * Subjective questions are skipped even when a key IS present: tutors can
 * record a model answer for students to compare against in review, and
 * that memo must not turn into a machine mark.
 *
 * The output is:
 *   {
 *     grades: [{ questionId, score, outOf, feedback: null }],
 *     autoScore, autoOutOf,
 *     autoCount, pendingCount,
 *   }
 *
 * `pendingCount` is the number of gradable questions we could NOT
 * auto-mark — the tutor needs to touch those manually.
 *
 * No I/O, no Prisma imports; safe to test in isolation.
 */

import { numericMatches } from "./numeric";

/** "equal", "not-equal" or "undecided": the shape of maths-check.ts, passed in so this file stays dependency-free. */
export type MathsChecker = (answer: unknown, key: unknown, mode: string | null | undefined) => "equal" | "not-equal" | "undecided";

/* ─── Types ────────────────────────────────────────────────────────────── */

/** Minimum question shape needed for auto-marking. Matches what
 *  features/assessments/queries.ts already returns. */
export interface AutoGradeQuestion {
  id: string;
  parentId: string | null;
  order: number | null;
  type: string;
  points: number;
  options: string[];
  answer: unknown;
  matchPairs: unknown;
  reorderItems: string[];
  blankCount: number | null;
  /** MATH_EXPRESSION only: EQUIVALENT (null), FORM or MARGIN. */
  mathMode?: string | null;
}

export interface AutoGradeResult {
  grades: Array<{
    questionId: string;
    score: number;
    outOf: number;
    feedback: string | null;
  }>;
  autoScore: number;
  autoOutOf: number;
  autoCount: number;
  pendingCount: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}

/** Question types that CAN in principle be auto-marked. Everything else is
 *  routed to manual grading. */
const AUTO_MARKABLE = new Set([
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "NUMERIC",
  "SHORT_ANSWER",
  "MATCHING",
  "REORDER",
  "FILL_IN_THE_BLANK",
  // Marked by maths-check.ts when the caller passes a checker; an
  // undecided answer is left for the tutor.
  "MATH_EXPRESSION",
]);

/**
 * Whether this type is marked by the machine or by a human.
 *
 * Exported because the UI needs the same answer the grader uses: a tutor
 * can record a model answer on a subjective question (ESSAY, CODE,
 * FILE_UPLOAD) and students see it in review, but the presence of that
 * memo must never make the question look auto-marked. Asking this function
 * rather than re-listing the types keeps the two from drifting.
 */
export function isAutoMarkable(type: string): boolean {
  return AUTO_MARKABLE.has(type);
}

/**
 * True for types a human always marks. The inverse of `isAutoMarkable`
 * minus NONE, which isn't a question at all.
 */
export function isManuallyMarked(type: string): boolean {
  return type !== "NONE" && !AUTO_MARKABLE.has(type);
}

/** Given a question and the student's answer, return true if the answer
 *  matches the tutor's key, false otherwise. Callers only call this when
 *  a key exists and the type is in AUTO_MARKABLE. */
function isCorrect(q: AutoGradeQuestion, answer: unknown): boolean {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
      return norm(answer) === norm(q.answer);

    case "NUMERIC":
      // Decimal commas, fractions and a "± margin" on the key: see numeric.ts.
      return numericMatches(answer, q.answer);

    case "MULTI_SELECT": {
      const want = Array.isArray(q.answer) ? (q.answer as unknown[]).map(norm) : [];
      const got = Array.isArray(answer) ? (answer as unknown[]).map(norm) : [];
      if (want.length !== got.length) return false;
      const wantSet = new Set(want);
      return got.every((g) => wantSet.has(g));
    }

    case "MATCHING": {
      const key = (q.matchPairs ?? []) as Array<{ left: string; right: string }>;
      const got = Array.isArray(answer)
        ? (answer as Array<{ left: string; right: string }>)
        : [];
      if (key.length === 0 || got.length !== key.length) return false;
      const gotMap = new Map(got.map((p) => [norm(p.left), norm(p.right)]));
      return key.every((p) => gotMap.get(norm(p.left)) === norm(p.right));
    }

    case "REORDER": {
      const key = q.reorderItems ?? [];
      const got = Array.isArray(answer) ? (answer as unknown[]) : [];
      if (key.length === 0 || got.length !== key.length) return false;
      return key.every((k, i) => norm(k) === norm(got[i]));
    }

    case "FILL_IN_THE_BLANK": {
      const key = Array.isArray(q.answer) ? (q.answer as unknown[]) : [];
      const got = Array.isArray(answer) ? (answer as unknown[]) : [];
      const blanks = q.blankCount ?? key.length;
      if (blanks === 0 || key.length === 0) return false;
      if (got.length < blanks) return false;
      for (let i = 0; i < blanks; i++) {
        if (norm(key[i]) !== norm(got[i])) return false;
      }
      return true;
    }

    default:
      return false;
  }
}

/** Whether the tutor supplied SOMETHING we could grade against for this
 *  question. Types like MATCHING/REORDER store their key on dedicated
 *  columns rather than `answer`. */
function hasKey(q: AutoGradeQuestion): boolean {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "MATH_EXPRESSION":
      return typeof q.answer === "string" && q.answer.trim() !== "";
    case "NUMERIC":
      return (
        (typeof q.answer === "string" && q.answer.trim() !== "") ||
        typeof q.answer === "number"
      );
    case "MULTI_SELECT":
    case "FILL_IN_THE_BLANK":
      return Array.isArray(q.answer) && (q.answer as unknown[]).length > 0;
    case "MATCHING":
      return Array.isArray(q.matchPairs) && (q.matchPairs as unknown[]).length > 0;
    case "REORDER":
      return Array.isArray(q.reorderItems) && q.reorderItems.length > 0;
    default:
      return false;
  }
}

/* ─── Entry point ──────────────────────────────────────────────────────── */

/**
 * Walk every question in the tree, auto-mark what we can, and return the
 * accumulated grade payload plus counts.
 *
 * `allQuestions` may be flat or nested — we just iterate the flat list
 * since the DB returns everything for a test in one findMany.
 */
export function autoGradeSubmission(
  allQuestions: readonly AutoGradeQuestion[],
  answers: Record<string, unknown>,
  opts: { checkMaths?: MathsChecker } = {},
): AutoGradeResult {
  const grades: AutoGradeResult["grades"] = [];
  let autoScore = 0;
  let autoOutOf = 0;
  let autoCount = 0;
  let pendingCount = 0;

  for (const q of allQuestions) {
    // Skip context blocks entirely — they never count toward the score.
    if (q.type === "NONE") continue;

    // Subjective or key-less → leaves pending for manual grading.
    if (!AUTO_MARKABLE.has(q.type) || !hasKey(q)) {
      pendingCount += 1;
      continue;
    }

    const outOf = q.points;
    let correct: boolean;
    if (q.type === "MATH_EXPRESSION") {
      // Owner decision 2: an answer the checker can't decide goes to the
      // tutor, never counted wrong. No checker (a client) means the same.
      const verdict = opts.checkMaths ? opts.checkMaths(answers[q.id], q.answer, q.mathMode) : "undecided";
      if (verdict === "undecided") {
        pendingCount += 1;
        continue;
      }
      correct = verdict === "equal";
    } else {
      correct = isCorrect(q, answers[q.id]);
    }
    const score = correct ? outOf : 0;

    grades.push({
      questionId: q.id,
      score,
      outOf,
      feedback: null,
    });
    autoScore += score;
    autoOutOf += outOf;
    autoCount += 1;
  }

  return { grades, autoScore, autoOutOf, autoCount, pendingCount };
}
