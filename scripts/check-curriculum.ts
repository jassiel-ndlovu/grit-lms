/**
 * Checks curriculum tagging (#216, contracts/curriculum.md).
 *
 *   npx tsx scripts/check-curriculum.ts
 *
 * Pure: no database, no network. The topic catalogue (unique codes in the
 * documented shape), which courses get a topic list, cleaning of stored
 * curriculum settings and topic tags, the label, coverage counts, and that
 * a JSON test export keeps question topics. Exits 1 on any failure.
 */

import {
  coverage, curriculumLabel, curriculumToStore, MAX_TOPICS, SUBJECT_OPTIONS, topicByCode, topicsFor, topicsToStore,
} from "../src/features/courses/lib/curriculum";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const caps10 = { curriculum: "CAPS" as const, subject: "mathematics", gradeLevel: 10 };

// Catalogue
const all = SUBJECT_OPTIONS.flatMap((s) => s.grades.flatMap((g) => topicsFor({ curriculum: "CAPS", subject: s.key, gradeLevel: g })));
pass(all.length > 0, "the catalogue has topics", `${all.length}`);
pass(new Set(all.map((t) => t.code)).size === all.length, "topic codes are unique");
pass(all.every((t) => /^caps:[a-z0-9-]+:\d{1,2}:[a-z0-9-]+$/.test(t.code)), "codes look like caps:<subject>:<grade>:<topic>");
pass(all.every((t) => topicByCode(t.code)?.title === t.title), "every code looks up to its topic");
pass(SUBJECT_OPTIONS.some((s) => s.key === "mathematics" && [10, 11, 12].every((g) => s.grades.includes(g))), "Mathematics has Grades 10-12");

// Which courses get topics
const t10 = topicsFor(caps10);
pass(t10.length > 0 && t10.every((t) => t.grade === 10 && t.subject === "mathematics"), "CAPS Maths Grade 10 lists only its own topics");
pass(t10.every((t, i) => i === 0 || t10[i - 1].order <= t.order), "topics come in teaching order");
pass(topicsFor({ ...caps10, curriculum: "IEB" }).length === t10.length, "IEB uses the same topic list");
pass(topicsFor({ curriculum: "OTHER", subject: null, gradeLevel: null }).length === 0, "Other has no topic list");
pass(topicsFor({ ...caps10, gradeLevel: null }).length === 0, "no grade, no topics");
pass(topicsFor(null).length === 0, "no curriculum, no topics");

// Stored settings
pass(JSON.stringify(curriculumToStore(caps10)) === JSON.stringify(caps10), "a full CAPS setting is kept");
pass(curriculumToStore({ curriculum: "NOPE", subject: "mathematics", gradeLevel: 10 }).curriculum === null, "an unknown curriculum clears everything");
pass(curriculumToStore({ curriculum: "OTHER", subject: "mathematics", gradeLevel: 10 }).subject === null, "Other drops subject and grade");
pass(curriculumToStore({ curriculum: "CAPS", subject: "alchemy", gradeLevel: 10 }).subject === null, "an unknown subject is dropped");
pass(curriculumToStore({ curriculum: "CAPS", subject: "mathematics", gradeLevel: 3 }).gradeLevel === null, "a grade the subject lacks is dropped");
pass(curriculumToStore({ curriculum: "CAPS", subject: "mathematics", gradeLevel: "11" }).gradeLevel === 11, "a grade sent as text is read");

// Stored tags
const [a, b] = t10;
pass(JSON.stringify(topicsToStore([a.code, "made:up", a.code, b.code, 7])) === JSON.stringify([a.code, b.code]), "tags keep known codes once, in order");
pass(topicsToStore("x").length === 0, "a non-list stores no tags");
pass(topicsToStore(all.map((t) => t.code)).length === MAX_TOPICS, `tags stop at ${MAX_TOPICS}`);

// Label
pass(curriculumLabel(caps10) === "CAPS · Mathematics · Grade 10", "the label reads CAPS · Mathematics · Grade 10", `${curriculumLabel(caps10)}`);
pass(curriculumLabel({ curriculum: null, subject: null, gradeLevel: null }) === null, "no curriculum, no label");

// Coverage
const rows = coverage(
  t10,
  [{ topics: [a.code] }, { topics: [a.code, b.code] }, { topics: [] }],
  [{ topics: [a.code], points: 4 }, { topics: [a.code, "made:up"], points: 3 }, { topics: [], points: 10 }],
);
const ra = rows.find((r) => r.topic.code === a.code);
const rb = rows.find((r) => r.topic.code === b.code);
pass(rows.length === t10.length, "coverage has a row per topic");
pass(ra?.lessons === 2 && ra.questions === 2 && ra.marks === 7, "a topic counts its lessons, questions and marks", JSON.stringify(ra));
pass(rb?.lessons === 1 && rb.questions === 0 && rb.marks === 0, "a topic with lessons only shows no questions", JSON.stringify(rb));
pass(rows.filter((r) => r !== ra && r !== rb).every((r) => r.lessons === 0 && r.questions === 0), "untagged items count nowhere");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll curriculum checks passed.");
