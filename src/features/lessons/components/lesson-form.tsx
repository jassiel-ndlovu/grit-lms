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
 * Lessons can be grouped: `parentId` nests a lesson under another one, and
 * a NONE-typed lesson is a content-free group heading. Its content fields
 * are hidden but kept, so switching a lesson back to CONTENT loses nothing.
 *
 * The body is a RichEditor. The form holds only the envelope it hands back,
 * and only once the tutor edits it: an untouched body sends nothing, so a
 * lesson still in markdown stays as it is until someone changes it. The
 * server validates the document and derives the markdown copy.
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
import { FileText, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/editor/rich-editor";
import type { EditorFeatures } from "@/components/editor/commands";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TopicPicker } from "@/features/courses/components/topic-picker";
import { cn } from "@/lib/utils";

/**
 * Combined form schema. `id` is optional; presence flips the form into edit
 * mode at submit time.
 *
 * Note: CreateLessonSchema uses `.default()` on order/videoUrl/attachments,
 * which makes those fields optional in the *input* type but required in the
 * *output* type. RHF's TFieldValues should be the input shape — otherwise
 * the resolver's input/output don't line up. We pass z.input for
 * TFieldValues and z.output for the transformed-values generic.
 */
const FormSchema = CreateLessonSchema.extend({
  id: z.string().optional(),
});
type FormValues = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

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
  /**
   * Lessons this one may be placed under, already labelled. The caller
   * excludes the lesson itself and its descendants.
   */
  parentOptions?: Array<{ id: string; label: string; title: string; depth: number }>;
  /** Editor blocks this course may use (the Plus graph block). */
  editorFeatures?: Partial<EditorFeatures>;
  /**
   * "stack" (default): every field in order, for the create dialog.
   * "document": the lessons page; a large title, the content under it,
   * the other settings in a Details box and a sticky save bar.
   */
  layout?: "stack" | "document";
}

const TOP_LEVEL = "__top__";

