"use client";

/**
 * MarkdownTextarea — a <Textarea> with a "Preview render" button.
 *
 * Tutor-authored text is stored as Markdown + MathJax and only rendered on
 * the student side, so a stray `$` or an unclosed `\(` used to go unnoticed
 * until a student saw it. The button opens a modal that renders the current
 * contents through the same <LessonMarkdown> the student pages use, so what
 * the tutor sees is exactly what gets shown.
 *
 * Drop-in: accepts every <textarea> prop. `previewTitle` names the modal.
 * <PreviewRenderButton> is exported on its own for fields that aren't a
 * plain Textarea (e.g. one wrapped in a drop zone).
 */

import * as React from "react";
import { Eye } from "lucide-react";

import LessonMarkdown from "@/app/components/markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PreviewRenderButtonProps {
  content: string;
  title?: string;
  className?: string;
}

export function PreviewRenderButton({
  content,
  title = "Preview render",
  className,
}: PreviewRenderButtonProps) {
  const [open, setOpen] = React.useState(false);
  const empty = content.trim() === "";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Eye className="size-3.5" />
        Preview render
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">{title}</DialogTitle>
            <DialogDescription>
              Rendered with Markdown and MathJax, exactly as students will see it.
            </DialogDescription>
          </DialogHeader>
          <div className="border-border bg-card max-h-[65vh] overflow-y-auto rounded-md border p-5">
            {empty ? (
              <p className="text-muted-foreground text-sm italic">
                Nothing to preview yet.
              </p>
            ) : (
              // Only mounted while open, so the MathJax pass runs on demand
              // rather than on every keystroke in the field behind it.
              open && <LessonMarkdown content={content} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface MarkdownTextareaProps
  extends React.ComponentProps<typeof Textarea> {
  previewTitle?: string;
  /** Class for the wrapper around the textarea + button row. */
  wrapperClassName?: string;
}

export const MarkdownTextarea = function MarkdownTextarea({
  previewTitle,
  wrapperClassName,
  value,
  ...props
}: MarkdownTextareaProps) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return (
    <div className={cn("space-y-1", wrapperClassName)}>
      <Textarea value={value} {...props} />
      <div className="flex justify-end">
        <PreviewRenderButton content={text} title={previewTitle} />
      </div>
    </div>
  );
};
