/**
 * MemoFilesEditor — tutor-only. Drop memo / model-answer files onto an
 * assignment. Files upload via the Blob token flow and are persisted onto
 * `Submission.memoFileUrls` via the `updateSubmission` server action.
 *
 * Everything students see comes from the persisted list; nothing is
 * visible until the tutor commits.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Paperclip, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, submissionPath } from "@/lib/blob/paths";

import { updateSubmission } from "../actions";

interface MemoFile {
  name: string;
  url: string;
}

interface Props {
  submissionId: string;
  initialUrls: string[];
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("?")[0]).split("/").pop() ?? url;
  } catch {
    return url;
  }
}

export function MemoFilesEditor({ submissionId, initialUrls }: Props) {
  const router = useRouter();
  const [files, setFiles] = React.useState<MemoFile[]>(
    initialUrls.map((url) => ({ name: fileNameFromUrl(url), url })),
  );
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const initial = React.useRef(initialUrls.join("\n"));
  const dirty = files.map((f) => f.url).join("\n") !== initial.current;

  async function onSelect(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    const uploaded: MemoFile[] = [];
    for (const file of Array.from(list)) {
      const t = toast.loading(`Uploading ${file.name}…`);
      try {
        const { url } = await uploadFile({
          kind: BlobKind.Submission,
          pathname: submissionPath(
            submissionId,
            `memo-${Date.now()}-${file.name}`,
          ),
          file,
        });
        uploaded.push({ name: file.name, url });
        toast.success(`Uploaded ${file.name}.`, { id: t });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", {
          id: t,
        });
      }
    }
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await updateSubmission({
        id: submissionId,
        memoFileUrls: files.map((f) => f.url),
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      initial.current = files.map((f) => f.url).join("\n");
      toast.success("Memo files saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
          No memo files attached to this assignment yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={f.url + i}
              className="bg-muted/30 flex items-center justify-between gap-2 rounded-md px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs hover:underline"
                >
                  {f.name}
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAt(i)}
                aria-label="Remove"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onSelect(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 size-4" />
          )}
          {uploading ? "Uploading…" : "Add memo file"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !dirty}
          className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
        >
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
