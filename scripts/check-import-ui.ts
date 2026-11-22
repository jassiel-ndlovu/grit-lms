/**
 * Checks the helpers behind the import screens (#216): labels, columns,
 * cell issues, what confirming imports, progress, undo and pending edits.
 *
 *   npx tsx scripts/check-import-ui.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import {
  canConfirm, canUndo, cellIssue, columnsOf, fieldLabel, importRoutes, pendingEdits, progressPercent, rowsLabel, toImport,
} from "../src/components/imports/import-ui";
import type { ImportRow, ImportView } from "../src/features/imports/types";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const row = (n: number, data: Record<string, string>, over: Partial<ImportRow> = {}): ImportRow => ({ n, data, action: "create", issues: [], ...over });
const err = { field: "email", level: "error" as const, message: "Not an email" };
const warn = { field: "email", level: "warning" as const, message: "Looks odd" };
const rows = [
  row(2, { full_name: "A", email: "a@x.test" }),
  row(3, { full_name: "B", email: "nope" }, { issues: [warn, err] }),
  row(4, { full_name: "C", grade: "10" }, { action: "skip" }),
];
const counts = { create: 2, update: 0, skip: 1, errors: 1, warnings: 0, done: 0, skipped: 0, failed: 0 };
const view = { rows, needs: [] as ImportView["needs"], counts };

check("field label", fieldLabel("full_name"), "Full name");
check("field label: dashes", fieldLabel("parent-email"), "Parent email");
check("columns in first-seen order", columnsOf(rows), ["full_name", "email", "grade"]);
check("columns follow the template", columnsOf(rows, ["email", "full_name", "minor"]), ["email", "full_name", "grade"]);
check("cell issue: error wins", cellIssue(rows[1].issues, "email")?.level, "error");
check("cell issue: none", cellIssue(rows[1].issues, "full_name"), null);
check("to import: with errors", toImport(view, false), 2);
check("to import: skipping errors", toImport(view, true), 1);
check("confirm: errors block", canConfirm(view, {}, false), false);
check("confirm: skip errors", canConfirm(view, {}, true), true);
check(
  "confirm: needs ticked",
  canConfirm({ ...view, needs: [{ option: "consentAttested", message: "x" }] }, {}, true),
  false,
);
check(
  "confirm: needs ticked (yes)",
  canConfirm({ ...view, needs: [{ option: "consentAttested", message: "x" }] }, { consentAttested: true }, true),
  true,
);
check("progress", progressPercent({ status: "APPLYING", progress: { cursor: 1, total: 4 } }), 25);
check("progress: undoing counts down", progressPercent({ status: "UNDOING", progress: { cursor: 1, total: 4 } }), 75);
check("progress: empty", progressPercent({ status: "APPLYING", progress: { cursor: 0, total: 0 } }), 0);
const now = Date.parse("2026-11-23T10:00:00Z");
check("undo: in time", canUndo({ status: "DONE", undoUntil: "2026-11-24T09:00:00Z" }, now), true);
check("undo: too late", canUndo({ status: "DONE", undoUntil: "2026-11-23T09:00:00Z" }, now), false);
check("undo: not done", canUndo({ status: "UNDONE", undoUntil: "2026-11-24T09:00:00Z" }, now), false);
check("rows label", [rowsLabel(1), rowsLabel(3)], ["1 row", "3 rows"]);
check(
  "pending edits: only changed cells",
  pendingEdits(view, { 2: { full_name: "A", email: "a@y.test" }, 3: { email: "nope" } }),
  [{ n: 2, data: { email: "a@y.test" } }],
);
check("route: start", importRoutes.start("students"), "/dashboard/imports?kind=students");
check("route: cards", importRoutes.cards("j1"), "/dashboard/imports/j1/cards");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
