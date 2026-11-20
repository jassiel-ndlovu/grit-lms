/**
 * Fixture checks for splitAnswerMaths (B design 01, phase 1): which parts
 * of a student's typed answer are typeset as maths.
 * Run: npx tsx scripts/check-answer-maths.ts
 */

import { splitAnswerMaths, type AnswerSegment } from "../src/lib/content/answer-maths";

const show = (segs: AnswerSegment[]) =>
  segs.map((s) => (s.kind === "text" ? `T(${s.text})` : `${s.display ? "D" : "M"}(${s.tex})`)).join(" ");

const cases: [string, string][] = [
  ["no maths here", "T(no maths here)"],
  ["It costs $5 and $10.", "T(It costs $5 and $10.)"],
  ["R5 or $5", "T(R5 or $5)"],
  ["So $x^2 + 1$ is positive.", "T(So ) M(x^2 + 1) T( is positive.)"],
  [String.raw`$$\frac{a}{b}$$`, String.raw`D(\frac{a}{b})`],
  [String.raw`Then \(x = 2\) and \[y = 3\]`, "T(Then ) M(x = 2) T( and ) D(y = 3)"],
  [String.raw`a literal \$ sign`, "T(a literal $ sign)"],
  ["$ x $ has spaces", "T($ x $ has spaces)"],
  ["$x$5 is not closed", "T($x$5 is not closed)"],
  ["line *one*\n# two", "T(line *one*\n# two)"],
  ["$a\n\nb$", "T($a\n\nb$)"],
  ["$x$ and $y$", "M(x) T( and ) M(y)"],
  ["It costs $5 and $10. So it gives $(x-2)^2$ here", "T(It costs $5 and $10. So it gives ) M((x-2)^2) T( here)"],
  ["Paid $5 then $x+1$", "T(Paid $5 then ) M(x+1)"],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = show(splitAnswerMaths(input));
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(input)}${ok ? "" : `\n      want ${want}\n      got  ${got}`}`);
}
console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
