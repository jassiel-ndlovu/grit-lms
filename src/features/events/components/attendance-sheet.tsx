"use client";

/**
 * AttendanceSheet — a tutor marks one session (#149, A's
 * `markAttendance`). One row per learner enrolled at the time; P, L, A, E
 * buttons save at once (optimistic, rolled back on error). "Mark the rest
 * present" fills the unmarked rows. A note per learner is optional. A new
 * Absent emails the learner's parents once (A's rule), so the toast says
 * when that happened.
 *
 * CheckInPanel opens or rotates a code learners type to mark themselves
 * (A's `openCheckIn`). The code is shown once, so it lives only here.
 *
 * Both lock in a read-only workspace.
 */

import * as React from "react";
import { CheckCheck, Loader2, MessageSquare, RefreshCw, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SaveState } from "@/components/ui/save-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { READ_ONLY_REASON, useReadOnly } from "@/components/shell/workspace-access";
import { markAttendance, openCheckIn } from "@/features/calendar/actions";
import { cn } from "@/lib/utils";

import { ATTENDANCE_STATUSES, attendanceRate, type AttendanceStatus } from "../lib/calendar-ui";

export type SheetLearner = { learnerId: string; name: string; status: AttendanceStatus | null; method: string | null; note: string | null };

const TONE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-foreground text-background border-foreground",
  LATE: "bg-foreground/70 text-background border-foreground/70",
  ABSENT: "bg-destructive text-destructive-foreground border-destructive",
  EXCUSED: "bg-muted-foreground text-background border-muted-foreground",
};

