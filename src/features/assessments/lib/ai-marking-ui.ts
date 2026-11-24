/**
 * Display helpers for AI-assisted marking (#150; A's actions in
 * src/features/ai-marking/actions.ts, B research 09 section 6). Pure and
 * client-safe: they only read what `getAiSuggestions` returns. The tutor
 * accepts, edits or rejects every mark; nothing here writes one.
 * Checked by scripts/check-ai-marking-ui.ts.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import { formatLabel, normalizeScheme } from "@/lib/enum-labels";

export type AiStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
export type AiConfidence = "HIGH" | "MEDIUM" | "LOW";
export type AiTutorAction = "ACCEPTED" | "EDITED" | "REJECTED";

export type AiCriterion = { id: string; label: string; awarded: number; max: number; justification: string; evidence: string[] };

/** One row of `getAiSuggestions` (criteria arrive as JSON). */
export type AiSuggestion = {
  id: string;
  questionId: string;
  status: AiStatus;
  criteria: unknown;
  totalAwarded: number | null;
  outOf: number;
  confidence: AiConfidence | null;
  flags: string[];
  feedbackToStudent: string | null;
  escalated: boolean;
  error: string | null;
  tutorAction: AiTutorAction | null;
  tutorScore: number | null;
  actedAt: string | null;
};

/** Only these question types get suggestions (A's WRITTEN list). */
export const AI_MARKED_TYPES = ["SHORT_ANSWER", "ESSAY"] as const;
export function isAiMarkedType(type: string): boolean {
  return (AI_MARKED_TYPES as readonly string[]).includes(type);
}

export const FLAG_LABEL: Record<string, { label: string; hint: string }> = {
  possible_injection: { label: "Instructions in the answer", hint: "The answer seems to talk to the marker. Read it yourself." },
  invented_evidence: { label: "Quotes not found", hint: "Some quotes the AI gave aren't in the answer, so they were dropped." },
  needs_tutor: { label: "Needs you", hint: "The AI asks you to mark this one." },
  memo_ambiguous: { label: "Memo unclear", hint: "The memo or rubric could be read more than one way." },
  off_topic: { label: "Off topic", hint: "The answer may not address the question." },
  illegible: { label: "Hard to read", hint: "Parts of the answer couldn't be read." },
  language_not_english: { label: "Not in English", hint: "The answer is partly or wholly in another language." },
  marks_adjusted: { label: "Marks adjusted", hint: "Marks were outside the rubric and were brought back in range." },
};

export function flagLabel(flag: string): { label: string; hint: string } {
  return FLAG_LABEL[flag] ?? { label: flag.replace(/_/g, " "), hint: "" };
}

export const CONFIDENCE: Record<AiConfidence, { label: string; tone: StatusTone }> = {
  HIGH: { label: "High confidence", tone: "success" },
  MEDIUM: { label: "Medium confidence", tone: "warning" },
  LOW: { label: "Low confidence", tone: "danger" },
};

export function isPending(s: Pick<AiSuggestion, "status">): boolean {
  return s.status === "QUEUED" || s.status === "RUNNING";
}

/** Criteria JSON → typed rows; anything malformed is dropped. */
export function criteriaOf(raw: unknown): AiCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c): AiCriterion[] => {
    if (!c || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    const awarded = Number(o.awarded);
    const max = Number(o.max);
    if (!Number.isFinite(awarded) || !Number.isFinite(max)) return [];
    return [{
      id: String(o.id ?? ""),
      label: String(o.label ?? o.id ?? ""),
      awarded,
      max,
      justification: typeof o.justification === "string" ? o.justification : "",
      evidence: Array.isArray(o.evidence) ? o.evidence.filter((e): e is string => typeof e === "string" && e.trim() !== "") : [],
    }];
  });
}

/**
 * Where a mark came from, for the chip beside each score:
 *   suggested  the AI has a mark the tutor hasn't acted on (nothing filled in)
 *   accepted   the tutor took the AI's mark as it was
 *   edited     the tutor started from the AI's mark and changed it
 *   rejected   the tutor turned the suggestion down
 *   tutor      no usable suggestion; the mark is the tutor's own
 */
export type Provenance = "suggested" | "accepted" | "edited" | "rejected" | "tutor";

