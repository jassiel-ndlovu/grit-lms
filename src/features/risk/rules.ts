/**
 * At-risk rules (#216 phase 2, Pro). Pure: scripts/check-risk-rules.ts
 * covers them. The daily job (./evaluate.ts) gathers each enrolled
 * student's recent marks, missed work and attendance for a course and asks
 * `assessRisk` whether to raise, update or clear an alert.
 *
 * Provisional thresholds, to be tuned with tutors.
 */

export const RISK_RULES = {
  /** How far back missed work and attendance are counted. */
  windowDays: 28,
  /** How far back marks are read (for the "falling" comparison). */
  marksLookbackDays: 120,
  /** Recent marks: the last N. */
  recentCount: 3,
  /** Earlier marks to compare with: up to N before the recent ones. */
  earlierCount: 5,
  /** A fall of this many percentage points or more. */
  fallPoints: 15,
  /** Recent average below this is low. */
  lowPercent: 50,
  /** Recent average below this is serious. */
  seriousPercent: 40,
  /** Missed pieces of work in the window. */
  missedWatch: 2,
  missedSerious: 3,
  /** Unexcused absences in the window. */
  absentWatch: 2,
  absentSerious: 3,
  /** Or attendance below this share, over at least `minSessions`. */
  attendanceShare: 0.75,
  minSessions: 4,
  /** A dismissed alert keeps quiet for this long. */
  quietDays: 14,
} as const;

export type RiskLevel = "WATCH" | "AT_RISK";
export type RiskReason =
  | { rule: "FALLING_MARKS"; from: number; to: number }
  | { rule: "LOW_MARKS"; average: number; count: number }
  | { rule: "MISSED_WORK"; count: number; titles: string[]; since: string }
  | { rule: "ABSENCES"; absent: number; sessions: number };

export type RiskInput = {
  now: Date;
  /** Marked work, any order: percent 0–100 and when it was marked. */
  marks: Array<{ at: Date; percent: number }>;
  /** Work whose last due date passed inside the window without a hand-in. */
  missed: Array<{ title: string; dueAt: Date }>;
  /** Sessions inside the window. */
  attendance: Array<{ status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" }>;
};

export type RiskResult = { level: RiskLevel; reasons: RiskReason[] } | null;

const round = (n: number) => Math.round(n);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function assessRisk(input: RiskInput): RiskResult {
  const R = RISK_RULES;
  const reasons: RiskReason[] = [];
  let serious = false;

  const marks = [...input.marks].filter((m) => Number.isFinite(m.percent)).sort((a, b) => a.at.getTime() - b.at.getTime());
  if (marks.length >= 2) {
    const recent = marks.slice(-R.recentCount).map((m) => m.percent);
    const recentAvg = avg(recent);
    const earlier = marks.slice(0, -R.recentCount).slice(-R.earlierCount).map((m) => m.percent);
    if (recent.length === R.recentCount && earlier.length >= 1 && avg(earlier) - recentAvg >= R.fallPoints) {
      reasons.push({ rule: "FALLING_MARKS", from: round(avg(earlier)), to: round(recentAvg) });
    }
    if (recentAvg < R.lowPercent) {
      reasons.push({ rule: "LOW_MARKS", average: round(recentAvg), count: recent.length });
      if (recentAvg < R.seriousPercent) serious = true;
    }
  }

  if (input.missed.length >= R.missedWatch) {
    const sorted = [...input.missed].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    reasons.push({ rule: "MISSED_WORK", count: sorted.length, titles: sorted.slice(0, 5).map((m) => m.title), since: sorted[0].dueAt.toISOString() });
    if (sorted.length >= R.missedSerious) serious = true;
  }

  const counted = input.attendance.filter((a) => a.status !== "EXCUSED");
  const absent = counted.filter((a) => a.status === "ABSENT").length;
  const lowShare = counted.length >= R.minSessions && (counted.length - absent) / counted.length < R.attendanceShare;
  if (absent >= R.absentWatch || lowShare) {
    reasons.push({ rule: "ABSENCES", absent, sessions: counted.length });
    if (absent >= R.absentSerious) serious = true;
  }

  if (!reasons.length) return null;
  const distinct = new Set(reasons.map((r) => (r.rule === "LOW_MARKS" || r.rule === "FALLING_MARKS" ? "MARKS" : r.rule))).size;
  return { level: serious || distinct >= 2 ? "AT_RISK" : "WATCH", reasons };
}

/** What the job does with a student given the open alert (if any) and a quiet period. */
export function nextStep(
  result: RiskResult,
  open: { level: RiskLevel } | null,
  quietUntil: Date | null,
  now: Date,
): "open" | "update" | "escalate" | "resolve" | "none" {
  if (!result) return open ? "resolve" : "none";
  if (!open) return quietUntil && quietUntil > now ? "none" : "open";
  return open.level === "WATCH" && result.level === "AT_RISK" ? "escalate" : "update";
}

const ZONE = "Africa/Johannesburg";
const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: ZONE, day: "numeric", month: "long" }).format(new Date(iso));
const listTitles = (t: string[]) => (t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The plain-language summary staff see and may share: one sentence per
 * reason, about the student by first name. No judgement words, only facts.
 */
export function riskSummary(studentName: string, courseName: string, reasons: RiskReason[]): string {
  const first = studentName.trim().split(/\s+/)[0] || "This student";
  const lines = reasons.map((r) => {
    switch (r.rule) {
      case "FALLING_MARKS":
        return `${first}'s marks in ${courseName} have dropped from an average of ${r.from}% to ${r.to}% over the last ${RISK_RULES.recentCount} assessments.`;
      case "LOW_MARKS":
        return `${first}'s last ${plural(r.count, "mark")} in ${courseName} average ${r.average}%.`;
      case "MISSED_WORK":
        return `${first} hasn't handed in ${plural(r.count, "piece")} of ${courseName} work due since ${dateLabel(r.since)}${r.titles.length ? `: ${listTitles(r.titles)}${r.count > r.titles.length ? " and more" : ""}` : ""}.`;
      case "ABSENCES":
        return `${first} was absent from ${r.absent} of the last ${plural(r.sessions, `${courseName} session`)}.`;
    }
  });
  // FALLING already says the recent average; drop LOW's sentence when both fire.
  const falling = reasons.some((r) => r.rule === "FALLING_MARKS");
  return lines.filter((_, i) => !(falling && reasons[i].rule === "LOW_MARKS")).join(" ");
}
