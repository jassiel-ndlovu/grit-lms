/**
 * AI help for tutors (#216 phase 2): how much each plan gets. Pure: the
 * check script covers it. Owner decision 22 Nov: "Plus gets a taste of AI
 * and Pro gets all of it". Plus is capped in runs a month per workspace;
 * Pro has much higher caps (a cost guard, not a product limit). Every run
 * also spends AI credits (with BILLING=1).
 */

export type AssistFeature = "QUESTIONS" | "OUTLINE" | "TIDY";
export type AssistTier = "CORE" | "PLUS" | "PRO";

/** Runs a month per workspace, by the course's plan. CORE gets none. Provisional. */
export const AI_ASSIST_LIMITS: Record<AssistTier, Record<AssistFeature, number>> = {
  CORE: { QUESTIONS: 0, OUTLINE: 0, TIDY: 0 },
  PLUS: { QUESTIONS: 10, OUTLINE: 3, TIDY: 50 },
  PRO: { QUESTIONS: 200, OUTLINE: 50, TIDY: 500 },
};

/** Size limits on what's sent. */
export const AI_ASSIST_INPUT = {
  maxQuestions: 10,
  /** Characters of lesson text used as context for questions. */
  lessonChars: 24_000,
  /** Characters of a pasted document for an outline. */
  documentChars: 120_000,
  /** A PDF for an outline. */
  pdfBytes: 15 * 1024 * 1024,
  /** Characters of text to tidy. */
  tidyChars: 12_000,
} as const;

export const FEATURE_LABEL: Record<AssistFeature, string> = {
  QUESTIONS: "question batches",
  OUTLINE: "course outlines",
  TIDY: "text tidy-ups",
};

/** The calendar month (UTC) a run counts towards. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type Allowance = { tier: AssistTier; limit: number; used: number; left: number };

export function allowance(tier: AssistTier, feature: AssistFeature, used: number): Allowance {
  const limit = AI_ASSIST_LIMITS[tier][feature];
  return { tier, limit, used, left: Math.max(0, limit - used) };
}

/** The message when a run is refused for the plan or the month's cap. Null when it may run. */
export function refusal(a: Allowance, feature: AssistFeature): string | null {
  if (a.limit === 0) return "AI help is part of the Plus and Pro plans for this course.";
  if (a.left > 0) return null;
  return a.tier === "PLUS"
    ? `You've used this month's ${a.limit} ${FEATURE_LABEL[feature]} on Plus. Pro includes many more, or wait until the 1st.`
    : `You've used this month's ${a.limit} ${FEATURE_LABEL[feature]}. It resets on the 1st.`;
}

/** Plain text from a lesson's stored description (HTML or plain). Keeps line breaks; drops tags. */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
