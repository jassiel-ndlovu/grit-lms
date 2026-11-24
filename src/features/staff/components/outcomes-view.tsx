/**
 * A tutor's outcomes as readable figures (viewer.md "Tutor outcomes and
 * reviews"). Server component. Null means "no data", never 0.
 */

import type { TutorOutcomes } from "../outcomes-math";

const pct = (n: number | null) => (n == null ? "No data" : `${n}%`);
const pts = (n: number | null) => (n == null ? "No data" : `${n > 0 ? "+" : ""}${n} points`);

export function outcomeRows(o: TutorOutcomes): Array<{ label: string; value: string; hint: string }> {
  return [
    { label: "Courses", value: String(o.courses), hint: "Courses they teach or own" },
    { label: "Active students", value: String(o.activeStudents), hint: "On those courses now" },
    { label: "Average mark", value: pct(o.averagePercent), hint: `Across ${o.marks} mark${o.marks === 1 ? "" : "s"} in the period` },
    { label: "Change in marks", value: pts(o.averageChange), hint: "Each student's last mark minus their first, averaged" },
    { label: "Improving or slipping", value: `${o.studentsImproving} up, ${o.studentsDeclining} down`, hint: "Students who moved 5 points or more" },
    { label: "Work handed in", value: pct(o.completionRate), hint: "Hand-ins against work that was due" },
    { label: "Attendance", value: pct(o.attendanceRate), hint: "Present or late, out of classes not excused" },
    { label: "At-risk alerts", value: `${o.riskOpened} raised, ${o.riskResolved} sorted`, hint: "Students flagged as needing help" },
    { label: "Hours", value: String(o.hours), hint: "From approved timesheets" },
    { label: "Booked lessons", value: `${o.bookingsCompleted} taught, ${o.bookingsNoShow} missed`, hint: "One-to-one bookings" },
  ];
}

export function OutcomesGrid({ outcomes }: { outcomes: TutorOutcomes }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {outcomeRows(outcomes).map((r) => (
        <div key={r.label} className="border-border rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">{r.label}</dt>
          <dd className="text-foreground text-lg font-semibold tabular-nums">{r.value}</dd>
          <dd className="text-muted-foreground text-xs">{r.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
