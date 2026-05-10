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
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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

import { createCourseEvent, updateCourseEvent } from "../actions";

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
    },
  });

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