export function AttendanceSheet({ eventId, occurrenceStart, learners: initial }: { eventId: string; occurrenceStart: string; learners: SheetLearner[] }) {
  const readOnly = useReadOnly();
  const [rows, setRows] = React.useState(initial);
  const [saving, setSaving] = React.useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [noteFor, setNoteFor] = React.useState<string | null>(null);

  async function save(marks: Array<{ learnerId: string; status: AttendanceStatus; note?: string | null }>) {
    const before = rows;
    const ids = new Set(marks.map((m) => m.learnerId));
    setRows((rs) => rs.map((r) => {
      const m = marks.find((x) => x.learnerId === r.learnerId);
      return m ? { ...r, status: m.status, note: m.note !== undefined ? m.note : r.note, method: "TUTOR" } : r;
    }));
    setSaving((s) => new Set([...s, ...ids]));
    const res = await markAttendance({ eventId, occurrenceStart, marks });
    setSaving((s) => new Set([...s].filter((x) => !ids.has(x))));
    setSaveFailed(!res?.data);
    if (!res?.data) {
      setRows(before);
      toast.error(res?.serverError ?? "We couldn't save that. Check your connection and try again.");
      return;
    }
    setSavedAt(new Date());
    if (res.data.guardiansEmailed > 0) toast.message(`Parents emailed about ${res.data.guardiansEmailed === 1 ? "an absence" : "absences"}`);
  }

  const unmarked = rows.filter((r) => !r.status);
  const rate = attendanceRate(rows.filter((r) => r.status) as Array<{ status: string }>);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Nobody was on this course when the session took place.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {rows.length - unmarked.length} of {rows.length} marked
          {rate.percent != null ? ` · ${rate.attended} attended` : ""}
        </p>
        <SaveState kind={saving.size > 0 ? "saving" : saveFailed ? "failed" : savedAt ? "saved" : "idle"} at={savedAt} quiet className="mr-auto" />
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly || unmarked.length === 0}
          title={readOnly ? READ_ONLY_REASON : undefined}
          onClick={() => save(unmarked.map((r) => ({ learnerId: r.learnerId, status: "PRESENT" })))}
        >
          <CheckCheck aria-hidden className="size-4" />
          Mark the rest present
        </Button>
      </div>
      <Card className="divide-border gap-0 divide-y overflow-hidden p-0">
        {rows.map((r) => (
          <div key={r.learnerId} className="px-3 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-muted-foreground text-xs">
                  {r.status ? ATTENDANCE_STATUSES.find((s) => s.value === r.status)?.label : "Not marked"}
                  {r.method === "CHECK_IN_CODE" ? " · checked in" : ""}
                </p>
              </div>
              <div role="radiogroup" aria-label={`Attendance for ${r.name}`} className="flex gap-1">
                {ATTENDANCE_STATUSES.map((s) => {
                  const on = r.status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={s.label}
                      title={readOnly ? READ_ONLY_REASON : s.label}
                      disabled={readOnly}
                      onClick={() => !on && save([{ learnerId: r.learnerId, status: s.value }])}
                      className={cn(
                        "focus-visible:ring-ring size-9 rounded-md border text-sm font-semibold outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                        on ? TONE[s.value] : "border-input hover:bg-accent text-muted-foreground",
                      )}
                    >
                      {s.short}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label={`Note for ${r.name}`}
                  aria-expanded={noteFor === r.learnerId}
                  disabled={readOnly || !r.status}
                  title={!r.status ? "Mark first, then add a note" : "Note"}
                  onClick={() => setNoteFor((n) => (n === r.learnerId ? null : r.learnerId))}
                  className={cn(
                    "focus-visible:ring-ring text-muted-foreground hover:bg-accent grid size-9 place-items-center rounded-md outline-none focus-visible:ring-2 disabled:opacity-40",
                    r.note && "text-foreground",
                  )}
                >
                  <MessageSquare aria-hidden className="size-4" />
                </button>
              </div>
            </div>
            {noteFor === r.learnerId && r.status && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const note = String(new FormData(ev.currentTarget).get("note") ?? "").trim();
                  save([{ learnerId: r.learnerId, status: r.status!, note: note || null }]);
                  setNoteFor(null);
                }}
              >
                <Input name="note" defaultValue={r.note ?? ""} maxLength={300} placeholder="e.g. Doctor's appointment" aria-label={`Note for ${r.name}`} autoFocus />
                <Button type="submit" size="sm" variant="outline">
                  Save
                </Button>
              </form>
            )}
            {r.note && noteFor !== r.learnerId && <p className="text-muted-foreground mt-1 text-xs">Note: {r.note}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
}

export function CheckInPanel({ eventId, occurrenceStart, openUntil }: { eventId: string; occurrenceStart: string; openUntil: string | null }) {
  const readOnly = useReadOnly();
  const [minutes, setMinutes] = React.useState("15");
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [code]);

  async function open() {
    setBusy(true);
    const r = await openCheckIn({ eventId, occurrenceStart, minutes: Number(minutes) });
    setBusy(false);
    if (!r?.data) return toast.error(r?.serverError ?? "Couldn't open check-in");
    setCode(r.data);
    setNow(Date.now());
  }

  const left = code ? Math.max(0, Date.parse(code.expiresAt) - now) : 0;
  const expired = code != null && left === 0;
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <Card className="space-y-3 p-4">
      {code && !expired ? (
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground text-sm">Show this to the class</p>
          <p className="font-mono text-4xl font-semibold tracking-[0.25em] sm:text-5xl" aria-label={`Code ${code.code.split("").join(" ")}`}>
            {code.code}
          </p>
          <p className="text-muted-foreground text-sm tabular-nums" aria-live="off">
            Closes in {mmss}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {expired
            ? "That code has closed."
            : openUntil
              ? "A code is open. It was shown once: make a new one to show it again."
              : "Students can check themselves in with a code. After 10 minutes they're marked late. What you mark always replaces it."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={minutes} onValueChange={setMinutes} disabled={readOnly}>
          <SelectTrigger className="w-32" aria-label="How long the code stays open">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["5", "10", "15", "30", "60"].map((m) => (
              <SelectItem key={m} value={m}>
                {m} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={open} disabled={busy || readOnly} title={readOnly ? READ_ONLY_REASON : undefined}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : code || openUntil ? <RefreshCw className="size-4" /> : <ScanLine className="size-4" />}
          {code || openUntil ? "New code" : "Open check-in"}
        </Button>
      </div>
    </Card>
  );
}
