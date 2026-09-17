/**
 * EntryGradingForm — tutor grades a single SubmissionEntry.
 *
 * Two modes controlled by a single "Break into sections" switch:
 *
 *   OFF — the tutor enters a total score, an "out of", and free-form
 *         feedback. This is the fast path when the assignment is small
 *         or the tutor already has a mark in mind.
 *
 *   ON  — the tutor lists sections (title, remarks, score, out-of,
 *         optional memo file). A single click sums section scores into
 *         the overall score. Sections replace any previously-stored
 *         sections for this entry on save.
 *
 * Sections are persisted through `gradeEntryWithSections` — see
 * features/submissions/actions.ts. The action wipes and recreates the
 * entry's QuestionGrade rows in one transaction.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileUp,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Sigma,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, submissionPath } from "@/lib/blob/paths";

import { gradeEntryWithSections } from "../actions";

export interface EntryGradingFormSection {
  title: string;
  remarks: string;
  score: number;
  outOf: number;
  memoFileUrl: string | null;
}

export interface EntryGradingFormProps {
  entryId: string;
  submissionId: string;
  totalPointsDefault: number;
  defaultValues: {
    score: number;
    outOf: number;
    feedback: string;
    sections: EntryGradingFormSection[];
  };
}

function blank(outOf: number): EntryGradingFormSection {
  return { title: "", remarks: "", score: 0, outOf, memoFileUrl: null };
}

export function EntryGradingForm({
  entryId,
  submissionId,
  totalPointsDefault,
  defaultValues,
}: EntryGradingFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  // Sections with a memo upload still in flight. Saving mid-upload would
  // persist the section with memoFileUrl still null and silently lose the
  // file the tutor just picked.
  const [uploadingIdx, setUploadingIdx] = React.useState<Set<number>>(
    () => new Set(),
  );
  const [score, setScore] = React.useState<number>(defaultValues.score);
  const [outOf, setOutOf] = React.useState<number>(
    defaultValues.outOf || totalPointsDefault || 1,
  );
  const [feedback, setFeedback] = React.useState<string>(defaultValues.feedback);
  const [sectionsOn, setSectionsOn] = React.useState<boolean>(
    defaultValues.sections.length > 0,
  );
  const [sections, setSections] = React.useState<EntryGradingFormSection[]>(
    defaultValues.sections.length > 0
      ? defaultValues.sections
      : [blank(totalPointsDefault || 10)],
  );

  function updateSection(
    i: number,
    patch: Partial<EntryGradingFormSection>,
  ) {
    setSections((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  function addSection() {
    setSections((prev) => [...prev, blank(10)]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  function autoSum() {
    const nextScore = sections.reduce((a, s) => a + (s.score || 0), 0);
    const nextOutOf = sections.reduce((a, s) => a + (s.outOf || 0), 0);
    setScore(nextScore);
    setOutOf(nextOutOf || 1);
    toast.success(`Summed: ${nextScore}/${nextOutOf || 0}.`);
  }

  function markUploading(i: number, on: boolean) {
    setUploadingIdx((prev) => {
      const next = new Set(prev);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });
  }

  async function handleMemoUpload(i: number, file: File) {
    updateSection(i, { memoFileUrl: null });
    markUploading(i, true);
    const uploadingToast = toast.loading(`Uploading ${file.name}…`);
    try {
      const { url } = await uploadFile({
        kind: BlobKind.Submission,
        pathname: submissionPath(submissionId, `memo-${Date.now()}-${file.name}`),
        file,
      });
      updateSection(i, { memoFileUrl: url });
      toast.success(`Uploaded ${file.name}.`, { id: uploadingToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: uploadingToast,
      });
    } finally {
      markUploading(i, false);
    }
  }

  /** True when a section carries anything the tutor would expect to keep. */
  function sectionHasContent(s: EntryGradingFormSection): boolean {
    return (
      s.title.trim().length > 0 ||
      s.remarks.trim().length > 0 ||
      s.memoFileUrl !== null ||
      s.score > 0
    );
  }

  async function onSave() {
    if (outOf <= 0) {
      toast.error("Out-of must be greater than zero.");
      return;
    }
    if (score > outOf) {
      toast.error("Score can't exceed the out-of.");
      return;
    }
    if (uploadingIdx.size > 0) {
      toast.error("A memo is still uploading - wait for it to finish.");
      return;
    }

    // Keep every section the tutor put something into. This used to filter
    // on a non-empty title, so attaching a memo to an otherwise-untitled
    // section threw the section (and the memo) away on save without saying
    // anything. Untitled sections get a positional name instead.
    const kept = sectionsOn ? sections.filter(sectionHasContent) : [];

    // The server schema requires outOf > 0 per section; catch it here so the
    // tutor gets a pointed message rather than a generic rejection.
    const badIdx = kept.findIndex((s) => s.outOf <= 0);
    if (badIdx !== -1) {
      toast.error(`Section ${badIdx + 1} needs an out-of greater than zero.`);
      return;
    }

    const cleanedSections = kept.map((s, i) => ({
      title: s.title.trim() || `Section ${i + 1}`,
      remarks: s.remarks,
      score: s.score,
      outOf: s.outOf,
      memoFileUrl: s.memoFileUrl,
    }));

    setPending(true);
    try {
      const res = await gradeEntryWithSections({
        entryId,
        score,
        outOf,
        feedback: feedback.trim().length > 0 ? feedback : null,
        sections: cleanedSections,
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      // A schema rejection comes back as validationErrors with no data -
      // that used to fall through to the success toast, so a refused save
      // looked identical to a successful one and the memo just vanished.
      if (res?.validationErrors) {
        console.warn("[EntryGradingForm] rejected:", res.validationErrors);
        toast.error(
          "Some fields were rejected - check each section's score and out-of.",
        );
        return;
      }
      if (!res?.data) {
        toast.error("Save did not complete. Please try again.");
        return;
      }
      toast.success("Grade saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  const pct = outOf > 0 ? Math.round((score / outOf) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-lg leading-tight">Grade</h2>
            <p className="text-muted-foreground text-sm">
              Enter a total score, or break it into sections below for a
              richer breakdown the student can see.
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Percent
            </p>
            <p className="font-display text-2xl tabular-nums text-foreground">
              {pct}%
            </p>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-24 space-y-1">
            <span className="text-muted-foreground text-xs">Score</span>
            <Input
              type="number"
              step="0.5"
              min={0}
              value={score}
              onChange={(e) => setScore(Number(e.target.value) || 0)}
              className="w-24"
            />
          </label>
          <span className="text-muted-foreground pb-2">/</span>
          <label className="min-w-24 space-y-1">
            <span className="text-muted-foreground text-xs">Out of</span>
            <Input
              type="number"
              step="0.5"
              min={1}
              value={outOf}
              onChange={(e) => setOutOf(Number(e.target.value) || 1)}
              className="w-24"
            />
          </label>
          {sectionsOn && sections.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoSum}
              className="ml-auto"
            >
              <Sigma className="mr-1 size-4" /> Sum from sections
            </Button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Overall feedback</label>
          <Textarea
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional — overall feedback for the student."
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg leading-tight">
              Break into sections
            </h2>
            <p className="text-muted-foreground text-sm">
              Optional. Give the student a per-section score, remarks, and
              (optionally) a memo file per section.
            </p>
          </div>
          <Switch
            checked={sectionsOn}
            onCheckedChange={setSectionsOn}
            aria-label="Toggle section-by-section grading"
          />
        </div>

        {sectionsOn && (
          <>
            <Separator className="my-4" />
            <ul className="space-y-4">
              {sections.map((s, i) => (
                <li
                  key={i}
                  className="border-border rounded-md border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className="text-muted-foreground text-xs">
                        Section title
                      </label>
                      <Input
                        value={s.title}
                        onChange={(e) =>
                          updateSection(i, { title: e.target.value })
                        }
                        placeholder={`Section ${i + 1} title`}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="space-y-1">
                        <span className="text-muted-foreground text-xs">
                          Score
                        </span>
                        <Input
                          type="number"
                          step="0.5"
                          min={0}
                          value={s.score}
                          onChange={(e) =>
                            updateSection(i, {
                              score: Number(e.target.value) || 0,
                            })
                          }
                          className="w-20"
                        />
                      </label>
                      <span className="text-muted-foreground pb-2">/</span>
                      <label className="space-y-1">
                        <span className="text-muted-foreground text-xs">
                          Out of
                        </span>
                        <Input
                          type="number"
                          step="0.5"
                          min={0}
                          value={s.outOf}
                          onChange={(e) =>
                            updateSection(i, {
                              outOf: Number(e.target.value) || 0,
                            })
                          }
                          className="w-20"
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(i)}
                        aria-label="Remove section"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">
                      Remarks / comments
                    </label>
                    <Textarea
                      rows={2}
                      value={s.remarks}
                      onChange={(e) =>
                        updateSection(i, { remarks: e.target.value })
                      }
                      placeholder="e.g. Working is correct but the units are missing."
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="border-input hover:bg-muted/40 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                      <FileUp className="size-3.5" />
                      {uploadingIdx.has(i)
                        ? "Uploading…"
                        : s.memoFileUrl
                          ? "Replace memo"
                          : "Attach memo (optional)"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingIdx.has(i)}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleMemoUpload(i, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {s.memoFileUrl && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Paperclip className="text-brand-terracotta size-3" />
                        <a
                          href={s.memoFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-terracotta underline"
                        >
                          Memo attached
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            updateSection(i, { memoFileUrl: null })
                          }
                          className="text-muted-foreground hover:text-foreground ml-1"
                          aria-label="Remove memo"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
              >
                <Plus className="mr-1 size-4" /> Add section
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={pending || uploadingIdx.size > 0}
          className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
        >
          {pending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save grade
        </Button>
      </div>
    </div>
  );
}
