/**
 * Section (per-part) grading helpers.
 *
 * Sections are persisted as `QuestionGrade` rows keyed to a
 * `submissionEntryId`. To avoid a schema migration, the section title +
 * memo file are packed into the row's `feedback` column as JSON with a
 * discriminator tag; anything unparseable is treated as legacy free-text
 * feedback and rendered as-is.
 *
 * `questionId` on the row is set to `sec:<ordinal>` so we can order the
 * sections deterministically without adding a column.
 */

import type { SubmissionSection } from "../schemas";

/** Marker written into the feedback JSON so unrelated readers can skip. */
const KIND = "section" as const;

export interface StoredSection {
  kind: typeof KIND;
  title: string;
  remarks: string;
  memoFileUrl: string | null;
}

/**
 * Serialize the parts of a section that don't fit in QuestionGrade's
 * numeric columns. Returns a compact JSON string.
 */
export function stringifySectionFeedback(
  section: Pick<SubmissionSection, "title" | "remarks" | "memoFileUrl">,
): string {
  const payload: StoredSection = {
    kind: KIND,
    title: section.title,
    remarks: section.remarks ?? "",
    memoFileUrl: section.memoFileUrl ?? null,
  };
  return JSON.stringify(payload);
}

/**
 * Parse a QuestionGrade.feedback string back into section metadata. If
 * the string isn't a section payload (missing kind or malformed JSON),
 * returns null — callers can fall back to treating it as plain text.
 */
export function parseSectionFeedback(
  raw: string | null | undefined,
): StoredSection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.kind === KIND &&
      typeof parsed.title === "string"
    ) {
      return {
        kind: KIND,
        title: parsed.title,
        remarks: typeof parsed.remarks === "string" ? parsed.remarks : "",
        memoFileUrl:
          typeof parsed.memoFileUrl === "string" ? parsed.memoFileUrl : null,
      };
    }
  } catch {
    // Not JSON — treat as legacy free-text feedback.
  }
  return null;
}

/**
 * `sec:<index>` prefix keeps the namespace-scoped so a stray real
 * questionId won't collide, and preserves the tutor's intended ordering.
 */
export function sectionQuestionId(index: number): string {
  return `sec:${index}`;
}

/**
 * Sort helper — sections are numbered by their ordinal; anything without
 * a valid ordinal sorts to the end in creation order.
 */
export function sectionOrdinal(questionId: string | null | undefined): number {
  if (!questionId) return Number.POSITIVE_INFINITY;
  const m = /^sec:(\d+)$/.exec(questionId);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}
