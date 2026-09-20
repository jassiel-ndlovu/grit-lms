import {
  answerToKeyPatch,
  seedAnswerFromKey,
  seedAnswersFromKeys,
  type KeyQuestion,
} from "../src/features/assessments/lib/answer-key";

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

function q(over: Partial<KeyQuestion> & { type: string }): KeyQuestion {
  return {
    id: "q1",
    options: [],
    matchPairs: null,
    reorderItems: [],
    blankCount: null,
    ...over,
  };
}

/* ─── Simple scalar types ──────────────────────────────────────────────── */

check(
  "MULTIPLE_CHOICE stores the chosen option",
  answerToKeyPatch(q({ type: "MULTIPLE_CHOICE", options: ["a", "b"] }), "b"),
  { ok: true, patch: { answer: "b" } },
);
check(
  "MULTIPLE_CHOICE rejects an answer that isn't an option",
  answerToKeyPatch(q({ type: "MULTIPLE_CHOICE", options: ["a", "b"] }), "c").ok,
  false,
);
check(
  "MULTIPLE_CHOICE blank clears the key",
  answerToKeyPatch(q({ type: "MULTIPLE_CHOICE", options: ["a"] }), ""),
  { ok: true, patch: { answer: null } },
);

check(
  "TRUE_FALSE stores the string",
  answerToKeyPatch(q({ type: "TRUE_FALSE" }), "true"),
  { ok: true, patch: { answer: "true" } },
);
check(
  "TRUE_FALSE rejects junk",
  answerToKeyPatch(q({ type: "TRUE_FALSE" }), "yes").ok,
  false,
);

check(
  "SHORT_ANSWER stores text",
  answerToKeyPatch(q({ type: "SHORT_ANSWER" }), "  mitochondria  "),
  { ok: true, patch: { answer: "  mitochondria  " } },
);
check(
  "SHORT_ANSWER whitespace-only clears the key",
  answerToKeyPatch(q({ type: "SHORT_ANSWER" }), "   "),
  { ok: true, patch: { answer: null } },
);
check(
  "NUMERIC keeps the string form (decimals survive)",
  answerToKeyPatch(q({ type: "NUMERIC" }), "3.50"),
  { ok: true, patch: { answer: "3.50" } },
);

/* ─── Subjective types get a model answer, not a mark ──────────────────── */

check(
  "ESSAY stores a model answer",
  answerToKeyPatch(q({ type: "ESSAY" }), "Because the treaty collapsed."),
  { ok: true, patch: { answer: "Because the treaty collapsed." } },
);
check(
  "CODE stores a model answer",
  answerToKeyPatch(q({ type: "CODE" }), "def f(): pass"),
  { ok: true, patch: { answer: "def f(): pass" } },
);

/* ─── List types ───────────────────────────────────────────────────────── */

check(
  "MULTI_SELECT stores the selected options",
  answerToKeyPatch(
    q({ type: "MULTI_SELECT", options: ["a", "b", "c"] }),
    ["a", "c"],
  ),
  { ok: true, patch: { answer: ["a", "c"] } },
);
check(
  "MULTI_SELECT rejects a selection outside the options",
  answerToKeyPatch(q({ type: "MULTI_SELECT", options: ["a"] }), ["a", "z"]).ok,
  false,
);
check(
  "MULTI_SELECT empty clears the key",
  answerToKeyPatch(q({ type: "MULTI_SELECT", options: ["a"] }), []),
  { ok: true, patch: { answer: null } },
);

check(
  "FILL_IN_THE_BLANK stores one entry per blank",
  answerToKeyPatch(q({ type: "FILL_IN_THE_BLANK", blankCount: 2 }), ["x", "y"]),
  { ok: true, patch: { answer: ["x", "y"] } },
);
check(
  "FILL_IN_THE_BLANK rejects a short array (the grader indexes positionally)",
  answerToKeyPatch(q({ type: "FILL_IN_THE_BLANK", blankCount: 3 }), ["x", "y"]).ok,
  false,
);
check(
  "FILL_IN_THE_BLANK all-empty clears the key",
  answerToKeyPatch(q({ type: "FILL_IN_THE_BLANK", blankCount: 2 }), ["", "  "]),
  { ok: true, patch: { answer: null } },
);
check(
  "FILL_IN_THE_BLANK trims extra entries beyond blankCount",
  answerToKeyPatch(
    q({ type: "FILL_IN_THE_BLANK", blankCount: 2 }),
    ["x", "y", "z"],
  ),
  { ok: true, patch: { answer: ["x", "y"] } },
);

/* ─── MATCHING — the key IS matchPairs ─────────────────────────────────── */

const matching = q({
  type: "MATCHING",
  matchPairs: [
    { left: "1", right: "one" },
    { left: "2", right: "two" },
    { left: "3", right: "three" },
  ],
});

