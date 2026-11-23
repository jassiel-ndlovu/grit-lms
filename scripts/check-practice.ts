/**
 * Checks practice sets and item analysis (contracts/practice.md).
 *
 *   npx tsx scripts/check-practice.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import {
  analyseTest, correlation, hardestFirst, latestPerStudent, type ItemAttempt, type ItemQuestion,
} from "../src/features/assessments/lib/item-analysis";
import { checkMaths } from "../src/features/assessments/lib/maths-check";
import {
  BOX_DAYS, KNOWN_BOX, NEW_PER_SESSION, SESSION_SIZE, TOP_BOX, buildQueue, canPractise, markPractice, nextReview,
  practiceKeys, practiceNodes, schoolMidnight, summarise, withSelfMark,
} from "../src/features/assessments/lib/practice";
import type { ImportQuestion } from "../src/features/assessments/lib/test-io";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const iso = (d: Date) => d.toISOString();

// Scheduling
const now = new Date("2026-11-23T16:30:00Z"); // 18:30 in South Africa
pass(iso(schoolMidnight(now, 1)) === "2026-11-23T22:00:00.000Z", "tomorrow starts at midnight in South Africa");
pass(iso(schoolMidnight(new Date("2026-11-23T22:30:00Z"), 1)) === "2026-11-24T22:00:00.000Z", "after midnight, tomorrow is the next day");
const first = nextReview(null, 1, now);
pass(first.box === 1 && iso(first.dueAt) === iso(schoolMidnight(now, 1)), "a first right answer is due tomorrow");
let s = first;
let t = now;
const gaps: number[] = [];
for (let i = 0; i < 6; i++) {
  t = s.dueAt;
  s = nextReview(s, 1, t);
  gaps.push(Math.round((s.dueAt.getTime() - t.getTime()) / 86_400_000));
}
pass(gaps.join() === [...BOX_DAYS.slice(2), 30, 30].join() && s.box === TOP_BOX, "gaps grow to the top box and stay there", gaps.join());
const early = nextReview({ box: 3, dueAt: schoolMidnight(now, 5) }, 1, now);
pass(early.box === 3 && iso(early.dueAt) === iso(schoolMidnight(now, 5)), "practising early doesn't stretch the gap");
const missed = nextReview({ box: 4, dueAt: schoolMidnight(now, 5) }, 0, now);
pass(missed.box === 0 && missed.dueAt === now, "a miss goes back to the start and is due now");
const half = nextReview({ box: 4, dueAt: now }, 0.5, now);
pass(half.box === 1 && iso(half.dueAt) === iso(schoolMidnight(now, 1)), "half right comes back tomorrow");
pass(nextReview(missed, 1, now).box === 1, "a right answer after a miss starts again at box 1");

// Queue
const many = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, order: i }));
const q1 = buildQueue(many, [], now);
pass(q1.length === NEW_PER_SESSION && q1[0].id === "i0", "a new set starts with its first new questions");
const reviews = many.slice(10, 28).map((i, n) => ({ itemId: i.id, dueAt: new Date(now.getTime() - n * 1000) }));
const q2 = buildQueue(many, reviews, now);
pass(q2.length === SESSION_SIZE && q2[0].id === "i27" && q2[18].id === "i0", "due questions first, longest overdue first, then new");
pass(
  buildQueue(many.slice(0, 2), [{ itemId: "i0", dueAt: schoolMidnight(now, 1) }, { itemId: "i1", dueAt: schoolMidnight(now, 1) }], now).length === 0,
  "nothing due, nothing new",
);

// Summary
const sum = summarise(
  many.slice(0, 4),
  [
    { itemId: "i0", box: KNOWN_BOX, dueAt: schoolMidnight(now, 3), lastAnsweredAt: now, answered: 4, correct: 3 },
    { itemId: "i1", box: 0, dueAt: now, lastAnsweredAt: new Date(now.getTime() - 5000), answered: 2, correct: 0 },
    { itemId: "other", box: 5, dueAt: now, lastAnsweredAt: now, answered: 9, correct: 9 },
  ],
  now,
);
pass(sum.questions === 4 && sum.answered === 2 && sum.known === 1 && sum.due === 1 && sum.fresh === 2, "summary counts");
pass(sum.accuracy === 0.5 && sum.lastAt?.getTime() === now.getTime() && sum.nextDue === null, "summary accuracy and dates");

// Questions
const mc: ImportQuestion = { type: "MULTIPLE_CHOICE", question: "2+2", points: 2, options: ["3", "4"], answer: "4" };
const tree: ImportQuestion = {
  type: "NONE",
  question: "Read this.",
  subQuestions: [
    mc,
    { type: "NUMERIC", question: "Half of 1", points: 1, answer: "0,5" },
    { type: "REORDER", question: "Order", points: 1, reorderItems: ["a", "b"] },
    { type: "MATCHING", question: "Match", points: 1, matchPairs: [{ left: "x", right: "1" }, { left: "y", right: "2" }] },
  ],
};
pass(canPractise(mc) && canPractise(tree), "keyed, machine-marked questions can be practised");
pass(!canPractise({ ...mc, answer: null }), "no answer saved, no practice");
pass(!canPractise({ type: "ESSAY", question: "Why?", points: 5, answer: "Because" }), "essays can't be practised");
pass(!canPractise({ type: "NONE", question: "Only text" }), "context alone can't be practised");
pass(
  !canPractise({ ...tree, subQuestions: [...(tree.subQuestions ?? []), { type: "ESSAY", question: "e", points: 1 }] }),
  "one hand-marked part rules out the question",
);
const nodes = practiceNodes(tree);
pass(nodes.map((n) => n.id).join() === "0,0.0,0.1,0.2,0.3" && nodes.every((n) => !("answer" in n)), "parts in order, without answers");
pass(practiceKeys(tree).map((k) => k.text.join("|")).join(";") === "4;0,5;a|b;" && practiceKeys(tree)[3].pairs.length === 2, "keys for the parts");
const allRight = { "0.0": "4", "0.1": "0.5", "0.2": ["a", "b"], "0.3": [{ left: "y", right: "2" }, { left: "x", right: "1" }] };
pass(markPractice(tree, allRight, checkMaths).share === 1, "all parts right is full marks");
const some = markPractice(tree, { ...allRight, "0.0": "3" }, checkMaths);
pass(some.share === 3 / 5 && some.parts["0.0"] === false && some.parts["0.1"] === true, "partly right gives its share");
pass(markPractice(tree, {}, checkMaths).share === 0, "blank is wrong");
pass(markPractice({ ...mc, points: 0 }, { "0": "3" }, checkMaths).share === 0, "a question worth no marks can still be missed");
const maths: ImportQuestion = { type: "MATH_EXPRESSION", question: "Factorise", points: 2, answer: "x(x+3)", mathMode: "EQUIVALENT" };
pass(canPractise(maths) && markPractice(maths, { "0": "x^2+3x" }, checkMaths).share === 1, "an equivalent maths answer is right");
const blankMaths = markPractice(maths, { "0": " " }, () => "undecided");
pass(blankMaths.share === 0 && !blankMaths.undecided, "a blank maths answer is wrong, not undecided");
const und = markPractice(maths, { "0": "x" }, () => "undecided");
pass(und.undecided && und.parts["0"] === null, "an undecided maths answer asks the student");
pass(withSelfMark(maths, und, true).share === 1 && withSelfMark(maths, und, false).share === 0, "the student's own mark decides it");
const mixed: ImportQuestion = { type: "NONE", question: "", subQuestions: [mc, maths] };
const mixedMark = markPractice(mixed, { "0.0": "3", "0.1": "x" }, () => "undecided");
pass(withSelfMark(mixed, mixedMark, true).share === 0.5, "self-marking can't change a part the checker marked");

// Item analysis
const base = { parentId: null, createdAt: now, topics: [] as string[], options: [] as string[] };
const questions: ItemQuestion[] = [
  { ...base, id: "ctx", order: 0, type: "NONE", question: "Read", points: 0, answer: null },
  { ...base, id: "a", parentId: "ctx", order: 0, type: "MULTIPLE_CHOICE", question: "A", points: 1, options: ["p", "q"], answer: "p", topics: ["t1"] },
  { ...base, id: "b", order: 1, type: "SHORT_ANSWER", question: "B", points: 2, answer: "yes", topics: ["t2"] },
  { ...base, id: "c", order: 2, type: "ESSAY", question: "C", points: 4, answer: null },
];
// Twelve students: the stronger half wins on b and c, and loses a (a wrong key).
const attempts: ItemAttempt[] = Array.from({ length: 12 }, (_, i) => {
  const strong = i < 6;
  return {
    studentId: `s${i}`,
    answers: { a: strong ? "q" : i < 10 ? "p" : "q", b: strong ? "yes" : i < 9 ? "no" : "" },
    questionGrades: [
      { questionId: "a", score: !strong && i < 10 ? 1 : 0, outOf: 1 },
      { questionId: "b", score: strong ? 2 : 0, outOf: 2 },
      { questionId: "c", score: strong ? 4 : i % 2, outOf: 4 },
      { questionId: null, score: 9, outOf: 9 },
    ],
  };
});
const r = analyseTest(questions, attempts, []);
const row = (id: string) => r.items.find((i) => i.id === id)!;
pass(r.items.map((i) => i.id).join() === "a,b,c", "context blocks are left out", r.items.map((i) => i.label).join());
pass(r.attempts === 12 && row("a").difficulty === 4 / 12 && row("a").difficultyLabel === "hard", "difficulty is the average mark's share");
pass(row("b").discrimination! > 0.3 && row("b").discriminationLabel === "good", "a question stronger students get right separates well");
pass(row("a").discriminationLabel === "negative" && row("a").warnings.some((w) => w.kind === "negative"), "a question stronger students miss is flagged");
pass(row("a").warnings.some((w) => w.kind === "key") && row("a").choices.map((c) => c.count).join() === "4,8", "a popular wrong option is flagged");
pass(row("b").blank === 3 && row("b").warnings.some((w) => w.kind === "blank"), "blank answers are counted and flagged");
pass(row("b").wrongAnswers.length === 1 && row("b").wrongAnswers[0].text === "no" && row("b").wrongAnswers[0].count === 3, "common wrong answers");
pass(row("c").full === 6 && row("c").part === 3 && row("c").none === 3 && row("c").wrongAnswers.length === 0, "full, part and no marks");
pass(r.topics.map((x) => x.topic).join() === "t1,t2" && r.topics[0].average === 4 / 12, "topics weakest first");
pass(hardestFirst(r.items)[0].id === "a", "hardest first");
const few = analyseTest(questions, attempts.slice(0, 4), []);
pass(few.items.every((i) => i.discrimination === null && i.warnings.length === 0), "small groups give no separation and no warnings");
const none = analyseTest(questions, [], []);
pass(none.attempts === 0 && none.average === null && none.items.every((i) => i.difficulty === null), "no attempts, no numbers");
pass(correlation([1, 1, 1], [1, 2, 3]) === null && Math.abs(correlation([1, 2, 3], [2, 4, 6])! - 1) < 1e-9, "correlation");
pass(latestPerStudent([{ studentId: "x", n: 1 }, { studentId: "x", n: 2 }, { studentId: "y", n: 3 }]).length === 2, "one attempt per student");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
