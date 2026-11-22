/**
 * Pure helpers for the import screens (#216 phase 1; A's engine, contract
 * docs/revamp/contracts/imports.md). No React, no database: checked by
 * scripts/check-import-ui.ts.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import type { ImportRow, ImportView, Issue } from "@/features/imports/types";

export type ImportStatus = ImportView["status"];

export const importRoutes = {
  home: "/dashboard/imports",
  start: (kind: string) => `/dashboard/imports?kind=${encodeURIComponent(kind)}`,
  job: (id: string) => `/dashboard/imports/${id}`,
  cards: (id: string) => `/dashboard/imports/${id}/cards`,
};

export const IMPORT_STATUS: Record<ImportStatus, { label: string; tone: StatusTone }> = {
  PREVIEW: { label: "Checking", tone: "info" },
  APPLYING: { label: "Importing", tone: "info" },
  DONE: { label: "Imported", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  UNDOING: { label: "Undoing", tone: "warning" },
  UNDONE: { label: "Undone", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** While the job moves on its own, the screen polls getImport. */
export const isWorking = (s: ImportStatus) => s === "APPLYING" || s === "UNDOING";

/** "full_name" → "Full name". */
export function fieldLabel(field: string): string {
  const words = field.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : field;
}

/** The columns to show: every field the rows carry, the template's order first, then the rest as first seen. */
export function columnsOf(rows: Array<Pick<ImportRow, "data">>, order: string[] = []): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.data)) seen.add(k);
  return [...order.filter((h) => seen.has(h)), ...[...seen].filter((k) => !order.includes(k))];
}

/** The worst issue for one cell (errors before warnings), or null. */
export function cellIssue(issues: Issue[], field: string): Issue | null {
  const mine = issues.filter((i) => i.field === field);
  return mine.find((i) => i.level === "error") ?? mine[0] ?? null;
}

/** Issues that aren't tied to one cell, shown under the row. */
export const rowIssues = (issues: Issue[]) => issues.filter((i) => !i.field);

export const hasError = (r: Pick<ImportRow, "issues">) => r.issues.some((i) => i.level === "error");
export const hasProblem = (r: Pick<ImportRow, "issues">) => r.issues.length > 0;

/** How many rows confirming will import, with or without the rows that have errors. */
export function toImport(view: Pick<ImportView, "rows">, skipErrors: boolean): number {
  return view.rows.filter((r) => r.action !== "skip" && (!hasError(r) || !skipErrors)).length;
}

/** Whether confirm is allowed: every `needs` box ticked, and errors skipped or gone. */
export function canConfirm(
  view: Pick<ImportView, "rows" | "needs" | "counts">,
  ticked: Record<string, boolean>,
  skipErrors: boolean,
): boolean {
  if (view.needs.some((n) => !ticked[n.option])) return false;
  if (view.counts.errors > 0 && !skipErrors) return false;
  return toImport(view, skipErrors) > 0;
}

/** Percent done, 0–100. While undoing, A's cursor counts down. */
export function progressPercent(view: Pick<ImportView, "status" | "progress">): number {
  const { cursor, total } = view.progress;
  if (total <= 0) return 0;
  const done = view.status === "UNDOING" ? total - cursor : cursor;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** True while undo is still offered. */
export const canUndo = (view: Pick<ImportView, "status" | "undoUntil">, now: number) =>
  view.status === "DONE" && view.undoUntil != null && Date.parse(view.undoUntil) > now;

/** "1 row" / "12 rows". */
export const rowsLabel = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;

/** The edits to send: only cells whose draft differs from the row's value. */
export function pendingEdits(
  view: Pick<ImportView, "rows">,
  drafts: Record<number, Record<string, string>>,
): Array<{ n: number; data: Record<string, string> }> {
  const out: Array<{ n: number; data: Record<string, string> }> = [];
  for (const r of view.rows) {
    const d = drafts[r.n];
    if (!d) continue;
    const changed = Object.fromEntries(Object.entries(d).filter(([k, v]) => (r.data[k] ?? "") !== v));
    if (Object.keys(changed).length) out.push({ n: r.n, data: changed });
  }
  return out;
}
