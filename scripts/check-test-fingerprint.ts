/**
 * Check the stale-save fingerprint hashing: npx tsx scripts/check-test-fingerprint.ts
 * (The database half, loadTestFingerprint, is exercised by the edit page.)
 */
import { hashCanonical } from "../src/features/assessments/lib/test-fingerprint";

let failures = 0;
function check(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

const base = {
  test: { title: "Quiz", dueDate: new Date("2026-11-20T08:00:00Z"), memoFileUrls: [] },
  questions: [
    { id: "a", question: "1+1", answer: { value: 2, unit: null } },
    { id: "b", question: "2+2", answer: "4" },
  ],
};

check("same data, same hash", hashCanonical(base) === hashCanonical(structuredClone(base)));
check(
  "key order does not matter",
  hashCanonical(base) ===
    hashCanonical({
      questions: base.questions.map((q) => ({ answer: q.answer, question: q.question, id: q.id })),
      test: { memoFileUrls: [], dueDate: base.test.dueDate, title: "Quiz" },
    }),
);
check(
  "an added question changes it",
  hashCanonical(base) !==
    hashCanonical({ ...base, questions: [...base.questions, { id: "c", question: "3+3", answer: "6" }] }),
);
check(
  "an edited answer changes it",
  hashCanonical(base) !==
    hashCanonical({ ...base, questions: [base.questions[0], { ...base.questions[1], answer: "5" }] }),
);
check(
  "a moved due date changes it",
  hashCanonical(base) !==
    hashCanonical({ ...base, test: { ...base.test, dueDate: new Date("2026-11-21T08:00:00Z") } }),
);
check("fits the schema's 100-character limit", hashCanonical(base).length <= 100);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
