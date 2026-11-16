/**
 * Check numeric answer marking: npx tsx scripts/check-numeric.ts
 */
import { numericMatches, parseNumber, parseNumericKey } from "../src/features/assessments/lib/numeric";
import { autoGradeSubmission } from "../src/features/assessments/lib/auto-grade";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Parsing
check("point decimal", parseNumber("0.5"), 0.5);
check("comma decimal", parseNumber("0,5"), 0.5);
check("negative comma decimal", parseNumber("-3,25"), -3.25);
check("space-grouped thousands", parseNumber("1 000 000"), 1000000);
check("comma-grouped with point", parseNumber("1,000.5"), 1000.5);
check("comma-grouped, no point", parseNumber("1,000,000"), 1000000);
check("fraction", parseNumber("1/2"), 0.5);
check("negative fraction", parseNumber("-3/4"), -0.75);
check("mixed number", parseNumber("1 1/2"), 1.5);
check("negative mixed number", parseNumber("-2 3/4"), -2.75);
check("scientific", parseNumber("6.02e23"), 6.02e23);
check("number type", parseNumber(42), 42);
check("trailing point", parseNumber("3."), 3);
check("leading point", parseNumber(".5"), 0.5);
check("divide by zero", parseNumber("1/0"), null);
check("words", parseNumber("five"), null);
check("unit suffix rejected", parseNumber("5 cm"), null);
check("empty", parseNumber("  "), null);
check("expression rejected", parseNumber("2+3"), null);

// Keys
check("key with ±", parseNumericKey("3.14 ± 0.01"), { value: 3.14, margin: 0.01 });
check("key with +/-", parseNumericKey("3,14 +/- 0,01"), { value: 3.14, margin: 0.01 });
check("key with +-", parseNumericKey("100+-5"), { value: 100, margin: 5 });
check("negative key with margin", parseNumericKey("-2 ± 0.5"), { value: -2, margin: 0.5 });
check("negative margin rejected", parseNumericKey("2 ± -1"), null);

// Matching
check("0.5 matches 1/2", numericMatches("0.5", "1/2"), true);
check("0,5 matches 0.5", numericMatches("0,5", "0.5"), true);
check("float noise ignored", numericMatches(String(0.1 + 0.2), "0.3"), true);
check("0.33 does not match 1/3", numericMatches("0.33", "1/3"), false);
check("inside margin", numericMatches("3.145", "3.14 ± 0.01"), true);
check("on margin edge", numericMatches("3.15", "3.14 ± 0.01"), true);
check("outside margin", numericMatches("3.16", "3.14 ± 0.01"), false);
check("garbage answer", numericMatches("abc", "1"), false);
check("number answer, string key", numericMatches(2, "2"), true);

// Through the grader
const q = {
  id: "q1",
  parentId: null,
  order: 0,
  type: "NUMERIC",
  points: 2,
  options: [],
  answer: "1/2",
  matchPairs: null,
  reorderItems: [],
  blankCount: null,
};
check("grader: 0,5 against 1/2 scores full", autoGradeSubmission([q], { q1: "0,5" }).autoScore, 2);
check("grader: 0.4 against 1/2 scores 0", autoGradeSubmission([q], { q1: "0.4" }).autoScore, 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
