/**
 * Rubrics (#216, phase 1): a written question's marks split into named
 * criteria. Stored on `TestQuestion.rubric` (B's assessments schema) in the
 * shape AI marking already reads (`Rubric` in features/ai-marking/rules.ts):
 *
 *   { criteria: [{ id, label, max }], notes?, halfMarks? }
 *
 * A question with a rubric is worth the sum of its criteria; the editor and
 * the save actions both keep `points` equal to that sum. Questions marked
 * automatically (multiple choice, numeric, …) have no rubric.
 *
 * Pure: safe in server and client components and in scripts.
 */

import { z } from "zod";

import type { Rubric, RubricCriterion } from "@/features/ai-marking/rules";

export type { Rubric, RubricCriterion };

/** Question types a tutor marks by judgement, so a rubric helps. */
export const RUBRIC_TYPES = ["SHORT_ANSWER", "ESSAY", "FILE_UPLOAD", "CODE"] as const;
export const MAX_CRITERIA = 10;
export const MAX_CRITERION_MARKS = 100;

export function rubricAllowed(type: string): boolean {
  return (RUBRIC_TYPES as readonly string[]).includes(type);
}

export const RubricCriterionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Name each criterion").max(200),
  max: z.number().int().min(1).max(MAX_CRITERION_MARKS),
});

export const RubricSchema = z.object({
  criteria: z.array(RubricCriterionSchema).min(1).max(MAX_CRITERIA),
  notes: z.string().trim().max(2000).optional(),
  halfMarks: z.boolean().optional(),
});

/** The rubric's total marks. */
export function rubricTotal(r: Pick<Rubric, "criteria">): number {
  return r.criteria.reduce((n, c) => n + c.max, 0);
}

/**
 * A stored or submitted rubric, cleaned, or null when there is none or it
 * isn't valid. Empty notes and `halfMarks: false` are dropped.
 */
export function readRubric(raw: unknown): Rubric | null {
  const parsed = RubricSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { criteria, notes, halfMarks } = parsed.data;
  return {
    criteria,
    ...(notes ? { notes } : {}),
    ...(halfMarks ? { halfMarks: true } : {}),
  };
}

/** The rubric to store for a question of this type, or null. */
export function rubricToStore(type: string, raw: unknown): Rubric | null {
  return rubricAllowed(type) ? readRubric(raw) : null;
}

let seq = 0;
/** A new criterion with a fresh id. */
export function newCriterion(label = "", max = 1): RubricCriterion {
  seq += 1;
  return { id: `c${Date.now().toString(36)}${seq}`, label, max };
}

/** A starting rubric for a question worth `points`: one criterion holding them all. */
export function starterRubric(points: number): Rubric {
  return { criteria: [newCriterion("Content", Math.max(1, Math.min(points || 1, MAX_CRITERION_MARKS)))] };
}

/**
 * Sum of per-criterion marks entered in the grading form, rounded to the
 * rubric's step (0.5 with half marks, else 1) and capped at each max.
 * Empty entries count as 0; null when nothing is entered yet.
 */
export function criterionScoreTotal(r: Rubric, marks: Record<string, string>): number | null {
  const step = r.halfMarks ? 0.5 : 1;
  let any = false;
  let total = 0;
  for (const c of r.criteria) {
    const raw = (marks[c.id] ?? "").trim().replace(",", ".");
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    any = true;
    total += Math.min(c.max, Math.max(0, Math.round(n / step) * step));
  }
  return any ? total : null;
}

/** Marks per criterion as sent by the grading form: criterion id → marks. */
export const CriterionMarksSchema = z.record(z.string().min(1).max(40), z.number().min(0).max(MAX_CRITERION_MARKS));
export type CriterionMarks = z.infer<typeof CriterionMarksSchema>;

/**
 * The marks per criterion to store with a question's grade, or null. Only
 * the rubric's criteria are kept, each rounded to the rubric's step and
 * capped at its max. They are stored only when they add up to the score
 * the tutor saved: a breakdown that disagrees with the mark would mislead
 * the student, so typing a different Score drops it.
 */
export function criterionMarksToStore(
  rubric: Rubric | null,
  marks: CriterionMarks | null | undefined,
  score: number,
): CriterionMarks | null {
  if (!rubric || rubric.criteria.length < 2 || !marks) return null;
  const step = rubric.halfMarks ? 0.5 : 1;
  const out: CriterionMarks = {};
  let total = 0;
  for (const c of rubric.criteria) {
    const n = marks[c.id];
    if (typeof n !== "number" || !Number.isFinite(n)) continue;
    const v = Math.min(c.max, Math.max(0, Math.round(n / step) * step));
    out[c.id] = v;
    total += v;
  }
  if (Object.keys(out).length === 0) return null;
  return Math.abs(total - score) < 1e-9 ? out : null;
}

/** Stored marks as the form's text fields ("" for a criterion with none). */
export function criterionMarksText(rubric: Rubric | null, raw: unknown): Record<string, string> {
  const parsed = CriterionMarksSchema.safeParse(raw);
  if (!rubric || !parsed.success) return {};
  return Object.fromEntries(rubric.criteria.filter((c) => c.id in parsed.data).map((c) => [c.id, String(parsed.data[c.id])]));
}

/** The form's text fields as numbers, for sending; empty and unreadable entries are left out. */
export function criterionMarksFromText(marks: Record<string, string> | undefined): CriterionMarks | null {
  if (!marks) return null;
  const out: CriterionMarks = {};
  for (const [id, raw] of Object.entries(marks)) {
    const t = raw.trim().replace(",", ".");
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) out[id] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** Each criterion with the marks stored for it, for the student's review; null when none were stored. */
export function criterionBreakdown(rubric: Rubric | null, raw: unknown): Array<{ id: string; label: string; awarded: number; max: number }> | null {
  const parsed = CriterionMarksSchema.safeParse(raw);
  if (!rubric || !parsed.success || Object.keys(parsed.data).length === 0) return null;
  return rubric.criteria.map((c) => ({ id: c.id, label: c.label, awarded: parsed.data[c.id] ?? 0, max: c.max }));
}
