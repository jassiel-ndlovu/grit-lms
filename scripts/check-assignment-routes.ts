/**
 * Checks assignment URLs and where each old /dashboard/submissions URL
 * redirects (src/features/assignments/routes.ts).
 *
 *   npx tsx scripts/check-assignment-routes.ts
 */

import { assignmentRoutes as r, legacyAssignmentPath } from "../src/features/assignments/routes";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// The routes themselves.
check("index", r.index, "/dashboard/assignments");
check("detail", r.detail("a1"), "/dashboard/assignments/a1");
check("new", r.new, "/dashboard/assignments/new");
check("edit", r.edit("a1"), "/dashboard/assignments/a1/edit");
check("student", r.student("a1", "s1"), "/dashboard/assignments/a1/students/s1");
check("ids are encoded", r.detail("a/b c"), "/dashboard/assignments/a%2Fb%20c");

// Old URLs (segments after /dashboard/submissions) → new.
const legacy: [string[], string][] = [
  [[], r.index],
  [["a1"], r.detail("a1")],
  [["create"], r.new],
  [["create", "a1"], r.edit("a1")],
  [["overview", "a1"], r.detail("a1")],
  [["overview", "a1", "s1"], r.student("a1", "s1")],
  [["portal", "a1"], r.detail("a1")],
  [["review", "a1"], r.detail("a1")],
  // Shapes that never existed fall back to the list, never a guess.
  [["overview"], r.index],
  [["portal"], r.index],
  [["review"], r.index],
  [["create", "a1", "x"], r.index],
  [["overview", "a1", "s1", "x"], r.index],
  [["portal", "a1", "x"], r.index],
  [["a1", "x"], r.index],
];
for (const [segments, want] of legacy) {
  check(`/dashboard/submissions/${segments.join("/")}`, legacyAssignmentPath(segments), want);
}

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
