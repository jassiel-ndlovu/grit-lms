/**
 * Term reports, the pure parts (contracts/term-reports.md), checked by
 * scripts/check-term-reports.ts. The data is in ../term-reports.ts and A's
 * renderer in @/features/reports/term-report-pdf.
 */

import { addDays, dayIn, daysBetween, isDay } from "@/components/business/period";
import { isReleased, type GradeRelease } from "@/features/activity/lib/child-overview";
import { wallToInstant } from "@/features/events/lib/calendar-ui";

import { buildWeightPlan, computeStudentMark, type WeightedAssessment } from "./weighting";

export const reportRoutes = {
  home: "/dashboard/reports",
  term: (termId: string) => `/dashboard/reports/${termId}`,
  course: (termId: string, courseId: string) => `/dashboard/reports/${termId}/course/${courseId}`,
  student: (termId: string, learnerId: string) => `/dashboard/reports/${termId}/student/${learnerId}`,
  pdf: (termId: string, learnerId: string) => `/dashboard/reports/${termId}/student/${learnerId}/pdf`,
};

export const TERM_TITLE_MAX = 60;
/** About six lines of the PDF. */
export const COMMENT_MAX = 600;
/** A term is at most a year. */
export const TERM_MAX_DAYS = 366;

/* ───── The term ───── */

/** Why these days can't be a term, or null. */
export function termDaysError(startsOn: string, endsOn: string): string | null {
  if (!isDay(startsOn) || !isDay(endsOn)) return "Choose the first and last day";
  if (endsOn < startsOn) return "The last day is before the first";
  if (daysBetween(startsOn, endsOn) > TERM_MAX_DAYS) return "A term can be at most a year";
  return null;
}

/** "2026-07-21" from a date column, which Prisma reads as midnight UTC. */
export const dayOf = (date: Date) => date.toISOString().slice(0, 10);

export interface TermWindow {
  from: Date;
  /** The first instant after the term. */
  before: Date;
}

/** The term's days as instants in the workspace's time zone. */
export function termWindow(startsOn: string, endsOn: string, timeZone: string): TermWindow {
  return { from: wallToInstant(startsOn, "00:00", timeZone), before: wallToInstant(addDays(endsOn, 1), "00:00", timeZone) };
}

export const inTerm = (at: Date, w: TermWindow) => at >= w.from && at < w.before;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Is this enrolment on the term's report? Yes when it lasted to the end of
 * the term (or is still open), or for a week or more of it. Someone added
 * by mistake and taken off again isn't.
 */
export function countsInTerm(e: { startedAt: Date; endedAt: Date | null }, w: TermWindow): boolean {
  if (e.startedAt >= w.before || (e.endedAt && e.endedAt <= w.from)) return false;
  if (!e.endedAt || e.endedAt >= w.before) return true;
  return e.endedAt.getTime() - Math.max(e.startedAt.getTime(), w.from.getTime()) >= WEEK_MS;
}

export type TermPhase = "upcoming" | "running" | "ended";

export function termPhase(startsOn: string, endsOn: string, timeZone: string, now: Date): TermPhase {
  const today = dayIn(now, timeZone);
  return today < startsOn ? "upcoming" : today > endsOn ? "ended" : "running";
}

/* ───── Marks ───── */

export interface ReportAssessment extends WeightedAssessment {
  isActive: boolean;
}

export interface ReportGrade extends GradeRelease {
  assessmentId: string;
  score: number;
  outOf: number;
  updatedAt: Date;
}

export interface ReportItem {
  id: string;
  kind: "test" | "assignment";
  title: string;
  score: number | null;
  outOf: number;
}

/**
 * One student's course for a term: the assessments due in it, the released
 * marks, and the mark to date over them. The weights are the course's own,
 * so an assessment counts for the same against its neighbours as it does in
 * the gradebook. A draft, or work that isn't due and isn't marked, is left
 * out.
 */
