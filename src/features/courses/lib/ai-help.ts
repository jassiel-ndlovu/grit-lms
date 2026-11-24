/** AI help for tutors: shared types and words (safe on the client). */

import type { AssistFeature, AssistTier } from "@/features/ai-assist/limits";

export type AiHelp = {
  courseId: string;
  /** Pro has every kind of help; Plus has questions, outlines and tidying. */
  pro: boolean;
  /** Runs spend AI credits (billing is on). */
  credits: boolean;
};

export type AiHelpWithLessons = AiHelp & { lessons: Array<{ id: string; title: string }> };

export type AiFeature = AssistFeature;
export type AiLeft = { tier: AssistTier; limit: number; used: number; left: number };

const WORDS: Record<AssistFeature, [string, string]> = {
  QUESTIONS: ["batch of questions", "batches of questions"],
  OUTLINE: ["outline", "outlines"],
  TIDY: ["tidy-up", "tidy-ups"],
  LESSONS: ["document", "documents"],
  FEEDBACK: ["comment", "comments"],
  REPORT_COMMENTS: ["batch of report comments", "batches of report comments"],
  GAPS: ["check", "checks"],
  NOTES: ["set of notes", "sets of notes"],
  DIAGRAM: ["diagram", "diagrams"],
};

/** "8 of 10 batches of questions left this month". */
export function leftText(feature: AiFeature, a: Pick<AiLeft, "left" | "limit">): string {
  if (a.left === 0) return `No ${WORDS[feature][1]} left this month. The count starts again on the 1st.`;
  return `${a.left} of ${a.limit} ${WORDS[feature][a.limit === 1 ? 0 : 1]} left this month`;
}

/** What to say while the AI works, by how long it usually takes. */
export const AI_WAIT: Partial<Record<AiFeature, string>> = {
  QUESTIONS: "Writing the questions. This can take up to a minute.",
  OUTLINE: "Reading the document and drafting an outline. This can take a minute or two.",
  TIDY: "Working on your text. This takes a few seconds.",
  LESSONS: "Reading the document and drafting. A long document can take up to four minutes, so keep this page open.",
  FEEDBACK: "Reading the answer and drafting a comment.",
  REPORT_COMMENTS: "Drafting the comments. A whole class can take a minute or two.",
  GAPS: "Comparing your lessons with the curriculum. This can take up to a minute.",
};
