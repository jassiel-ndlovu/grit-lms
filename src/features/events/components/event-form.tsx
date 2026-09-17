"use client";

/**
 * EventForm — single client form for creating or editing a CourseEvent.
 *
 * Mode is determined by `defaultValues.id`:
 *   - present  → calls updateCourseEvent
 *   - absent   → calls createCourseEvent
 *
 * Date is split across a date input and a time input for usability;
 * the form merges them into a single ISO timestamp before submitting.
 *
 * Repeat settings mirror the columns on CourseEvent. Only the first
 * occurrence is stored; the calendar derives the rest via
 * features/events/lib/recurrence.ts. A series ends either on a date or
 * after N occurrences - the form makes that an explicit either/or so the
 * two can't contradict each other.
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Separator } from "@/components/ui/separator";

import { createCourseEvent, updateCourseEvent } from "../actions";
import { describeRecurrence, type RepeatFrequency } from "../lib/recurrence";

const WEEKDAYS: Array<{ value: number; short: string; label: string }> = [
  { value: 0, short: "S", label: "Sunday" },
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
];



const FormSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Required").max(200),
  description: z.string().default(""),
  type: z.enum([
    "LECTURE",
    "TEST",
    "REMINDER",
    "SUBMISSION",
    "LIVE",
    "EXAM",
    "MEETING",
    "HOLIDAY",
  ]),
  date: z.string().min(1, "Required"),
  time: z.string().min(1, "Required"),
  duration: z.string().optional(),
  location: z.string().optional().nullable(),
  link: z.string().optional().nullable(),

  /* Repeat. Kept as strings because they come straight off inputs. */
  repeatFrequency: z
    .enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
    .default("NONE"),
  repeatInterval: z.string().default("1"),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  endMode: z.enum(["never", "on", "after"]).default("never"),
  repeatUntil: z.string().default(""),
  repeatCount: z.string().default(""),
});
type FormValues = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

export interface EventFormProps {
  courseId: string;
  defaultValues?: Partial<{
    id: string;
    title: string;
    description: string;
    type: FormValues["type"];
    date: Date;
    duration: number | null;
    location: string | null;
    link: string | null;
    repeatFrequency: RepeatFrequency;
    repeatInterval: number;
    repeatWeekdays: number[];
    repeatUntil: Date | null;
    repeatCount: number | null;
  }>;
  onSuccess?: () => void;
}

