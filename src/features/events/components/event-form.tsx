"use client";

/**
 * EventForm — creates a course event, or edits one (#149).
 *
 * Times are wall times in the event's zone: a new event takes the tutor's
 * zone (`timeZone`, stored on CourseEvent.timeZone so a series repeats at
 * the same local time); an edit keeps its series' zone.
 *
 * Editing a repeating series at one occurrence offers A's scopes
 * (contracts/calendar.md): "This session" (an exception keyed by the
 * occurrence's original start) and "This and following" go through
 * `editCourseEventOccurrence` and send only what changed; "All sessions"
 * updates the series with `updateCourseEvent`, shifting its first start by
 * as much as this occurrence moved, and may change the repeat rule. A
 * one-off event is updated directly.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMeetingProvider } from "@/components/shell/workspace-access";
import { editCourseEventOccurrence } from "@/features/calendar/actions";
import { cn } from "@/lib/utils";

import { createCourseEvent, updateCourseEvent } from "../actions";
import { MEETING_PROVIDER_INFO, meetingProvider, splitInZone, wallToInstant } from "../lib/calendar-ui";
import { MeetingAppMark } from "./meeting-app-mark";
import { describeRecurrence, type RepeatFrequency } from "../lib/recurrence";

const WEEKDAYS: Array<{ value: number; short: string; label: string }> = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];

const LINK_RE = /^https?:\/\/\S+$/i;

const FormSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  description: z.string().default(""),
  type: z.enum(["LECTURE", "TEST", "REMINDER", "SUBMISSION", "LIVE", "EXAM", "MEETING", "HOLIDAY"]),
  date: z.string().min(1, "Required"),
  time: z.string().min(1, "Required"),
  duration: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 5 && Number(v) <= 24 * 60), "Between 5 and 1440 minutes"),
  location: z.string().max(200).optional().nullable(),
  link: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || LINK_RE.test(v.trim()), "Paste the full link, starting with https://"),

  /* Repeat. Kept as strings because they come straight off inputs. */
  repeatFrequency: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("NONE"),
  repeatInterval: z.string().default("1"),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  endMode: z.enum(["never", "on", "after"]).default("never"),
  repeatUntil: z.string().default(""),
  repeatCount: z.string().default(""),
});
type FormValues = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

export type EventType = FormValues["type"];
export type EditScope = "THIS" | "FOLLOWING" | "ALL";

/** The series row, as `getCourseEventSeries` returns it. */
export type EventSeries = {
  id: string;
  title: string;
  description: string;
  type: EventType;
  date: string;
  duration: number | null;
  location: string | null;
  link: string | null;
  timeZone: string;
  repeatFrequency: RepeatFrequency;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
};

/** The occurrence being edited, as the calendar shows it (with any "this one only" change applied). */
export type EditedOccurrence = {
  occurrenceStart: string;
  start: string;
  end: string | null;
  title: string;
  description: string | null;
  location: string | null;
  link: string | null;
};

export interface EventFormProps {
  courseId: string;
  /** The tutor's zone, for a new event. */
  timeZone: string;
  /** A new event's day (`YYYY-MM-DD`), e.g. the day the calendar shows. */
  initialDate?: string;
  /** Edit: the series. */
  series?: EventSeries;
  /** Edit at one occurrence (from the calendar). */
  occurrence?: EditedOccurrence;
  onSuccess?: () => void;
}

const SCOPES: Array<{ value: EditScope; label: string; hint: string }> = [
  { value: "THIS", label: "This session", hint: "Only this date changes." },
  { value: "FOLLOWING", label: "This and following", hint: "From this date on." },
  { value: "ALL", label: "All sessions", hint: "The whole series and its repeat rule." },
];

const TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: "LIVE", label: "Live session" },
  { value: "LECTURE", label: "Lesson" },
  { value: "MEETING", label: "Meeting" },
  { value: "REMINDER", label: "Reminder" },
  { value: "TEST", label: "Test" },
  { value: "EXAM", label: "Exam" },
  { value: "SUBMISSION", label: "Assignment" },
  { value: "HOLIDAY", label: "Holiday" },
];

function minutesBetween(a: string, b: string | null): number | null {
  if (!b) return null;
  const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000);
  return m > 0 ? m : null;
}

