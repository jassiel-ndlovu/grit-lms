/**
 * Check extra time on timed tests (decision 7): npx tsx scripts/check-extra-time.ts
 */
import { attemptDeadline, effectiveTimeLimit } from "../src/features/assessments/lib/attempt-deadline";
import {
  EXTRA_TIME_CHOICES,
  choiceToExtraTime,
  extraTimeToChoice,
  hasExtraTime,
  minutesLabel,
} from "../src/features/assessments/lib/extra-time";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const MIN = 60_000;
const start = Date.UTC(2026, 10, 20, 8, 0);
const farDue = start + 24 * 60 * MIN;

check("no extra: unchanged", effectiveTimeLimit(30), 30);
check("+25%", effectiveTimeLimit(30, { extraTimePercent: 25 }), 37.5);
check("+50%", effectiveTimeLimit(40, { extraTimePercent: 50 }), 60);
check("+100%", effectiveTimeLimit(45, { extraTimePercent: 100 }), 90);
check("no time limit wins over a percent", effectiveTimeLimit(30, { extraTimePercent: 50, noTimeLimit: true }), null);
check("untimed test stays untimed", effectiveTimeLimit(null, { extraTimePercent: 50 }), null);
check("a negative percent is ignored", effectiveTimeLimit(30, { extraTimePercent: -10 }), 30);

check("deadline without extra (as before)", attemptDeadline({ startedAt: start, timeLimit: 30, dueDate: farDue }), {
  at: start + 30 * MIN, reason: "timeLimit", cutShort: false,
});
check("deadline with +50%", attemptDeadline({ startedAt: start, timeLimit: 30, dueDate: farDue, extraTimePercent: 50 }).at, start + 45 * MIN);
check("the due date still caps extra time", attemptDeadline({ startedAt: start, timeLimit: 60, dueDate: start + 70 * MIN, extraTimePercent: 100 }), {
  at: start + 70 * MIN, reason: "dueDate", cutShort: true,
});
check("no time limit: the due date closes it", attemptDeadline({ startedAt: start, timeLimit: 30, dueDate: farDue, noTimeLimit: true }), {
  at: farDue, reason: "dueDate", cutShort: false,
});
check("no time limit, no due date: nothing closes it", attemptDeadline({ startedAt: start, timeLimit: 30, dueDate: null, noTimeLimit: true }).at, null);

for (const c of EXTRA_TIME_CHOICES) check(`choice ${c} round-trips`, extraTimeToChoice(choiceToExtraTime(c)), c);
check("no row reads as None", extraTimeToChoice(undefined), "0");
check("an odd stored percent reads as None", extraTimeToChoice({ extraTimePercent: 33, noTimeLimit: false }), "0");
check("None is not extra time", hasExtraTime(choiceToExtraTime("0")), false);
check("untimed is extra time", hasExtraTime(choiceToExtraTime("untimed")), true);

check("whole minutes", minutesLabel(45), "45 min");
check("half a minute", minutesLabel(37.5), "37 min 30 s");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
