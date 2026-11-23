/**
 * Checks the question bank helpers (contracts/question-bank.md).
 *
 *   npx tsx scripts/check-question-bank.ts
 *
 * Pure: no database, no network. Editor question -> bank item -> editor
 * question keeps every field, gives new ids, links only the top question,
 * and the stored item passes the test JSON validator. Stem, points, parts
 * and topics. Exits 1 on any failure.
 */

import type { EditorQuestion } from "../src/features/assessments/components/test-question-editor";
import {
  bankNodeCount, bankNodePoints, bankNodeToEditor, bankNodeTopics, bankStem, drawFromPool, editorToBankNode, readBankNode,
  topicCounts,
} from "../src/features/assessments/lib/question-bank";
import { parseTestJson } from "../src/features/assessments/lib/test-io";
import { topicsFor } from "../src/features/courses/lib/curriculum";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const [t1, t2] = topicsFor({ curriculum: "CAPS", subject: "mathematics", gradeLevel: 10 });
const base = {
  options: [], answer: null, language: null, matchPairs: [], reorderItems: [], blankCount: null, mathMode: null, rubric: null,
};
const tree: EditorQuestion = {
  ...base,
  clientId: "id:old-1",
  bankQuestionId: null,
  type: "NONE",
  points: 5,
  question: "## Read the graph\n\n![graph](https://example.test/g.png) of $f(x) = x^2$ and answer **both** parts.",
  topics: [t1.code],
  subQuestions: [
    { ...base, clientId: "id:old-2", type: "MULTIPLE_CHOICE", points: 2, question: "Which is the turning point?", options: ["(0;0)", "(1;1)"], answer: "(0;0)", topics: [t2.code, t1.code], subQuestions: [] },
    {
      ...base, clientId: "id:old-3", type: "ESSAY", points: 4, question: "Explain.", topics: [],
      rubric: { criteria: [{ id: "c1", label: "Method", max: 3 }, { id: "c2", label: "Answer", max: 1 }] }, subQuestions: [],
    },
    { ...base, clientId: "id:old-4", type: "MATH_EXPRESSION", points: 1, question: "Simplify.", answer: "x^2", mathMode: null, topics: [], subQuestions: [] },
  ],
};

const node = editorToBankNode(tree);
pass(readBankNode(JSON.parse(JSON.stringify(node))) !== null, "a stored item passes the test JSON validator");
pass(!JSON.stringify(node).includes("old-"), "stored items carry no question ids");
pass(node.points === 0, "a context block stores no marks of its own");
pass(node.subQuestions?.[2].mathMode === "EQUIVALENT", "a maths question gets its default marking mode");
pass(bankNodePoints(node) === 7, "points add up over the tree", `${bankNodePoints(node)}`);
pass(bankNodeCount(node) === 4, "parts count the whole tree", `${bankNodeCount(node)}`);
pass(JSON.stringify(bankNodeTopics(node)) === JSON.stringify([t1.code, t2.code]), "topics are gathered once, top first");
pass(bankStem(node) === "Read the graph of f(x) = x^2 and answer both parts.", "the stem drops images and markup", bankStem(node));
pass(bankStem({ ...node, question: "" }) === "Which is the turning point?", "an empty stem falls back to the first part");
pass(bankStem({ ...node, question: "x".repeat(500) }).length === 200, "long stems are cut to 200 characters");

let n = 0;
const back = bankNodeToEditor(node, () => `new-${++n}`, "bank-1");
pass(back.clientId === "new-1" && back.subQuestions[2].clientId === "new-4", "copies get fresh ids");
pass(back.bankQuestionId === "bank-1" && back.subQuestions.every((c) => !c.bankQuestionId), "only the top question links to the bank item");
pass(back.subQuestions[0].answer === "(0;0)" && back.subQuestions[0].options.length === 2, "answers and options come back");
pass(back.subQuestions[1].rubric?.criteria.length === 2, "the rubric comes back");
pass(JSON.stringify(back.subQuestions[0].topics) === JSON.stringify([t2.code, t1.code]), "topics come back");
pass(bankNodeToEditor({ ...node, topics: ["made:up"] }, () => "x").topics?.length === 0, "unknown topics are dropped on the way in");
pass(readBankNode({ type: "NOPE", question: "?" }) === null, "an unreadable item reads as null");

// The same tree imports as a test, so the bank and JSON import agree.
const parsed = parseTestJson({ version: 1, title: "T", dueDate: "2026-12-01", questions: [node] });
pass(parsed.questions?.length === 1, "a bank item imports as a test question");

// Generate from bank: the random draw.
const pool = [
  { id: "a", topics: ["f"] }, { id: "b", topics: ["f"] }, { id: "c", topics: ["f", "t"] },
  { id: "d", topics: ["t"] }, { id: "e", topics: ["p"] },
];
let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const d1 = drawFromPool(pool, [{ topic: "f", count: 2 }, { topic: "t", count: 2 }], rng);
const ids = d1.drawn.map((x) => x.id);
pass(new Set(ids).size === ids.length, "a draw never repeats an item", ids.join(","));
pass(d1.drawn.slice(0, 2).every((x) => x.topics.includes("f")) && d1.drawn.slice(2).every((x) => x.topics.includes("t")), "each row draws from its own topic");
pass(ids.length + d1.short.reduce((n, s) => n + s.wanted - s.got, 0) === 4, "drawn plus shortfall equals what was asked");
const d2 = drawFromPool(pool, [{ topic: "p", count: 3 }], rng);
pass(d2.drawn.length === 1 && JSON.stringify(d2.short) === JSON.stringify([{ topic: "p", wanted: 3, got: 1 }]), "a short topic says how many it found");
const d3 = drawFromPool(pool, [{ topic: "f", count: 2 }, { topic: "f", count: 2 }], rng);
pass(d3.drawn.length === 3 && d3.short[0]?.got === 1, "rows on the same topic add up and share the pool");
pass(drawFromPool(pool, [{ topic: "x", count: 1 }, { topic: "f", count: 0 }]).drawn.length === 0, "unknown topics and zero counts draw nothing");
const seen = new Set<string>();
for (let i = 0; i < 200; i++) seen.add(drawFromPool(pool, [{ topic: "f", count: 1 }], rng).drawn[0].id);
pass(seen.size === 3, "over many draws every item on a topic comes up", [...seen].sort().join(","));
pass(pool.map((x) => x.id).join() === "a,b,c,d,e", "the pool isn't reordered");
pass(JSON.stringify(topicCounts([{ topics: ["f", "f", "t"] }, { topics: ["f"] }])) === JSON.stringify({ f: 2, t: 1 }), "topic counts count each item once per topic");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll question bank checks passed.");