function splitDate(d: Date | undefined): { date: string; time: string } {
  if (!d) {
    return { date: "", time: "" };
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

export function EventForm({
  courseId,
  defaultValues,
  onSuccess,
}: EventFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const split = splitDate(defaultValues?.date);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id: defaultValues?.id,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      type: defaultValues?.type ?? "LECTURE",
      date: split.date,
      time: split.time,
      duration: defaultValues?.duration ? String(defaultValues.duration) : "",
      location: defaultValues?.location ?? "",
      link: defaultValues?.link ?? "",
      repeatFrequency: defaultValues?.repeatFrequency ?? "NONE",
      repeatInterval: String(defaultValues?.repeatInterval ?? 1),
      repeatWeekdays: defaultValues?.repeatWeekdays ?? [],
      endMode: defaultValues?.repeatUntil
        ? "on"
        : defaultValues?.repeatCount != null
          ? "after"
          : "never",
      repeatUntil: defaultValues?.repeatUntil
        ? splitDate(defaultValues.repeatUntil).date
        : "",
      repeatCount:
        defaultValues?.repeatCount != null
          ? String(defaultValues.repeatCount)
          : "",
    },
  });

  // Watched so the repeat panel can show/hide its dependent controls and
  // render a live plain-English summary of the rule.
  const repeatFrequency = form.watch("repeatFrequency");
  const repeatInterval = form.watch("repeatInterval");
  const repeatWeekdays = form.watch("repeatWeekdays");
  const endMode = form.watch("endMode");
  const repeatUntil = form.watch("repeatUntil");
  const repeatCount = form.watch("repeatCount");
  const repeats = repeatFrequency !== "NONE";

  const summary = React.useMemo(
    () =>
      describeRecurrence({
        repeatFrequency: repeatFrequency as RepeatFrequency,
        repeatInterval: Number(repeatInterval) || 1,
        repeatWeekdays: repeatWeekdays ?? [],
        repeatUntil:
          endMode === "on" && repeatUntil ? new Date(repeatUntil) : null,
        repeatCount:
          endMode === "after" && repeatCount ? Number(repeatCount) : null,
      }),
    [repeatFrequency, repeatInterval, repeatWeekdays, endMode, repeatUntil, repeatCount],
  );

  function toggleWeekday(day: number) {
    const current = form.getValues("repeatWeekdays") ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    form.setValue("repeatWeekdays", next, { shouldDirty: true });
  }

  const isEdit = Boolean(defaultValues?.id);

  async function onSubmit(values: FormOutput) {
    setPending(true);
    try {
      // Combine date + time into a single Date in the user's local timezone.
      const merged = new Date(`${values.date}T${values.time}`);

      const durationNum =
        values.duration && values.duration.length > 0
          ? Number(values.duration)
          : null;

      const payload = {
        title: values.title,
        description: values.description ?? "",
        type: values.type,
        date: merged,
        duration: durationNum,
        location:
          values.location && values.location.length > 0
            ? values.location
            : null,
        link:
          values.link && values.link.length > 0 ? values.link : "",

        repeatFrequency: values.repeatFrequency,
        repeatInterval: Number(values.repeatInterval) || 1,
        // Weekday selection only means anything for a weekly series; send
        // an empty list otherwise so a leftover selection from a frequency
        // the tutor changed their mind about can't survive the save.
        repeatWeekdays:
          values.repeatFrequency === "WEEKLY" ? (values.repeatWeekdays ?? []) : [],
        repeatUntil:
          values.repeatFrequency !== "NONE" &&
          values.endMode === "on" &&
          values.repeatUntil
            ? // End of the chosen day, so an occurrence ON that day counts.
              new Date(`${values.repeatUntil}T23:59:59`)
            : null,
        repeatCount:
          values.repeatFrequency !== "NONE" &&
          values.endMode === "after" &&
          values.repeatCount
            ? Number(values.repeatCount)
            : null,
      };

      if (isEdit && values.id) {
        const result = await updateCourseEvent({ id: values.id, ...payload });
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Event updated");
      } else {
        const result = await createCourseEvent({ ...payload, courseId });
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Event created");
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
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Lesson 3 — Calculus review" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  <SelectItem value="LECTURE">Lecture</SelectItem>
                  <SelectItem value="LIVE">Live session</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="REMINDER">Reminder</SelectItem>
                  <SelectItem value="TEST">Test</SelectItem>
                  <SelectItem value="EXAM">Exam</SelectItem>
                  <SelectItem value="SUBMISSION">Assignment</SelectItem>
                  <SelectItem value="HOLIDAY">Holiday</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="60"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Optional — leave empty for all-day.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Room 12 / online"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
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
              <FormLabel>Link</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Notes, agenda, etc."
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* ───── Repeat ───── */}
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
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          className="w-20 tabular-nums"
                          {...field}
                        />
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
                          className={
                            on
                              ? "border-brand-terracotta bg-brand-terracotta text-brand-terracotta-foreground size-9 rounded-full border text-sm font-medium"
                              : "border-input hover:border-brand-terracotta/50 size-9 rounded-full border text-sm"
                          }
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                  <FormDescription>
                    Leave all unselected to repeat on the same weekday as the
                    start date.
                  </FormDescription>
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
                        <SelectItem value="after">
                          After a number of occurrences
                        </SelectItem>
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
                      <FormLabel>End date</FormLabel>
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
                      <FormLabel>Number of occurrences</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          className="w-28 tabular-nums"
                          placeholder="10"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Counts the first occurrence.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {summary && (
                <p className="text-muted-foreground border-t pt-3 text-xs">
                  {summary}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
