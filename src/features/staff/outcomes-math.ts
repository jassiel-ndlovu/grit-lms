/**
 * Per-tutor outcomes (#216 phase 3): the pure arithmetic, covered by
 * scripts/check-outcomes.ts. ./outcomes.ts gathers the rows.
 */

export type OutcomeInput = {
  courses: number;
  activeStudents: number;
  /** Marks in the period, by student, oldest first per student. */
  marks: Array<{ student: string; at: Date; percent: number }>;
  /** Work due in the period × enrolled students, and how many were handed in. */
  workExpected: number;
  workHandedIn: number;
  attendance: Array<{ status: string }>;
  riskOpened: number;
  riskResolved: number;
  approvedMinutes: number;
  bookingsCompleted: number;
  bookingsNoShow: number;
};

export type TutorOutcomes = {
  courses: number;
  activeStudents: number;
  marks: number;
  averagePercent: number | null;
  /** Average of (last − first) per student with two or more marks, in percentage points. */
  averageChange: number | null;
  studentsImproving: number;
  studentsDeclining: number;
  completionRate: number | null;
  attendanceRate: number | null;
  riskOpened: number;
  riskResolved: number;
  hours: number;
  bookingsCompleted: number;
  bookingsNoShow: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeOutcomes(i: OutcomeInput): TutorOutcomes {
  const by = new Map<string, Array<{ at: Date; percent: number }>>();
  for (const m of i.marks) by.set(m.student, [...(by.get(m.student) ?? []), m]);
  const changes: number[] = [];
  for (const list of by.values()) {
    if (list.length < 2) continue;
    const s = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
    changes.push(s[s.length - 1].percent - s[0].percent);
  }
  const counted = i.attendance.filter((a) => a.status !== "EXCUSED");
  const present = counted.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  return {
    courses: i.courses,
    activeStudents: i.activeStudents,
    marks: i.marks.length,
    averagePercent: i.marks.length ? r1(i.marks.reduce((n, m) => n + m.percent, 0) / i.marks.length) : null,
    averageChange: changes.length ? r1(changes.reduce((a, b) => a + b, 0) / changes.length) : null,
    // A change of 5 points or more either way counts.
    studentsImproving: changes.filter((c) => c >= 5).length,
    studentsDeclining: changes.filter((c) => c <= -5).length,
    completionRate: i.workExpected > 0 ? r1((Math.min(i.workHandedIn, i.workExpected) / i.workExpected) * 100) : null,
    attendanceRate: counted.length ? r1((present / counted.length) * 100) : null,
    riskOpened: i.riskOpened,
    riskResolved: i.riskResolved,
    hours: r1(i.approvedMinutes / 60),
    bookingsCompleted: i.bookingsCompleted,
    bookingsNoShow: i.bookingsNoShow,
  };
}

/** YYYY-MM months that overlap [from, to) (UTC months; timesheets are near enough). */
export function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear(), m = from.getUTCMonth();
  while (Date.UTC(y, m, 1) < to.getTime()) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m === 12) { m = 0; y++; }
    if (out.length > 36) break;
  }
  return out;
}
