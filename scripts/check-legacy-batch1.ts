/**
 * Guards legacy replacement Batch 1 (docs/revamp/a/design/07-legacy-replacement.md).
 *
 * The 10 contexts and 25 routes deleted in Batch 1 must stay gone, and
 * nothing may import or fetch them again. Batch 4 removes the rest.
 *
 *   npx tsx scripts/check-legacy-batch1.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n        ${detail}` : ""}`);
}

const root = process.cwd();

const CONTEXTS = [
  "ActivityLogContext", "GradeContext", "LessonCompletionContext", "LessonContext",
  "NotificationsContext", "QuestionGradeContext", "StudentContext", "TestContext",
  "TestSubmissionContext", "TutorContext",
];
const ROUTE_DIRS = [
  "activity", "notifications", "grades", "lesson-completions", "lessons", "login",
  "question-grades", "seed-users", "students", "test-submission", "tests", "tutors",
  "courses/[id]", "events/[id]",
];
const URLS = [
  "/api/activity", "/api/notifications", "/api/grades", "/api/lesson-completions",
  "/api/lessons", "/api/login", "/api/question-grades", "/api/seed-users",
  "/api/students", "/api/test-submission", "/api/tests", "/api/tutors",
];

for (const c of CONTEXTS) {
  check(`context ${c} is deleted`, !existsSync(join(root, "src/context", `${c}.tsx`)));
}
for (const d of ROUTE_DIRS) {
  check(`route /api/${d} is deleted`, !existsSync(join(root, "src/app/api", d)));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "generated" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const offenders: string[] = [];
for (const file of walk(join(root, "src"))) {
  const src = readFileSync(file, "utf8");
  for (const c of CONTEXTS) {
    if (new RegExp(`context/${c}["']`).test(src)) offenders.push(`${file}: imports ${c}`);
  }
  for (const u of URLS) {
    // a string literal or template that calls the URL (comments are fine)
    if (new RegExp(`["'\`]${u.replace(/\//g, "\\/")}(["'\`/?]|$)`).test(src)) offenders.push(`${file}: calls ${u}`);
  }
}
check("nothing imports a deleted context or calls a deleted route", offenders.length === 0, offenders.join("\n        "));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
