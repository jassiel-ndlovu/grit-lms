/**
 * The student runner's question states (b/research/06 §3): pure functions
 * over the question tree and the answers, shared by the question strip, the
 * submit summary and scripts/check-runner-state.ts.
 *
 * A top-level question is one step. Its state sums up every answerable node
 * under it (NONE-typed context questions take no answer).
 */

export interface StateNode {
  id: string;
  type: string;
  subQuestions: StateNode[];
}

export type StepState = "empty" | "partial" | "done";

export interface StepSummary {
  state: StepState;
  answered: number;
  total: number;
  /** An answer in this step was not saved by the last save. */
  unsaved: boolean;
  flagged: boolean;
}

export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** Every node in a step that takes an answer, parent first. */
export function answerableNodes<T extends StateNode>(q: T): T[] {
  const out: T[] = [];
  const walk = (n: T) => {
    if (n.type !== "NONE") out.push(n);
    for (const c of n.subQuestions as T[]) walk(c);
  };
  walk(q);
  return out;
}

export function summariseStep(
  q: StateNode,
  answers: Record<string, unknown>,
  flagged: ReadonlySet<string>,
  unsavedIds: ReadonlySet<string>,
): StepSummary {
  const nodes = answerableNodes(q);
  const answered = nodes.filter((n) => isAnswered(answers[n.id])).length;
  const total = nodes.length;
  return {
    state: total > 0 && answered === total ? "done" : answered > 0 ? "partial" : "empty",
    answered,
    total,
    unsaved: nodes.some((n) => unsavedIds.has(n.id)) || unsavedIds.has(q.id),
    flagged: flagged.has(q.id),
  };
}

/** The strip button's accessible name: "Question 3, answered, flagged". */
export function stepName(label: string, s: StepSummary): string {
  const parts = [`Question ${label}`];
  if (s.total === 0) parts.push("no answer needed");
  else if (s.state === "done") parts.push("answered");
  else if (s.state === "partial") parts.push(`partly answered, ${s.answered} of ${s.total} parts`);
  else parts.push("not answered");
  if (s.unsaved) parts.push("not saved");
  if (s.flagged) parts.push("flagged");
  return parts.join(", ");
}

/** Labels of answerable nodes with no answer, in test order. */
export function unansweredLabels(
  questions: StateNode[],
  answers: Record<string, unknown>,
  labels: ReadonlyMap<string, string>,
): Array<{ stepIndex: number; id: string; label: string }> {
  const out: Array<{ stepIndex: number; id: string; label: string }> = [];
  questions.forEach((q, stepIndex) => {
    for (const n of answerableNodes(q)) {
      if (!isAnswered(answers[n.id])) out.push({ stepIndex, id: n.id, label: labels.get(n.id) ?? String(stepIndex + 1) });
    }
  });
  return out;
}

/** Alt+↑/↓ move between questions, Alt+F flags, Ctrl/Cmd+S saves. */
export type RunnerKey = "prev" | "next" | "flag" | "save" | null;

export function runnerKey(e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): RunnerKey {
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (e.key === "ArrowDown") return "next";
    if (e.key === "ArrowUp") return "prev";
    if (e.key === "f" || e.key === "F" || e.key === "ƒ") return "flag";
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "s" || e.key === "S")) return "save";
  return null;
}

/** The timer reads out once when it crosses each of these (seconds left). */
export const TIMER_WARNINGS = [300, 60] as const;

/**
 * The warning to read out when the clock moves from `prev` to `next`
 * seconds left, or null. Opening the test with 3 minutes left says nothing
 * about 5 minutes; it says "1 minute left" when that comes.
 */
export function timerWarning(prev: number | null, next: number): string | null {
  if (prev == null) return null;
  // Smallest first: a clock that jumps past both (a sleeping laptop) says the nearer one.
  for (const t of [...TIMER_WARNINGS].sort((a, b) => a - b)) {
    if (prev > t && next <= t && next > 0) return t === 60 ? "1 minute left." : `${t / 60} minutes left.`;
  }
  return null;
}

/** Where a sitting's flags are kept in the browser (flags belong to the student). */
export function flagStorageKey(submissionId: string): string {
  return `nexa:test-flags:${submissionId}`;
}
