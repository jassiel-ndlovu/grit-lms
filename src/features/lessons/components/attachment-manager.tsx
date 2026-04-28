"use client";

/**
 * AttachmentManager — controlled list editor for lesson attachments.
 *
 * Each attachment is a `{ title, url }` pair. Two ways to add an attachment:
 *
 *   1. Drag/drop a file (or click "Upload file"): the file is uploaded
 *      directly to Vercel Blob via `/api/blob/upload-token`, and the
 *      resulting public URL becomes the attachment's `url`. The title is
 *      derived from the filename and remains editable.
 *
 *   2. "Add link": appends an empty row whose `title` and `url` the user
 *      types in by hand — useful for external references (YouTube, docs,
 *      etc.) that don't need to live in our blob storage.
 *
 * The component is fully controlled — it never owns attachment state itself
 * so it composes cleanly inside react-hook-form via Controller / FormField.
 */

import * as React from "react";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadFile } from "@/lib/blob/client";
import {
  BlobKind,
  lessonAttachmentPath,
  sanitizeFilename,
} from "@/lib/blob/paths";
import { cn } from "@/lib/utils";

export interface AttachmentInput {
  title: string;
  url: string;
}

export interface AttachmentManagerProps {
  /** Course id — used for blob path. */
  courseId: string;
  /** Lesson id (real or pseudo) — used for blob path. */
  lessonId: string;
  /** Current attachment list. */
  value: AttachmentInput[];
  /** Called whenever the list changes. */
  onChange: (next: AttachmentInput[]) => void;
  className?: string;
}

/** Strip the file extension so the default title reads cleanly. */
function deriveTitleFromFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || base;
}

export function AttachmentManager({
  courseId,
  lessonId,
  value,
  onChange,
  className,
}: AttachmentManagerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingNames, setUploadingNames] = React.useState<string[]>([]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploadingNames((prev) => [...prev, ...list.map((f) => f.name)]);

    const uploaded = await Promise.all(
      list.map(async (file) => {
        try {
          const { url } = await uploadFile({
            kind: BlobKind.LessonAttachment,
            pathname: lessonAttachmentPath(
              courseId,
              lessonId,
              sanitizeFilename(file.name),
            ),
            file,
          });
          return { title: deriveTitleFromFilename(file.name), url };
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

    const ok = uploaded.filter((a): a is AttachmentInput => a !== null);
    if (ok.length > 0) {
      onChange([...value, ...ok]);
      toast.success(
        ok.length === 1
          ? "Attachment uploaded"
          : `${ok.length} attachments uploaded`,
      );
    }

    setUploadingNames((prev) =>
      prev.filter((n) => !list.some((f) => f.name === n)),
    );
  }

  function update(index: number, patch: Partial<AttachmentInput>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addLink() {
    onChange([...value, { title: "", url: "" }]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
        className="border-input bg-muted/30 hover:border-ring flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm transition-colors"
      >
        <Upload className="text-muted-foreground size-5" />
        <p className="text-muted-foreground">
          Drop files here, or{" "}
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            click to browse
          </button>
        </p>
        <p className="text-muted-foreground text-xs">
          PDFs, images, Office docs — up to 100 MB each
        </p>
      </div>

      {uploadingNames.length > 0 && (
        <ul className="space-y-1 text-sm">
          {uploadingNames.map((name) => (
            <li
              key={name}
              className="text-muted-foreground flex items-center gap-2"
            >
              <Loader2 className="size-3 animate-spin" />
              <span className="truncate">Uploading {name}…</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {value.length === 0
            ? "No attachments yet"
            : `${value.length} attachment${value.length === 1 ? "" : "s"}`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addLink}>
          <Plus className="size-3" /> Add link
        </Button>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((a, i) => (
            <li
              key={`${i}-${a.url || "new"}`}
              className="bg-card flex items-start gap-2 rounded-md border p-3"
            >
              <FileText className="text-muted-foreground mt-2 size-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Input
                  value={a.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Resource title"
                />
                <Input
                  type="url"
                  value={a.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="https://example.com/file.pdf"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
                aria-label={`Remove attachment ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
