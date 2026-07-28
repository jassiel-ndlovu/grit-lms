"use client";

/**
 * ImportTestDialog — tutor uploads a JSON file (or pastes JSON) to create
 * a new test. Also surfaces a "Copy prompt for LLMs" button so tutors
 * can generate tests with the correct schema in ChatGPT / Claude / etc.
 *
 * Flow:
 *   1. Tutor picks a course (skipped if they only own one).
 *   2. Drops a .json file OR pastes into the textarea.
 *   3. Client-side parseTestJson validates + coerces the payload.
 *   4. importTest server action creates the test transactionally.
 *   5. On success we route to the edit page so the tutor can review.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { importTest } from "../actions";
import { parseTestJson, toCreateInput, TEST_JSON_GUIDE } from "../lib/test-io";

export interface ImportTestDialogProps {
  courses: { id: string; name: string }[];
}

export function ImportTestDialog({ courses }: ImportTestDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [courseId, setCourseId] = React.useState<string>(courses[0]?.id ?? "");
  const [raw, setRaw] = React.useState<string>("");
  const [pending, setPending] = React.useState(false);
  const [copiedGuide, setCopiedGuide] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    const text = await file.text();
    setRaw(text);
  }

  async function copyGuide() {
    try {
      await navigator.clipboard.writeText(TEST_JSON_GUIDE);
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 2000);
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  }

  async function onImport() {
    if (!courseId) {
      toast.error("Pick a course to import into");
      return;
    }
    if (!raw.trim()) {
      toast.error("Paste JSON or upload a file first");
      return;
    }
    setPending(true);
    try {
      const parsed = parseTestJson(raw);
      const result = await importTest(toCreateInput(parsed, courseId));
      if (result?.serverError) throw new Error(result.serverError);
      const id = result?.data?.id;
      toast.success("Test imported");
      setOpen(false);
      if (id) {
        router.push(`/dashboard/tutor-tests/${id}/edit`);
      } else {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="size-4" />
          Import JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import a test from JSON</DialogTitle>
          <DialogDescription>
            Upload a JSON file or paste the JSON below. Use the &quot;Copy
            LLM prompt&quot; button to give the schema to an LLM so it can
            generate a test in the right shape.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={copyGuide}
          >
            {copiedGuide ? (
              <>Copied</>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Copy LLM prompt
              </>
            )}
          </Button>
          <span className="text-muted-foreground text-xs">
            Paste this in ChatGPT / Claude / etc. to have it generate an
            importable test.
          </span>
        </div>

        {courses.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">
              Course
            </label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-foreground text-sm font-medium">
              JSON payload
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-3.5" /> Upload .json
            </Button>
          </div>
          <Textarea
            rows={12}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='{"version": 1, "title": "...", ...}'
            className={cn(
              "font-mono text-xs",
              raw.trim() === "" && "text-muted-foreground",
            )}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Imported tests are created as drafts (isActive = false) unless the
            JSON says otherwise.
          </p>
          <Button
            type="button"
            variant="brand"
            onClick={onImport}
            disabled={pending || !raw.trim()}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            <ClipboardCopy className="size-4" />
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
