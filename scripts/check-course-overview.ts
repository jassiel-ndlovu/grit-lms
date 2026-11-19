/**
 * Checks the tutor course page helpers (src/features/courses/lib/course-overview.ts).
 *
 *   npx tsx scripts/check-course-overview.ts
 */

import { courseInitials, lessonSummary, sortWork, workStatus } from "../src/features/courses/lib/course-overview";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("two words", courseInitials("Information Technology 12"), "IT");
check("one word", courseInitials("Mathematics"), "MA");
check("skips leading number", courseInitials("12 Physical Sciences"), "PS");
check("punctuation", courseInitials("Life-Orientation (Gr 10)"), "LG");
check("accents", courseInitials("Éducation civique"), "ÉC");
check("numbers only", courseInitials("2026"), "20");
check("empty", courseInitials("   "), "?");

const now = new Date("2026-11-19T10:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
check("hidden → draft", workStatus({ isActive: false, dueDate: days(3) }, now), "draft");
check("null isActive counts as visible", workStatus({ isActive: null, dueDate: days(3) }, now), "open");
check("past → closed", workStatus({ isActive: true, dueDate: days(-1) }, now), "closed");

const sorted = sortWork(
  [
    { kind: "test", id: "c1", title: "Old", dueDate: days(-10), isActive: true },
    { kind: "test", id: "c2", title: "Recent", dueDate: days(-2), isActive: true },
    { kind: "assignment", id: "d1", title: "Draft", dueDate: days(9), isActive: false },
    { kind: "assignment", id: "o2", title: "Later", dueDate: days(6), isActive: true },
    { kind: "test", id: "o1", title: "Soon", dueDate: days(1), isActive: true },
  ],
  now,
);
check("order: open soonest, drafts, closed newest", sorted.map((s) => s.id), ["o1", "o2", "d1", "c2", "c1"]);

check("lessons only", lessonSummary([{ type: "CONTENT" }]), "1 lesson");
check(
  "lessons and groups",
  lessonSummary([{ type: "NONE" }, { type: "CONTENT" }, { type: "CONTENT" }, { type: "NONE" }]),
  "2 lessons in 2 groups",
);
check("none", lessonSummary([]), "0 lessons");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
