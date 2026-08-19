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
]);

/** Given a question and the student's answer, return true if the answer
 *  matches the tutor's key, false otherwise. Callers only call this when
 *  a key exists and the type is in AUTO_MARKABLE. */
function isCorrect(q: AutoGradeQuestion, answer: unknown): boolean {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
      return norm(answer) === norm(q.answer);

    case "NUMERIC": {
      // The runner now stores NUMERIC as a string; tolerate both.
      const a = typeof answer === "string" ? answer.trim() : answer;
      const key = typeof q.answer === "string" ? q.answer.trim() : q.answer;
      const na = typeof a === "number" ? a : Number(a);
      const nk = typeof key === "number" ? key : Number(key);
      if (!Number.isFinite(na) || !Number.isFinite(nk)) return false;
      return na === nk;
    }

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
    const correct = isCorrect(q, answers[q.id]);
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
