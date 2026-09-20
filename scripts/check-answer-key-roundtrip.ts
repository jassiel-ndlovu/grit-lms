/**
 * End-to-end round trip for the tutor preview's answer key, against the
 * real database and the real write path.
 *
 * It creates a throwaway test on a tutor's course containing one question
 * of every keyable type, plays the part of a tutor answering them in the
 * preview, saves through `applyAnswerKey` (the same function the
 * saveTestAnswerKey action calls), then re-reads through the same queries
 * the preview page uses and asserts the memo comes back identical. It
 * finishes by auto-grading a student answer against the saved key, which
 * proves the key is usable and not merely stored.
 *
 * The scratch test is deleted at the end, including on failure.
 *
 * Run: npx tsx scripts/check-answer-key-roundtrip.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { applyAnswerKey } from "../src/features/assessments/lib/answer-key-store";
import { seedAnswersFromKeys } from "../src/features/assessments/lib/answer-key";
import { buildRunnerTree } from "../src/features/assessments/lib/question-tree";
import { autoGradeSubmission } from "../src/features/assessments/lib/auto-grade";

const prisma = new PrismaClient();

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${g}`);
    console.log(`        want: ${w}`);
  }
}

const SCRATCH_TITLE = "ZZ scratch — answer key round trip (safe to delete)";

async function main() {
  const course = await prisma.course.findFirst({
    select: { id: true, name: true, tutor: { select: { id: true, email: true } } },
  });
  if (!course) throw new Error("No course in the database to attach a test to");
  console.log(`Using course "${course.name}" (tutor ${course.tutor.email})\n`);

  // Clean up anything a previous interrupted run left behind.
  await prisma.test.deleteMany({ where: { title: SCRATCH_TITLE } });

  const test = await prisma.test.create({
    data: {
      title: SCRATCH_TITLE,
      description: "Temporary fixture.",
      courseId: course.id,
      dueDate: new Date(Date.now() + 86400000),
      isActive: false,
      timeLimit: 30,
      totalPoints: 0,
      questions: {
        create: [
          { order: 0, question: "Pick one.", type: "MULTIPLE_CHOICE", points: 2, options: ["alpha", "beta", "gamma"] },
          { order: 1, question: "True or false?", type: "TRUE_FALSE", points: 1 },
          { order: 2, question: "Pick several.", type: "MULTI_SELECT", points: 2, options: ["a", "b", "c", "d"] },
          { order: 3, question: "Short answer?", type: "SHORT_ANSWER", points: 1 },
          { order: 4, question: "A number?", type: "NUMERIC", points: 1 },
          { order: 5, question: "Two blanks.", type: "FILL_IN_THE_BLANK", points: 2, blankCount: 2 },
          {
            order: 6,
            question: "Match these.",
            type: "MATCHING",
            points: 3,
            matchPairs: [
              { left: "one", right: "1" },
              { left: "two", right: "2" },
              { left: "three", right: "3" },
            ],
          },
          { order: 7, question: "Order these.", type: "REORDER", points: 3, reorderItems: ["first", "second", "third"] },
          { order: 8, question: "Essay.", type: "ESSAY", points: 10 },
          { order: 9, question: "Code.", type: "CODE", points: 5, language: "python" },
          { order: 10, question: "Untouched question — keeps its key.", type: "SHORT_ANSWER", points: 1, answer: "keep me" },
        ],
      },
    },
    select: { id: true },
  });

  const questions = await prisma.testQuestion.findMany({
    where: { testId: test.id },
    orderBy: { order: "asc" },
  });
  const byOrder = new Map(questions.map((q) => [q.order ?? -1, q]));
  const id = (order: number) => byOrder.get(order)!.id;

  /* ── 1. The preview opens: only the pre-keyed question is filled in ── */

  const initialSeed = seedAnswersFromKeys(questions);
  check(
    "preview opens with only the already-keyed question answered",
    initialSeed,
    {
      // MATCHING and REORDER always carry a key by construction: the
      // authored pairing and order ARE the answer.
      [id(6)]: [
        { left: "one", right: "1" },
        { left: "two", right: "2" },
        { left: "three", right: "3" },
      ],
      [id(7)]: ["first", "second", "third"],
      [id(10)]: "keep me",
    },
  );

  /* ── 2. The tutor answers, and saves ────────────────────────────────── */

  const tutorAnswers: Record<string, unknown> = {
    [id(0)]: "beta",
    [id(1)]: "true",
    [id(2)]: ["a", "c"],
    [id(3)]: "photosynthesis",
    [id(4)]: "42.5",
    [id(5)]: ["north", "south"],
    [id(6)]: [
      { left: "three", right: "3" },
      { left: "one", right: "1" },
      { left: "two", right: "2" },
    ],
    [id(7)]: ["third", "first", "second"],
    [id(8)]: "A model essay answer.",
    [id(9)]: "def solve():\n    return 42",
    // id(10) deliberately omitted — an untouched question must keep its key.
  };

  const saved = await applyAnswerKey({ testId: test.id, answers: tutorAnswers });
  check("save reports the right number of updated questions", saved.updated, 10);

  /* ── 3. Re-read exactly as the preview page does ────────────────────── */

  const reread = await prisma.testQuestion.findMany({
    where: { testId: test.id },
    orderBy: { order: "asc" },
  });
  const reseed = seedAnswersFromKeys(reread);

  // MATCHING is compared as a left->right mapping rather than as an array:
  // the writer deliberately re-sorts pairs into the question's authored
  // left order so the rendered left column doesn't shuffle when a key is
  // saved. The pairing is what has to survive, not the array order.
  const asPairing = (v: unknown) =>
    JSON.stringify(
      (v as Array<{ left: string; right: string }>)
        .map((p) => `${p.left}=>${p.right}`)
        .sort(),
    );

  for (const [qid, given] of Object.entries(tutorAnswers)) {
    const back = reseed[qid];
    const same =
      qid === id(6)
        ? asPairing(given) === asPairing(back)
        : JSON.stringify(given) === JSON.stringify(back);
    check(`answer survives the round trip (${byOrder.get(
      questions.find((q) => q.id === qid)!.order ?? -1,
    )!.type})`, same, true);
  }

  check("the untouched question kept its original key", reseed[id(10)], "keep me");

  const rerereadById = new Map(reread.map((q) => [q.id, q]));
  check(
    "MATCHING wrote matchPairs, in the original left order",
    rerereadById.get(id(6))!.matchPairs,
    [
      { left: "one", right: "1" },
      { left: "two", right: "2" },
      { left: "three", right: "3" },
    ],
  );
  check(
    "REORDER wrote reorderItems in the tutor's order",
    rerereadById.get(id(7))!.reorderItems,
    ["third", "first", "second"],
  );
  check(
    "MATCHING left `answer` alone",
    rerereadById.get(id(6))!.answer,
    null,
  );
  check(
    "NUMERIC kept its string form so decimals survive",
    rerereadById.get(id(4))!.answer,
    "42.5",
  );

  /* ── 4. The tree the runner renders is unchanged by saving ──────────── */

  const tree = buildRunnerTree(reread);
  check("the runner tree still has every top-level question", tree.length, 11);

  /* ── 5. The key actually marks work ─────────────────────────────────── */

  const studentAnswers: Record<string, unknown> = {
    // id(10) is included so the "untouched" question is marked too - it
    // kept its key, so a student who matches it should score on it.
    [id(10)]: "keep me",
    [id(0)]: "beta",
    [id(1)]: "true",
    [id(2)]: ["c", "a"], // order shouldn't matter
    [id(3)]: "  Photosynthesis  ", // case and padding shouldn't matter
    [id(4)]: "42.50", // numerically equal
    [id(5)]: ["north", "south"],
    [id(6)]: [
      { left: "one", right: "1" },
      { left: "two", right: "2" },
      { left: "three", right: "3" },
    ],
    [id(7)]: ["third", "first", "second"],
  };
  const graded = autoGradeSubmission(reread, studentAnswers);
  check(
    "a student matching the key scores full marks on every auto-marked question",
    [graded.autoScore, graded.autoOutOf],
    [graded.autoOutOf, graded.autoOutOf],
  );
  // Nine, not eight: there are two SHORT_ANSWER questions, and the one the
  // tutor never touched in the preview still carries its original key.
  check(
    "every question carrying a key was auto-marked",
    graded.autoCount,
    9,
  );

  const wrong = autoGradeSubmission(reread, {
    ...studentAnswers,
    [id(7)]: ["first", "second", "third"], // the authored order, not the key
  });
  check(
    "a student who gets the reorder wrong loses exactly those marks",
    graded.autoScore - wrong.autoScore,
    3,
  );

  /* ── 6. A malformed answer is refused, and changes nothing ──────────── */

  let refused = "";
  try {
    await applyAnswerKey({
      testId: test.id,
      answers: { [id(7)]: ["first", "second", "nonsense"] },
    });
  } catch (e) {
    refused = e instanceof Error ? e.message : String(e);
  }
  check("a reorder that changed the items is refused", refused, "Question 8: the items changed");

  const afterRefusal = await prisma.testQuestion.findUnique({ where: { id: id(7) } });
  check(
    "the refused save left the question untouched",
    afterRefusal!.reorderItems,
    ["third", "first", "second"],
  );

  /* ── 7. Clearing a key ──────────────────────────────────────────────── */

  await applyAnswerKey({ testId: test.id, answers: { [id(3)]: "" } });
  const cleared = await prisma.testQuestion.findUnique({ where: { id: id(3) } });
  check("blanking an answer clears the key", cleared!.answer, null);
}

main()
  .then(async () => {
    await prisma.test.deleteMany({ where: { title: SCRATCH_TITLE } });
    console.log(`\nScratch test removed.`);
    console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error("\nERROR:", e);
    await prisma.test.deleteMany({ where: { title: SCRATCH_TITLE } });
    console.error("Scratch test removed.");
    await prisma.$disconnect();
    process.exit(1);
  });
