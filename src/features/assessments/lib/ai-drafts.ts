/**
 * AI drafts to Nexa's own shapes (contracts/viewer.md, "AI help for tutors").
 * Pure: no I/O. A's actions return drafts and save nothing; these turn the
 * ones a tutor keeps into test questions, lessons and assignments.
 *
 * A draft is never trusted to mark itself. A short answer is marked by exact
 * match, so a model answer with working in it would mark every student
 * wrong: those become written questions the tutor marks, with the model
 * answer as the memo.
 */

import type { DraftQuestion } from "@/features/ai-assist/model";
import type { DraftLessons } from "@/features/ai-assist/model-pro";

import type { ImportQuestion } from "./test-io";

export type { DraftLessons, DraftQuestion };

/** A key students could type exactly: one short line, no maths markup. */
const SHORT_KEY = 60;

export function isTypableKey(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= SHORT_KEY && !/[\n\\$]/.test(t);
}

const num = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/** "3.14 ± 0.01", as lib/numeric.ts reads it. */
export function numericKey(value: number, tolerance: number | null): string {
  return num(tolerance) && tolerance > 0 ? `${value} ± ${tolerance}` : String(value);
}

/** The model answer and why it's right, as one memo. */
export function memoText(d: Pick<DraftQuestion, "modelAnswer" | "explanation">): string {
  return [d.modelAnswer.trim(), d.explanation.trim()].filter(Boolean).join("\n\n");
}

export type MappedQuestion = {
  node: ImportQuestion;
  /** Who marks it once it's in a test. */
  marked: "nexa" | "tutor";
  /** What the tutor must finish before publishing, or null. */
  todo: string | null;
};

export function draftToQuestion(d: DraftQuestion): MappedQuestion {
  const base = { question: d.question.trim(), points: Math.max(1, Math.round(d.points)), topics: d.topicCodes };
  const written = (): MappedQuestion => ({ node: { ...base, type: "ESSAY", answer: memoText(d) || null }, marked: "tutor", todo: null });

  switch (d.type) {
    case "MULTIPLE_CHOICE":
    case "MULTI_SELECT": {
      const options = [...new Set(d.options.map((o) => o.trim()).filter(Boolean))];
      const right = [...new Set(d.correctOptions.map((i) => d.options[i]?.trim()).filter((o): o is string => Boolean(o)))];
      if (options.length < 2) return written();
      if (d.type === "MULTIPLE_CHOICE") {
        const one = right.length === 1 ? right[0] : null;
        return { node: { ...base, type: d.type, options, answer: one }, marked: "nexa", todo: one ? null : "Choose the correct option once it's in the test." };
      }
      return {
        node: { ...base, type: d.type, options, answer: right },
        marked: "nexa",
        todo: right.length ? null : "Choose the correct options once it's in the test.",
      };
    }
    case "TRUE_FALSE":
      return {
        node: { ...base, type: "TRUE_FALSE", answer: d.trueFalse === null ? null : String(d.trueFalse) },
        marked: "nexa",
        todo: d.trueFalse === null ? "Choose true or false once it's in the test." : null,
      };
    case "NUMERIC":
      return num(d.numericAnswer) ? { node: { ...base, type: "NUMERIC", answer: numericKey(d.numericAnswer, d.numericTolerance) }, marked: "nexa", todo: null } : written();
    case "SHORT_ANSWER":
      return isTypableKey(d.modelAnswer) ? { node: { ...base, type: "SHORT_ANSWER", answer: d.modelAnswer.trim() }, marked: "nexa", todo: null } : written();
    default:
      return written();
  }
}

/* ─── Outlines and lessons ──────────────────────────────────────────────── */

export const LESSON_TITLE_MAX = 120;
export const DRAFT_LESSONS_MAX = 100;

export type LessonGroupDraft = {
  /** The group the lessons go in; null puts them at the top level. */
  title: string | null;
  lessons: Array<{ title: string; description: string; topics: string[] }>;
};

const cut = (s: string, max: number) => (s.trim().length > max ? `${s.trim().slice(0, max - 1)}…` : s.trim());

/** The outline's ticked lessons, as groups. Sections with none ticked are left out. */
export function outlineGroups(
  sections: ReadonlyArray<{ title: string; lessons: ReadonlyArray<{ title: string; summary: string; topicCodes: string[] }> }>,
  ticked: (section: number, lesson: number) => boolean,
): LessonGroupDraft[] {
  return sections
    .map((s, i) => ({
      title: cut(s.title, LESSON_TITLE_MAX),
      lessons: s.lessons
        .map((l, j) => ({ l, on: ticked(i, j) }))
        .filter(({ l, on }) => on && l.title.trim())
        .map(({ l }) => ({ title: cut(l.title, LESSON_TITLE_MAX), description: l.summary.trim(), topics: l.topicCodes })),
    }))
    .filter((g) => g.title && g.lessons.length > 0);
}

/** Drafted lessons at the top level: the body is already the markdown lessons store. */
export function lessonGroup(lessons: ReadonlyArray<DraftLessons["lessons"][number]>): LessonGroupDraft {
  return {
    title: null,
    lessons: lessons.map((l) => ({ title: cut(l.title, LESSON_TITLE_MAX), description: cut(l.body, 20_000), topics: l.topicCodes })),
  };
}

/** A drafted test in the JSON import's shape, so it goes through the same checks. Always an unpublished draft. */
export function testImport(t: DraftLessons["tests"][number], dueDate: Date) {
  return {
    version: 1 as const,
    title: cut(t.title, LESSON_TITLE_MAX) || "Test",
    dueDate: dueDate.toISOString(),
    isActive: false,
    preTestInstructions: t.instructions.trim() || null,
    questions: t.questions.map((q) => draftToQuestion(q).node),
  };
}

/** The brief students read: what to do, then how it's marked. The memo is never in it. */
export function assignmentBrief(a: DraftLessons["assignments"][number]): { description: string; totalPoints: number } {
  const rubric = a.rubric.filter((r) => r.criterion.trim() && r.points > 0);
  const lines = rubric.map((r) => `- ${r.criterion.trim()}: ${r.points} ${r.points === 1 ? "mark" : "marks"}`);
  const description = cut([a.brief.trim(), lines.length ? `## How it's marked\n\n${lines.join("\n")}` : ""].filter(Boolean).join("\n\n"), 10_000);
  return { description, totalPoints: rubric.reduce((n, r) => n + r.points, 0) || 1 };
}

/* ─── Feedback ──────────────────────────────────────────────────────────── */

/** The comment to edit: the feedback, then what to do next. */
export function feedbackText(d: { feedback: string; nextSteps: string[] }): string {
  const next = d.nextSteps.map((s) => s.trim()).filter(Boolean);
  return [d.feedback.trim(), next.length ? `Next steps:\n${next.map((s) => `- ${s}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
}