export function courseReport(
  assessments: readonly ReportAssessment[],
  grades: readonly ReportGrade[],
  w: TermWindow,
  now: Date,
): { percent: number | null; items: ReportItem[] } {
  const released = new Map<string, ReportGrade>();
  for (const g of grades) {
    if (!isReleased(g) || g.outOf <= 0) continue;
    const before = released.get(g.assessmentId);
    if (!before || g.updatedAt > before.updatedAt) released.set(g.assessmentId, g);
  }
  // The whole course's plan, drafts too, as the gradebook builds it.
  const plan = buildWeightPlan([...assessments]);
  const shown = new Set(
    assessments.filter((a) => inTerm(a.dueDate, w) && (released.has(a.id) || (a.isActive && a.dueDate <= now))).map((a) => a.id),
  );
  const mark = computeStudentMark(
    { ...plan, assessments: plan.assessments.filter((a) => shown.has(a.id)) },
    [...released.values()].map((g) => ({ assessmentId: g.assessmentId, score: g.score, outOf: g.outOf })),
  );
  return {
    percent: mark.markToDate,
    items: mark.rows.map(({ assessment: a, result }) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      score: result?.score ?? null,
      outOf: result?.outOf ?? a.totalPoints,
    })),
  };
}

/**
 * South Africa's seven achievement levels, on CAPS and IEB courses. Rounded
 * first, as a school report prints whole percentages.
 */
export function achievementLevel(percent: number | null, curriculum: string | null): string | null {
  if (percent === null || (curriculum !== "CAPS" && curriculum !== "IEB")) return null;
  const p = Math.round(percent);
  return `Level ${p >= 80 ? 7 : p >= 70 ? 6 : p >= 60 ? 5 : p >= 50 ? 4 : p >= 40 ? 3 : p >= 30 ? 2 : 1}`;
}

/** The grade the student's courses share, or null when they differ. */
export function sharedGrade(levels: ReadonlyArray<number | null>): string | null {
  const set = new Set(levels.filter((l): l is number => l !== null));
  return set.size === 1 ? String([...set][0]) : null;
}

/* ───── Attendance ───── */

export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  excused: number;
}

export function countAttendance(statuses: readonly string[]): AttendanceCounts | null {
  if (statuses.length === 0) return null;
  const n = (s: string) => statuses.filter((x) => x === s).length;
  return { present: n("PRESENT"), late: n("LATE"), absent: n("ABSENT"), excused: n("EXCUSED") };
}

/** "8 present, 1 late, 1 absent". */
export function attendanceText(a: AttendanceCounts | null): string | null {
  if (!a) return null;
  return [`${a.present} present`, a.late ? `${a.late} late` : "", a.absent ? `${a.absent} absent` : "", a.excused ? `${a.excused} excused` : ""]
    .filter(Boolean)
    .join(", ");
}

/* ───── Words ───── */

const SWAPS: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"', "„": '"', // quotes
  "‐": "-", "‑": "-", "–": "-", "—": "-", "−": "-", "•": "-", // dashes and bullets
  "…": "...", " ": " ", " ": " ", " ": " ", "\t": " ",
  "≤": "<=", "≥": ">=", "≠": "not equal to", "√": "sqrt", "π": "pi", "€": "EUR",
  "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "ı": "i", "Œ": "OE", "œ": "oe",
};

/**
 * The PDF's font holds Western European characters; A's renderer prints the
 * rest as "?". Typographic marks get their plain form and other letters
 * lose their accents, so a Sepedi "š" reads "s". Emoji are dropped, and
 * a letter of another script stays "?".
 */
export function pdfText(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC").replace(/\r\n?/g, "\n")) {
    if (ch === "\n" || /[\x20-\x7E¡-ÿ]/.test(ch)) out += ch;
    else if (ch in SWAPS) out += SWAPS[ch];
    else {
      const plain = ch.normalize("NFD").replace(/\p{M}/gu, "");
      if (/^[\x20-\x7E]+$/.test(plain)) out += plain;
      else if (/[\p{L}\p{N}]/u.test(ch)) out += "?";
    }
  }
  return out.replace(/ {2,}/g, " ").trim();
}

/** "3 of 12 comments written". */
export const commentsText = (written: number, of: number) => `${written} of ${of} ${of === 1 ? "comment" : "comments"} written`;

export const percentText = (p: number | null) => (p === null ? "Not marked yet" : `${Math.round(p * 10) / 10}%`);
