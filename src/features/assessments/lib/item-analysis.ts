/**
 * Item analysis (Plus service "advanced-analytics"): how each question of a
 * test performed, from its marked attempts. Pure: no I/O.
 *
 * Per question:
 *   difficulty      the average mark as a share of the question's marks
 *   discrimination  the correlation between a student's mark on the
 *                   question and their mark on the rest of the test. Low or
 *                   negative means stronger students did no better on it.
 *   choices         how many picked each option
 *   wrong answers   the most common ones, for typed answers
 *
 * Small groups say little, so discrimination needs MIN_FOR_DISCRIMINATION
 * attempts and the warnings need MIN_FOR_WARNINGS.
 */

import { formatLabel, normalizeScheme } from "@/lib/enum-labels";

import { isAnswered } from "./runner-state";

export const MIN_FOR_WARNINGS = 5;
export const MIN_FOR_DISCRIMINATION = 10;

/** Below this share of the marks a question is hard; from EASY_FROM, easy. */
export const HARD_BELOW = 0.4;
export const EASY_FROM = 0.8;

export interface ItemQuestion {
  id: string;
  parentId: string | null;
  order: number | null;
  createdAt: Date;
  type: string;
  question: string;
  points: number;
  options: string[];
  answer: unknown;
  topics: string[];
}

export interface ItemAttempt {
  studentId: string;
  answers: unknown;
  questionGrades: Array<{ questionId: string | null; score: number; outOf: number }>;
}

export type Difficulty = "hard" | "medium" | "easy";
export type Discrimination = "good" | "weak" | "poor" | "negative";

export interface ItemChoice {
  text: string;
  count: number;
  /** The marked answer, or one of them. */
  correct: boolean;
}

export interface ItemWarning {
  kind: "negative" | "key" | "blank";
  text: string;
}

export interface ItemRow {
  id: string;
  label: string;
  type: string;
  question: string;
  points: number;
  topics: string[];
  /** Marked attempts that include this question. */
  attempts: number;
  blank: number;
  averageMark: number | null;
  /** Average mark as a share of the marks, 0 to 1. */
  difficulty: number | null;
  difficultyLabel: Difficulty | null;
  full: number;
  part: number;
  none: number;
  /** -1 to 1; null with too few attempts or when everyone got the same mark. */
  discrimination: number | null;
  discriminationLabel: Discrimination | null;
  choices: ItemChoice[];
  wrongAnswers: Array<{ text: string; count: number }>;
  warnings: ItemWarning[];
}

export interface TopicRow {
  topic: string;
  questions: number;
  average: number;
}

export interface ItemAnalysis {
  attempts: number;
  /** Average test mark as a share, 0 to 1. */
  average: number | null;
  items: ItemRow[];
  /** Weakest first; only topics with marked questions. */
  topics: TopicRow[];
}

const norm = (v: unknown) => (v == null ? "" : String(v).trim().toLowerCase());

export function difficultyLabel(share: number): Difficulty {
  return share < HARD_BELOW ? "hard" : share >= EASY_FROM ? "easy" : "medium";
}

export function discriminationLabel(r: number): Discrimination {
  return r < 0 ? "negative" : r < 0.1 ? "poor" : r < 0.3 ? "weak" : "good";
}

/** Pearson correlation; null when either side never varies. */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (let i = 0; i < n; i++) {
    xy += (xs[i] - mx) * (ys[i] - my);
    xx += (xs[i] - mx) ** 2;
    yy += (ys[i] - my) ** 2;
  }
  if (xx < 1e-12 || yy < 1e-12) return null;
  return xy / Math.sqrt(xx * yy);
}

/** Questions in the order students see them, with their printed labels. */
function ordered<Q extends ItemQuestion>(questions: Q[], scheme: unknown): Array<{ q: Q; label: string }> {
  const s = normalizeScheme(scheme);
  const byParent = new Map<string | null, Q[]>();
  for (const q of questions) {
    const key = q.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), q]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());
  }
  const out: Array<{ q: Q; label: string }> = [];
  const visit = (parent: string | null, path: number[]) =>
    (byParent.get(parent) ?? []).forEach((q, i) => {
      const pos = [...path, i];
      out.push({ q, label: formatLabel(s, pos) });
      visit(q.id, pos);
    });
  visit(null, []);
  return out;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const CHOICE_TYPES = new Set(["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE"]);
const TYPED_TYPES = new Set(["SHORT_ANSWER", "NUMERIC", "MATH_EXPRESSION", "FILL_IN_THE_BLANK"]);

/** isAnswered, but a list of empty blanks counts as blank. */
function gave(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((v) => (typeof v === "string" ? v.trim() !== "" : v != null));
  return isAnswered(value);
}

function choicesOf(q: ItemQuestion, answers: unknown[]): ItemChoice[] {
  if (!CHOICE_TYPES.has(q.type)) return [];
  const options = q.type === "TRUE_FALSE" ? ["true", "false"] : [...new Set(q.options)];
  const key = new Set((Array.isArray(q.answer) ? q.answer : [q.answer]).map(norm).filter(Boolean));
  const picked = answers.map((a) => new Set((Array.isArray(a) ? a : [a]).map(norm)));
  return options.map((text) => ({
    text,
    count: picked.filter((p) => p.has(norm(text))).length,
    correct: key.has(norm(text)),
  }));
}

