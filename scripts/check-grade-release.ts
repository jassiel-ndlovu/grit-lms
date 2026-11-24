/**
 * Checks the rule for which marks a student may see
 * (src/features/grades/lib/release.ts), and that the database filter says
 * the same as the function for every status.
 *
 *   npx tsx scripts/check-grade-release.ts
 */

import { readFileSync } from "node:fs";

import { entryMarkReleased, isReleased, RELEASED_GRADE, testMarksReleased, type GradeRelease } from "../src/features/grades/lib/release";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

/** Just enough of a Prisma filter: OR, `is`, null and plain equality. */
function matches(where: Record<string, unknown>, row: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => matches(w, row));
    if (v !== null && typeof v === "object") {
      if (!("is" in v) || Object.keys(v).length !== 1) throw new Error(`filter not understood: ${k}`);
      const related = row[k] as Record<string, unknown> | null;
      return related !== null && matches(v.is as Record<string, unknown>, related);
    }
    if (!(k in row)) throw new Error(`no such field: ${k}`);
    return row[k] === v;
  });
}

const row = (g: GradeRelease) => ({ ...g, testSubmissionId: g.testSubmission ? "t" : null, submissionEntryId: g.submissionEntry ? "e" : null });
const test = (status: string, auto: boolean): GradeRelease => ({ testSubmission: { status, test: { releaseAutoMarksToStudent: auto } }, submissionEntry: null });
const entry = (status: string): GradeRelease => ({ testSubmission: null, submissionEntry: { status } });

check("test auto-marked, not released: hidden", isReleased(test("SUBMITTED", false)), false);
check("test sent back after marking: hidden", isReleased(test("LATE", false)), false);
check("test released", isReleased(test("GRADED", false)), true);
check("test that releases auto-marks", isReleased(test("SUBMITTED", true)), true);
check("assignment marked", isReleased(entry("GRADED")), true);
check("assignment handed in again: hidden", isReleased(entry("SUBMITTED")), false);
check("entered by hand", isReleased({ testSubmission: null, submissionEntry: null }), true);
check("the pages' helpers agree", [testMarksReleased("SUBMITTED", false), testMarksReleased("GRADED", false), entryMarkReleased("SUBMITTED"), entryMarkReleased("GRADED")], [false, true, false, true]);

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "GRADED", "LATE", "NOT_SUBMITTED"];
const all: GradeRelease[] = [
  ...STATUSES.flatMap((s) => [test(s, false), test(s, true), entry(s)]),
  ...STATUSES.flatMap((s) => STATUSES.map((s2) => ({ ...test(s, false), submissionEntry: { status: s2 } }))),
  { testSubmission: null, submissionEntry: null },
];
check("the database filter says the same", all.filter((g) => matches(RELEASED_GRADE, row(g)) !== isReleased(g)), []);

// Anything sent to families must use the filter in every Grade query.
for (const file of [
  "src/features/risk/evaluate.ts",
  "src/features/notifications/weekly-summary.ts",
  "src/features/users/export.ts",
  "src/features/ai-assist/pro.ts",
]) {
  const queries = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /prisma[.]grade[.]/.test(l));
  check(`${file} reads released marks only`, [queries.length > 0, queries.filter((l) => !l.includes("...RELEASED_GRADE"))], [true, []]);
}

const lines = (file: string) => readFileSync(file, "utf8").split(/\r?\n/);
check(
  "the export leaves out unreleased report comments",
  lines("src/features/users/export.ts").filter((l) => /report(Overall)?Comments: [{]/.test(l)).map((l) => l.includes("where: { term: { releasedAt: { not: null } } }")),
  [true, true],
);
check("the old entries URL reads nothing", lines("src/app/api/submission-entry/route.ts").filter((l) => /submissionEntry[.]find|grade/i.test(l)), []);

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
