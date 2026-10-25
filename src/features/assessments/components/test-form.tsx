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
import { ArrowUpDown, Loader2, PlayCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownTextarea } from "@/components/markdown-textarea";
import { TreeReorderDialog, type ReorderNode } from "@/components/tree-reorder-dialog";
import { LabelSchemeDialog } from "@/components/label-scheme-dialog";
import {
  DraftStatus,
  RestoreDraftBanner,
  SaveProgressButton,
} from "@/components/draft-controls";
import { useLocalDraft } from "@/lib/use-local-draft";
import {
  isDefaultScheme,
  labelTree,
  normalizeScheme,
  type LabelScheme,
} from "@/lib/enum-labels";
import { cn } from "@/lib/utils";
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
import { TestMemoFiles } from "./test-memo-files";

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
    releaseAutoMarksToStudent: boolean;
    preTestInstructions: string | null;
    memoFileUrls?: string[];
    labelScheme?: string[];
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

/** Strip the client-only `clientId` field before sending to the server.
 *  When the clientId encodes a DB id ("id:<dbId>") we forward that id
 *  so updateTest can UPDATE the question in place instead of deleting
 *  and recreating it — which would orphan any student answers keyed by
 *  the old id. */
function toServerTree(qs: EditorQuestion[]): unknown[] {
  return qs.map((q, i) => ({
    // Preserve the DB id for existing questions so student answers stay
    // linked. New questions omit this and get a fresh cuid on insert.
    id: q.clientId.startsWith("id:") ? q.clientId.slice(3) : undefined,
    // Position among siblings. Without it every row stored order = null and
    // the read side fell back to createdAt, so reordering existing
    // questions never stuck.
    order: i,
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

/** Shape persisted by the local auto-save. */
interface TestDraft {
  title: string;
  description: string;
  courseId: string;
  dateStr: string;
  timeStr: string;
  timeLimit: string;
  instructions: string;
  releaseAutoMarks: boolean;
  memoFileUrls: string[];
  labelScheme: LabelScheme;
  questions: EditorQuestion[];
}

function toReorderTree(qs: EditorQuestion[]): ReorderNode[] {
  return qs.map((q) => ({ id: q.clientId, children: toReorderTree(q.subQuestions) }));
}

/** Rebuild the question tree in the arrangement the reorder dialog returned. */
function fromReorderTree(nodes: ReorderNode[], byId: Map<string, EditorQuestion>): EditorQuestion[] {
  return nodes.flatMap((n) => {
    const q = byId.get(n.id);
    return q ? [{ ...q, subQuestions: fromReorderTree(n.children, byId) }] : [];
  });
}

function indexQuestions(qs: EditorQuestion[], into = new Map<string, EditorQuestion>()) {
  for (const q of qs) {
    into.set(q.clientId, q);
    indexQuestions(q.subQuestions, into);
  }
  return into;
}

function plainSnippet(text: string): string {
  const t = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]").replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 80)}…` : t || "(empty)";
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
  const [releaseAutoMarks, setReleaseAutoMarks] = React.useState(
    defaultValues?.releaseAutoMarksToStudent ?? false,
  );
  const [questions, setQuestions] = React.useState<EditorQuestion[]>(
    defaultValues?.questions ?? [],
  );
  const [memoFileUrls, setMemoFileUrls] = React.useState<string[]>(
    defaultValues?.memoFileUrls ?? [],
  );
  const [labelScheme, setLabelScheme] = React.useState<LabelScheme>(
    normalizeScheme(defaultValues?.labelScheme),
  );
  const [reorderOpen, setReorderOpen] = React.useState(false);
  const [pending, setPending] = React.useState<"draft" | "publish" | "preview" | null>(null);

  const computedPoints = sumPoints(questions);
  const labels = React.useMemo(
    () => labelTree(questions, labelScheme, (q) => q.clientId, (q) => q.subQuestions),
    [questions, labelScheme],
  );

  const depths = React.useMemo(() => {
    const m = new Map<string, number>();
    const walk = (qs: EditorQuestion[], d: number) =>
      qs.forEach((q) => {
        m.set(q.clientId, d);
        walk(q.subQuestions, d + 1);
      });
    walk(questions, 0);
    return m;
  }, [questions]);

  /* ─── Local auto-save ─── */

  const draftData = React.useMemo<TestDraft>(
    () => ({
      title,
      description,
      courseId,
      dateStr,
      timeStr,
      timeLimit,
      instructions,
      releaseAutoMarks,
      memoFileUrls,
      labelScheme,
      questions,
    }),
    [title, description, courseId, dateStr, timeStr, timeLimit, instructions, releaseAutoMarks, memoFileUrls, labelScheme, questions],
  );
  const draft = useLocalDraft<TestDraft>({
    key: defaultValues?.id ? `test-edit:${defaultValues.id}` : "test-new",
    data: draftData,
  });
  function restoreDraft(d: TestDraft) {
    setTitle(d.title ?? "");
    setDescription(d.description ?? "");
    if (d.courseId && courses.some((c) => c.id === d.courseId)) setCourseId(d.courseId);
    setDateStr(d.dateStr ?? dateStr);
    setTimeStr(d.timeStr ?? timeStr);
    setTimeLimit(d.timeLimit ?? "");
    setInstructions(d.instructions ?? "");
    setReleaseAutoMarks(Boolean(d.releaseAutoMarks));
    setMemoFileUrls(Array.isArray(d.memoFileUrls) ? d.memoFileUrls : []);
    setLabelScheme(normalizeScheme(d.labelScheme));
    setQuestions(Array.isArray(d.questions) ? d.questions : []);
  }

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

  /**
   * "draft" / "publish" save and go back to the tests list. "preview"
   * saves as a draft-style checkpoint and opens the student preview — it
   * keeps the test's current published state (so previewing a live test
   * never unpublishes it) and skips the "Test updated" notification.
   */
  async function save(mode: "draft" | "publish" | "preview") {
    const publish = mode === "publish";
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
    setPending(mode);
    try {
      const dueDate = new Date(`${dateStr}T${timeStr}`);
      const payload = {
        title,
        description,
        courseId,
        dueDate,
        timeLimit: timeLimit.trim() === "" ? null : Number(timeLimit),
        totalPoints: computedPoints,
        isActive: mode === "preview" ? isActive : publish,
        releaseAutoMarksToStudent: releaseAutoMarks,
        preTestInstructions:
          instructions.trim() === "" ? null : instructions,
        memoFileUrls,
        labelScheme: isDefaultScheme(labelScheme) ? [] : labelScheme,
        // The server schema types `questions` as CreateTestQuestionTree[].
        // We cast because toServerTree strips clientId + normalizes shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: toServerTree(questions) as any,
      };

      let savedId: string | undefined;
      if (isEdit && defaultValues?.id) {
        const result = await updateTest({
          id: defaultValues.id,
          ...payload,
          notifyStudents: mode !== "preview",
        });
        if (result?.serverError) throw new Error(result.serverError);
        if (result?.validationErrors) throw new Error("Some fields were rejected — check every question has text.");
        savedId = result?.data?.id ?? defaultValues.id;
      } else {
        const result = await createTest(payload);
        if (result?.serverError) throw new Error(result.serverError);
        if (result?.validationErrors) throw new Error("Some fields were rejected — check every question has text.");
        savedId = result?.data?.id;
      }
      toast.success(publish ? "Test published" : "Draft saved");
      // The server has it now; the local safety copy has done its job.
      draft.clear();
      if (mode === "preview") {
        if (!savedId) throw new Error("Saved, but couldn't open the preview — open it from the tests list.");
        router.push(`/dashboard/tutor-tests/${savedId}/preview`);
      } else {
        router.push("/dashboard/tutor-tests");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setPending(null);
    }
  }

  return (
    <div className="space-y-6 pb-40">
      <RestoreDraftBanner draft={draft} onRestore={restoreDraft} what="this test" />

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
          <MarkdownTextarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short blurb the students see on their tests list."
            previewTitle="Description preview"
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
          <MarkdownTextarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Rules, materials allowed, tone, etc. Rendered above the timer on the pre-test page."
            previewTitle="Pre-test instructions preview"
          />
        </div>

        {/* Release-to-student toggle for the auto-marker. When on, the
            student sees their auto-marked grade the moment they submit
            (with a note that subjective bits are still pending). When
            off, the tutor still gets an auto-marked pre-fill in the
            grading UI, but the student sees no grade until release. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
          <input
            type="checkbox"
            checked={releaseAutoMarks}
            onChange={(e) => setReleaseAutoMarks(e.target.checked)}
            className="mt-1 size-4 accent-brand-terracotta"
          />
          <span className="space-y-0.5 text-sm">
            <span className="text-foreground block font-medium">
              Release auto-marks to students at submit time
            </span>
            <span className="text-muted-foreground block text-xs">
              Objective questions (multiple choice, matching, numeric, etc.)
              are graded automatically from your answer keys. Subjective
              questions still wait for you. Uncheck to keep all grades
              hidden until you release them manually.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Memo <span className="text-muted-foreground">(optional)</span>
          </label>
          <p className="text-muted-foreground text-xs">
            The full worked solutions for this test, if you have them as a
            document. Students can open it from their review page once their
            attempt has been graded.
          </p>
          <TestMemoFiles
            testId={defaultValues?.id ?? "draft"}
            value={memoFileUrls}
            onChange={setMemoFileUrls}
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
          <div className="flex flex-wrap items-center gap-2">
            <LabelSchemeDialog scheme={labelScheme} onChange={setLabelScheme} noun="question" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={questions.length === 0}
              onClick={() => setReorderOpen(true)}
            >
              <ArrowUpDown className="size-3.5" /> Rearrange
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="size-3" /> Add question
            </Button>
          </div>
        </div>

        {/* Jump list — one chip per question, so long tests are navigable by label. */}
        {labels.size > 1 && (
          <nav aria-label="Jump to question" className="flex flex-wrap gap-1">
            {[...labels.entries()].map(([id, label]) => {
              const depth = depths.get(id) ?? 0;
              return (
                <a
                  key={id}
                  href={`#q-${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "border-border bg-card hover:border-brand-terracotta/50 hover:text-foreground rounded border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors",
                    depth === 0 ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </a>
              );
            })}
          </nav>
        )}

        <TreeReorderDialog
          open={reorderOpen}
          onOpenChange={setReorderOpen}
          title="Rearrange questions"
          tree={toReorderTree(questions)}
          scheme={labelScheme}
          tooltip={(id) => {
            const q = indexQuestions(questions).get(id);
            return q ? plainSnippet(q.question) : undefined;
          }}
          onApply={(tree) => setQuestions(fromReorderTree(tree, indexQuestions(questions)))}
        />

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
                label={labels.get(q.clientId) ?? String(i + 1)}
                labels={labels}
                depth={0}
                testId={defaultValues?.id ?? "draft"}
              />
            ))}
          </div>
        )}
      </div>

      {/* ───── Sticky save bar ───── */}
      <div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="space-y-0.5">
            <div className="text-muted-foreground text-xs">
              {questions.length} question{questions.length === 1 ? "" : "s"} · {" "}
              {computedPoints} points
            </div>
            <DraftStatus draft={draft} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SaveProgressButton draft={draft} />
            <Button
              type="button"
              variant="outline"
              onClick={() => save("preview")}
              disabled={pending !== null}
              title={
                isActive
                  ? "Save your changes (students aren't notified) and open the student preview"
                  : "Save as a draft and open the student preview"
              }
            >
              {pending === "preview" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              Preview as student
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => save("draft")}
              disabled={pending !== null}
            >
              {pending === "draft" && <Loader2 className="size-4 animate-spin" />}
              Save draft
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={() => save("publish")}
              disabled={pending !== null}
            >
              {pending === "publish" && <Loader2 className="size-4 animate-spin" />}
              {isActive || !isEdit ? "Publish" : "Publish updates"}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
