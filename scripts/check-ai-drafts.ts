/**
 * Checks how AI drafts become questions, lessons and assignments
 * (contracts/viewer.md, "AI help for tutors").
 *
 *   npx tsx scripts/check-ai-drafts.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import { parseTestJson } from "../src/features/assessments/lib/test-io";
import { bankNodeToEditor } from "../src/features/assessments/lib/question-bank";
import {
  assignmentBrief, draftToQuestion, feedbackText, isTypableKey, lessonGroup, numericKey, outlineGroups, testImport, type DraftQuestion,
} from "../src/features/assessments/lib/ai-drafts";
import { leftText } from "../src/features/courses/lib/ai-help";
import { blockedBlock, tidyProblem } from "../src/features/lessons/lib/ai-tidy";
import { CreateLessonsFromDraftSchema } from "../src/features/lessons/schemas";
import { numericMatches } from "../src/features/assessments/lib/numeric";
import { docToMarkdown, markdownToDoc } from "../src/lib/content/markdown";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const q = (patch: Partial<DraftQuestion>): DraftQuestion => ({
  type: "ESSAY", question: " Q ", points: 3, options: [], correctOptions: [], trueFalse: null, numericAnswer: null, numericTolerance: null, modelAnswer: "", explanation: "", topicCodes: [],
  difficulty: "medium", ...patch,
});

// Questions
const mc = draftToQuestion(q({ type: "MULTIPLE_CHOICE", options: ["a", " b ", "b", "c"], correctOptions: [1] }));
pass(mc.node.answer === "b" && mc.node.options?.join() === "a,b,c" && mc.marked === "nexa" && mc.todo === null, "multiple choice: trimmed options, one key that is an option");
pass(draftToQuestion(q({ type: "MULTIPLE_CHOICE", options: ["a", "b"], correctOptions: [0, 1] })).node.answer === null, "multiple choice with two right answers has no key");
pass(draftToQuestion(q({ type: "MULTIPLE_CHOICE", options: ["a", "b"], correctOptions: [5] })).todo !== null, "an out-of-range key asks the tutor to choose");
pass(draftToQuestion(q({ type: "MULTIPLE_CHOICE", options: ["a"], correctOptions: [0], modelAnswer: "x" })).node.type === "ESSAY", "one option isn't a choice: a written question");
const ms = draftToQuestion(q({ type: "MULTI_SELECT", options: ["a", "b", "c"], correctOptions: [2, 0, 2] }));
pass(Array.isArray(ms.node.answer) && (ms.node.answer as string[]).join() === "c,a", "multi-select key is a list without repeats");
pass(draftToQuestion(q({ type: "TRUE_FALSE", trueFalse: false })).node.answer === "false", "true/false key is a word");
pass(draftToQuestion(q({ type: "TRUE_FALSE" })).todo !== null, "true/false without an answer asks the tutor");

const n = draftToQuestion(q({ type: "NUMERIC", numericAnswer: 3.14, numericTolerance: 0.01 }));
pass(numericMatches("3,15", n.node.answer) && !numericMatches("3.2", n.node.answer), "numeric key with a margin marks as numeric.ts reads it");
pass(numericKey(42, 0) === "42" && numericKey(42, null) === "42", "no margin, no ±");
pass(draftToQuestion(q({ type: "NUMERIC", modelAnswer: "42" })).marked === "tutor", "numeric without a number is marked by the tutor");

pass(isTypableKey("Photosynthesis") && !isTypableKey("") && !isTypableKey("a\nb") && !isTypableKey("\\(x\\)") && !isTypableKey("$x$") && !isTypableKey("x".repeat(61)), "only one short plain line can be a short-answer key");
const short = draftToQuestion(q({ type: "SHORT_ANSWER", modelAnswer: "Pairs of 12.\n\\((x+3)(x+4)\\)", explanation: "Why." }));
pass(short.node.type === "ESSAY" && short.marked === "tutor" && String(short.node.answer).endsWith("Why."), "a worked model answer never marks by exact match");
pass(draftToQuestion(q({ type: "SHORT_ANSWER", modelAnswer: " Pretoria " })).node.answer === "Pretoria", "a short key is trimmed");

const ed = bankNodeToEditor(mc.node, () => "id1");
pass(ed.clientId === "id1" && ed.answer === "b" && ed.bankQuestionId === null && ed.points === 3 && ed.question === "Q", "a draft opens in the editor like any question");

// Tests go through the JSON import's own validator
const all = [mc, ms, n, short].length;
const t = parseTestJson(testImport({ title: " Quiz ", instructions: "", questions: [q({ type: "MULTIPLE_CHOICE", options: ["a", "b"], correctOptions: [0] }), q({ type: "NUMERIC", numericAnswer: 1 }), q({}), q({ type: "TRUE_FALSE", trueFalse: true })] }, new Date("2026-12-01T10:00:00Z")));
pass(t.isActive === false && t.title === "Quiz" && t.totalPoints === 12 && t.questions.length === all && t.preTestInstructions === null, "a drafted test is unpublished and adds up");

// Outlines and lessons
const sections = [
  { title: "One", lessons: [{ title: "", summary: "", topicCodes: [] }, { title: "A", summary: " s ", topicCodes: ["x"] }] },
  { title: "Two", lessons: [{ title: "B", summary: "", topicCodes: [] }] },
];
const groups = outlineGroups(sections, (s, l) => s === 0 && l <= 1);
pass(groups.length === 1 && groups[0].lessons.length === 1 && groups[0].lessons[0].title === "A" && groups[0].lessons[0].description === "s", "only ticked lessons with a title, each under its own section");
const second = outlineGroups(sections, (s, l) => s === 1 && l === 0);
pass(second[0].title === "Two" && second[0].lessons[0].title === "B", "ticks keep their own positions");
const lg = lessonGroup([{ title: "t".repeat(300), summary: "", body: "b".repeat(30_000), topicCodes: [] }]);
pass(lg.title === null && lg.lessons[0].title.length === 120 && lg.lessons[0].description.length === 20_000, "lessons are cut to what a lesson stores");
const id = "cmwpktyo2004linbsxdxk9k9o";
pass(CreateLessonsFromDraftSchema.safeParse({ courseId: id, groups: [...groups, lg] }).success, "the action accepts them");
pass(!CreateLessonsFromDraftSchema.safeParse({ courseId: id, groups: [] }).success, "nothing to add is refused");
const many = { title: "G", lessons: Array.from({ length: 50 }, () => ({ title: "L", description: "", topics: [] })) };
pass(!CreateLessonsFromDraftSchema.safeParse({ courseId: id, groups: [many, many, many] }).success, "more than 100 lessons is refused");

// Assignments
const a = assignmentBrief({ title: "A", brief: "Do it", rubric: [{ criterion: "Method", points: 4 }, { criterion: " ", points: 2 }, { criterion: "Answer", points: 1 }], modelAnswer: "SECRET MEMO" });
pass(a.totalPoints === 5 && a.description.includes("- Answer: 1 mark") && !a.description.includes("SECRET"), "the brief carries the rubric and never the memo");
pass(assignmentBrief({ title: "A", brief: "x", rubric: [], modelAnswer: "" }).totalPoints === 1, "no rubric: 1 mark, as the form's default");

pass(feedbackText({ feedback: " Good. ", nextSteps: ["Check", " "] }) === "Good.\n\nNext steps:\n- Check", "a comment ends with its next steps");
pass(feedbackText({ feedback: "Good.", nextSteps: [] }) === "Good.", "no empty next steps");

// Tidying
const doc = (md: string) => markdownToDoc(md).content ?? [];
pass(blockedBlock(doc("## H\n\nText \\(x\\) and [a link](https://example.test)\n\n- one\n\n> quote\n\n$$x$$")) === null, "text, lists, quotes, links and maths can be tidied");
pass(blockedBlock(doc("| a | b |\n| - | - |\n| 1 | 2 |")) === "a table", "a table stops it");
pass(blockedBlock(doc("Look:\n\n![x](https://example.test/a.png)")) === "an image", "an image stops it");
pass(blockedBlock(doc("```\ncode\n```")) === "code", "code stops it");
pass(tidyProblem(doc("Short"), "Short", true) !== null && tidyProblem([], "x".repeat(12_001), true) !== null, "too short and too long are refused");
pass(tidyProblem(doc("This is long enough to tidy."), "This is long enough to tidy.", false) === null, "ordinary text is accepted");
const round = "## Heading\n\nUse \\(x^2\\) and **bold**.\n\n- one\n- two";
pass(/\$x\^2\$/.test(docToMarkdown(markdownToDoc(round))) && docToMarkdown(markdownToDoc(round)).includes("## Heading"), "text survives the trip to markdown and back");

pass(leftText("QUESTIONS", { left: 8, limit: 10 }) === "8 of 10 batches of questions left this month", "what's left");
pass(leftText("TIDY", { left: 0, limit: 50 }).startsWith("No tidy-ups left"), "none left");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
