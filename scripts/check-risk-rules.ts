/**
 * At-risk rules (#216 phase 2): which patterns raise an alert, at what
 * level, what the job does next, and the plain-language summary. Pure.
 *
 *   npx tsx scripts/check-risk-rules.ts
 */

import { assessRisk, nextStep, RISK_RULES, riskSummary, type RiskInput } from "../src/features/risk/rules";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const now = new Date("2026-11-23T08:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const marks = (...ps: number[]) => ps.map((p, i) => ({ at: daysAgo(60 - i * 7), percent: p }));
const input = (o: Partial<RiskInput>): RiskInput => ({ now, marks: [], missed: [], attendance: [], ...o });
const rules = (r: ReturnType<typeof assessRisk>) => r?.reasons.map((x) => x.rule) ?? [];
const present = (n: number) => Array.from({ length: n }, () => ({ status: "PRESENT" as const }));
const absent = (n: number) => Array.from({ length: n }, () => ({ status: "ABSENT" as const }));

// Nothing to worry about.
check("no data, no alert", assessRisk(input({})), null);
check("steady good marks, no alert", assessRisk(input({ marks: marks(72, 75, 70, 74, 71) })), null);
check("one missed piece is not enough", assessRisk(input({ missed: [{ title: "Essay", dueAt: daysAgo(5) }] })), null);
check("one absence is not enough", assessRisk(input({ attendance: [...present(5), ...absent(1)] })), null);
check("excused absences don't count", assessRisk(input({ attendance: [...present(2), { status: "EXCUSED" }, { status: "EXCUSED" }, { status: "EXCUSED" }] })), null);
check("a single low mark is not enough", assessRisk(input({ marks: marks(30) })), null);

// Marks.
const falling = assessRisk(input({ marks: marks(80, 78, 82, 60, 58, 62) }));
check("falling marks: rule", rules(falling), ["FALLING_MARKS"]);
check("falling marks: from and to", falling?.reasons[0], { rule: "FALLING_MARKS", from: 80, to: 60 });
check("falling marks alone is WATCH", falling?.level, "WATCH");
check("a 10-point dip is not falling", assessRisk(input({ marks: marks(70, 72, 68, 60, 61, 59) })), null);
check("marks out of order still compare by date", rules(assessRisk(input({ marks: [{ at: daysAgo(2), percent: 55 }, { at: daysAgo(40), percent: 85 }, { at: daysAgo(5), percent: 58 }, { at: daysAgo(9), percent: 60 }] }))), ["FALLING_MARKS"]);
const low = assessRisk(input({ marks: marks(45, 48, 44) }));
check("low marks: rule and level", [rules(low), low?.level], [["LOW_MARKS"], "WATCH"]);
check("very low marks are AT_RISK", assessRisk(input({ marks: marks(35, 38) }))?.level, "AT_RISK");
check("falling into low counts as one kind (WATCH)", (() => { const r = assessRisk(input({ marks: marks(75, 72, 45, 44, 46) })); return [rules(r), r?.level]; })(), [["FALLING_MARKS", "LOW_MARKS"], "WATCH"]);

// Missed work and absences.
const missed = assessRisk(input({ missed: [{ title: "Test 2", dueAt: daysAgo(3) }, { title: "Essay", dueAt: daysAgo(10) }] }));
check("two missed: rule, count, oldest first", [rules(missed), missed?.reasons[0]], [["MISSED_WORK"], { rule: "MISSED_WORK", count: 2, titles: ["Essay", "Test 2"], since: daysAgo(10).toISOString() }]);
check("three missed is AT_RISK", assessRisk(input({ missed: [1, 2, 3].map((i) => ({ title: `W${i}`, dueAt: daysAgo(i) })) }))?.level, "AT_RISK");
check("two absences: WATCH", (() => { const r = assessRisk(input({ attendance: [...present(6), ...absent(2)] })); return [rules(r), r?.level, r?.reasons[0]]; })(), [["ABSENCES"], "WATCH", { rule: "ABSENCES", absent: 2, sessions: 8 }]);
check("three absences: AT_RISK", assessRisk(input({ attendance: [...present(6), ...absent(3)] }))?.level, "AT_RISK");
check("low share needs enough sessions", assessRisk(input({ attendance: [...present(2), ...absent(1)] })), null);

// Two different kinds make it AT_RISK.
check("missed work plus absences is AT_RISK", assessRisk(input({ missed: [{ title: "A", dueAt: daysAgo(2) }, { title: "B", dueAt: daysAgo(4) }], attendance: [...present(5), ...absent(2)] }))?.level, "AT_RISK");
check("low marks plus missed work is AT_RISK", assessRisk(input({ marks: marks(45, 46, 47), missed: [{ title: "A", dueAt: daysAgo(2) }, { title: "B", dueAt: daysAgo(4) }] }))?.level, "AT_RISK");

// What the job does.
const watch = { level: "WATCH" as const, reasons: [] };
const atRisk = { level: "AT_RISK" as const, reasons: [] };
check("new problem opens", nextStep(watch, null, null, now), "open");
check("quiet period holds", nextStep(watch, null, new Date(now.getTime() + 86_400_000), now), "none");
check("quiet period over opens", nextStep(watch, null, daysAgo(1), now), "open");
check("still a problem updates", nextStep(watch, { level: "WATCH" }, null, now), "update");
check("worse escalates", nextStep(atRisk, { level: "WATCH" }, null, now), "escalate");
check("better but not clear stays (update)", nextStep(watch, { level: "AT_RISK" }, null, now), "update");
check("clear resolves", nextStep(null, { level: "WATCH" }, null, now), "resolve");
check("clear and nothing open does nothing", nextStep(null, null, null, now), "none");

// Summary.
const s1 = riskSummary("Thandi Mokoena", "Mathematics", [{ rule: "FALLING_MARKS", from: 80, to: 60 }, { rule: "LOW_MARKS", average: 45, count: 3 }]);
check("falling hides the low sentence", s1, `Thandi's marks in Mathematics have dropped from an average of 80% to 60% over the last ${RISK_RULES.recentCount} assessments.`);
check("low marks sentence", riskSummary("Sipho", "Physics", [{ rule: "LOW_MARKS", average: 45, count: 2 }]), "Sipho's last 2 marks in Physics average 45%.");
check(
  "missed work sentence",
  riskSummary("Ayanda Zulu", "English", [{ rule: "MISSED_WORK", count: 3, titles: ["Essay", "Poem", "Test 1"], since: "2026-11-02T08:00:00Z" }]),
  "Ayanda hasn't handed in 3 pieces of English work due since 2 November: Essay, Poem and Test 1.",
);
check("one missed piece, singular", riskSummary("Ayanda", "English", [{ rule: "MISSED_WORK", count: 1, titles: ["Essay"], since: "2026-11-02T08:00:00Z" }]), "Ayanda hasn't handed in 1 piece of English work due since 2 November: Essay.");
check("more than five titles says 'and more'", riskSummary("A", "C", [{ rule: "MISSED_WORK", count: 7, titles: ["1", "2", "3", "4", "5"], since: "2026-11-02T08:00:00Z" }]).endsWith("1, 2, 3, 4 and 5 and more."), true);
check("absence sentence", riskSummary("Lerato", "Maths", [{ rule: "ABSENCES", absent: 3, sessions: 8 }]), "Lerato was absent from 3 of the last 8 Maths sessions.");
check("blank name", riskSummary("  ", "Maths", [{ rule: "ABSENCES", absent: 2, sessions: 2 }]).startsWith("This student was absent"), true);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
