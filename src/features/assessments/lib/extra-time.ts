/**
 * Extra time on timed tests (owner decision 7): the choices a tutor picks
 * from and how they read. Pure, so the settings card, the pre-test page and
 * scripts/check-extra-time.ts share it.
 */

export const EXTRA_TIME_CHOICES = ["0", "25", "50", "100", "untimed"] as const;
export type ExtraTimeChoice = (typeof EXTRA_TIME_CHOICES)[number];

export const EXTRA_TIME_LABEL: Record<ExtraTimeChoice, string> = {
  "0": "None",
  "25": "+25% (1.25×)",
  "50": "+50% (1.5×)",
  "100": "+100% (2×)",
  untimed: "No time limit",
};

export interface ExtraTime {
  extraTimePercent: number;
  noTimeLimit: boolean;
}

export const NO_EXTRA_TIME: ExtraTime = { extraTimePercent: 0, noTimeLimit: false };

export function choiceToExtraTime(choice: ExtraTimeChoice): ExtraTime {
  return choice === "untimed" ? { extraTimePercent: 0, noTimeLimit: true } : { extraTimePercent: Number(choice), noTimeLimit: false };
}

/** The stored values as a choice; an unexpected percentage reads as None. */
export function extraTimeToChoice(e: ExtraTime | null | undefined): ExtraTimeChoice {
  if (!e) return "0";
  if (e.noTimeLimit) return "untimed";
  const c = String(e.extraTimePercent) as ExtraTimeChoice;
  return (EXTRA_TIME_CHOICES as readonly string[]).includes(c) ? c : "0";
}

export function hasExtraTime(e: ExtraTime | null | undefined): boolean {
  return !!e && (e.noTimeLimit || e.extraTimePercent > 0);
}

/** "45 min" or "37 min 30 s", for a limit that may be fractional. */
export function minutesLabel(minutes: number): string {
  const whole = Math.floor(minutes);
  const secs = Math.round((minutes - whole) * 60);
  return secs === 0 ? `${whole} min` : `${whole} min ${secs} s`;
}
