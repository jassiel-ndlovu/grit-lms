/**
 * AI help for tutors (#216 phase 2): plan caps, refusal messages, month
 * boundaries and lesson text cleaning. Pure; no model calls.
 *
 *   npx tsx scripts/check-ai-assist.ts
 */

import { AI_ASSIST_LIMITS, allowance, ASSIST_FEATURES, monthStart, plainText, PRO_ONLY, refusal, uncoveredTopics } from "../src/features/ai-assist/limits";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("Core gets none", Object.values(AI_ASSIST_LIMITS.CORE).every((n) => n === 0), true);
check("Plus is limited, Pro gets more", ["QUESTIONS", "OUTLINE", "TIDY"].every((f) => AI_ASSIST_LIMITS.PLUS[f as "TIDY"] < AI_ASSIST_LIMITS.PRO[f as "TIDY"]), true);
check("allowance counts down", allowance("PLUS", "QUESTIONS", 4), { tier: "PLUS", limit: 10, used: 4, left: 6 });
check("never below zero", allowance("PLUS", "OUTLINE", 9).left, 0);
check("Core refusal names the plans", refusal(allowance("CORE", "TIDY", 0), "TIDY"), "AI help is part of the Plus and Pro plans for this course.");
check("Plus within cap runs", refusal(allowance("PLUS", "QUESTIONS", 9), "QUESTIONS"), null);
check("Plus at cap points to Pro", refusal(allowance("PLUS", "QUESTIONS", 10), "QUESTIONS"), "You've used this month's 10 question batches on Plus. Pro includes many more, or wait until the 1st.");
check("Pro at cap says when it resets", refusal(allowance("PRO", "OUTLINE", 50), "OUTLINE"), "You've used this month's 50 course outlines. It resets on the 1st.");
check("Pro-only features: none on Plus, some on Pro", [...PRO_ONLY].every((f) => AI_ASSIST_LIMITS.PLUS[f] === 0 && AI_ASSIST_LIMITS.PRO[f] > 0), true);
check("every feature has a limit on every plan", ASSIST_FEATURES.every((f) => ["CORE", "PLUS", "PRO"].every((t) => Number.isInteger(AI_ASSIST_LIMITS[t as "PRO"][f]))), true);
check("Plus asking for a Pro feature is told it's Pro", refusal(allowance("PLUS", "FEEDBACK", 0), "FEEDBACK"), "This AI help is part of the Pro plan for this course.");
check("uncovered topics keep curriculum order", uncoveredTopics([{ code: "c", order: 3 }, { code: "a", order: 1 }, { code: "b", order: 2 }], [["b"], ["x"]]).map((t) => t.code), ["a", "c"]);
check("everything covered gives none", uncoveredTopics([{ code: "a", order: 1 }], [["a"]]).length, 0);
check("month start (UTC)", monthStart(new Date("2026-11-23T21:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
check("month start on the 1st", monthStart(new Date("2026-12-01T00:00:00Z")).toISOString(), "2026-12-01T00:00:00.000Z");

check("plain text from lesson HTML", plainText("<h2>Forces</h2><p>A force is a <b>push</b> or pull.</p><ul><li>Gravity</li><li>Friction</li></ul>"), "Forces\nA force is a push or pull.\n- Gravity\n- Friction");
check("scripts and styles dropped", plainText("<style>p{}</style><p>Hi</p><script>alert(1)</script>"), "Hi");
check("entities decoded", plainText("R5 &amp; up &lt;3&gt; &quot;ok&quot; it&#39;s"), "R5 & up <3> \"ok\" it's");
check("null is empty", plainText(null), "");
check("blank lines collapse", plainText("a<br><br><br>b"), "a\n\nb");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
