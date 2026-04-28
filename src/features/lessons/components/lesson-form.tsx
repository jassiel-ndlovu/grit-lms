"use client";

/**
 * LessonForm — single form used for both Create and Update flows.
 *
 * Mode is determined by `defaultValues.id`:
 *   - present  → calls updateLesson
 *   - absent   → calls createLesson
 *
 * The same Zod schema runs client-side (via zodResolver) and server-side
 * inside the Server Action — single source of truth.
 *
 * Attachments and video URLs are managed by their dedicated controlled
 * sub-components (AttachmentManager, VideoUrlList). The form composes them
 * via RHF FormFields so all state lives in one place and `handleSubmit`
 * captures the full input atomically.
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

import { CreateLessonSchema, UpdateLessonSchema } from "../schemas";
import { createLesson, updateLesson } from "../actions";
import { AttachmentManager } from "./attachment-manager";
import { VideoUrlList } from "./video-url-list";
import { cn } from "@/lib/utils";

/**
 * Combined form schema. `id` is optional; presence flips the form into edit
 * mode at submit time.
 */
const FormSchema = CreateLessonSchema.extend({
  id: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export interface LessonFormProps {
  /** Course this lesson belongs to. Required for blob path generation. */
  courseId: string;
  /** When set, the form edits an existing lesson. */
  defaultValues?: Partial<FormValues>;
  /** Where to navigate after a successful save. */
  redirectTo?: string;
  /** Optional callback after a successful save. */
  onSuccess?: (result: { id: string; courseId: string }) => void;
  /** Optional class for the outer wrapper. */
  className?: string;
}

export function LessonForm({
  courseId,
  defaultValues,
  redirectTo,
  onSuccess,
  className,
}: LessonFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // For new lessons we don't have a real lessonId yet — generate a stable
  // pseudo-id so the attachment uploader has somewhere to put files.
  const pseudoId = React.useMemo(
    () => defaultValues?.id ?? `new-${Date.now().toString(36)}`,
    [defaultValues?.id],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id: defaultValues?.id,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      courseId,
      order: defaultValues?.order ?? 0,
      duration: defaultValues?.duration ?? null,
      videoUrl: defaultValues?.videoUrl ?? [],
      attachments: defaultValues?.attachments ?? [],
    },
  });

  const isEdit = Boolean(defaultValues?.id);

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      // Strip empty manual rows so the server doesn't reject them on UrlSchema.
      const cleanAttachments = (values.attachments ?? []).filter(
        (a) => a.title.trim() !== "" && a.url.trim() !== "",
      );
      const cleanVideos = (values.videoUrl ?? [])
        .map((v) => v.trim())
        .filter((v) => v !== "");

      if (isEdit && values.id) {
        const parsed = UpdateLessonSchema.parse({
          id: values.id,
          title: values.title,
          description: values.description,
          order: values.order,
          duration: values.duration ?? null,
          videoUrl: cleanVideos,
          attachments: cleanAttachments,
        });
        const result = await updateLesson(parsed);
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Lesson updated");
        if (result?.data) onSuccess?.(result.data);
      } else {
        const parsed = CreateLessonSchema.parse({
          title: values.title,
          description: values.description,
          courseId: values.courseId,
          order: values.order,
          duration: values.duration ?? null,
          videoUrl: cleanVideos,
          attachments: cleanAttachments,
        });
        const result = await createLesson(parsed);
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Lesson created");
        if (result?.data) onSuccess?.(result.data);
      }

      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(className, "space-y-6")}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Introduction to limits" {...field} />
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
                  rows={10}
                  placeholder="Write your lesson content in Markdown…"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  className="font-mono text-sm"
                />
              </FormControl>
              <FormDescription>
                Markdown formatting is supported, including math (KaTeX) and
                code blocks.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value ?? 0}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value, 10) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  Lower values appear first in the lesson list.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? null : Number.parseInt(v, 10));
                    }}
                    placeholder="Optional"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Videos</FormLabel>
              <FormControl>
                <VideoUrlList
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                YouTube URLs render as embedded players for students.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attachments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Attachments</FormLabel>
              <FormControl>
                <AttachmentManager
                  courseId={courseId}
                  lessonId={pseudoId}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create lesson"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