check(
  "MATCHING rewrites the pairing and keeps the original left order",
  answerToKeyPatch(matching, [
    { left: "3", right: "one" },
    { left: "1", right: "three" },
    { left: "2", right: "two" },
  ]),
  {
    ok: true,
    patch: {
      matchPairs: [
        { left: "1", right: "three" },
        { left: "2", right: "two" },
        { left: "3", right: "one" },
      ],
    },
  },
);
check(
  "MATCHING rejects a partial pairing",
  answerToKeyPatch(matching, [{ left: "1", right: "one" }]).ok,
  false,
);
check(
  "MATCHING rejects reusing one option twice (it would delete a choice)",
  answerToKeyPatch(matching, [
    { left: "1", right: "one" },
    { left: "2", right: "one" },
    { left: "3", right: "three" },
  ]).ok,
  false,
);
check(
  "MATCHING with no answer leaves the question alone",
  answerToKeyPatch(matching, []),
  { ok: true, patch: {} },
);

// A question that legitimately maps two lefts to the same right must still
// round-trip — the check is multiset equality, not uniqueness.
const dupRights = q({
  type: "MATCHING",
  matchPairs: [
    { left: "a", right: "same" },
    { left: "b", right: "same" },
  ],
});
check(
  "MATCHING allows a genuinely repeated right",
  answerToKeyPatch(dupRights, [
    { left: "b", right: "same" },
    { left: "a", right: "same" },
  ]).ok,
  true,
);

/* ─── REORDER — the key IS reorderItems ────────────────────────────────── */

const reorder = q({ type: "REORDER", reorderItems: ["a", "b", "c"] });

check(
  "REORDER stores the tutor's order",
  answerToKeyPatch(reorder, ["c", "a", "b"]),
  { ok: true, patch: { reorderItems: ["c", "a", "b"] } },
);
check(
  "REORDER rejects an answer that isn't a permutation",
  answerToKeyPatch(reorder, ["a", "b", "d"]).ok,
  false,
);
check(
  "REORDER rejects a dropped item",
  answerToKeyPatch(reorder, ["a", "b"]).ok,
  false,
);

/* ─── FILE_UPLOAD — a model-answer attachment ──────────────────────────── */

check(
  "FILE_UPLOAD stores the uploaded memo files",
  answerToKeyPatch(q({ type: "FILE_UPLOAD" }), [
    { fileUrl: "https://x/memo.pdf", fileType: "application/pdf", fileName: "memo.pdf" },
  ]),
  {
    ok: true,
    patch: {
      answer: [
        { fileUrl: "https://x/memo.pdf", fileType: "application/pdf", fileName: "memo.pdf" },
      ],
    },
  },
);
check(
  "FILE_UPLOAD with nothing attached clears the key",
  answerToKeyPatch(q({ type: "FILE_UPLOAD" }), null),
  { ok: true, patch: { answer: null } },
);

/* ─── NONE carries no key ──────────────────────────────────────────────── */

check(
  "NONE context blocks are left untouched",
  answerToKeyPatch(q({ type: "NONE" }), "anything"),
  { ok: true, patch: {} },
);

/* ─── Seeding is the inverse ───────────────────────────────────────────── */

check(
  "seed: multiple choice",
  seedAnswerFromKey({ ...q({ type: "MULTIPLE_CHOICE", options: ["a"] }), answer: "a" }),
  "a",
);
check(
  "seed: matching returns the stored pairing",
  seedAnswerFromKey({ ...matching, answer: null }),
  [
    { left: "1", right: "one" },
    { left: "2", right: "two" },
    { left: "3", right: "three" },
  ],
);
check(
  "seed: reorder returns the stored order",
  seedAnswerFromKey({ ...reorder, answer: null }),
  ["a", "b", "c"],
);
check(
  "seed: no key yields undefined so the runner shows it unanswered",
  seedAnswerFromKey({ ...q({ type: "SHORT_ANSWER" }), answer: null }),
  undefined,
);

// Round trip: seed -> save -> seed must be stable.
const seeded = seedAnswerFromKey({ ...matching, answer: null });
const saved = answerToKeyPatch(matching, seeded);
check(
  "matching round-trips unchanged",
  saved.ok ? saved.patch.matchPairs : null,
  [
    { left: "1", right: "one" },
    { left: "2", right: "two" },
    { left: "3", right: "three" },
  ],
);

check(
  "seedAnswersFromKeys omits questions with no key",
  seedAnswersFromKeys([
    { ...q({ type: "SHORT_ANSWER", id: "a" }), answer: "yes" },
    { ...q({ type: "SHORT_ANSWER", id: "b" }), answer: null },
  ]),
  { a: "yes" },
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
