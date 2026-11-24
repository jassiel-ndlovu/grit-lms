/**
 * Checks for the account screens' pure helpers (#174).
 * Run: npx tsx scripts/check-account-screens.ts
 */

import { actionError, isStudentLimitError, parseEmails } from "../src/features/courses/lib/account-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("commas, spaces and new lines", parseEmails("a@x.co, b@x.co\nc@x.co;d@x.co").emails, ["a@x.co", "b@x.co", "c@x.co", "d@x.co"]);
check("lower-cased and de-duplicated", parseEmails("A@X.co a@x.co").emails, ["a@x.co"]);
check("bad addresses are reported", parseEmails("a@x.co nope b@").bad, ["nope", "b@"]);
check("blank", parseEmails("  \n ").emails, []);
check("coded server error shows its message", actionError({ serverError: "STUDENT_LIMIT: Your plan allows 10 students" }), "Your plan allows 10 students");
check("plain server error as is", actionError({ serverError: "That username is taken" }), "That username is taken");
check("validation errors", actionError({ validationErrors: {} }), "Check the details and try again.");
check("nothing", actionError(undefined), "That didn't work. Check your connection and try again.");

check("trial cap is a limit error", isStudentLimitError("TRIAL_CAP_REACHED: The trial allows 20 students. Pay for your first 30 days to add more."), true);
check("own limit is a limit error", isStudentLimitError("FORBIDDEN: This workspace's limit is 40 active students. Raise it in billing to add more."), true);
check("other FORBIDDEN is not", isStudentLimitError("FORBIDDEN: Unknown time zone"), false);
check("plain error is not", isStudentLimitError("That username is taken"), false);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
