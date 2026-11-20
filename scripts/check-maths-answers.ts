/**
 * Fixture checks for checkMaths (B design 01, phase 2): CAPS-style answers
 * marked against a key in each mode.
 * Run: npx tsx scripts/check-maths-answers.ts
 */

import { autoGradeSubmission } from "../src/features/assessments/lib/auto-grade";
import { checkMaths, type MathMode, type MathsVerdict } from "../src/features/assessments/lib/maths-check";

const r = String.raw;
type Case = [answer: string, key: string, mode: MathMode | null, want: MathsVerdict, note: string];

const cases: Case[] = [
  // Equivalent (the default)
  [r`x^2+3x`, r`x(x+3)`, null, "equal", "expanded vs factorised"],
  [r`3x+x^2`, r`x^2+3x`, "EQUIVALENT", "equal", "order of terms"],
  [r`(x+1)^2`, r`x^2+2x+1`, null, "equal", "square of a binomial"],
  [r`\frac{1}{2}`, r`0.5`, null, "equal", "fraction vs decimal"],
  [r`2\sqrt{2}`, r`\sqrt{8}`, null, "equal", "simplified surd"],
  [r`\sin^2x+\cos^2x`, r`1`, null, "equal", "identity"],
  [r`\frac{2}{x}`, r`2x^{-1}`, null, "equal", "negative exponent"],
  [r`x+1`, r`x+2`, null, "not-equal", "off by one"],
  [r`x^2-3x`, r`x(x+3)`, null, "not-equal", "sign error"],
  [r`2^{x+1}`, r`2\cdot2^x`, null, "equal", "exponent law"],
  [r`y=2x+1`, r`2x+1`, null, "equal", "y = prefix"],
  [r`\left(x+3\right)x`, r`x(x+3)`, null, "equal", "left/right brackets"],
  [r`a^2-b^2`, r`(a-b)(a+b)`, null, "equal", "two variables"],
  [r``, r`x`, null, "not-equal", "blank answer"],
  [r`x+`, r`x`, null, "undecided", "unfinished answer goes to the tutor"],
  [r`x`, r``, null, "undecided", "no key"],
  // Same form
  [r`(x+3)x`, r`x(x+3)`, "FORM", "equal", "factor order"],
  [r`x(x+3)`, r`x(x+3)`, "FORM", "equal", "identical"],
  [r`x^2+3x`, r`x(x+3)`, "FORM", "not-equal", "equal but not factorised"],
  [r`3x+x^2`, r`x^2+3x`, "FORM", "equal", "term order"],
  [r`x(x-3)`, r`x(x+3)`, "FORM", "not-equal", "wrong factor"],
  // Margin
  [r`3.14`, r`3.14\pm0.01`, "MARGIN", "equal", "inside the margin"],
  [r`3.16`, r`3.14\pm0.01`, "MARGIN", "not-equal", "outside the margin"],
  [r`\frac{22}{7}`, r`3.14\pm0.01`, "MARGIN", "equal", "fraction within margin"],
  [r`\pi`, r`3.1416\pm0.0001`, "MARGIN", "equal", "constant"],
  [r`0.5`, r`\frac{1}{2}`, "MARGIN", "equal", "no margin: exact value"],
  [r`x`, r`2\pm0.1`, "MARGIN", "not-equal", "not a number"],
];

let failed = 0;
for (const [answer, key, mode, want, note] of cases) {
  const t = Date.now();
  const got = checkMaths(answer, key, mode);
  const ms = Date.now() - t;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${(mode ?? "default").padEnd(10)} ${note}${ok ? "" : `: want ${want}, got ${got}`}${ms > 300 ? ` (${ms} ms)` : ""}`);
}
// Through autoGradeSubmission: right, wrong and undecided answers.
const q = (id: string, key: string, mathMode: MathMode | null = null) => ({
  id, parentId: null, order: 0, type: "MATH_EXPRESSION", points: 2, options: [],
  answer: key, matchPairs: null, reorderItems: [], blankCount: null, mathMode,
});
const marked = autoGradeSubmission(
  [q("right", r`x(x+3)`), q("wrong", r`x(x+3)`, "FORM"), q("unsure", r`x`)],
  { right: r`x^2+3x`, wrong: r`x^2+3x`, unsure: r`x+` },
  { checkMaths },
);
const score = (id: string) => marked.grades.find((g) => g.questionId === id)?.score;
const flowOk = score("right") === 2 && score("wrong") === 0 && score("unsure") === undefined && marked.pendingCount === 1;
if (!flowOk) failed++;
console.log(`${flowOk ? "PASS" : "FAIL"}  marking    right 2, wrong 0, unsure left for the tutor${flowOk ? "" : `: ${JSON.stringify(marked)}`}`);
const noChecker = autoGradeSubmission([q("right", r`x(x+3)`)], { right: r`x(x+3)` });
const noCheckerOk = noChecker.grades.length === 0 && noChecker.pendingCount === 1;
if (!noCheckerOk) failed++;
console.log(`${noCheckerOk ? "PASS" : "FAIL"}  marking    no checker: left for the tutor`);

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
