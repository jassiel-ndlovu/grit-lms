"use client";

/**
 * /dashboard/submissions/create/[[id]] — tutor creates or edits an
 * assignment. Legacy context-backed page, restyled to the Inkwell
 * components the rest of the tutor surfaces use. Fields and save
 * behaviour are unchanged.
 *
 * Progress auto-saves to this device (useLocalDraft) so a dropped
 * connection or a dead laptop doesn't lose a half-written brief. Files
 * picked but not yet uploaded can't be kept that way — they live in
 * browser memory until "Create" uploads them.
 */

import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useEvents } from "@/context/EventContext";
import { $Enums } from "@/generated/prisma";
import { uploadFile } from "@/lib/blob";
import { formatDate, formatForDateTimeLocal, parseDateTimeLocal } from "@/lib/functions";
import { ArrowLeft, CalendarClock, Download, EyeOff, FileText, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import SubmissionFormSkeleton from "../../../skeletons/submission-form-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownTextarea } from "@/components/markdown-textarea";
import {
  DraftStatus,
  RestoreDraftBanner,
  SaveProgressButton,
} from "@/components/draft-controls";
import { useLocalDraft } from "@/lib/use-local-draft";

type MaxAttemptOptions = "Limited" | "Unlimited";

export default function SubmissionForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);

  // Contexts
  const { loading: coursesLoading, fetchCoursesByTutorId } = useCourses();
  const { 
    loading: submissionLoading, 
    fetchSubmissionById, 
    createSubmission, 
    updateSubmission 
  } = useSubmission();
  const { createEvent } = useEvents();
  const { profile } = useProfile();
  const router = useRouter();

  // States
  const [formData, setFormData] = useState<Partial<AppTypes.Submission>>({
    title: "",
    description: "",
    descriptionFiles: [],
    courseId: "",
    fileType: "PDF",
    dueDate: new Date(),
    lastDueDate: new Date(),
    maxAttempts: 1,
    totalPoints: 1,
    isActive: true,
  });

  const [maxAttemptsOption, setMaxAttemptsOption] = useState<MaxAttemptOptions>(
    formData.maxAttempts === null ? "Unlimited" : "Limited"
  );
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(formData.maxAttempts || 1);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local auto-save. Held until an edited assignment has loaded, so the
  // baseline is the real record rather than the blank placeholder.
  const draftData = useMemo(
    () => ({ formData, maxAttemptsOption, maxAttempts }),
    [formData, maxAttemptsOption, maxAttempts],
  );
  const draft = useLocalDraft({
    key: isEditing ? `assignment-edit:${id}` : "assignment-new",
    data: draftData,
    enabled: !isEditing || submission !== null,
  });
  function restoreDraft(d: typeof draftData) {
    const f = d.formData ?? {};
    setFormData({
      ...f,
      // JSON turned the dates into strings.
      dueDate: f.dueDate ? new Date(f.dueDate) : new Date(),
      lastDueDate: f.lastDueDate ? new Date(f.lastDueDate) : null,
    });
    setMaxAttemptsOption(d.maxAttemptsOption === "Unlimited" ? "Unlimited" : "Limited");
    setMaxAttempts(Number(d.maxAttempts) || 1);
  }

  // fetch courses
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const courses = await fetchCoursesByTutorId(profile.id) as AppTypes.Course[];
      setCourses(courses);
    })();
  }, [profile, fetchCoursesByTutorId]);

  // fetch submission if editing
  useEffect(() => {
    if (!id) return;

    (async () => {
      const sub = await fetchSubmissionById(id as string) as AppTypes.Submission;
      setSubmission(sub);
      setFormData({
        title: sub.title,
        description: sub.description,
        descriptionFiles: sub.descriptionFiles || [],
        courseId: sub.courseId,
        fileType: sub.fileType,
        dueDate: sub.dueDate,
        lastDueDate: sub.lastDueDate || undefined,
        maxAttempts: sub.maxAttempts,
        totalPoints: sub.totalPoints,
        isActive: sub.isActive,
      });
      setMaxAttempts(sub.maxAttempts || 1);
      setMaxAttemptsOption(sub.maxAttempts === null ? "Unlimited" : "Limited");
    })();
  }, [id, fetchSubmissionById]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!(formData.title as string)?.trim()) newErrors.title = "Title is required";
    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.courseId) newErrors.courseId = "Course is required";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    if (!formData.totalPoints || formData.totalPoints < 1) newErrors.totalPoints = "Total points must be at least 1";
    if (maxAttemptsOption === "Limited" && (!formData.maxAttempts || formData.maxAttempts < 1)) {
      newErrors.maxAttempts = "Max attempts must be at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsUploading(true);

    try {
      // Upload files and get their URLs
      const uploadedFileUrls = await Promise.all(
        files.map(async (file) => {
          try {
            const url = await uploadFile(file);
            return url;
          } catch (error) {
            console.error(`Failed to upload file ${file.name}:`, error);
            return null;
          }
        })
      );

      // Filter out failed uploads
      const successfulUploads = uploadedFileUrls.filter(url => url !== null) as string[];

      // Combine with existing files if editing
      const allDescriptionFiles = [
        ...(formData.descriptionFiles || []),
        ...successfulUploads
      ];

      const submissionData: Partial<AppTypes.Submission> = {
        title: formData.title as string,
        description: formData.description as string,
        descriptionFiles: allDescriptionFiles,
        fileType: formData.fileType as $Enums.FileType,
        courseId: formData.courseId as string,
        totalPoints: formData.totalPoints as number,
        isActive: formData.isActive,
        maxAttempts: maxAttemptsOption === "Limited" ? maxAttempts : null,
        dueDate: new Date(formData.dueDate as Date),
        lastDueDate: formData.lastDueDate ? new Date(formData.lastDueDate as Date) : null,
      };

      if (isEditing && submission) {
        // Update existing submission
        await updateSubmission(submission.id, submissionData);
        
        // Update event if needed
        await createEvent(formData.courseId ?? "", {
          title: `${formData.title} (Updated)`,
          courseId: formData.courseId,
          date: new Date(),
          description: `Submission "${formData.title}" has been updated. Due on ${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
          type: $Enums.EventType.SUBMISSION,
          link: `/dashboard/submissions/${submission.id}`
        });
      } else {
        // Create new submission
        const newSubmission = await createSubmission(formData.courseId as string, submissionData);
        
        // Create event for new submission
        if (newSubmission) {
          await createEvent(formData.courseId ?? "", {
            title: formData.title as string,
            courseId: formData.courseId as string,
            date: formData.dueDate as Date,
            description: `New submission "${formData.title}" created. Due on ${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
            type: $Enums.EventType.SUBMISSION,
            link: `/dashboard/submissions/${newSubmission.id}`
          });
        }
      }

      draft.clear();
      router.push("/dashboard/submissions");
    } catch (error) {
      console.error("Error saving submission:", error);
      setErrors({ submit: "Failed to save submission. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUploadedFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descriptionFiles: (prev.descriptionFiles || []).filter((_, i) => i !== index)
    }));
  };

  const toggleActiveStatus = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };

  const fileTypeOptions = [
    { value: "PDF", label: "PDF only" },
    { value: "DOCX", label: "Word documents only" },
    { value: "PDF,DOCX", label: "PDF and Word documents" },
    { value: "PDF,DOCX,ZIP", label: "PDF, Word, and ZIP files" },
    { value: "PDF,DOCX,ZIP,JPEG", label: "All supported formats" }
  ];

  if (coursesLoading || submissionLoading) {
    return <SubmissionFormSkeleton />;
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/submissions">
                <ArrowLeft className="size-4" /> Back to assignments
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6 px-6 py-10 pb-40">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
              {isEditing ? "Edit assignment" : "New assignment"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isEditing ? "Update the assignment details." : "Set up a new assignment for your students."}
            </p>
          </div>

          {/* Active/Inactive Toggle */}
          <div className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2">
            <Badge variant={formData.isActive ? "soft" : "secondary"}>
              {formData.isActive ? "Active" : "Draft"}
            </Badge>
            <span className="text-muted-foreground text-xs">Visible to students</span>
            <Switch
              checked={Boolean(formData.isActive)}
              onCheckedChange={toggleActiveStatus}
              aria-label="Visible to students"
            />
          </div>
        </header>

        <RestoreDraftBanner draft={draft} onRestore={restoreDraft} what="this assignment" />

        {/* Status Indicator */}
        {!formData.isActive && (
          <div className="border-brand-terracotta/30 bg-brand-terracotta/5 flex items-center gap-2 rounded-lg border px-4 py-3">
            <EyeOff className="text-brand-terracotta size-4 shrink-0" />
            <p className="text-foreground text-sm">
              This assignment is in draft mode and won&apos;t be visible to students.
            </p>
          </div>
        )}

        {/* ───── Details ───── */}
        <Card className="space-y-5 p-6">
          <SectionTitle title="Details" />

          {/* Title */}
          <Field label="Assignment title" required error={errors.title}>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              aria-invalid={Boolean(errors.title)}
              placeholder="Enter assignment title..."
            />
          </Field>

          {/* Description with Markdown support */}
          <Field
            label="Description"
            required
            error={errors.description}
            hint="Markdown and MathJax supported — use Preview render to check it."
          >
            <MarkdownTextarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="font-mono text-sm"
              aria-invalid={Boolean(errors.description)}
              rows={4}
              placeholder="Enter assignment description or instructions (Markdown supported)..."
              previewTitle="Assignment description preview"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Course Selection */}
            <Field label="Course" required error={errors.courseId}>
              <Select
                value={formData.courseId || undefined}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, courseId: v }))}
              >
                <SelectTrigger className="w-full" aria-invalid={Boolean(errors.courseId)}>
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Total Points */}
            <Field label="Total points" required error={errors.totalPoints}>
              <Input
                type="number"
                min={1}
                value={formData.totalPoints}
                onChange={(e) => setFormData((prev) => ({ ...prev, totalPoints: Number(e.target.value) }))}
                aria-invalid={Boolean(errors.totalPoints)}
                placeholder="Enter total points..."
              />
            </Field>
          </div>
        </Card>

        {/* ───── Instruction files ───── */}
        <Card className="space-y-4 p-6">
          <SectionTitle title="Instruction files" optional />

          {/* Existing uploaded files */}
          {formData.descriptionFiles && formData.descriptionFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Existing files</p>
              <ul className="space-y-1.5">
                {formData.descriptionFiles.map((fileUrl, index) => (
                  <li
                    key={index}
                    className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-7 shrink-0 items-center justify-center rounded">
                      <Download className="size-3.5" />
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      File {index + 1}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => removeUploadedFile(index)}
                      aria-label={`Remove file ${index + 1}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dropzone for new files */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-input bg-muted/30 hover:border-brand-terracotta/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm transition-colors"
          >
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              ref={fileInputRef}
            />
            <Upload className="text-brand-terracotta size-5" />
            <p className="text-muted-foreground">Drop files here or click to browse</p>
            <p className="text-muted-foreground text-xs">Files will be uploaded and available to students</p>
          </div>

          {/* New files to be uploaded */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Files to upload</p>
              <ul className="space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={index}
                    className="border-brand-terracotta/30 bg-brand-terracotta/5 flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <FileText className="text-brand-terracotta size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-[11px]">
                Picked files upload when you save, and aren&apos;t part of the auto-saved progress.
              </p>
            </div>
          )}
        </Card>

        {/* ───── Submission rules ───── */}
        <Card className="space-y-5 p-6">
          <SectionTitle title="Submission rules" />

          {/* File Type */}
          <Field label="Accepted file types">
            <Select
              value={formData.fileType}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, fileType: v as $Enums.FileType }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fileTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Max Attempts */}
          <Field label="Max attempts" error={errors.maxAttempts}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                value={maxAttemptsOption}
                onValueChange={(v) => setMaxAttemptsOption(v as MaxAttemptOptions)}
              >
                <SelectTrigger className="w-full" aria-invalid={Boolean(errors.maxAttempts)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Limited">Limited</SelectItem>
                  <SelectItem value="Unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={maxAttemptsOption === "Limited" ? maxAttempts : ""}
                min={1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setFormData((prev) => ({ ...prev, maxAttempts: value }));
                  setMaxAttempts(value);
                }}
                disabled={maxAttemptsOption === "Unlimited"}
                aria-invalid={Boolean(errors.maxAttempts)}
                placeholder="Number of attempts"
              />
            </div>
          </Field>
        </Card>

        {/* ───── Schedule ───── */}
        <Card className="space-y-5 p-6">
          <SectionTitle
            title="Schedule"
            icon={<CalendarClock className="text-brand-terracotta size-4" />}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Due Date */}
            <Field label="Due date" required error={errors.dueDate}>
              <Input
                type="datetime-local"
                value={formData.dueDate ? formatForDateTimeLocal(new Date(formData.dueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    dueDate: parseDateTimeLocal(e.target.value)
                  }))
                }
                aria-invalid={Boolean(errors.dueDate)}
              />
            </Field>

            {/* Last Due Date */}
            <Field
              label="Extended due date"
              optional
              hint="If provided, students can still resubmit after the main due date until this deadline."
            >
              <Input
                type="datetime-local"
                value={formData.lastDueDate ? formatForDateTimeLocal(new Date(formData.lastDueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lastDueDate: e.target.value ? parseDateTimeLocal(e.target.value) : null
                  }))
                }
              />
            </Field>
          </div>
        </Card>

        {/* Submit Error */}
        {errors.submit && (
          <div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3">
            <p className="text-destructive text-sm">{errors.submit}</p>
          </div>
        )}

        {/* ───── Sticky save bar ───── */}
        <div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <DraftStatus draft={draft} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/dashboard/submissions")}
              >
                Cancel
              </Button>
              <SaveProgressButton draft={draft} />
              <Button
                type="submit"
                variant="brand"
                disabled={coursesLoading || submissionLoading || isUploading}
              >
                {isUploading && <Loader2 className="size-4 animate-spin" />}
                {isUploading
                  ? isEditing ? "Updating..." : "Creating..."
                  : isEditing ? "Update assignment" : "Create assignment"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({
  title,
  optional,
  icon,
}: {
  title: string;
  optional?: boolean;
  icon?: ReactNode;
}) {
  return (
    <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
      {icon}
      {title}
      {optional && (
        <span className="text-muted-foreground font-sans text-xs font-normal">(optional)</span>
      )}
    </h2>
  );
}

function Field({
  label,
  required,
  optional,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground text-xs font-medium">
        {label}
        {required && <span className="text-brand-terracotta"> *</span>}
        {optional && <span className="text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
