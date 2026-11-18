"use client";

/**
 * AssignmentForm — create or edit an assignment (legacy Batch 3b).
 *
 * The server page passes the tutor's courses and, when editing, the
 * assignment. Saving calls createSubmission / updateSubmission; picked files
 * upload first as BlobKind.AssignmentBrief. A new assignment has no id yet,
 * so its briefs go under a client draft id (A's 14-day grace rule cleans up
 * drafts that are never saved).
 *
 * No calendar event is created: the calendar already lists every active
 * assignment from its due date, so the legacy page's events were duplicates.
 *
 * Progress auto-saves to this device (useLocalDraft) with the legacy keys
 * and shape, so drafts written by the old page still restore. Picked files
 * can't be kept that way; they live in memory until "Create" uploads them.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, EyeOff, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichEditor } from "@/components/editor/rich-editor";
import { DraftStatus, RestoreDraftBanner, SaveProgressButton } from "@/components/draft-controls";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, assignmentBriefPath } from "@/lib/blob/paths";
import { readStoredContent } from "@/lib/content/value";
import { formatForDateTimeLocal, parseDateTimeLocal } from "@/lib/functions";
import { useLocalDraft } from "@/lib/use-local-draft";

import { createSubmission, updateSubmission } from "../actions";

export interface AssignmentFormValues {
  title: string;
  /** Markdown; the fallback when there is no rich document. */
  description: string;
  /**
   * The brief as RichEditor's envelope. From the row on load; after an edit,
   * what the editor handed back, which is what gets saved.
   */
  descriptionJson?: unknown;
  descriptionFiles: string[];
  courseId: string;
  fileType: string;
  dueDate: Date;
  lastDueDate: Date | null;
  maxAttempts: number | null;
  totalPoints: number;
  isActive: boolean;
}

type MaxAttemptOptions = "Limited" | "Unlimited";

const FILE_TYPE_OPTIONS = [
  { value: "PDF", label: "PDF only" },
  { value: "DOCX", label: "Word documents only" },
  { value: "PDF,DOCX", label: "PDF and Word documents" },
  { value: "PDF,DOCX,ZIP", label: "PDF, Word, and ZIP files" },
  { value: "PDF,DOCX,ZIP,JPEG", label: "All supported formats" },
];

const BLANK: AssignmentFormValues = {
  title: "",
  description: "",
  descriptionFiles: [],
  courseId: "",
  fileType: "PDF",
  dueDate: new Date(),
  lastDueDate: null,
  maxAttempts: 1,
  totalPoints: 1,
  isActive: true,
};

/** Whether a brief has any text: the document's, else the markdown's. */
function hasBrief(json: unknown, markdown: string): boolean {
  const stored = readStoredContent(json);
  if (!stored) return markdown.trim().length > 0;
  const text = (n: { text?: string; type?: string; content?: unknown[] }): boolean =>
    Boolean(n.text?.trim()) ||
    n.type === "image" ||
    n.type === "blockMath" ||
    n.type === "inlineMath" ||
    (n.content ?? []).some((c) => text(c as typeof n));
  return text(stored.doc);
}

/** The file name from a Blob URL, without Vercel's random suffix. */
function fileLabel(url: string, index: number): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return last.replace(/-[A-Za-z0-9]{20,}(?=\.[^.]+$|$)/, "") || `File ${index + 1}`;
  } catch {
    return `File ${index + 1}`;
  }
}

