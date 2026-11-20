/**
 * Checks for the account screens' pure helpers (#174).
 * Run: npx tsx scripts/check-account-screens.ts
 */

import { actionError, parseEmails } from "../src/features/courses/lib/account-ui";

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
check("nothing", actionError(undefined), "Something went wrong. Try again.");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
