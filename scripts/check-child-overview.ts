/**
 * Checks the pure parts of the parent's per-child view
 * (src/features/activity/lib/child-overview.ts): routes, where a parent
 * lands from a student page, lesson progress, released marks, the
 * two-week window and grouping by workspace.
 *
 *   npx tsx scripts/check-child-overview.ts
 */

import {
  childRoutes,
  dueSoon,
  groupByWorkspace,
  isReleased,
  lessonProgress,
  overallProgress,
  parentLanding,
  upcomingStatusLabel,
} from "../src/features/activity/lib/child-overview";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Routes and landing.
check("child route", childRoutes.child("u1"), "/dashboard/children/u1");
check("child route encodes", childRoutes.child("a/b"), "/dashboard/children/a%2Fb");
check("no children -> home", parentLanding([]), "/dashboard");
check("one child -> their view", parentLanding([{ userId: "u1" }]), "/dashboard/children/u1");
check("siblings -> home to choose", parentLanding([{ userId: "u1" }, { userId: "u2" }]), "/dashboard");

// Lesson progress: headings don't count, completions of other lessons don't count, no double counting.
const lessons = [
  { id: "h", type: "NONE" },
  { id: "l1", type: "TEXT" },
  { id: "l2", type: "VIDEO" },
  { id: "l3", type: "TEXT" },
];
check("progress", lessonProgress(lessons, [{ lessonId: "l1" }, { lessonId: "l1" }, { lessonId: "h" }, { lessonId: "x" }]), {
  done: 1,
  total: 3,
  percent: 33,
});
check("progress, no lessons", lessonProgress([], []), { done: 0, total: 0, percent: 0 });
check(
  "overall progress",
  overallProgress([
    { done: 1, total: 3, percent: 33 },
    { done: 3, total: 5, percent: 60 },
  ]),
  { done: 4, total: 8, percent: 50 },
);

// Released marks.
const test = (status: string, release: boolean) => ({
  testSubmission: { status, test: { releaseAutoMarksToStudent: release } },
  submissionEntry: null,
});
check("test GRADED shows", isReleased(test("GRADED", false)), true);
check("test auto-marked, not released, hidden", isReleased(test("SUBMITTED", false)), false);
check("test releases auto-marks at submit, shows", isReleased(test("SUBMITTED", true)), true);
check("assignment GRADED shows", isReleased({ testSubmission: null, submissionEntry: { status: "GRADED" } }), true);
check("assignment SUBMITTED hidden", isReleased({ testSubmission: null, submissionEntry: { status: "SUBMITTED" } }), false);
check("manual grade shows", isReleased({ testSubmission: null, submissionEntry: null }), true);

// Two-week window.
const now = new Date("2026-11-20T10:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const items = [
  { id: "late", dueDate: day(-1) },
  { id: "d10", dueDate: day(10) },
  { id: "d1", dueDate: day(1) },
  { id: "d14", dueDate: day(14) },
  { id: "d15", dueDate: day(15) },
];
check(
  "due soon: next 14 days, soonest first, overdue left out",
  dueSoon(items, now).map((i) => i.id),
  ["d1", "d10", "d14"],
);

check("status: none", upcomingStatusLabel({ kind: "assignment", status: null }), "Not started");
check("status: test started", upcomingStatusLabel({ kind: "test", status: "IN_PROGRESS" }), "Started");
check("status: handed in late", upcomingStatusLabel({ kind: "assignment", status: "LATE" }), "Handed in");
check("status: marked", upcomingStatusLabel({ kind: "test", status: "GRADED" }), "Marked");

// Grouping: the seed's Luyanda learns in two workspaces.
const groups = groupByWorkspace(
  [
    { id: "c1", workspaceId: "w2" },
    { id: "c2", workspaceId: "w1" },
    { id: "c3", workspaceId: null },
    { id: "c4", workspaceId: "w-left" },
  ],
  [
    { id: "w1", name: "Ubuntu Tutors" },
    { id: "w2", name: "Sipho Science" },
  ],
);
check(
  "grouped by workspace, unknown last",
  groups.map((g) => [g.name, g.courses.map((c) => c.id)]),
  [
    ["Ubuntu Tutors", ["c2"]],
    ["Sipho Science", ["c1"]],
    ["Other courses", ["c3", "c4"]],
  ],
);

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll child-overview checks passed");
