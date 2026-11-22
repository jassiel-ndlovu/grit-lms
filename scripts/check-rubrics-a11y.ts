/**
 * Checks rubrics and the reading settings (#216, phase 1).
 *
 *   npx tsx scripts/check-rubrics-a11y.ts
 *
 * Pure: no database, no network. Rubrics: cleaning, totals, which types
 * keep one, the grading form's per-criterion sum, and a JSON import that
 * carries one (points follow the rubric). AI marking's `rubricFor` still
 * reads a stored rubric unchanged. Reading: the attribute values, the CSS
 * that styles them, the boot script, the Lexend font and the skip link in
 * both shells. Exits 1 on any failure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { rubricFor } from "../src/features/ai-marking/rules";
import { criterionScoreTotal, readRubric, rubricAllowed, rubricToStore, rubricTotal } from "../src/features/assessments/lib/rubric";
import { parseTestJson } from "../src/features/assessments/lib/test-io";
import { readReadingFont, readTextSize, readingBootScript, readingFontAttr, textSizeAttr } from "../src/lib/ui-a11y";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// --- Rubrics ----------------------------------------------------------------

const two = { criteria: [{ id: "c1", label: "States the rule", max: 2 }, { id: "c2", label: "Applies it", max: 3 }], notes: "  ", halfMarks: false };
const clean = readRubric(two);
pass(clean !== null && rubricTotal(clean) === 5, "a two-criterion rubric totals 5");
pass(clean !== null && !("notes" in clean) && !("halfMarks" in clean), "empty notes and halfMarks:false are dropped");
pass(readRubric({ criteria: [] }) === null, "no criteria is no rubric");
pass(readRubric({ criteria: [{ id: "c1", label: " ", max: 2 }] }) === null, "an unnamed criterion is refused");
pass(readRubric({ criteria: [{ id: "c1", label: "A", max: 0 }] }) === null, "a criterion worth 0 is refused");
pass(readRubric(null) === null && readRubric("x") === null, "junk is no rubric");
pass(["SHORT_ANSWER", "ESSAY", "FILE_UPLOAD", "CODE"].every(rubricAllowed), "written types take a rubric");
pass(!["MULTIPLE_CHOICE", "NUMERIC", "MATH_EXPRESSION", "NONE"].some(rubricAllowed), "auto-marked types and context blocks don't");
pass(rubricToStore("MULTIPLE_CHOICE", two) === null, "a rubric on multiple choice is dropped on save");

const ai = rubricFor(clean, 5);
pass(ai.criteria.length === 2 && ai.criteria[1].max === 3, "AI marking reads a stored rubric unchanged");

const half = readRubric({ ...two, halfMarks: true })!;
pass(criterionScoreTotal(half, {}) === null, "no marks entered yet: no total");
pass(criterionScoreTotal(half, { c1: "1,5", c2: "2" }) === 3.5, "half marks add up, decimal comma allowed");
pass(criterionScoreTotal(half, { c1: "9", c2: "-1" }) === 2, "each criterion is capped at 0..max");
pass(criterionScoreTotal(clean!, { c1: "1.5" }) === 2, "without half marks a mark rounds to a whole one");

const imported = parseTestJson({
  version: 1,
  title: "Rubric import",
  dueDate: "2026-12-01T10:00:00Z",
  questions: [
    { type: "ESSAY", question: "Explain.", points: 1, rubric: two },
    { type: "NUMERIC", question: "2+2", points: 1, answer: "4", rubric: two },
  ],
});
pass(imported.questions[0].points === 5 && rubricTotal(imported.questions[0].rubric as never) === 5, "import: an essay's points follow its rubric");
pass(imported.questions[1].rubric === null && imported.questions[1].points === 1, "import: a numeric question drops the rubric");
pass(imported.totalPoints === 6, "import: the test total counts the rubric", String(imported.totalPoints));

const actions = read("src/features/assessments/actions.ts");
pass((actions.match(/\.\.\.rubricColumns\(node\)/g) ?? []).length === 2, "create and update both store the rubric and its points");

// --- Reading settings -------------------------------------------------------

pass(textSizeAttr("DEFAULT") === null && textSizeAttr("LARGER") === "larger", "text size attributes");
pass(readingFontAttr("DEFAULT") === null && readingFontAttr("DYSLEXIA") === "dyslexia", "reading font attributes");
pass(readTextSize("large") === "LARGE" && readTextSize("huge") === "DEFAULT", "stored text size is read safely");
pass(readReadingFont("DYSLEXIA") === "DYSLEXIA" && readReadingFont(null) === "DEFAULT", "stored font is read safely");

const css = read("src/app/a11y.css");
pass(/data-text-size="large"\]\s*\{\s*font-size:\s*112\.5%/.test(css), "Large is 112.5%");
pass(/data-text-size="larger"\]\s*\{\s*font-size:\s*125%/.test(css), "Larger is 125%");
pass(/--app-font-sans:\s*var\(--font-lexend\)/.test(css), "the reading font swaps in Lexend");
pass(read("src/app/globals.css").includes('@import "./a11y.css";'), "globals.css imports a11y.css");

const layout = read("src/app/layout.tsx");
pass(/Lexend\(\{[\s\S]*?preload:\s*false/.test(layout) && layout.includes("lexend.variable"), "Lexend is loaded, not preloaded");
pass(layout.includes("readingBootScript"), "the boot script applies reading settings before paint");
// A string imported from a "use client" module reaches this server layout
// as a client reference, and the inline script breaks (it did until 22 Nov).
for (const m of layout.matchAll(/import \{[^}]*BootScript[^}]*\} from "@\/([^"]+)"/g)) {
  const src = read(`src/${m[1]}${m[1].endsWith(".ts") ? "" : ".ts"}`);
  pass(!/^\s*["']use client["']/.test(src), `boot script from a plain module (${m[1]})`);
}
pass(readingBootScript.includes("dataset.textSize") && readingBootScript.includes("dataset.readingFont"), "boot script sets both attributes");

for (const shell of ["src/components/shell/app-shell.tsx", "src/app/dashboard/dashboard-shell.tsx"]) {
  const src = read(shell);
  pass(src.includes("<SkipLink />") && src.includes('id="main-content"'), `${shell}: skip link to <main id="main-content">`);
}
pass(read("src/components/shell/skip-link.tsx").includes('href="#main-content"'), "the skip link targets #main-content");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll rubric and reading checks passed.");
