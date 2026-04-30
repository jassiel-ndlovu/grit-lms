"use client";

/**
 * SubmissionForm — student-facing client form for submitting an assignment.
 *
 * Handles uploading 1+ files to Vercel Blob (out-of-band, via the same
 * upload-token pattern as lesson attachments) and then calling the
 * submitEntry Server Action with the resulting URL list.
 *
 * Locked once the entry is GRADED — the parent passes `disabled` in that
 * case so the student can't overwrite a graded submission.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, submissionPath } from "@/lib/blob/paths";
import { cn } from "@/lib/utils";

import { submitEntry } from "../actions";

export interface SubmissionFormProps {
  submissionId: string;
  /** Existing file URLs from the latest entry — preloaded into the form. */
  initialFileUrls?: string[];
  /** When true, the form renders read-only (already graded). */
  disabled?: boolean;
  /** Allow multiple files? Defaults true. */
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  name: string;
  progress: number;
}

export function SubmissionForm({
  submissionId,
  initialFileUrls,
  disabled,
  multiple = true,
  className,
}: SubmissionFormProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<{ name: string; url: string }[]>(
    () =>
      (initialFileUrls ?? []).map((url) => ({
        name: url.split("/").pop() ?? url,
        url,
      })),
  );
  const [uploading, setUploading] = React.useState<UploadingFile[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;

    setUploading((prev) => [
      ...prev,
      ...arr.map((f) => ({ name: f.name, progress: 0 })),
    ]);

    const uploaded = await Promise.all(
      arr.map(async (file) => {
        try {
          const { url } = await uploadFile({
            kind: BlobKind.Submission,
            pathname: submissionPath(submissionId, file.name),
            file,
            onProgress: (f) =>
              setUploading((prev) =>
                prev.map((u) =>
                  u.name === file.name ? { ...u, progress: f } : u,
                ),
              ),
          });
          return { name: file.name, url };
        } catch (e) {
          toast.error(
            `Failed to upload ${file.name}: ${
              e instanceof Error ? e.message : "Upload failed"
            }`,
          );
          return null;
        }
      }),
    );

    const ok = uploaded.filter(
      (a): a is { name: string; url: string } => a !== null,
    );
    if (ok.length > 0) {
      setFiles((prev) => [...prev, ...ok]);
      toast.success(
        ok.length === 1 ? "File uploaded" : `${ok.length} files uploaded`,
      );
    }

    setUploading((prev) =>
      prev.filter((u) => !arr.some((f) => f.name === u.name)),
    );
  }

  function remove(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit() {
    if (files.length === 0) {
      toast.error("Add at least one file before submitting");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitEntry({
        submissionId,
        fileUrl: files.map((f) => f.url),
      });
      if (result?.serverError) throw new Error(result.serverError);
      toast.success("Submitted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          if (!disabled) e.preventDefault();
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "border-input bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm transition-colors",
          !disabled && "hover:border-brand-terracotta/40 cursor-pointer",
          disabled && "opacity-60",
        )}
      >
        <Upload className="text-brand-terracotta size-5" />
        <p className="text-muted-foreground">
          {disabled ? "Submission locked" : "Drop files here, or click to browse"}
        </p>
        <p className="text-muted-foreground text-xs">
          Up to 100 MB each
        </p>
      </div>

      {uploading.length > 0 && (
        <ul className="space-y-1 text-sm">
          {uploading.map((u) => (
            <li
              key={u.name}
              className="text-muted-foreground flex items-center gap-2"
            >
              <Loader2 className="size-3 animate-spin" />
              <span className="truncate">
                Uploading {u.name}…{" "}
                {u.progress > 0 ? `${Math.round(u.progress * 100)}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={`${i}-${f.url}`}
              className="bg-card flex items-center gap-3 rounded-md border p-3"
            >
              <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                <FileUp className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {f.name}
                </p>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground truncate text-xs"
                >
                  Open file
                </a>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div className="flex items-center justify-end gap-3">
          <p className="text-muted-foreground text-xs">
            {files.length} {files.length === 1 ? "file" : "files"} ready
          </p>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || files.length === 0}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
