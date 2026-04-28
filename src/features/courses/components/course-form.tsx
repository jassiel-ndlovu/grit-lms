"use client";

/**
 * CourseForm — single form used for both Create and Update flows.
 *
 * Mode is determined by `defaultValues.id`:
 *   - present  → calls updateCourse
 *   - absent   → calls createCourse
 *
 * Validation runs client-side via Zod (zodResolver) and the same schema
 * runs server-side inside the Server Action — single source of truth.
 *
 * The form is intentionally controlled at the field level rather than
 * embedded in a Dialog so it can be reused on a dedicated edit page or
 * inside a modal without ceremony.
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { CreateCourseSchema, UpdateCourseSchema } from "../schemas";
import { createCourse, updateCourse } from "../actions";
import { CoverUploader } from "./cover-uploader";
import { StudentPicker } from "./student-picker";
import type { StudentListItem } from "@/features/students/queries";

/**
 * Combined form schema. `id` is optional; presence flips the form into edit
 * mode. Reused by both branches via discriminator at submit time.
 */
const FormSchema = CreateCourseSchema.extend({
  id: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export interface CourseFormProps {
  /** All students available for enrolment. */
  students: StudentListItem[];
  /** When set, the form edits an existing course. */
  defaultValues?: Partial<FormValues>;
  /** Where to navigate after a successful save. */
  redirectTo?: string;
  /** Optional callback after a successful save. */
  onSuccess?: () => void;
}

export function CourseForm({
  students,
  defaultValues,
  redirectTo,
  onSuccess,
}: CourseFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // Stable pseudo-id used for the cover-upload pathname. For new courses we
  // use a temporary cuid-shaped string — the path will be cleaned up by
  // Vercel's random suffix and isn't actually tied to the DB id.
  const pseudoId = React.useMemo(
    () => defaultValues?.id ?? `new-${Date.now().toString(36)}`,
    [defaultValues?.id],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id: defaultValues?.id,
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
      studentIds: defaultValues?.studentIds ?? [],
    },
  });

  const isEdit = Boolean(defaultValues?.id);

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      if (isEdit && values.id) {
        const parsed = UpdateCourseSchema.parse({
          id: values.id,
          name: values.name,
          description: values.description,
          imageUrl: values.imageUrl,
          studentIds: values.studentIds,
        });
        const result = await updateCourse(parsed);
        if (result?.serverError) {
          throw new Error(result.serverError);
        }
        toast.success("Course updated");
      } else {
        const parsed = CreateCourseSchema.parse({
          name: values.name,
          description: values.description,
          imageUrl: values.imageUrl,
          studentIds: values.studentIds,
        });
        const result = await createCourse(parsed);
        if (result?.serverError) {
          throw new Error(result.serverError);
        }
        toast.success("Course created");
      }
      onSuccess?.();
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover image</FormLabel>
              <FormControl>
                <CoverUploader
                  courseId={pseudoId}
                  value={field.value || null}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course name</FormLabel>
              <FormControl>
                <Input placeholder="Introduction to algebra" {...field} />
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
                  placeholder="What will students learn?"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="studentIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enrolled students</FormLabel>
              <FormControl>
                <StudentPicker
                  students={students}
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
            {isEdit ? "Save changes" : "Create course"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
