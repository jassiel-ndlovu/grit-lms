/**
 * npx tsx scripts/check-attempt-deadline.ts
 *
 * The runner's clock, the pre-test warning and the auto-submit cron all use
 * attemptDeadline(); this pins the rule: an attempt ends at the EARLIER of
 * startedAt + timeLimit and the due date.
 */
import { attemptDeadline } from "../src/features/assessments/lib/attempt-deadline";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const t0 = Date.parse("2026-11-14T13:00:00Z");
const min = 60_000;

// The reported case: 120-minute test started at 13:00, due at 14:17. The
// clock used to read 43:00 left at 14:17 while the cron closed the attempt.
const reported = attemptDeadline({ startedAt: t0, timeLimit: 120, dueDate: t0 + 77 * min });
check("due date wins when it is earlier", reported.at === t0 + 77 * min && reported.reason === "dueDate");
check("flagged as cut short", reported.cutShort === true);

const plenty = attemptDeadline({ startedAt: t0, timeLimit: 60, dueDate: t0 + 5 * 24 * 60 * min });
check("time limit wins when due date is later", plenty.at === t0 + 60 * min && plenty.reason === "timeLimit" && !plenty.cutShort);

const exact = attemptDeadline({ startedAt: t0, timeLimit: 60, dueDate: t0 + 60 * min });
check("tie counts as time limit, not cut short", exact.at === t0 + 60 * min && !exact.cutShort);

const untimed = attemptDeadline({ startedAt: new Date(t0), timeLimit: null, dueDate: new Date(t0 + 10 * min) });
check("untimed test ends at the due date", untimed.at === t0 + 10 * min && untimed.reason === "dueDate" && !untimed.cutShort);

const none = attemptDeadline({ startedAt: t0, timeLimit: null, dueDate: null });
check("no limit and no due date never ends", none.at === null && none.reason === null);

const noDue = attemptDeadline({ startedAt: t0, timeLimit: 30, dueDate: undefined });
check("timed test with no due date ends at the limit", noDue.at === t0 + 30 * min);

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
