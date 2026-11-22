/**
 * AttendanceHistory — a learner's attendance, read only (#149). Parents see
 * it per child on /dashboard/children/[userId] (A's `getAttendanceHistory`
 * with `childUserId`, the last 180 days). The rate counts present and late
 * out of marked sessions, leaving excused ones out.
 *
 * Server-safe.
 */

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { attendanceLabel, attendanceRate } from "../lib/calendar-ui";

export type HistoryRow = { eventId: string; title: string; courseName: string; occurrenceStart: string; status: string; note: string | null };

const DOT: Record<string, string> = {
  PRESENT: "bg-foreground",
  LATE: "bg-foreground/60",
  ABSENT: "bg-destructive",
  EXCUSED: "bg-muted-foreground/50",
};

export function AttendanceHistory({ rows, timeZone, locale, limit = 10, empty }: { rows: HistoryRow[]; timeZone: string; locale: string; limit?: number; empty: React.ReactNode }) {
  if (rows.length === 0) return <Card className="p-0">{empty}</Card>;
  const rate = attendanceRate(rows);
  const counts = (s: string) => rows.filter((r) => r.status === s).length;
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone });
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b px-4 py-3 sm:px-5">
        <p className="text-2xl font-semibold tabular-nums">{rate.percent != null ? `${rate.percent}%` : "–"}</p>
        <p className="text-muted-foreground text-sm">
          attended {rate.attended} of {rate.counted} {rate.counted === 1 ? "session" : "sessions"}
        </p>
        <p className="text-muted-foreground text-xs sm:ml-auto">
          {counts("LATE")} late · {counts("ABSENT")} absent · {counts("EXCUSED")} excused
        </p>
      </div>
      <ul className="divide-border divide-y">
        {rows.slice(0, limit).map((r) => (
          <li key={`${r.eventId}#${r.occurrenceStart}`} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[r.status] ?? "bg-muted")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {r.courseName} · {fmt.format(new Date(r.occurrenceStart))}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            <span className={cn("shrink-0 text-sm", r.status === "ABSENT" ? "text-destructive font-medium" : "text-muted-foreground")}>{attendanceLabel(r.status)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
