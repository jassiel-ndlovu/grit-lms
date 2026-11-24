"use client";

/**
 * A tutor's bookable hours: the weekly times, time off, and (owners and
 * admins) the workspace's booking rules. Times are the workspace's.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useReadOnly, WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBookingTimeOff, removeBookingTimeOff, setBookingAvailability, setBookingPolicyAction } from "@/features/booking/actions";

import {
  GAPS, lessonsIn, nextRow, parsePolicy, rowsFrom, rulesFrom, SLOT_LENGTHS, timeOffWarning, WEEK_ORDER, WEEKDAY_NAME,
  type BookingPolicy, type HoursRow, type HoursRule,
} from "../../lib/booking-ui";
import { addDays, wallToInstant } from "../../lib/calendar-ui";

const FAILED = "That didn't work. Try again.";
const ANY = "any";

/** The listed choices, plus the saved one when it isn't among them. */
const withSaved = (choices: readonly number[], saved: number) => (choices.includes(saved) ? choices : [...choices, saved].sort((a, b) => a - b));

export function HoursForm({
  membershipId, rules, courses,
}: {
  membershipId: string;
  rules: Array<HoursRule & { id: string }>;
  courses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [rows, setRows] = React.useState<HoursRow[]>(() => rowsFrom(rules));
  const [dirty, setDirty] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const made = React.useRef(0);

  const change = (next: HoursRow[]) => {
    setRows(next);
    setDirty(true);
    setError(null);
  };
  const edit = (key: string, patch: Partial<HoursRow>) => change(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (weekday: number) => change([...rows, nextRow(rows, weekday, `new${++made.current}`)]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = rulesFrom(rows);
    if ("error" in parsed) return setError(parsed.error);
    setPending(true);
    const r = await setBookingAvailability({ membershipId, rules: parsed.rules }).catch(() => null);
    setPending(false);
    if (!r?.data) return setError(r?.serverError ?? FAILED);
    setRows(rowsFrom(r.data.rules));
    setDirty(false);
    toast.success("Hours saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <ul className="divide-border border-border divide-y rounded-lg border">
        {WEEK_ORDER.map((wd) => {
          const day = WEEKDAY_NAME[wd];
          const list = rows.filter((r) => r.weekday === wd);
          return (
            <li key={wd} className="flex flex-col gap-2 p-4 md:flex-row md:gap-4">
              <div className="flex w-full items-center justify-between md:w-32 md:shrink-0 md:items-start md:pt-1.5">
                <h3 className="text-foreground text-sm font-medium">{day}</h3>
                <Button type="button" size="sm" variant="ghost" disabled={readOnly} className="md:hidden" aria-label={`Add a time on ${day}`} onClick={() => add(wd)}>
                  <Plus aria-hidden className="size-4" />
                  Add
                </Button>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {list.length === 0 ? <p className="text-muted-foreground text-sm md:pt-1.5">Not available</p> : null}
                {list.map((r) => {
                  const n = lessonsIn(r);
                  return (
                    <div key={r.key} className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Input type="time" required aria-label={`${day}: from`} className="h-9 w-28" value={r.start} disabled={readOnly} onChange={(e) => edit(r.key, { start: e.target.value })} />
                          <span className="text-muted-foreground text-sm">to</span>
                          <Input type="time" required aria-label={`${day}: to`} className="h-9 w-28" value={r.end} disabled={readOnly} onChange={(e) => edit(r.key, { end: e.target.value })} />
                        </div>
                        <Select value={String(r.slotMinutes)} onValueChange={(v) => edit(r.key, { slotMinutes: Number(v) })} disabled={readOnly}>
                          <SelectTrigger aria-label={`${day}: lesson length`} className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {withSaved(SLOT_LENGTHS, r.slotMinutes).map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {m} min each
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(r.bufferMinutes)} onValueChange={(v) => edit(r.key, { bufferMinutes: Number(v) })} disabled={readOnly}>
                          <SelectTrigger aria-label={`${day}: gap between lessons`} className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {withSaved(GAPS, r.bufferMinutes).map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {m === 0 ? "No gap" : `${m} min gap`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {courses.length > 0 ? (
                          <Select value={r.courseId ?? ANY} onValueChange={(v) => edit(r.key, { courseId: v === ANY ? null : v })} disabled={readOnly}>
                            <SelectTrigger aria-label={`${day}: course`} className="w-full max-w-48 sm:w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ANY}>Any course</SelectItem>
                              {courses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <span className="text-muted-foreground text-xs tabular-nums">{n === 1 ? "1 lesson" : `${n} lessons`}</span>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" disabled={readOnly} aria-label={`Remove ${day} ${r.start} to ${r.end}`} onClick={() => change(rows.filter((x) => x.key !== r.key))}>
                        <X aria-hidden className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button type="button" size="sm" variant="ghost" disabled={readOnly} className="hidden shrink-0 md:inline-flex" aria-label={`Add a time on ${day}`} onClick={() => add(wd)}>
                <Plus aria-hidden className="size-4" />
                Add
              </Button>
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <WriteGuard label="Save hours">
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            Save hours
          </Button>
        </WriteGuard>
        {dirty ? (
          <span role="status" className="text-muted-foreground text-xs">
            Not saved yet
          </span>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */

export type TimeOffRow = { id: string; label: string; note: string | null };

export function TimeOff({ membershipId, rows, timeZone, today }: { membershipId: string; rows: TimeOffRow[]; timeZone: string; today: string }) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  async function remove(id: string) {
    setRemoving(id);
    const r = await removeBookingTimeOff({ id }).catch(() => null);
    setRemoving(null);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    toast.success("Time off removed.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {warning ? (
        <p role="status" className="border-warning/40 bg-warning/5 text-foreground rounded-lg border px-4 py-3 text-sm">
          {warning}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No time off planned.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm">{t.label}</p>
                {t.note ? <p className="text-muted-foreground text-xs">{t.note}</p> : null}
              </div>
              <WriteGuard label="Remove">
                <Button type="button" size="sm" variant="ghost" disabled={removing !== null} aria-label={`Remove time off: ${t.label}`} onClick={() => remove(t.id)}>
                  {removing === t.id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
                  Remove
                </Button>
              </WriteGuard>
            </li>
          ))}
        </ul>
      )}
      <AddTimeOffButton membershipId={membershipId} timeZone={timeZone} today={today} onAdded={setWarning} />
    </div>
  );
}

function AddTimeOffButton({ membershipId, timeZone, today, onAdded }: { membershipId: string; timeZone: string; today: string; onAdded: (warning: string | null) => void }) {
  const router = useRouter();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [first, setFirst] = React.useState(today);
  const [last, setLast] = React.useState(today);
  const [allDay, setAllDay] = React.useState(true);
  const [from, setFrom] = React.useState("08:00");
  const [to, setTo] = React.useState("17:00");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!first || !last) return setError("Pick both days.");
    const startsAt = wallToInstant(first, allDay ? "00:00" : from, timeZone);
    const endsAt = allDay ? wallToInstant(addDays(last, 1), "00:00", timeZone) : wallToInstant(last, to, timeZone);
    if (!(endsAt > startsAt)) return setError("Time off must end after it starts.");
    setPending(true);
    setError(null);
    const r = await addBookingTimeOff({ membershipId, startsAt, endsAt, note: note.trim() || null }).catch(() => null);
    setPending(false);
    if (!r?.data) return setError(r?.serverError ?? FAILED);
    setOpen(false);
    onAdded(timeOffWarning(r.data.bookingsInside));
    toast.success("Time off added.");
    router.refresh();
  }

  return (
    <WriteGuard label="Add time off">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setFirst(today);
          setLast(today);
          setAllDay(true);
          setNote("");
          setError(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        Add time off
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Time off</DialogTitle>
              <DialogDescription>Nobody can book you then. Lessons already booked stay.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-f`}>First day</Label>
                <Input
                  id={`${id}-f`}
                  type="date"
                  required
                  min={today}
                  value={first}
                  onChange={(e) => {
                    setFirst(e.target.value);
                    if (last < e.target.value) setLast(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-l`}>Last day</Label>
                <Input id={`${id}-l`} type="date" required min={first || today} value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-a`} checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
              <Label htmlFor={`${id}-a`} className="font-normal">
                All day
              </Label>
            </div>
            {allDay ? null : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-ft`}>From</Label>
                  <Input id={`${id}-ft`} type="time" required value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-tt`}>To</Label>
                  <Input id={`${id}-tt`} type="time" required value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-n`}>Note (optional)</Label>
              <Input id={`${id}-n`} value={note} maxLength={200} placeholder="School holidays" onChange={(e) => setNote(e.target.value)} />
              <p className="text-muted-foreground text-xs">Families don&apos;t see it.</p>
            </div>
            {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

/* ------------------------------------------------------------------------- */

const POLICY_FIELDS: Array<{ key: keyof BookingPolicy; label: string; unit: string; help: string }> = [
  { key: "leadHours", label: "Book at least", unit: "hours before", help: "So tutors aren't booked at the last minute." },
  { key: "horizonDays", label: "Book up to", unit: "days ahead", help: "How far ahead families see free times." },
  { key: "cancelHours", label: "Cancel at least", unit: "hours before", help: "Later than this, the lesson doesn't go back on the pack." },
];

/** Owners and admins: for every tutor in the workspace. */
export function PolicyForm({ policy }: { policy: BookingPolicy }) {
  const router = useRouter();
  const id = React.useId();
  const readOnly = useReadOnly();
  const [form, setForm] = React.useState({ cancelHours: String(policy.cancelHours), leadHours: String(policy.leadHours), horizonDays: String(policy.horizonDays) });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePolicy(form);
    if ("error" in parsed) return setError(parsed.error);
    setPending(true);
    setError(null);
    const r = await setBookingPolicyAction(parsed.policy).catch(() => null);
    setPending(false);
    if (!r?.data) return setError(r?.serverError ?? FAILED);
    toast.success("Booking rules saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {POLICY_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${id}-${f.key}`}>{f.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-${f.key}`}
                inputMode="numeric"
                className="w-20"
                maxLength={3}
                value={form[f.key]}
                disabled={readOnly}
                aria-describedby={`${id}-${f.key}-h`}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
              <span className="text-muted-foreground text-sm">{f.unit}</span>
            </div>
            <p id={`${id}-${f.key}-h`} className="text-muted-foreground text-xs">
              {f.help}
            </p>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <WriteGuard label="Save rules">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
          Save rules
        </Button>
      </WriteGuard>
    </form>
  );
}