export const PROVENANCE: Record<Provenance, { label: string; tone: StatusTone }> = {
  suggested: { label: "AI suggestion: not confirmed", tone: "info" },
  accepted: { label: "Confirmed by you (AI mark)", tone: "success" },
  edited: { label: "Confirmed by you (edited AI mark)", tone: "success" },
  rejected: { label: "AI suggestion rejected", tone: "neutral" },
  tutor: { label: "Your mark", tone: "neutral" },
};

/** The action the tutor has taken this session (local) wins over the stored one. */
export function provenanceOf(s: AiSuggestion | undefined, local: AiTutorAction | null | undefined): Provenance {
  const action = local ?? s?.tutorAction ?? null;
  if (action === "ACCEPTED") return "accepted";
  if (action === "EDITED") return "edited";
  if (action === "REJECTED") return "rejected";
  if (s && s.status === "DONE" && s.totalAwarded != null) return "suggested";
  return "tutor";
}

/**
 * What to record for a suggestion when the grade is saved and the tutor
 * typed a score without pressing Accept or Edit: the same mark counts as
 * accepted, a different one as edited, an empty one as nothing.
 */
export function actionForSavedScore(s: AiSuggestion, score: string): { action: AiTutorAction; score: number } | null {
  if (s.status !== "DONE" || s.totalAwarded == null || s.tutorAction) return null;
  if (score.trim() === "") return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return { action: n === s.totalAwarded ? "ACCEPTED" : "EDITED", score: n };
}

/** A suggestion the "Accept all" button may take (unless the tutor includes the risky ones). */
export function isSafeToBulkAccept(s: AiSuggestion): boolean {
  return s.status === "DONE" && s.totalAwarded != null && s.confidence !== "LOW" && s.flags.length === 0;
}

/** Suggestions still waiting for the tutor's decision. */
export function awaitingReview(list: AiSuggestion[], local: Record<string, AiTutorAction | undefined> = {}): AiSuggestion[] {
  return list.filter((s) => s.status === "DONE" && s.totalAwarded != null && !s.tutorAction && !local[s.id]);
}

/** Review order (research 09, 6.4): flagged first, then low, medium and high confidence. */
export function riskRank(s: AiSuggestion): number {
  if (s.flags.length > 0 || s.escalated) return 0;
  return s.confidence === "LOW" ? 1 : s.confidence === "MEDIUM" ? 2 : 3;
}

export type AiProgress = { total: number; queued: number; running: number; done: number; failed: number; skipped: number; reviewed: number };

export function progressOf(list: Array<Pick<AiSuggestion, "status" | "tutorAction">>): AiProgress {
  const p: AiProgress = { total: list.length, queued: 0, running: 0, done: 0, failed: 0, skipped: 0, reviewed: 0 };
  for (const s of list) {
    if (s.status === "QUEUED") p.queued++;
    else if (s.status === "RUNNING") p.running++;
    else if (s.status === "DONE") p.done++;
    else if (s.status === "FAILED") p.failed++;
    else p.skipped++;
    if (s.tutorAction) p.reviewed++;
  }
  return p;
}

/** "12 of 30 marked" while running; "30 marked, 4 reviewed" when finished. */
export function progressLabel(p: AiProgress): string {
  if (p.total === 0) return "No AI suggestions yet";
  const waiting = p.queued + p.running;
  const extra = [p.failed ? `${p.failed} failed` : "", p.skipped ? `${p.skipped} skipped` : ""].filter(Boolean).join(", ");
  if (waiting > 0) return `${p.done} of ${p.total - p.skipped - p.failed} marked${extra ? ` (${extra})` : ""}`;
  return `${p.done} marked, ${p.reviewed} reviewed${extra ? ` (${extra})` : ""}`;
}

/** The result of `requestAiMarking`, in words. */
export function queuedLabel(r: { queued: number; skipped: number }): string {
  const q = r.queued === 0 ? "Nothing new to mark" : `${r.queued} ${r.queued === 1 ? "answer" : "answers"} queued`;
  if (r.skipped === 0) return `${q}.`;
  return `${q}; ${r.skipped} skipped (blank answers or questions without a memo).`;
}

