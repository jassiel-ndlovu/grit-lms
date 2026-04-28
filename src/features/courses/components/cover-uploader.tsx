"use client";

/**
 * CoverUploader — drag/drop or click-to-pick image upload for course covers.
 *
 * Uploads directly to Vercel Blob via /api/blob/upload-token (no 4.5 MB
 * function body cap). Reports progress and exposes the resulting public
 * URL to the parent via onChange.
 *
 * The parent owns the URL — this component is uncontrolled with respect to
 * server state. Use it inside a CourseForm RHF field.
 */

import * as React from "react";
import Image from "next/image";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, courseCoverPath } from "@/lib/blob/paths";

export interface CoverUploaderProps {
  /** A pseudo-id used to build the blob path before the course exists. */
  courseId: string;
  /** Current cover URL, or null/empty for "no cover". */
  value: string | null;
  /** Called with the new URL after a successful upload, or "" to clear. */
  onChange: (url: string) => void;
  /** Optional class for the outer wrapper. */
  className?: string;
}

export function CoverUploader({
  courseId,
  value,
  onChange,
  className,
}: CoverUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);

  async function handleFile(file: File) {
    setProgress(0);
    try {
      const { url } = await uploadFile({
        kind: BlobKind.CourseCover,
        pathname: courseCoverPath(courseId, file.name),
        file,
        onProgress: (f) => setProgress(f),
      });
      onChange(url);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "border-input bg-muted/30 hover:border-ring relative flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors",
          progress !== null && "pointer-events-none opacity-70",
        )}
      >
        {value ? (
          <Image
            src={value}
            alt="Course cover"
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <ImageIcon className="size-8" />
            <span>Drop an image, or click to browse</span>
            <span className="text-xs">PNG, JPEG, or WebP — up to 10 MB</span>
          </div>
        )}

        {progress !== null && (
          <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
            <Loader2 className="text-primary size-6 animate-spin" />
            <div className="bg-muted h-1 w-32 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange("")}
        >
          <X className="size-3" />
          Remove cover
        </Button>
      )}
    </div>
  );
}
