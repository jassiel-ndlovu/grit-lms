/**
 * AI-assisted marking rules that run in code, not in the prompt (B research
 * 09, sections 4.2, 5.2 and 7). Pure; checked by scripts/check-ai-marking.ts.
 *
 *   scrubIdentifiers  names from the class roster, emails, phone and ID
 *                     numbers become placeholders before anything is sent
 *   injectionSignals  instruction-like text aimed at the marker
 *   postCheck         clamp each criterion to 0..max, recompute the total,
 *                     drop invented evidence quotes, add flags
 *   shouldEscalate    low confidence, injection, or a needs-tutor flag go to
 *                     the stronger model once
 */

export type RubricCriterion = { id: string; label: string; max: number };
export type Rubric = { criteria: RubricCriterion[]; notes?: string; halfMarks?: boolean };

export type RawCriterion = { id: string; awarded: number; max: number; justification: string; evidence: string[] };
export type RawResult = {
  criteria: RawCriterion[];
  total: number;
  confidence: "high" | "medium" | "low";
  flags: string[];
  feedbackToStudent: string;
  /** For photo answers: the model's transcription of the handwriting (empty for typed answers). */
  transcript?: string;
};

export type CheckedResult = {
  criteria: Array<RawCriterion & { label: string }>;
  total: number;
  outOf: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  flags: string[];
  feedbackToStudent: string;
};

export const KNOWN_FLAGS = ["possible_injection", "off_topic", "illegible", "language_not_english", "memo_ambiguous", "needs_tutor", "invented_evidence", "marks_adjusted"] as const;

/** The question's rubric, or one criterion worth the question's points. */
export function rubricFor(raw: unknown, points: number): Rubric {
  const r = raw as Partial<Rubric> | null;
  const criteria = Array.isArray(r?.criteria)
    ? r!.criteria.filter((c) => c && typeof c.id === "string" && typeof c.max === "number" && c.max > 0).map((c) => ({ id: c.id, label: String(c.label ?? c.id), max: c.max }))
    : [];
  if (criteria.length) return { criteria, notes: typeof r?.notes === "string" ? r.notes : undefined, halfMarks: r?.halfMarks === true };
  return { criteria: [{ id: "c1", label: "Answer", max: points }], halfMarks: false };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces roster names (whole words, any case), emails, phone numbers and
 * 13-digit SA ID numbers. Names shorter than 3 letters are skipped, so
 * words like "Al" in an answer survive.
 */
export function scrubIdentifiers(text: string, names: string[]): string {
  let out = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{13}\b/g, "[id-number]")
    .replace(/(?:\+27|\b0)(?:[\s-]?\d){9}\b/g, "[phone]");
  const parts = new Set<string>();
  for (const n of names) for (const p of n.split(/\s+/)) if (p.length >= 3) parts.add(p);
  for (const p of [...parts].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`(?<![\\p{L}])${escape(p)}(?![\\p{L}])`, "giu"), "[name]");
  }
  return out;
}

const INJECTION = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /(give|award|assign) (me |this( answer)? )?(full|maximum|max|all( the)?) (marks|points|score)/i,
  /\b(system prompt|you are (now )?an? (ai|assistant|marker|grader))\b/i,
  /<\/?(student_answer|system|instructions?)>/i,
  /\bas an ai\b|\bdisregard\b.*\b(rubric|memo|instructions)\b/i,
];

export function injectionSignals(text: string): boolean {
  return INJECTION.some((r) => r.test(text));
}

/**
 * For comparing evidence with the answer: case, spacing and maths notation
 * ignored (m/s² = m/s^2 = m/s^{2}, × = *, TeX delimiters), since a quote
 * from handwriting may use either form (#216 phase 3).
 */
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^${[...m].map((c) => SUP[c]).join("")}`)
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, "")
    .replace(/\^\{([^}]*)\}/g, "^$1")
    .replace(/×|\\times|·|\\cdot/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");

export function postCheck(raw: RawResult, rubric: Rubric, answer: string): CheckedResult {
  const flags = new Set(raw.flags.filter((f) => (KNOWN_FLAGS as readonly string[]).includes(f)));
  const answerN = norm(answer);
  const step = rubric.halfMarks ? 0.5 : 1;
  const byId = new Map(raw.criteria.map((c) => [c.id, c]));
  let adjusted = false;
  const criteria = rubric.criteria.map((rc) => {
    const c = byId.get(rc.id);
    if (!c) {
      adjusted = true;
      return { id: rc.id, label: rc.label, awarded: 0, max: rc.max, justification: "Not marked by the model.", evidence: [] };
    }
    let awarded = Number.isFinite(c.awarded) ? c.awarded : 0;
    const rounded = Math.round(awarded / step) * step;
    const clamped = Math.min(rc.max, Math.max(0, rounded));
    if (clamped !== awarded) adjusted = true;
    awarded = clamped;
    const evidence = (c.evidence ?? []).filter((e) => typeof e === "string" && e.trim() && answerN.includes(norm(e)));
    if (evidence.length < (c.evidence ?? []).length) flags.add("invented_evidence");
    return { id: rc.id, label: rc.label, awarded, max: rc.max, justification: String(c.justification ?? ""), evidence };
  });
  const total = criteria.reduce((n, c) => n + c.awarded, 0);
  if (adjusted || Math.abs(total - raw.total) > 1e-9) flags.add("marks_adjusted");
  if (flags.has("invented_evidence")) flags.add("needs_tutor");
  const confidence = raw.confidence === "high" && !flags.has("needs_tutor") ? "HIGH" : raw.confidence === "low" ? "LOW" : "MEDIUM";
  return {
    criteria,
    total,
    outOf: rubric.criteria.reduce((n, c) => n + c.max, 0),
    confidence,
    flags: [...flags].sort(),
    feedbackToStudent: String(raw.feedbackToStudent ?? "").slice(0, 1000),
  };
}

export function shouldEscalate(r: CheckedResult): boolean {
  return r.confidence === "LOW" || r.flags.includes("possible_injection") || r.flags.includes("needs_tutor") || r.flags.includes("memo_ambiguous");
}

/** Prices in US dollars per million tokens (Anthropic first-party, cached 2026-11-03). Cache reads at 10% of input. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function costMicroUsd(model: string, usage: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  const usd = (usage.input * p.input + usage.cacheWrite * p.input * 1.25 + usage.cacheRead * p.input * 0.1 + usage.output * p.output) / 1_000_000;
  return Math.round(usd * 1_000_000);
}

/** An uploaded answer file the marker can read (#216 phase 3): images and PDFs. Others (HEIC, Word, ZIP) are left for the tutor. */
export type AnswerFile = { url: string; kind: "image" | "pdf" };
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
export function readableFiles(files: Array<{ fileUrl: string; fileType: string }>, max = 5): { files: AnswerFile[]; skipped: number } {
  const out: AnswerFile[] = [];
  let skipped = 0;
  for (const f of files) {
    let u: URL;
    try { u = new URL(f.fileUrl); } catch { skipped++; continue; }
    // Only Nexa's own Blob store: the model fetches these by URL.
    if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com")) { skipped++; continue; }
    const kind = f.fileType === "PDF" || PDF_EXT.test(u.pathname) ? "pdf" : f.fileType === "JPEG" || IMAGE_EXT.test(u.pathname) ? "image" : null;
    if (!kind || out.length >= max) { skipped++; continue; }
    out.push({ url: u.toString(), kind });
  }
  return { files: out, skipped };
}
