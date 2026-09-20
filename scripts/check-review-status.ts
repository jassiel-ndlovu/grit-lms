import {
  questionStatusTone,
  type StatusInput,
} from "../src/features/assessments/lib/review-status";

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

function tone(over: Partial<StatusInput>) {
  return questionStatusTone({
    isContext: false,
    answered: true,
    grade: null,
    ...over,
  });
}

/* ─── The reported bug: partial credit is not "correct" ────────────────── */

check("4 out of 6 is partial, not correct", tone({ grade: { score: 4, outOf: 6 } }), "partial");
check("1 out of 6 is partial", tone({ grade: { score: 1, outOf: 6 } }), "partial");
check("5.5 out of 6 is partial", tone({ grade: { score: 5.5, outOf: 6 } }), "partial");

/* ─── The ends of the range keep their old meaning ─────────────────────── */

check("full marks is correct", tone({ grade: { score: 6, outOf: 6 } }), "correct");
check("zero is wrong", tone({ grade: { score: 0, outOf: 6 } }), "wrong");
check("one out of one is correct", tone({ grade: { score: 1, outOf: 1 } }), "correct");

/* ─── Ungraded states ──────────────────────────────────────────────────── */

check("answered but unmarked is pending", tone({ grade: null }), "pending");
check("blank and unmarked is unanswered", tone({ answered: false, grade: null }), "unanswered");
check("a context block is context", tone({ isContext: true }), "context");
check(
  "a context block stays context even with a grade row",
  tone({ isContext: true, grade: { score: 3, outOf: 3 } }),
  "context",
);

/* ─── Subjective questions rest at pending ─────────────────────────────── */

// An ESSAY the tutor published a model answer for is still unmarked until a
// human scores it — the memo must not change the status.
check(
  "an answered essay with no grade row reads as pending",
  tone({ answered: true, grade: null }),
  "pending",
);
check(
  "once a human marks it partially, it reads as partial",
  tone({ answered: true, grade: { score: 7, outOf: 10 } }),
  "partial",
);

/* ─── Degenerate marks ─────────────────────────────────────────────────── */

check(
  "a zero-point question is not painted red",
  tone({ grade: { score: 0, outOf: 0 } }),
  "correct",
);
check(
  "a score above the maximum still reads as correct",
  tone({ grade: { score: 7, outOf: 6 } }),
  "correct",
);
check(
  "a negative score reads as wrong",
  tone({ grade: { score: -1, outOf: 6 } }),
  "wrong",
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
