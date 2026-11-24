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

import { CourseCurriculumInputSchema, CreateCourseSchema, UpdateCourseSchema } from "../schemas";
import { CurriculumFields } from "./curriculum-fields";
import { createCourse, updateCourse } from "../actions";
import { CoverUploader } from "./cover-uploader";
import { StockCoverPicker } from "./stock-cover-picker";
import { CourseCoverSchema, isValidCover, stockCoverFor } from "../lib/stock-covers";
import { StudentPicker } from "./student-picker";
import { actionError, BILLING_PATH, isStudentLimitError } from "../lib/account-ui";
import type { StudentListItem } from "@/features/students/queries";

/**
 * Combined form schema. `id` is optional; presence flips the form into edit
 * mode. Reused by both branches via discriminator at submit time.
 *
 * The cover may be empty here: on submit an empty cover becomes the stock
 * cover for the course name (stockCoverFor), so the server always receives
 * an upload URL or a stock path and never shows "Must be a valid URL".
 */
const FormSchema = CreateCourseSchema.extend({
  id: z.string().optional(),
  imageUrl: CourseCoverSchema.or(z.literal("")),
  curriculum: CourseCurriculumInputSchema,
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
  /** Show the enrolment picker (default). Onboarding hides it: no students yet. */
  showStudents?: boolean;
}

export function CourseForm({
  students,
  defaultValues,
  redirectTo,
  onSuccess,
  showStudents = true,
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
      // An old row's "" or bare file name starts empty, so it saves as a stock cover.
      imageUrl: isValidCover(defaultValues?.imageUrl) ? defaultValues.imageUrl : "",
      studentIds: defaultValues?.studentIds ?? [],
      curriculum: defaultValues?.curriculum ?? { curriculum: null, subject: null, gradeLevel: null },
    },
  });

  const isEdit = Boolean(defaultValues?.id);
  const courseName = form.watch("name");

  /** A student limit (#178) gets a link to billing; any other error shows its message. */
  function failed(serverError: string) {
    const message = actionError({ serverError });
    if (isStudentLimitError(serverError)) {
      toast.error(message, { duration: 12_000, action: { label: "Billing", onClick: () => router.push(BILLING_PATH) } });
    } else {
      toast.error(message);
    }
  }

  async function onSubmit(values: FormValues) {
    setPending(true);
    const imageUrl = values.imageUrl || stockCoverFor(values.name).src;
    try {
      if (isEdit && values.id) {
        const parsed = UpdateCourseSchema.parse({
          id: values.id,
          name: values.name,
          description: values.description,
          imageUrl,
          studentIds: values.studentIds,
          curriculum: values.curriculum,
        });
        const result = await updateCourse(parsed);
        if (result?.serverError) return failed(result.serverError);
        toast.success("Course updated");
      } else {
        const parsed = CreateCourseSchema.parse({
          name: values.name,
          description: values.description,
          imageUrl,
          studentIds: values.studentIds,
          curriculum: values.curriculum,
        });
        const result = await createCourse(parsed);
        if (result?.serverError) return failed(result.serverError);
        toast.success("Course created");
      }
      onSuccess?.();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't save the course. Check your connection and try again.");
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
              <StockCoverPicker
                value={field.value}
                fallback={stockCoverFor(courseName ?? "")}
                onChange={field.onChange}
              />
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
                <Input placeholder="Grade 10 Mathematics" {...field} />
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
          name="curriculum"
          render={({ field }) => (
            <FormItem>
              <CurriculumFields value={field.value} onChange={field.onChange} disabled={pending} />
              <FormMessage />
            </FormItem>
          )}
        />

        {showStudents ? (
          <FormField
            control={form.control}
            name="studentIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Students on this course</FormLabel>
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
        ) : null}

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
