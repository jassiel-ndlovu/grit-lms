"use client";

/**
 * TestMemoFiles — the tutor attaches a memo / worked-solutions document to
 * the whole test while authoring it. Controlled: the URLs live in the
 * TestForm state and are saved with the rest of the test.
 *
 * Uploads use BlobKind.TestQuestionImage (tutor-only, documents + images)
 * under tests/<testId>/questions/memo/, the same prefix the per-question
 * model-answer files use.
 */

import * as React from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, testQuestionImagePath } from "@/lib/blob/paths";
import { cn } from "@/lib/utils";

function fileNameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(url.split("?")[0]).split("/").pop() ?? url;
    // Vercel Blob appends "-<random>" before the extension; keep it readable.
    return last.replace(/-[A-Za-z0-9]{20,}(\.[^.]+)$/, "$1");
  } catch {
    return url;
  }
}

export function TestMemoFiles({
  testId,
  value,
  onChange,
}: {
  testId: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  async function add(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    setUploading(true);
    const added: string[] = [];
    for (const file of files) {
      const t = toast.loading(`Uploading ${file.name}…`);
      try {
        const { url } = await uploadFile({
          kind: BlobKind.TestQuestionImage,
          pathname: testQuestionImagePath(testId, "memo", file.name),
          file,
        });
        added.push(url);
        toast.success(`Attached ${file.name}.`, { id: t });
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`, {
          id: t,
        });
      }
    }
    setUploading(false);
    if (added.length > 0) onChange([...value, ...added]);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="bg-card border-border flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-7 shrink-0 items-center justify-center rounded">
                <FileText className="size-3.5" />
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {fileNameFromUrl(url)}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-7"
                aria-label="Remove memo file"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading && e.dataTransfer.files) void add(e.dataTransfer.files);
        }}
        className={cn(
          "border-input bg-muted/30 hover:border-brand-terracotta/40 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed p-5 text-sm transition-colors",
          dragOver && "border-brand-terracotta/60 bg-brand-terracotta/5",
        )}
      >
        {uploading ? (
          <Loader2 className="text-brand-terracotta size-4 animate-spin" />
        ) : (
          <Upload className="text-brand-terracotta size-4" />
        )}
        <p className="text-muted-foreground text-xs">
          {value.length > 0 ? "Add another memo document" : "Drop the memo here, or click to browse"}
        </p>
        <p className="text-muted-foreground text-[11px]">PDF, Word, Excel, text or images · up to 25 MB</p>
      </div>
    </div>
  );
}