export function AssignmentForm({
  id,
  initial,
  courses,
}: {
  id: string | null;
  initial: AssignmentFormValues | null;
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isEditing = id !== null;

  const [formData, setFormData] = React.useState<AssignmentFormValues>(initial ?? BLANK);
  const [maxAttemptsOption, setMaxAttemptsOption] = React.useState<MaxAttemptOptions>(
    initial && initial.maxAttempts === null ? "Unlimited" : "Limited",
  );
  const [maxAttempts, setMaxAttempts] = React.useState<number>(initial?.maxAttempts ?? 1);
  const [files, setFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  // Whether the brief was edited here; only then is descriptionJson sent.
  const [briefEdited, setBriefEdited] = React.useState(false);
  // Remounts the editor when a draft is restored (it reads value on mount).
  const [editorKey, setEditorKey] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Where a new assignment's briefs go before it has an id.
  const draftId = React.useMemo(() => id ?? `draft-${crypto.randomUUID()}`, [id]);

  const draftData = React.useMemo(
    () => ({ formData, maxAttemptsOption, maxAttempts }),
    [formData, maxAttemptsOption, maxAttempts],
  );
  const draft = useLocalDraft({ key: isEditing ? `assignment-edit:${id}` : "assignment-new", data: draftData });

  function restoreDraft(d: typeof draftData) {
    const f = d.formData ?? {};
    setFormData({
      ...BLANK,
      ...f,
      // JSON turned the dates into strings.
      dueDate: f.dueDate ? new Date(f.dueDate) : new Date(),
      lastDueDate: f.lastDueDate ? new Date(f.lastDueDate) : null,
      descriptionFiles: f.descriptionFiles ?? [],
      isActive: f.isActive ?? true,
    });
    // An old page's draft has markdown only; the editor then falls back to it.
    setBriefEdited(f.descriptionJson !== undefined);
    setEditorKey((k) => k + 1);
    setMaxAttemptsOption(d.maxAttemptsOption === "Unlimited" ? "Unlimited" : "Limited");
    setMaxAttempts(Number(d.maxAttempts) || 1);
  }

  function set<K extends keyof AssignmentFormValues>(key: K, value: AssignmentFormValues[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!formData.title.trim()) e.title = "Title is required";
    if (!hasBrief(formData.descriptionJson, formData.description)) e.description = "Description is required";
    if (!formData.courseId) e.courseId = "Course is required";
    if (!formData.dueDate || Number.isNaN(formData.dueDate.getTime())) e.dueDate = "Due date is required";
    if (!formData.totalPoints || formData.totalPoints < 1) e.totalPoints = "Total points must be at least 1";
    if (maxAttemptsOption === "Limited" && (!maxAttempts || maxAttempts < 1)) {
      e.maxAttempts = "Max attempts must be at least 1";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        try {
          const { url } = await uploadFile({
            kind: BlobKind.AssignmentBrief,
            pathname: assignmentBriefPath(draftId, file.name),
            file,
          });
          uploaded.push(url);
        } catch {
          throw new Error(`Couldn't upload ${file.name}. Check the file type and size, then try again.`);
        }
      }

      const values = {
        title: formData.title.trim(),
        description: formData.description,
        // The server derives the markdown from the document (contracts/editor.md).
        ...(briefEdited ? { descriptionJson: formData.descriptionJson ?? null } : {}),
        descriptionFiles: [...formData.descriptionFiles, ...uploaded],
        courseId: formData.courseId,
        fileType: formData.fileType,
        totalPoints: formData.totalPoints,
        isActive: formData.isActive,
        maxAttempts: maxAttemptsOption === "Limited" ? maxAttempts : null,
        dueDate: formData.dueDate,
        lastDueDate: formData.lastDueDate,
      };

      const res = id !== null ? await updateSubmission({ id, ...values }) : await createSubmission(values);
      if (!res?.data) throw new Error(res?.serverError ?? "Couldn't save the assignment.");

      draft.clear();
      toast.success(isEditing ? "Assignment updated" : "Assignment created");
      router.push(`/dashboard/submissions/${res.data.id}`);
      router.refresh();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Couldn't save the assignment. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked]);
  }

  return (
    <div className="bg-background">
      <div className="bg-card border-border border-b">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={isEditing ? `/dashboard/submissions/${id}` : "/dashboard/submissions"}>
                <ArrowLeft className="size-4" /> {isEditing ? "Back to assignment" : "Back to assignments"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-40 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">
              {isEditing ? "Edit assignment" : "New assignment"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isEditing ? "Update the assignment details." : "Set up a new assignment for your students."}
            </p>
          </div>
          <div className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2">
            <Badge variant={formData.isActive ? "soft" : "secondary"}>{formData.isActive ? "Active" : "Draft"}</Badge>
            <span className="text-muted-foreground text-xs">Visible to students</span>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              aria-label="Visible to students"
            />
          </div>
        </header>

        <RestoreDraftBanner draft={draft} onRestore={restoreDraft} what="this assignment" />

        {!formData.isActive && (
          <div className="border-brand-terracotta/30 bg-brand-terracotta/5 flex items-center gap-2 rounded-lg border px-4 py-3">
            <EyeOff className="text-brand-terracotta size-4 shrink-0" />
            <p className="text-foreground text-sm">
              This assignment is in draft mode and won&apos;t be visible to students.
            </p>
          </div>
        )}

        <Card className="space-y-5 p-6">
          <SectionTitle title="Details" />
          <Field id="a-title" label="Assignment title" required error={errors.title}>
            <Input
              id="a-title"
              value={formData.title}
              onChange={(e) => set("title", e.target.value)}
              aria-invalid={Boolean(errors.title)}
              placeholder="Enter assignment title..."
            />
          </Field>
          <Field
            id="a-description"
            label="Description"
            required
            error={errors.description}
            hint="Headings, lists, tables, code and maths. Type / for the block menu, $ for maths."
          >
            <RichEditor
              key={editorKey}
              label="Assignment description"
              value={formData.descriptionJson}
              fallbackMarkdown={formData.description}
              onChange={(v) => {
                setBriefEdited(true);
                set("descriptionJson", v);
              }}
              placeholder="Write the brief. Type / for blocks, $ for maths"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="a-course" label="Course" required error={errors.courseId}>
              <Select value={formData.courseId || undefined} onValueChange={(v) => set("courseId", v)}>
                <SelectTrigger id="a-course" className="w-full" aria-invalid={Boolean(errors.courseId)}>
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="a-points" label="Total points" required error={errors.totalPoints}>
              <Input
                id="a-points"
                type="number"
                min={1}
                value={formData.totalPoints}
                onChange={(e) => set("totalPoints", Number(e.target.value))}
                aria-invalid={Boolean(errors.totalPoints)}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <SectionTitle title="Instruction files" optional />
          {formData.descriptionFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Attached files</p>
              <ul className="space-y-1.5">
                {formData.descriptionFiles.map((url, i) => (
                  <li key={url} className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2">
                    <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-7 shrink-0 items-center justify-center rounded">
                      <Download className="size-3.5" />
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
                      {fileLabel(url, i)}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => set("descriptionFiles", formData.descriptionFiles.filter((u) => u !== url))}
                      aria-label={`Remove ${fileLabel(url, i)}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            className="border-input bg-muted/30 hover:border-brand-terracotta/40 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm transition-colors"
          >
            <Upload className="text-brand-terracotta size-5" />
            <p className="text-muted-foreground">Drop files here, or</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="text-muted-foreground text-xs">PDF, Word, slides, spreadsheets, images or ZIP; up to 100 MB each.</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Files to upload</p>
              <ul className="space-y-1.5">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="border-brand-terracotta/30 bg-brand-terracotta/5 flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <FileText className="text-brand-terracotta size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
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

        <Card className="space-y-5 p-6">
          <SectionTitle title="Submission rules" />
          <Field id="a-filetype" label="Accepted file types">
            <Select value={formData.fileType} onValueChange={(v) => set("fileType", v)}>
              <SelectTrigger id="a-filetype" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="a-attempts" label="Max attempts" error={errors.maxAttempts}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select value={maxAttemptsOption} onValueChange={(v) => setMaxAttemptsOption(v as MaxAttemptOptions)}>
                <SelectTrigger className="w-full" aria-label="Attempts limit" aria-invalid={Boolean(errors.maxAttempts)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Limited">Limited</SelectItem>
                  <SelectItem value="Unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="a-attempts"
                type="number"
                min={1}
                value={maxAttemptsOption === "Limited" ? maxAttempts : ""}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                disabled={maxAttemptsOption === "Unlimited"}
                aria-invalid={Boolean(errors.maxAttempts)}
                placeholder="Number of attempts"
              />
            </div>
          </Field>
        </Card>

        <Card className="space-y-5 p-6">
          <SectionTitle title="Schedule" icon={<CalendarClock className="text-brand-terracotta size-4" />} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="a-due" label="Due date" required error={errors.dueDate}>
              <Input
                id="a-due"
                type="datetime-local"
                value={formatForDateTimeLocal(formData.dueDate)}
                onChange={(e) => set("dueDate", parseDateTimeLocal(e.target.value))}
                aria-invalid={Boolean(errors.dueDate)}
              />
            </Field>
            <Field
              id="a-lastdue"
              label="Extended due date"
              optional
              hint="If provided, students can still resubmit after the main due date until this deadline."
            >
              <Input
                id="a-lastdue"
                type="datetime-local"
                value={formData.lastDueDate ? formatForDateTimeLocal(formData.lastDueDate) : ""}
                onChange={(e) => set("lastDueDate", e.target.value ? parseDateTimeLocal(e.target.value) : null)}
              />
            </Field>
          </div>
        </Card>

        {errors.submit && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3">
            <p className="text-destructive text-sm">{errors.submit}</p>
          </div>
        )}

        <div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <DraftStatus draft={draft} />
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild type="button" variant="ghost">
                <Link href={isEditing ? `/dashboard/submissions/${id}` : "/dashboard/submissions"}>Cancel</Link>
              </Button>
              <SaveProgressButton draft={draft} />
              <Button type="submit" variant="brand" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update assignment"
                    : "Create assignment"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ title, optional, icon }: { title: string; optional?: boolean; icon?: React.ReactNode }) {
  return (
    <h2 className="font-display text-foreground flex items-center gap-2 text-lg leading-tight tracking-tight">
      {icon}
      {title}
      {optional && <span className="text-muted-foreground font-sans text-xs font-normal">(optional)</span>}
    </h2>
  );
}

function Field({
  id,
  label,
  required,
  optional,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-foreground text-xs font-medium">
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