export function LessonForm({
  courseId,
  defaultValues,
  redirectTo,
  onSuccess,
  className,
  parentOptions = [],
  layout = "stack",
  editorFeatures,
}: LessonFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // For new lessons we don't have a real lessonId yet — generate a stable
  // pseudo-id so the attachment uploader has somewhere to put files.
  const pseudoId = React.useMemo(
    () => defaultValues?.id ?? `new-${Date.now().toString(36)}`,
    [defaultValues?.id],
  );

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id: defaultValues?.id,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? null,
      descriptionJson: undefined,
      courseId,
      order: defaultValues?.order ?? 0,
      duration: defaultValues?.duration ?? null,
      videoUrl: defaultValues?.videoUrl ?? [],
      attachments: defaultValues?.attachments ?? [],
      type: defaultValues?.type ?? "CONTENT",
      parentId: defaultValues?.parentId ?? null,
      topics: defaultValues?.topics ?? [],
    },
  });

  const isEdit = Boolean(defaultValues?.id);
  const isGroup = form.watch("type") === "NONE";

  async function onSubmit(values: FormOutput) {
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
          descriptionJson: values.descriptionJson,
          order: values.order,
          duration: values.duration ?? null,
          videoUrl: cleanVideos,
          attachments: cleanAttachments,
          type: values.type,
          parentId: values.parentId ?? null,
          topics: values.topics ?? [],
        });
        const result = await updateLesson(parsed);
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Lesson updated");
        if (result?.data) onSuccess?.(result.data);
      } else {
        const parsed = CreateLessonSchema.parse({
          title: values.title,
          descriptionJson: values.descriptionJson,
          courseId: values.courseId,
          order: values.order,
          duration: values.duration ?? null,
          videoUrl: cleanVideos,
          attachments: cleanAttachments,
          type: values.type,
          parentId: values.parentId ?? null,
          topics: values.topics ?? [],
        });
        const result = await createLesson(parsed);
        if (result?.serverError) throw new Error(result.serverError);
        toast.success("Lesson created");
        if (result?.data) onSuccess?.(result.data);
      }

      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't save the lesson. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const doc = layout === "document";

  // Each block once; the layout only changes their order and grouping.
  const kindAndParent = (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <FormControl>
                    <div className="border-border inline-flex w-fit rounded-md border p-0.5" role="radiogroup">
                      {(
                        [
                          ["CONTENT", "Lesson", FileText],
                          ["NONE", "Group (no content)", FolderOpen],
                        ] as const
                      ).map(([v, name, Icon]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={field.value === v}
                          onClick={() => field.onChange(v)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors",
                            field.value === v
                              ? "bg-brand-terracotta text-brand-terracotta-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon aria-hidden className="size-3.5" />
                          {name}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormDescription>
                    A group is a heading that holds other lessons.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inside</FormLabel>
                  <Select
                    value={field.value ?? TOP_LEVEL}
                    onValueChange={(v) => field.onChange(v === TOP_LEVEL ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={TOP_LEVEL}>Top level</SelectItem>
                      {parentOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span style={{ paddingLeft: p.depth * 12 }} className="tabular-nums">
                            {p.label} · {p.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Optional. Put it inside a group or another lesson.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
  );
  const content = (
    <>
          {!isGroup && (
          <FormField
            control={form.control}
            name="descriptionJson"
            render={({ field }) => (
              <FormItem>
                {/* The editor names itself (aria-label); this is the visible label. */}
                <p className="text-sm leading-none font-medium">Content</p>
                <RichEditor
                  label="Lesson content"
                  // Read once on mount; field.value keeps edits across a
                  // switch to "Group" and back.
                  value={field.value ?? defaultValues?.descriptionJson}
                  fallbackMarkdown={defaultValues?.description}
                  onChange={field.onChange}
                  features={editorFeatures}
                  placeholder="Write the lesson. Type / for blocks, $ for maths"
                  className="[&_.rich-editor-surface]:min-h-64"
                />
                <FormDescription>
                  {editorFeatures?.graph
                    ? "Headings, lists, tables, code, maths and graphs. Type / for the block menu."
                    : "Headings, lists, tables, code and maths. Type / for the block menu."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          )}
    </>
  );
  // Curriculum topics (contracts/curriculum.md), when the course has a topic list.
  const topicsField = isGroup ? null : (
    <FormField
      control={form.control}
      name="topics"
      render={({ field }) => (
        <FormItem>
          <TopicPicker what="lesson" value={field.value ?? []} onChange={field.onChange} disabled={pending} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
  const orderAndDuration = (
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
                    Lower numbers come first. To drag lessons into order, choose Rearrange in the list.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isGroup && (
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
            )}
          </div>
  );
  const media = (
    <>
          {!isGroup && (
          <>
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
                  Paste YouTube links. Students watch them in the lesson.
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
                <FormLabel>Files and links</FormLabel>
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
          </>
          )}
    </>
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(className, doc ? "space-y-8" : "space-y-6")}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={doc ? "sr-only" : undefined}>Title</FormLabel>
              <FormControl>
                <Input
                  placeholder={doc ? "Untitled lesson" : "Introduction to limits"}
                  className={
                    doc
                      ? "font-display h-auto border-transparent bg-transparent px-1 py-1 text-2xl tracking-tight shadow-none hover:bg-muted/40 focus-visible:bg-muted/40 md:text-3xl dark:bg-transparent"
                      : undefined
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {doc ? (
          <>
            {content}
            <section aria-labelledby={`details-${pseudoId}`} className="border-border space-y-6 rounded-lg border p-4 sm:p-5">
              <h2 id={`details-${pseudoId}`} className="text-foreground text-sm font-semibold">
                Details
              </h2>
              {kindAndParent}
              {topicsField}
              {orderAndDuration}
              {media}
            </section>
          </>
        ) : (
          <>
            {kindAndParent}
            {content}
            {topicsField}
            {orderAndDuration}
            {media}
          </>
        )}

        <div
          className={cn(
            "flex justify-end gap-2",
            doc && "bg-background/95 border-border sticky bottom-0 z-10 border-t py-3 backdrop-blur",
          )}
        >
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : isGroup ? "Create group" : "Create lesson"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