/** Split an answer into plain and highlighted runs for the evidence quotes (case-insensitive, overlaps merged). */
export function highlightRuns(text: string, quotes: string[]): Array<{ text: string; mark: boolean }> {
  const lower = text.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const q of quotes) {
    const needle = q.trim().toLowerCase();
    if (!needle) continue;
    let from = 0;
    for (;;) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      spans.push([i, i + needle.length]);
      from = i + needle.length;
    }
  }
  if (spans.length === 0) return [{ text, mark: false }];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const out: Array<{ text: string; mark: boolean }> = [];
  let at = 0;
  for (const [a, b] of merged) {
    if (a > at) out.push({ text: text.slice(at, a), mark: false });
    out.push({ text: text.slice(a, b), mark: true });
    at = b;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return out;
}

/** Previous and next submissions around one student, in list order. */
export function neighbours<T extends { studentId: string }>(list: T[], studentId: string): { prev: T | null; next: T | null; index: number } {
  const i = list.findIndex((s) => s.studentId === studentId);
  if (i < 0) return { prev: null, next: null, index: -1 };
  return { prev: list[i - 1] ?? null, next: list[i + 1] ?? null, index: i };
}

/**
 * Turning the switch on: the course needs the `ai-marking` service. When
 * it doesn't, the upgrade path is the course's Services page (billing on)
 * or nothing to link (billing off, where every v1 service is on anyway).
 */
export function aiSwitchState(input: { on: boolean; available: boolean; readOnly: boolean }): "on" | "off" | "upgrade" | "locked" {
  if (input.readOnly) return "locked";
  if (input.on) return "on";
  return input.available ? "off" : "upgrade";
}

/**
 * The test's short-answer and essay questions with their printed labels
 * ("1.b"), from the flat rows Prisma returns, in the order the tutor set.
 */
export function writtenQuestions<Q extends { id: string; parentId: string | null; order: number | null; type: string; question: string }>(
  flat: Q[],
  scheme: unknown,
): Array<{ id: string; label: string; preview: string }> {
  const s = normalizeScheme(scheme);
  const byParent = new Map<string | null, Q[]>();
  for (const q of flat) {
    const list = byParent.get(q.parentId ?? null) ?? [];
    list.push(q);
    byParent.set(q.parentId ?? null, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: Array<{ id: string; label: string; preview: string }> = [];
  const visit = (parent: string | null, path: number[]) =>
    (byParent.get(parent) ?? []).forEach((q, i) => {
      const pos = [...path, i];
      if (isAiMarkedType(q.type)) out.push({ id: q.id, label: formatLabel(s, pos), preview: plainPreview(q.question) });
      visit(q.id, pos);
    });
  visit(null, []);
  return out;
}

/** A question's first words without markdown, for a one-line list. */
export function plainPreview(md: string, max = 90): string {
  const t = md.replace(/\s*\\[()[\]]\s*(?=[.,;:?!])|\\[()[\]]/g, "").replace(/[#*_`>\[\]()$]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * What to record for each suggestion when the tutor saves the grade
 * (`recordAiSuggestionAction`, A's audit trail). Accept and Edit count by
 * the final mark: the AI's mark unchanged is ACCEPTED, anything else
 * EDITED. Reject stays REJECTED. A suggestion the tutor didn't touch
 * counts only if they typed a score (actionForSavedScore).
 */
export function finalActions(
  list: AiSuggestion[],
  local: Record<string, AiTutorAction | undefined>,
  scoreFor: (questionId: string) => string,
): Array<{ suggestionId: string; action: AiTutorAction; score: number | null }> {
  const out: Array<{ suggestionId: string; action: AiTutorAction; score: number | null }> = [];
  for (const s of list) {
    const mine = local[s.id];
    const raw = scoreFor(s.questionId);
    const n = raw.trim() === "" ? null : Number(raw);
    const score = n != null && Number.isFinite(n) ? n : null;
    if (mine === "REJECTED") out.push({ suggestionId: s.id, action: "REJECTED", score });
    else if (mine && score != null) out.push({ suggestionId: s.id, action: score === s.totalAwarded ? "ACCEPTED" : "EDITED", score });
    else if (!mine) {
      const auto = actionForSavedScore(s, raw);
      if (auto) out.push({ suggestionId: s.id, ...auto });
    }
  }
  return out;
}