function wrongAnswersOf(q: ItemQuestion, wrong: unknown[]): Array<{ text: string; count: number }> {
  if (!TYPED_TYPES.has(q.type)) return [];
  const counts = new Map<string, { text: string; count: number }>();
  for (const a of wrong) {
    const text = (Array.isArray(a) ? a.map((v) => String(v ?? "").trim()).join("; ") : String(a ?? "")).trim();
    if (!text) continue;
    const key = norm(text);
    const seen = counts.get(key);
    if (seen) seen.count++;
    else counts.set(key, { text: text.length > 120 ? `${text.slice(0, 119)}…` : text, count: 1 });
  }
  return [...counts.values()].filter((c) => c.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Analyses one test. `attempts` are its fully marked submissions, one per
 * student (the caller picks the latest).
 */
export function analyseTest(questions: ItemQuestion[], attempts: ItemAttempt[], scheme: unknown): ItemAnalysis {
  const rows = ordered(questions, scheme);
  const answerable = rows.filter(({ q }) => q.type !== "NONE");
  const known = new Set(answerable.map(({ q }) => q.id));

  const marked = attempts.map((a) => {
    const grades = new Map<string, { score: number; outOf: number }>();
    for (const g of a.questionGrades) {
      if (g.questionId && known.has(g.questionId) && g.outOf > 0) grades.set(g.questionId, g);
    }
    let score = 0;
    let outOf = 0;
    for (const g of grades.values()) {
      score += g.score;
      outOf += g.outOf;
    }
    return { answers: asRecord(a.answers), grades, score, outOf };
  });
  const withMarks = marked.filter((m) => m.outOf > 0);

  const items = answerable.map(({ q, label }): ItemRow => {
    const on = withMarks.filter((m) => m.grades.has(q.id));
    const n = on.length;
    const shares = on.map((m) => {
      const g = m.grades.get(q.id)!;
      return Math.max(0, Math.min(1, g.score / g.outOf));
    });
    const difficulty = n ? shares.reduce((a, b) => a + b, 0) / n : null;
    const blank = on.filter((m) => !gave(m.answers[q.id])).length;

    // Each question against the rest of the test, so it never counts towards itself.
    const pairs: Array<[number, number]> = [];
    on.forEach((m, i) => {
      const g = m.grades.get(q.id)!;
      const outOf = m.outOf - g.outOf;
      if (outOf > 0) pairs.push([shares[i], (m.score - g.score) / outOf]);
    });
    const discrimination =
      pairs.length >= MIN_FOR_DISCRIMINATION ? correlation(pairs.map((p) => p[0]), pairs.map((p) => p[1])) : null;

    const given = on.filter((m) => gave(m.answers[q.id]));
    const choices = choicesOf(q, given.map((m) => m.answers[q.id]));
    const wrongAnswers = wrongAnswersOf(q, given.filter((m) => m.grades.get(q.id)!.score <= 0).map((m) => m.answers[q.id]));

    const warnings: ItemWarning[] = [];
    if (discrimination !== null && discrimination < 0) {
      warnings.push({
        kind: "negative",
        text: "Students who did well on the rest of the test tended to lose marks here. Check the wording and the answer.",
      });
    }
    if (n >= MIN_FOR_WARNINGS && (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && choices.some((c) => c.correct)) {
      const best = Math.max(...choices.filter((c) => c.correct).map((c) => c.count));
      const rival = Math.max(0, ...choices.filter((c) => !c.correct).map((c) => c.count));
      if (rival > best) {
        warnings.push({ kind: "key", text: "A wrong option was chosen more often than the marked answer. Check the answer key." });
      }
    }
    if (n >= MIN_FOR_WARNINGS && blank / n >= 0.25) {
      warnings.push({ kind: "blank", text: `${blank} of ${n} students left it blank.` });
    }

    return {
      id: q.id,
      label,
      type: q.type,
      question: q.question,
      points: q.points,
      topics: q.topics,
      attempts: n,
      blank,
      averageMark: n ? on.reduce((a, m) => a + m.grades.get(q.id)!.score, 0) / n : null,
      difficulty,
      difficultyLabel: difficulty === null ? null : difficultyLabel(difficulty),
      full: shares.filter((s) => s >= 1).length,
      part: shares.filter((s) => s > 0 && s < 1).length,
      none: shares.filter((s) => s <= 0).length,
      discrimination,
      discriminationLabel: discrimination === null ? null : discriminationLabel(discrimination),
      choices,
      wrongAnswers,
      warnings,
    };
  });

  // Topics: every marked answer on a tagged question, weighted by its marks.
  const byTopic = new Map<string, { score: number; outOf: number; questions: Set<string> }>();
  for (const { q } of answerable) {
    for (const t of new Set(q.topics)) {
      const row = byTopic.get(t) ?? { score: 0, outOf: 0, questions: new Set<string>() };
      for (const m of withMarks) {
        const g = m.grades.get(q.id);
        if (!g) continue;
        row.score += g.score;
        row.outOf += g.outOf;
        row.questions.add(q.id);
      }
      byTopic.set(t, row);
    }
  }
  const topics = [...byTopic.entries()]
    .filter(([, r]) => r.outOf > 0)
    .map(([topic, r]) => ({ topic, questions: r.questions.size, average: r.score / r.outOf }))
    .sort((a, b) => a.average - b.average);

  return {
    attempts: withMarks.length,
    average: withMarks.length ? withMarks.reduce((a, m) => a + m.score / m.outOf, 0) / withMarks.length : null,
    items,
    topics,
  };
}

/** Hardest first; questions nobody has been marked on go last. */
export function hardestFirst(items: ItemRow[]): ItemRow[] {
  return [...items].sort((a, b) => (a.difficulty ?? 2) - (b.difficulty ?? 2));
}

/** The latest attempt per student; `attempts` come newest first. */
export function latestPerStudent<T extends { studentId: string }>(attempts: T[]): T[] {
  const seen = new Set<string>();
  return attempts.filter((a) => {
    if (seen.has(a.studentId)) return false;
    seen.add(a.studentId);
    return true;
  });
}
