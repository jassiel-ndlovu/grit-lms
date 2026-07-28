/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

/**
 * TestForm — tutor authoring surface for a Test + its question tree.
 *
 * Mode is determined by `defaultValues.id`:
 *   - present → calls updateTest
 *   - absent  → calls createTest
 *
 * Owns metadata state (title, description, courseId, dueDate, timeLimit,
 * totalPoints, isActive, preTestInstructions) plus the full question tree
 * (EditorQuestion[]). Each question is rendered by <TestQuestionEditor>,
 * which recurses on its own sub-questions.
 *
 * Save / publish buttons:
 *   - "Save draft"  → isActive stays whatever it was (default false)
 *   - "Publish"     → sets isActive true; students see the test immediately
 *                      and a TEST_CREATED / TEST_UPDATED notification fires
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createTest, updateTest } from "../actions";
import {
  TestQuestionEditor,
  blankQuestion,
  type EditorQuestion,
} from "./test-question-editor";

export interface TestFormCourse {
  id: string;
  name: string;
}

export interface TestFormProps {
  /** Courses the tutor owns; the picker is locked when only one is available. */
  courses: TestFormCourse[];
  /** When present the form loads in edit mode. */
  defaultValues?: {
    id?: string;
    title: string;
    description: string;
    courseId: string;
    dueDate: Date;
    timeLimit: number | null;
    totalPoints: number;
    isActive: boolean;
    preTestInstructions: string | null;
    questions: EditorQuestion[];
  };
}

function splitDate(d: Date): { date: string; time: string } {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Strip the client-only `clientId` field before sending to the server. */
function toServerTree(qs: EditorQuestion[]): unknown[] {
  return qs.map((q) => ({
    question: q.question,
    type: q.type,
    points: q.points,
    options: q.options,
    answer: q.answer,
    language: q.language,
    matchPairs: q.matchPairs.length > 0 ? q.matchPairs : undefined,
    reorderItems: q.reorderItems,
    blankCount: q.blankCount,
    subQuestions: toServerTree(q.subQuestions),
  }));
}

/** Sum points across the tree, skipping NONE-typed context blocks. */
function sumPoints(qs: EditorQuestion[]): number {
  let n = 0;
  for (const q of qs) {
    if (q.type !== "NONE") n += q.points;
    if (q.subQuestions.length > 0) n += sumPoints(q.subQuestions);
  }
  return n;
}

export function TestForm({ courses, defaultValues }: TestFormProps) {
  const router = useRouter();
  const isEdit = Boolean(defaultValues?.id);

  const initialDue = defaultValues?.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const initialSplit = splitDate(initialDue);

  const [title, setTitle] = React.useState(defaultValues?.title ?? "");
  const [description, setDescription] = React.useState(
    defaultValues?.description ?? "",
  );
  const [courseId, setCourseId] = React.useState(
    defaultValues?.courseId ?? courses[0]?.id ?? "",
  );
  const [dateStr, setDateStr] = React.useState(initialSplit.date);
  const [timeStr, setTimeStr] = React.useState(initialSplit.time);
  const [timeLimit, setTimeLimit] = React.useState<string>(
    defaultValues?.timeLimit ? String(defaultValues.timeLimit) : "",
  );
  const [instructions, setInstructions] = React.useState(
    defaultValues?.preTestInstructions ?? "",
  );
  const [isActive, setIsActive] = React.useState(defaultValues?.isActive ?? false);
  const [questions, setQuestions] = React.useState<EditorQuestion[]>(
    defaultValues?.questions ?? [],
  );
  const [pending, setPending] = React.useState<"draft" | "publish" | null>(null);

  const computedPoints = sumPoints(questions);

  /* ─── Question mutators ─── */

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }
  function updateQuestion(i: number, next: EditorQuestion) {
    setQuestions((prev) => {
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    });
  }
  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, j) => j !== i));
  }
  function moveQuestion(i: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  /* ─── Save ─── */

  async function save(publish: boolean) {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!courseId) {
      toast.error("Pick a course");
      return;
    }
    if (!dateStr || !timeStr) {
      toast.error("Due date and time are required");
      return;
    }
    setPending(publish ? "publish" : "draft");
    try {
      const dueDate = new Date(`${dateStr}T${timeStr}`);
      const payload = {
        title,
        description,
        courseId,
        dueDate,
        timeLimit: timeLimit.trim() === "" ? null : Number(timeLimit),
        totalPoints: computedPoints,
        isActive: publish,
        preTestInstructions:
          instructions.trim() === "" ? null : instructions,
        // The server schema types `questions` as CreateTestQuestionTree[].
        // We cast because toServerTree strips clientId + normalizes shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: toServerTree(questions) as any,
      };

      if (isEdit && defaultValues?.id) {
        const result = await updateTest({
          id: defaultValues.id,
          ...payload,
        });
        if (result?.serverError) throw new Error(result.serverError);
        toast.success(publish ? "Test published" : "Draft saved");
      } else {
        const result = await createTest(payload);
        if (result?.serverError) throw new Error(result.serverError);
        toast.success(publish ? "Test published" : "Draft saved");
      }
      router.push("/dashboard/tutor-tests");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setPending(null);
    }
  }

  return (
    <div className="space-y-6 pb-40">
      {/* ───── Metadata ───── */}
      <Card className="space-y-5 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Test details
          </h2>
          {isEdit && (
            <Badge variant={isActive ? "soft" : "secondary"}>
              {isActive ? "Published" : "Draft"}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Unit 3 quiz"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Description
          </label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short blurb the students see on their tests list."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Course</label>
            <Select value={courseId} onValueChange={setCourseId} disabled={courses.length <= 1}>
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
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">
              Time limit (minutes)
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Leave empty for untimed"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Due date</label>
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Due time</label>
            <Input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Pre-test instructions
          </label>
          <Textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Rules, materials allowed, tone, etc. Rendered above the timer on the pre-test page."
          />
        </div>
      </Card>

      {/* ───── Questions ───── */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Questions
            </h2>
            <p className="text-muted-foreground text-xs">
              {questions.length} top-level · {computedPoints} points total
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="size-3" /> Add question
          </Button>
        </div>

        {questions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground text-sm">
              No questions yet. Add one to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <TestQuestionEditor
                key={q.clientId}
                question={q}
                onChange={(next) => updateQuestion(i, next)}
                onRemove={() => removeQuestion(i)}
                onMoveUp={i > 0 ? () => moveQuestion(i, -1) : undefined}
                onMoveDown={
                  i < questions.length - 1 ? () => moveQuestion(i, 1) : undefined
                }
                label={String(i + 1)}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      {/* ───── Sticky save bar ───── */}
      <div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="text-muted-foreground text-xs">
            {questions.length} question{questions.length === 1 ? "" : "s"} · {" "}
            {computedPoints} points
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => save(false)}
              disabled={pending !== null}
            >
              {pending === "draft" && <Loader2 className="size-4 animate-spin" />}
              Save draft
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={() => save(true)}
              disabled={pending !== null}
            >
              {pending === "publish" && <Loader2 className="size-4 animate-spin" />}
              {isActive || !isEdit ? "Publish" : "Publish updates"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preserve `sub-letters` reference so future dotted-label logic can
          reuse it without re-declaring. */}
      <span className="hidden" data-sub-letters={SUB_LETTERS} />
    </div>
  );
}
