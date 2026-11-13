/**
 * When does a test attempt end?
 *
 * An attempt ends at the EARLIER of its time limit (startedAt + timeLimit)
 * and the test's due date. The auto-submit cron always enforced both, but
 * the runner's clock only counted the time limit, so a student who started
 * close to the due date watched "43:00" on the clock while the cron closed
 * the attempt underneath them. Every caller (cron, runner, pre-test page)
 * now asks this one function, so the clock and the cutoff can't disagree.
 */

export type DeadlineReason = "timeLimit" | "dueDate";

export interface AttemptDeadline {
  /** Epoch ms when the attempt closes, or null when nothing closes it. */
  at: number | null;
  /** Which limit wins. */
  reason: DeadlineReason | null;
  /** True when the due date ends the attempt before the time limit would. */
  cutShort: boolean;
}

export function attemptDeadline(input: {
  startedAt: Date | number;
  timeLimit: number | null | undefined;
  dueDate: Date | number | null | undefined;
}): AttemptDeadline {
  const start = typeof input.startedAt === "number" ? input.startedAt : input.startedAt.getTime();
  const limitEnd = input.timeLimit != null ? start + input.timeLimit * 60_000 : null;
  const due =
    input.dueDate == null
      ? null
      : typeof input.dueDate === "number"
        ? input.dueDate
        : input.dueDate.getTime();

  if (limitEnd == null && due == null) return { at: null, reason: null, cutShort: false };
  if (limitEnd == null) return { at: due, reason: "dueDate", cutShort: false };
  if (due == null || limitEnd <= due) return { at: limitEnd, reason: "timeLimit", cutShort: false };
  return { at: due, reason: "dueDate", cutShort: true };
}

/**
 * Grace the cron gives before force-submitting. The runner submits at zero
 * WITH the student's latest answers; the cron only flips the status on
 * whatever was last autosaved, so let the client win when it is online.
 */
export const AUTO_SUBMIT_GRACE_MS = 2 * 60_000;
