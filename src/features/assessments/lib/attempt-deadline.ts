/**
 * When does a test attempt end?
 *
 * An attempt ends at the EARLIER of its time limit (startedAt + timeLimit)
 * and the test's due date. The auto-submit cron always enforced both, but
 * the runner's clock only counted the time limit, so a student who started
 * close to the due date watched "43:00" on the clock while the cron closed
 * the attempt underneath them. Every caller (cron, runner, pre-test page)
 * now asks this one function, so the clock and the cutoff can't disagree.
 *
 * A student's extra time (TimeAccommodation, copied onto the attempt)
 * stretches the time limit, or removes it. The due date still closes the
 * test for everyone; a tutor who wants more extends the due date.
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
  /** The attempt's extra time, as a share of the limit (25 = +25%). */
  extraTimePercent?: number | null;
  /** The attempt has no time limit (an accommodation). */
  noTimeLimit?: boolean | null;
}): AttemptDeadline {
  const start = typeof input.startedAt === "number" ? input.startedAt : input.startedAt.getTime();
  const minutes = effectiveTimeLimit(input.timeLimit, input);
  const limitEnd = minutes != null ? start + minutes * 60_000 : null;
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
 * Whether a test can still be begun. It closes at its due date for everyone
 * (extra time never moves it); an attempt already begun is a separate matter.
 * Asked by the pre-test page and by startTestSubmission, so they agree.
 */
export function closedToStart(dueDate: Date | number | null | undefined, now: Date | number): boolean {
  return dueDate != null && Number(now) >= Number(dueDate);
}

/**
 * Grace the cron gives before force-submitting. The runner submits at zero
 * WITH the student's latest answers; the cron only flips the status on
 * whatever was last autosaved, so let the client win when it is online.
 */
export const AUTO_SUBMIT_GRACE_MS = 2 * 60_000;

/**
 * The time limit in minutes once a student's extra time is applied, or null
 * when the attempt is untimed. May be fractional: 30 minutes +25% is 37.5.
 */
export function effectiveTimeLimit(
  timeLimit: number | null | undefined,
  extra: { extraTimePercent?: number | null; noTimeLimit?: boolean | null } = {},
): number | null {
  if (timeLimit == null || extra.noTimeLimit) return null;
  const pct = Math.max(0, extra.extraTimePercent ?? 0);
  return (timeLimit * (100 + pct)) / 100;
}