export function EventForm({ courseId, timeZone, initialDate, series, occurrence, onSuccess }: EventFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEdit = Boolean(series);
  const recurring = Boolean(series && series.repeatFrequency !== "NONE");
  const [scope, setScope] = React.useState<EditScope>(recurring && occurrence ? "THIS" : "ALL");
  const occurrenceOnly = recurring && Boolean(occurrence) && scope !== "ALL";
  const zone = series?.timeZone ?? timeZone;

  // The start the form opens with: this occurrence's, or the series'.
  const baseStart = occurrence?.start ?? series?.date ?? null;
  const baseDuration = occurrence ? (minutesBetween(occurrence.start, occurrence.end) ?? series?.duration ?? null) : (series?.duration ?? null);

  const [initial] = React.useState<FormValues>(() => {
    const split = baseStart ? splitInZone(baseStart, zone) : { date: initialDate ?? "", time: "" };
    return {
      title: occurrence?.title ?? series?.title ?? "",
      description: occurrence?.description ?? series?.description ?? "",
      type: series?.type ?? "LIVE",
      date: split.date,
      time: split.time,
      duration: baseDuration ? String(baseDuration) : "",
      location: occurrence?.location ?? series?.location ?? "",
      link: occurrence?.link ?? series?.link ?? "",
      repeatFrequency: series?.repeatFrequency ?? "NONE",
      repeatInterval: String(series?.repeatInterval ?? 1),
      repeatWeekdays: series?.repeatWeekdays ?? [],
      endMode: series?.repeatUntil ? "on" : series?.repeatCount != null ? "after" : "never",
      repeatUntil: series?.repeatUntil ? splitInZone(series.repeatUntil, zone).date : "",
      repeatCount: series?.repeatCount != null ? String(series.repeatCount) : "",
    };
  });

  const form = useForm<FormValues, unknown, FormOutput>({ resolver: zodResolver(FormSchema), defaultValues: initial });

  const repeatFrequency = form.watch("repeatFrequency");
  const repeatInterval = form.watch("repeatInterval");
  const repeatWeekdays = form.watch("repeatWeekdays");
  const endMode = form.watch("endMode");
  const repeatUntil = form.watch("repeatUntil");
  const repeatCount = form.watch("repeatCount");
  const provider = meetingProvider(form.watch("link")?.trim());
  // The workspace's provider (#211) picks the "New … meeting" button.
  const newProvider = useMeetingProvider();
  const newMeeting = MEETING_PROVIDER_INFO[newProvider];
  const repeats = repeatFrequency !== "NONE";

  const summary = React.useMemo(
    () =>
      describeRecurrence({
        repeatFrequency: repeatFrequency as RepeatFrequency,
        repeatInterval: Number(repeatInterval) || 1,
        repeatWeekdays: repeatWeekdays ?? [],
        repeatUntil: endMode === "on" && repeatUntil ? new Date(repeatUntil) : null,
        repeatCount: endMode === "after" && repeatCount ? Number(repeatCount) : null,
      }),
    [repeatFrequency, repeatInterval, repeatWeekdays, endMode, repeatUntil, repeatCount],
  );

  function toggleWeekday(day: number) {
    const current = form.getValues("repeatWeekdays") ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
    form.setValue("repeatWeekdays", next, { shouldDirty: true });
  }

  async function onSubmit(values: FormOutput) {
    setPending(true);
    try {
      const start = wallToInstant(values.date, values.time, zone);
      const duration = values.duration ? Number(values.duration) : null;
      const location = values.location?.trim() ? values.location.trim() : null;
      const link = values.link?.trim() ? values.link.trim() : null;

      if (series && occurrence && occurrenceOnly) {
        // "This session" or "This and following": send only what changed.
        const changes: { title?: string; description?: string; start?: string; duration?: number; location?: string | null; link?: string | null } = {};
        if (values.title !== initial.title) changes.title = values.title;
        if ((values.description ?? "") !== (initial.description ?? "")) changes.description = values.description ?? "";
        if (start.getTime() !== Date.parse(baseStart!)) changes.start = start.toISOString();
        if (duration != null && duration !== baseDuration) changes.duration = duration;
        if (location !== (initial.location || null)) changes.location = location;
        if (link !== (initial.link || null)) changes.link = link;
        if (Object.keys(changes).length > 0) {
          const r = await editCourseEventOccurrence({ eventId: series.id, occurrenceStart: occurrence.occurrenceStart, scope, changes });
          if (r?.serverError || r?.validationErrors) throw new Error(r.serverError ?? "Check the form and try again");
          toast.success(scope === "THIS" ? "Session updated" : "This and following sessions updated");
        }
      } else {
        const repeatsNow = values.repeatFrequency !== "NONE";
        // "All sessions" from one occurrence: shift the series by as much as this one moved.
        const date = series && occurrence ? new Date(Date.parse(series.date) + (start.getTime() - Date.parse(baseStart!))) : start;
        const payload = {
          title: values.title,
          description: values.description ?? "",
          type: values.type,
          date,
          duration,
          location,
          link: link ?? "",
          repeatFrequency: values.repeatFrequency,
          repeatInterval: Number(values.repeatInterval) || 1,
          // Weekdays only mean anything for a weekly series.
          repeatWeekdays: values.repeatFrequency === "WEEKLY" ? (values.repeatWeekdays ?? []) : [],
          // End of the chosen day in the event's zone, so a session on that day counts.
          repeatUntil: repeatsNow && values.endMode === "on" && values.repeatUntil ? wallToInstant(values.repeatUntil, "23:59:59", zone) : null,
          repeatCount: repeatsNow && values.endMode === "after" && values.repeatCount ? Number(values.repeatCount) : null,
          timeZone: zone,
        };
        const r = series ? await updateCourseEvent({ id: series.id, ...payload }) : await createCourseEvent({ ...payload, courseId });
        if (r?.serverError || r?.validationErrors) throw new Error(r.serverError ?? "Check the form and try again");
        toast.success(series ? (recurring ? "All sessions updated" : "Session updated") : "Session created");
      }
      onSuccess?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {recurring && occurrence && (
          <fieldset>
            <legend className="text-foreground mb-2 text-sm font-medium">Change</legend>
            <div role="radiogroup" aria-label="Which sessions to change" className="grid gap-2 sm:grid-cols-3">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={scope === s.value}
                  onClick={() => setScope(s.value)}
                  className={cn(
                    "focus-visible:ring-ring rounded-md border p-2.5 text-left text-sm outline-none focus-visible:ring-2",
                    scope === s.value ? "border-foreground bg-accent" : "border-input hover:bg-accent/50",
                  )}
                >
                  <span className="block font-medium">{s.label}</span>
                  <span className="text-muted-foreground block text-xs">{s.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Grade 11 maths: functions" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!occurrenceOnly && (
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Live sessions, lessons and meetings take attendance.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="text-muted-foreground text-xs">Times are in {zone.replace(/_/g, " ")}.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Length (minutes)</FormLabel>
                <FormControl>
                  <Input type="number" min={5} max={1440} placeholder="60" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormDescription>Optional. Leave empty for all day.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place</FormLabel>
                <FormControl>
                  <Input placeholder="Room 12, or online" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meeting link</FormLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <FormControl>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                {newMeeting.newUrl ? (
                  <Button type="button" variant="outline" className="shrink-0" onClick={() => window.open(newMeeting.newUrl!, "_blank", "noopener")}>
                    <MeetingAppMark provider={newProvider} className="size-4" />
                    {newMeeting.newLabel}
                  </Button>
                ) : null}
              </div>
              <FormDescription>
                {provider ? `${provider} link. ` : ""}Paste a Meet, Zoom or Teams link. Learners get a Join button 15 minutes before the start.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="What to bring, what we'll cover" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!occurrenceOnly && (
          <>
            <Separator />
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="repeatFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Repeat className="size-4" /> Repeat
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">Does not repeat</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {repeats && (
                <div className="border-border space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="repeatInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Every</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input type="number" min={1} max={52} className="w-20 tabular-nums" {...field} />
                          </FormControl>
                          <span className="text-muted-foreground text-sm">
                            {repeatFrequency === "DAILY"
                              ? "day(s)"
                              : repeatFrequency === "WEEKLY"
                                ? "week(s)"
                                : repeatFrequency === "MONTHLY"
                                  ? "month(s)"
                                  : "year(s)"}
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {repeatFrequency === "WEEKLY" && (
                    <FormItem>
                      <FormLabel>On these days</FormLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((d) => {
                          const on = (repeatWeekdays ?? []).includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleWeekday(d.value)}
                              aria-pressed={on}
                              aria-label={d.label}
                              className={cn(
                                "size-9 rounded-full border text-sm",
                                on ? "border-foreground bg-foreground text-background font-medium" : "border-input hover:bg-accent",
                              )}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                      <FormDescription>None picked: the same weekday as the start date.</FormDescription>
                    </FormItem>
                  )}

                  <FormField
                    control={form.control}
                    name="endMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ends</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="on">On a date</SelectItem>
                            <SelectItem value="after">After a number of sessions</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {endMode === "on" && (
                    <FormField
                      control={form.control}
                      name="repeatUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {endMode === "after" && (
                    <FormField
                      control={form.control}
                      name="repeatCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of sessions</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={365} className="w-28 tabular-nums" placeholder="10" {...field} />
                          </FormControl>
                          <FormDescription>Counts the first session.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {summary && <p className="text-muted-foreground border-t pt-3 text-xs">{summary}.</p>}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create session"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
