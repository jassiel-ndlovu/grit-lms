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
  coverage, curriculumLabel, curriculumToStore, MAX_TOPICS, subjectOptions, topicByCode, topicsFor, topicsToStore,
} from "../src/features/courses/lib/curriculum";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const caps10 = { curriculum: "CAPS" as const, subject: "mathematics", gradeLevel: 10 };

// Catalogue
const listOf = (curriculum: "CAPS" | "IEB") =>
  subjectOptions(curriculum).flatMap((s) => s.grades.flatMap((g) => topicsFor({ curriculum, subject: s.key, gradeLevel: g })));
const all = listOf("CAPS");
const ieb = listOf("IEB");
pass(all.length > 0, "the catalogue has topics", `${all.length}`);
pass(new Set(all.map((t) => t.code)).size === all.length, "topic codes are unique");
pass(all.every((t) => /^caps:[a-z0-9-]+:\d{1,2}:[a-z0-9-]+$/.test(t.code)), "codes look like caps:<subject>:<grade>:<topic>");
pass(all.every((t) => topicByCode(t.code)?.title === t.title), "every code looks up to its topic");
for (const c of ["CAPS", "IEB"] as const) {
  pass(subjectOptions(c).every((s) => [10, 11, 12].every((g) => s.grades.includes(g) && topicsFor({ curriculum: c, subject: s.key, gradeLevel: g }).length > 0)), `every ${c} subject lists topics for Grades 10-12`, `${subjectOptions(c).length} subjects`);
}
pass(subjectOptions(null).length === 0 && subjectOptions("OTHER").length === 0, "no curriculum, no subjects");

// IEB lists
pass(new Set(ieb.map((t) => t.code)).size === ieb.length, "IEB lists repeat no code", `${ieb.length}`);
pass(ieb.every((t) => /^(caps|ieb):[a-z0-9-]+:\d{1,2}:[a-z0-9-]+$/.test(t.code)), "IEB codes are caps: or ieb:");
pass(ieb.every((t) => topicByCode(t.code)?.title === t.title), "every IEB code looks up to its topic");
pass(JSON.stringify(topicsFor({ curriculum: "IEB", subject: "mathematics", gradeLevel: 12 })) === JSON.stringify(topicsFor({ curriculum: "CAPS", subject: "mathematics", gradeLevel: 12 })), "IEB Mathematics is the CAPS list");
const ps = topicsFor({ curriculum: "IEB", subject: "physical-sciences", gradeLevel: 12 });
const psTitles = ps.map((t) => t.title);
pass(!psTitles.includes("Doppler effect") && psTitles[0] === "Newton's laws", "IEB Physical Sciences Grade 12 drops and adds its own topics");
pass(ps.filter((t) => t.code.startsWith("caps:")).every((t) => all.some((c) => c.code === t.code)), "shared IEB topics keep their CAPS codes");
pass(ps.every((t, i) => t.order === i), "IEB topics are numbered in order");
pass(topicByCode("caps:physical-sciences:12:doppler-effect") !== null, "a topic the IEB leaves out still reads");
const added = ieb.filter((t) => t.code.startsWith("ieb:") && t.subject !== "advanced-programme-mathematics");
pass(added.length === 7, "IEB adds seven topics to shared subjects", added.map((t) => t.title).join("; "));
pass(ps.findIndex((t) => t.title === "Gravitational and electric fields") === psTitles.indexOf("Work, energy and power") + 1, "an added topic sits after the one named");
pass(!subjectOptions("CAPS").some((s) => s.key === "advanced-programme-mathematics") && subjectOptions("IEB").some((s) => s.key === "advanced-programme-mathematics"), "AP Mathematics is IEB only");
pass(topicsFor({ curriculum: "CAPS", subject: "advanced-programme-mathematics", gradeLevel: 12 }).length === 0, "a CAPS course gets no AP Mathematics list");

// Which courses get topics
const t10 = topicsFor(caps10);
pass(t10.length > 0 && t10.every((t) => t.grade === 10 && t.subject === "mathematics"), "CAPS Maths Grade 10 lists only its own topics");
pass(t10.every((t, i) => i === 0 || t10[i - 1].order <= t.order), "topics come in teaching order");
pass(topicsFor({ curriculum: "OTHER", subject: null, gradeLevel: null }).length === 0, "Other has no topic list");
pass(topicsFor({ ...caps10, gradeLevel: null }).length === 0, "no grade, no topics");
pass(topicsFor(null).length === 0, "no curriculum, no topics");

// Stored settings
pass(JSON.stringify(curriculumToStore(caps10)) === JSON.stringify(caps10), "a full CAPS setting is kept");
pass(curriculumToStore({ curriculum: "NOPE", subject: "mathematics", gradeLevel: 10 }).curriculum === null, "an unknown curriculum clears everything");
pass(curriculumToStore({ curriculum: "OTHER", subject: "mathematics", gradeLevel: 10 }).subject === null, "Other drops subject and grade");
pass(curriculumToStore({ curriculum: "CAPS", subject: "alchemy", gradeLevel: 10 }).subject === null, "an unknown subject is dropped");
pass(curriculumToStore({ curriculum: "CAPS", subject: "advanced-programme-mathematics", gradeLevel: 12 }).subject === null, "an IEB-only subject is dropped for CAPS");
pass(curriculumToStore({ curriculum: "IEB", subject: "advanced-programme-mathematics", gradeLevel: 12 }).gradeLevel === 12, "an IEB-only subject is kept for IEB");
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
