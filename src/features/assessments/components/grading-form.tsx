"use client";

/**
 * GradingForm — tutor grades a single student's test submission.
 *
 * Owns the per-question grade state (score + feedback per question) plus
 * an overall feedback field. Overall score defaults to the sum of every
 * per-question score but the tutor can override with a manual value.
 *
 * On submit → gradeTestSubmission({ submissionId, score, outOf, feedback,
 * questionGrades }). That action is transactional: upserts the Grade row
 * and replaces every QuestionGrade in one write.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, ExternalLink, FileText, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownTextarea } from "@/components/markdown-textarea";
import {
  DraftStatus,
  RestoreDraftBanner,
  SaveProgressButton,
} from "@/components/draft-controls";
import { NexusLoader } from "@/components/ui/nexus";
import { useLocalDraft } from "@/lib/use-local-draft";
import { formatLabel, normalizeScheme, type LabelScheme } from "@/lib/enum-labels";
import { cn } from "@/lib/utils";
import { criterionMarksFromText, criterionMarksText, criterionScoreTotal, type Rubric } from "../lib/rubric";
import LessonMarkdown from "@/app/components/markdown";
import { AnswerText, MathsAnswerText } from "@/components/content/answer-text";

import { EmailStudentCheckbox } from "@/features/notifications/components/email-student-checkbox";
import { WriteGuard, useReadOnly } from "@/components/shell/workspace-access";
import { getAiSuggestions, recordAiSuggestionAction } from "@/features/ai-marking/actions";

import { gradeTestSubmission } from "../actions";
import { markKey, withComment } from "../lib/marking-flow";
import { toFileAnswers, toFileUploadMemo } from "../lib/file-answers";
import {
  awaitingReview,
  criteriaOf,
  finalActions,
  highlightRuns,
  isAiMarkedType,
  isPending,
  provenanceOf,
  type AiSuggestion,
  type AiTutorAction,
  type Provenance,
} from "../lib/ai-marking-ui";
import { AiSuggestionCard, HighlightedAnswer } from "./ai-suggestion-card";
import { usePublishGrading } from "./grading-session";

/* ─── Shapes ───────────────────────────────────────────────────────────── */

export type GradingQuestion = {
  id: string;
  parentId: string | null;
  order: number | null;
  type: string;
  question: string;
  points: number;
  options: string[];
  blankCount: number | null;
  reorderItems: string[];
  matchPairs: unknown;
  // Tutor's correct-answer key from test creation — displayed alongside
  // the student's answer so the tutor can compare at a glance.
  correctAnswer: unknown;
  /** MATH_EXPRESSION only: how the answer is marked. */
  mathMode?: string | null;
  /** The question's rubric (lib/rubric.ts); with two or more criteria the card marks each. */
  rubric?: Rubric | null;
  subQuestions: GradingQuestion[];
};

const MATH_MODE_LABEL: Record<string, string> = {
  EQUIVALENT: "Any equivalent form is right.",
  FORM: "Must be in the same form as the key.",
  MARGIN: "A number within the key's margin.",
};

export type GradingExistingQG = {
  questionId: string | null;
  score: number;
  outOf: number;
  feedback: string | null;
  /** Saved marks per rubric criterion (`QuestionGrade.criteria`), if any. */
  criteria?: unknown;
};

export interface GradingFormProps {
  submissionId: string;
  testId: string;
  studentName: string;
  /** Top-level questions; sub-questions live on subQuestions. */
  questions: GradingQuestion[];
  /** Raw answers JSON stored on the TestSubmission — keyed by questionId. */
  answers: Record<string, unknown>;
  /** Pre-existing per-question grades (if any). */
  existingQuestionGrades: GradingExistingQG[];
  /** Existing overall grade (if any). */
  existingGrade: {
    score: number;
    outOf: number;
    finalComments: string | null;
  } | null;
  /** The test's question numbering (Test.labelScheme); empty = default. */
  labelScheme?: string[];
  /** AI-suggested marks (#150), when the test has them on. */
  ai?: {
    initial: AiSuggestion[];
    /** For the preview pages only; A's actions by default. */
    load?: (testSubmissionId: string) => Promise<AiSuggestion[] | null>;
    record?: (input: { suggestionId: string; action: AiTutorAction; score: number | null }) => Promise<string | null>;
  } | null;
  /** Comments used before on each question (marking-comments.ts). */
  comments?: Record<string, string[]>;
  /** The next script to mark, for "Save and next". */
  next?: { href: string; name: string } | null;
}

const NO_COMMENTS: string[] = [];

const AI_POLL_MS = 5000;

async function loadSuggestions(testSubmissionId: string): Promise<AiSuggestion[] | null> {
  const r = await getAiSuggestions({ testSubmissionId });
  return (r?.data as AiSuggestion[] | undefined) ?? null;
}

/** Returns the server's message when it refused. */
async function recordAction(input: { suggestionId: string; action: AiTutorAction; score: number | null }): Promise<string | null> {
  const r = await recordAiSuggestionAction(input);
  return r?.serverError ?? (r?.validationErrors ? "The mark was rejected." : null);
}

/* ─── Flattening + helpers ─────────────────────────────────────────────── */

/**
 * Depth-first flatten of the question tree with a dotted display label
 * ("1", "1.a", "1.b", "2"). Skips NONE-typed questions since they aren't
 * gradable — but keeps them as visible context blocks in the rendered form.
 */
type FlatRow = {
  q: GradingQuestion;
  path: string;
  depth: number;
  parentText: string | null;
  gradable: boolean;
};
function flatten(questions: GradingQuestion[], scheme: LabelScheme): FlatRow[] {
  const out: FlatRow[] = [];
  function visit(q: GradingQuestion, pos: number[], parentText: string | null) {
    out.push({
      q,
      path: formatLabel(scheme, pos),
      depth: pos.length - 1,
      parentText,
      gradable: q.type !== "NONE",
    });
    q.subQuestions.forEach((child, i) => visit(child, [...pos, i], q.question));
  }
  questions.forEach((q, i) => visit(q, [i], null));
  return out;
}

function pct(score: number, outOf: number) {
  if (outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function GradingForm({
  submissionId,
  testId,
  studentName,
  questions,
  answers,
  existingQuestionGrades,
  existingGrade,
  labelScheme,
  ai = null,
  comments,
  next = null,
}: GradingFormProps) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const rows = React.useMemo(
    () => flatten(questions, normalizeScheme(labelScheme)),
    [questions, labelScheme],
  );
  const gradableRows = rows.filter((r) => r.gradable);

  // Index existing per-question grades by questionId.
  const initialByQ = React.useMemo(() => {
    const m = new Map<string, { score: number; feedback: string; criteria: unknown }>();
    for (const g of existingQuestionGrades) {
      if (g.questionId) {
        m.set(g.questionId, {
          score: g.score,
          feedback: g.feedback ?? "",
          criteria: g.criteria ?? null,
        });
      }
    }
    return m;
  }, [existingQuestionGrades]);

  // Per-question grade state: score is a string so empty is representable.
  // `criteria`: marks per rubric criterion as typed, for questions with a rubric.
  type PerQ = { score: string; feedback: string; criteria?: Record<string, string> };
  const [perQ, setPerQ] = React.useState<Record<string, PerQ>>(() => {
    const seed: Record<string, PerQ> = {};
    for (const r of gradableRows) {
      const prior = initialByQ.get(r.q.id);
      seed[r.q.id] = {
        score: prior ? String(prior.score) : "",
        feedback: prior?.feedback ?? "",
        criteria: criterionMarksText(r.q.rubric ?? null, prior?.criteria),
      };
    }
    return seed;
  });

  /* ─── AI suggestions (#150) ─── */

  const [suggestions, setSuggestions] = React.useState<AiSuggestion[]>(ai?.initial ?? []);
  // What the tutor decided on this page; recorded when the grade is saved.
  const [decided, setDecided] = React.useState<Record<string, AiTutorAction | undefined>>({});
  const byQuestion = React.useMemo(() => new Map(suggestions.map((s) => [s.questionId, s])), [suggestions]);
  const aiWorking = suggestions.filter(isPending).length;
  const loadAi = ai?.load ?? loadSuggestions;
  React.useEffect(() => {
    if (!ai || aiWorking === 0) return;
    const t = window.setInterval(async () => {
      const next = await loadAi(submissionId).catch(() => null);
      if (next) setSuggestions(next);
    }, AI_POLL_MS);
    return () => window.clearInterval(t);
  }, [ai, aiWorking, loadAi, submissionId]);

  const [overallFeedback, setOverallFeedback] = React.useState(
    existingGrade?.finalComments ?? "",
  );
  // Overall score can be auto (sum of per-question) or manual override.
  const [overrideOverall, setOverrideOverall] = React.useState<string | null>(
    existingGrade ? String(existingGrade.score) : null,
  );
  const [pending, setPending] = React.useState(false);
  const [emailStudent, setEmailStudent] = React.useState(true);

  /* ─── Local auto-save ─── */

  type GradingDraft = {
    perQ: Record<string, PerQ>;
    overallFeedback: string;
    overrideOverall: string | null;
  };
  const draftData = React.useMemo<GradingDraft>(
    () => ({ perQ, overallFeedback, overrideOverall }),
    [perQ, overallFeedback, overrideOverall],
  );
  const draft = useLocalDraft<GradingDraft>({
    key: `test-grade:${submissionId}`,
    data: draftData,
  });
  function restoreDraft(d: GradingDraft) {
    // Only take entries for questions that still exist on the test.
    setPerQ((prev) => {
      const next = { ...prev };
      for (const [qid, v] of Object.entries(d.perQ ?? {})) {
        if (qid in next && v) next[qid] = { score: String(v.score ?? ""), feedback: String(v.feedback ?? "") };
      }
      return next;
    });
    setOverallFeedback(d.overallFeedback ?? "");
    setOverrideOverall(d.overrideOverall ?? null);
  }

  /* ─── Derived totals ─── */

  const outOfTotal = gradableRows.reduce((s, r) => s + r.q.points, 0);
  const scoreSum = gradableRows.reduce((s, r) => {
    const v = perQ[r.q.id]?.score;
    if (!v || v.trim() === "") return s;
    const n = Number(v);
    return Number.isFinite(n) ? s + n : s;
  }, 0);
  const effectiveScore =
    overrideOverall && overrideOverall.trim() !== ""
      ? Number(overrideOverall)
      : scoreSum;
  const overallPct = pct(effectiveScore, outOfTotal);
  const allGraded = gradableRows.every((r) => {
    const v = perQ[r.q.id]?.score;
    return v !== undefined && v.trim() !== "";
  });

  /* ─── Handlers ─── */

  // Stable callbacks — React.memo on QuestionCard relies on these keeping
  // referential identity across renders so unchanged cards can skip an
  // expensive MathJax re-typeset when the tutor is typing elsewhere.
  const updateScore = React.useCallback((qid: string, next: string) => {
    setPerQ((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { score: "", feedback: "" }), score: next },
    }));
  }, []);
  const updateFeedback = React.useCallback((qid: string, next: string) => {
    setPerQ((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { score: "", feedback: "" }), feedback: next },
    }));
  }, []);
  // Marks per criterion; each change sets Score to their total.
  const rubricOf = React.useMemo(() => new Map(gradableRows.map((r) => [r.q.id, r.q.rubric ?? null])), [gradableRows]);
  const updateCriteria = React.useCallback(
    (qid: string, next: Record<string, string>) => {
      const rubric = rubricOf.get(qid);
      const total = rubric ? criterionScoreTotal(rubric, next) : null;
      setPerQ((prev) => {
        const cur = prev[qid] ?? { score: "", feedback: "" };
        return { ...prev, [qid]: { ...cur, criteria: next, score: total !== null ? String(total) : cur.score } };
      });
    },
    [rubricOf],
  );
  const assignFull = React.useCallback(
    (qid: string, points: number) => {
      updateScore(qid, String(points));
    },
    [updateScore],
  );

  const fillFrom = React.useCallback((s: AiSuggestion) => {
    const total = s.totalAwarded;
    if (total == null) return;
    setPerQ((prev) => {
      const cur = prev[s.questionId] ?? { score: "", feedback: "" };
      // The AI's marks per criterion, where they match this question's rubric.
      const rubric = rubricOf.get(s.questionId);
      const aiMarks = rubric
        ? Object.fromEntries(
            criteriaOf(s.criteria)
              .filter((c) => rubric.criteria.some((rc) => rc.id === c.id))
              .map((c) => [c.id, String(c.awarded)]),
          )
        : {};
      const criteria = rubric && criterionScoreTotal(rubric, aiMarks) === total ? aiMarks : {};
      return {
        ...prev,
        [s.questionId]: { score: String(total), criteria, feedback: cur.feedback.trim() ? cur.feedback : (s.feedbackToStudent ?? "") },
      };
    });
  }, [rubricOf]);
  // Takes the AI's mark back out, and its draft feedback too while the tutor
  // hasn't changed it: a rejected suggestion's words must not reach the student.
  const clearAi = React.useCallback((s: AiSuggestion) => {
    setPerQ((prev) => {
      const feedback = prev[s.questionId]?.feedback ?? "";
      const aiDraft = (s.feedbackToStudent ?? "").trim();
      return { ...prev, [s.questionId]: { score: "", criteria: {}, feedback: aiDraft && feedback.trim() === aiDraft ? "" : feedback } };
    });
  }, []);
  const acceptSuggestion = React.useCallback(
    (s: AiSuggestion) => {
      fillFrom(s);
      setDecided((d) => ({ ...d, [s.id]: "ACCEPTED" }));
    },
    [fillFrom],
  );
  const editSuggestion = React.useCallback(
    (s: AiSuggestion) => {
      fillFrom(s);
      setDecided((d) => ({ ...d, [s.id]: "EDITED" }));
      window.setTimeout(() => {
        const el = document.getElementById(`score-${s.questionId}`) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    },
    [fillFrom],
  );
  // Rejecting or undoing takes the AI's mark back out of the box.
  const rejectSuggestion = React.useCallback(
    (s: AiSuggestion) => {
      if (decided[s.id] === "ACCEPTED" || decided[s.id] === "EDITED") clearAi(s);
      setDecided((d) => ({ ...d, [s.id]: "REJECTED" }));
    },
    [decided, clearAi],
  );
  const undoSuggestion = React.useCallback(
    (s: AiSuggestion) => {
      if (decided[s.id] === "ACCEPTED" || decided[s.id] === "EDITED") clearAi(s);
      setDecided((d) => {
        const next = { ...d };
        delete next[s.id];
        return next;
      });
    },
    [decided, clearAi],
  );
  const acceptMany = React.useCallback(
    (ids: string[]) => {
      for (const s of suggestions) if (ids.includes(s.id)) acceptSuggestion(s);
    },
    [suggestions, acceptSuggestion],
  );

  const pathById = React.useMemo(() => new Map(rows.map((r) => [r.q.id, r.path])), [rows]);
  usePublishGrading({
    score: effectiveScore,
    outOf: outOfTotal,
    working: aiWorking,
    toReview: awaitingReview(suggestions, decided).map((s) => ({ suggestion: s, label: pathById.get(s.questionId) ?? "" })),
    acceptMany,
  });

  async function onSubmit(thenNext = false) {
    if (outOfTotal <= 0) {
      toast.error("This test has no gradable questions.");
      return;
    }
    setPending(true);
    try {
      const questionGrades = gradableRows.map((r) => {
        const raw = perQ[r.q.id]?.score ?? "";
        const parsed = raw.trim() === "" ? 0 : Number(raw);
        return {
          questionId: r.q.id,
          score: Number.isFinite(parsed) ? parsed : 0,
          outOf: r.q.points,
          feedback:
            perQ[r.q.id]?.feedback && perQ[r.q.id].feedback.trim() !== ""
              ? perQ[r.q.id].feedback
              : null,
          // The server keeps these only when they add up to the score.
          criteria: r.q.rubric ? criterionMarksFromText(perQ[r.q.id]?.criteria) : null,
        };
      });

      const result = await gradeTestSubmission({
        submissionId,
        score: effectiveScore,
        outOf: outOfTotal,
        feedback:
          overallFeedback.trim() === "" ? null : overallFeedback,
        questionGrades,
        notifyByEmail: emailStudent,
      });
      if (result?.serverError) throw new Error(result.serverError);
      if (result?.validationErrors) throw new Error("Some scores were rejected — check each question.");
      // The audit trail for each AI suggestion (A's recordAiSuggestionAction).
      if (ai && suggestions.length > 0) {
        const record = ai.record ?? recordAction;
        const actions = finalActions(suggestions, decided, (qid) => perQ[qid]?.score ?? "");
        const refused = (
          await Promise.all(actions.map((a) => record(a).catch((e: unknown) => (e instanceof Error ? e.message : "Failed"))))
        ).filter(Boolean);
        if (refused.length > 0) {
          toast.error(`The grade is saved, but ${refused.length} AI decision${refused.length === 1 ? " wasn't" : "s weren't"} recorded: ${refused[0]}`);
        }
      }
      draft.clear();
      toast.success(`Saved grade for ${studentName}`);
      router.push(thenNext && next ? next.href : `/dashboard/tutor-tests/${testId}/submissions`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setPending(false);
    }
  }

  /* ─── Keyboard (lib/marking-flow.ts) ─── */

  function focusScore(qid: string) {
    const el = document.getElementById(`score-${qid}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
    el?.scrollIntoView({ block: "center" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    const scoreOf = target.id.startsWith("score-") ? target.id.slice("score-".length) : null;
    const does = markKey(e, scoreOf !== null);
    if (!does || pending || readOnly) return;
    e.preventDefault();
    if (does === "save-next") {
      const missing = gradableRows.find((r) => (perQ[r.q.id]?.score ?? "").trim() === "");
      if (missing) {
        focusScore(missing.q.id);
        toast.warning(`Question ${missing.path} has no mark yet.`);
        return;
      }
      void onSubmit(true);
      return;
    }
    const at = gradableRows.findIndex((r) => r.q.id === scoreOf);
    const row = gradableRows[at];
    if (!row) return;
    if (does === "full") updateScore(row.q.id, String(row.q.points));
    else if (does === "comment") document.getElementById(`feedback-${row.q.id}`)?.focus();
    else {
      const to = gradableRows[at + (does === "next" ? 1 : -1)];
      if (to) focusScore(to.q.id);
      else if (does === "next") document.getElementById("save-grade")?.focus();
    }
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-6" onKeyDown={onKeyDown}>
      <RestoreDraftBanner draft={draft} onRestore={restoreDraft} what="this grade" />
      <div className="divide-border border-border divide-y border-y">
      {rows.map((r) => (
        <QuestionCard
          key={r.q.id}
          row={r}
          answer={answers[r.q.id]}
          score={perQ[r.q.id]?.score ?? ""}
          feedback={perQ[r.q.id]?.feedback ?? ""}
          criteria={perQ[r.q.id]?.criteria}
          onCriteria={updateCriteria}
          onScore={updateScore}
          onFeedback={updateFeedback}
          onAssignFull={assignFull}
          suggestion={ai ? byQuestion.get(r.q.id) : undefined}
          provenance={ai && isAiMarkedType(r.q.type) ? provenanceOf(byQuestion.get(r.q.id), decided[byQuestion.get(r.q.id)?.id ?? ""]) : null}
          canUndo={Boolean(decided[byQuestion.get(r.q.id)?.id ?? ""])}
          readOnly={readOnly}
          onAccept={acceptSuggestion}
          onEdit={editSuggestion}
          onReject={rejectSuggestion}
          onUndo={undoSuggestion}
          comments={comments?.[r.q.id] ?? NO_COMMENTS}
        />
      ))}
      </div>

      <section aria-labelledby="overall-feedback" className="space-y-3">
        <div>
          <h2 id="overall-feedback" className="text-foreground text-sm font-semibold">
            Overall feedback
          </h2>
          <p className="text-muted-foreground text-sm">
            Optional. Rendered with markdown + MathJax on the student review.
          </p>
        </div>
        <MarkdownTextarea
          rows={6}
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="Nice work overall. A few notes..."
          previewTitle="Overall feedback preview"
        />
      </section>

      {/* Save bar: sticks to the bottom of the content column (not the
          window), so it never covers the sidebar. */}
      <div className="bg-background/95 border-border sticky bottom-0 z-10 -mx-4 border-t px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 sm:py-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Overall</p>
              <div className="flex items-baseline gap-2">
                <Input
                  type="number"
                  className="h-9 w-20 text-right tabular-nums"
                  value={overrideOverall ?? String(scoreSum)}
                  onChange={(e) => setOverrideOverall(e.target.value)}
                  min={0}
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
                  / {outOfTotal}
                </span>
                {outOfTotal > 0 && (
                  <span className="text-muted-foreground text-sm tabular-nums">({overallPct}%)</span>
                )}
              </div>
            </div>
            {overrideOverall != null && overrideOverall !== String(scoreSum) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOverrideOverall(null)}
                className="text-muted-foreground"
              >
                Use sum ({scoreSum})
              </Button>
            )}
            {!allGraded && (
              <span className="text-muted-foreground text-xs">
                Some questions still ungraded — score defaults to 0 for those.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <EmailStudentCheckbox
              checked={emailStudent}
              onCheckedChange={setEmailStudent}
              studentName={studentName.split(" ")[0]}
              disabled={pending}
            />
            <DraftStatus draft={draft} className="max-sm:w-full" />
            {/* It saves by itself, so a phone does without the button. */}
            <span className="max-sm:hidden">
              <SaveProgressButton draft={draft} />
            </span>
            <WriteGuard label={existingGrade ? "Update grade" : "Save grade"} variant={next ? "outline" : "brand"} size="default">
              <Button id={next ? undefined : "save-grade"} type="button" variant={next ? "outline" : "brand"} onClick={() => onSubmit()} disabled={pending}>
                {pending && !next ? <NexusLoader size={16} label={null} className="text-current" /> : null}
                {existingGrade ? "Update grade" : "Save grade"}
                <Save className="size-4" />
              </Button>
            </WriteGuard>
            {next ? (
              <WriteGuard label="Save and next" variant="brand" size="default">
                <Button id="save-grade" type="button" variant="brand" onClick={() => onSubmit(true)} disabled={pending} title={`Next: ${next.name}`}>
                  {pending ? <NexusLoader size={16} label={null} className="text-current" /> : null}
                  Save and next
                  <ChevronRight className="size-4" />
                </Button>
              </WriteGuard>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* QuestionCard                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Memoized so typing in one question's score / feedback input doesn't
 * re-render every other card (which would trigger a full MathJax
 * re-typeset per card and feel like buffering).
 */
const QuestionCard = React.memo(function QuestionCard({
  row,
  answer,
  score,
  feedback,
  criteria,
  onCriteria,
  onScore,
  onFeedback,
  onAssignFull,
  suggestion,
  provenance,
  canUndo,
  readOnly,
  onAccept,
  onEdit,
  onReject,
  onUndo,
  comments,
}: {
  row: FlatRow;
  answer: unknown;
  score: string;
  feedback: string;
  criteria?: Record<string, string>;
  onCriteria: (qid: string, next: Record<string, string>) => void;
  onScore: (qid: string, v: string) => void;
  onFeedback: (qid: string, v: string) => void;
  onAssignFull: (qid: string, points: number) => void;
  suggestion?: AiSuggestion;
  /** Where the mark comes from; null when AI marking doesn't apply. */
  provenance: Provenance | null;
  canUndo: boolean;
  readOnly: boolean;
  onAccept: (s: AiSuggestion) => void;
  onEdit: (s: AiSuggestion) => void;
  onReject: (s: AiSuggestion) => void;
  onUndo: (s: AiSuggestion) => void;
  /** Used before on this question. */
  comments: string[];
}) {
  const { q, path, depth, gradable } = row;
  const isContext = !gradable;
  const [highlight, setHighlight] = React.useState(true);
  const evidence = React.useMemo(() => criteriaOf(suggestion?.criteria).flatMap((c) => c.evidence), [suggestion?.criteria]);
  const answerText = typeof answer === "string" ? answer : "";
  const showHighlight = highlight && evidence.length > 0 && answerText.trim() !== "" && provenance !== null;

  return (
    <section
      id={`q-${q.id}`}
      aria-label={isContext ? `Context ${path}` : `Question ${path}`}
      className={cn("space-y-4 py-6", depth > 0 && "border-brand-terracotta/30 ml-2 border-l-2 pl-4 sm:ml-4")}
    >
      <div className="space-y-2">
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            isContext ? "text-muted-foreground" : "text-brand-terracotta",
          )}
        >
          {isContext
            ? `Context ${path}`
            : `Question ${path} · ${q.points} ${q.points === 1 ? "point" : "points"}`}
        </p>
        <LessonMarkdown content={q.question} dynamic={false} />
      </div>

      {!isContext && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium">Student answer</p>
                {evidence.length > 0 && provenance !== null ? (
                  <button
                    type="button"
                    onClick={() => setHighlight((h) => !h)}
                    aria-pressed={highlight}
                    className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                  >
                    {highlight ? "Hide AI evidence" : "Show AI evidence"}
                  </button>
                ) : null}
              </div>
              <div className="border-border bg-muted/40 rounded-md border p-3">
                {showHighlight ? <HighlightedAnswer runs={highlightRuns(answerText, evidence)} /> : <AnswerView type={q.type} value={answer} />}
              </div>
            </div>
            <div>
              <p className="text-success mb-2 text-xs font-medium">Correct answer</p>
              <div className="border-success/30 bg-success/5 rounded-md border p-3">
                <CorrectAnswerView q={q} />
              </div>
            </div>
          </div>

          {suggestion && provenance !== null ? (
            <AiSuggestionCard
              suggestion={suggestion}
              provenance={provenance}
              canUndo={canUndo}
              disabled={readOnly}
              onAccept={onAccept}
              onEdit={onEdit}
              onReject={onReject}
              onUndo={onUndo}
            />
          ) : null}

          {q.rubric && q.rubric.criteria.length > 1 ? (
            <CriterionMarks
              rubric={q.rubric}
              questionId={q.id}
              disabled={readOnly}
              marks={criteria ?? {}}
              score={score}
              onChange={(next) => onCriteria(q.id, next)}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <label htmlFor={`score-${q.id}`} className="text-foreground text-xs font-medium">
                Score
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`score-${q.id}`}
                  type="number"
                  className="h-9 w-20 text-right tabular-nums"
                  value={score}
                  onChange={(e) => onScore(row.q.id, e.target.value)}
                  min={0}
                  max={q.points}
                  aria-describedby="marking-keys"
                  placeholder="0"
                />
                <span className="text-muted-foreground text-sm tabular-nums">
                  / {q.points}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAssignFull(row.q.id, row.q.points)}
                  title="Give full marks"
                  className="text-brand-terracotta"
                >
                  <CheckCircle2 className="size-3.5" />
                  Full
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`feedback-${q.id}`} className="text-foreground text-xs font-medium">
                Feedback
              </label>
              <MarkdownTextarea
                id={`feedback-${q.id}`}
                rows={3}
                value={feedback}
                onChange={(e) => onFeedback(row.q.id, e.target.value)}
                placeholder="Optional — markdown + LaTeX supported."
                previewTitle={`Feedback for ${row.path}`}
              />
              {comments.length > 0 ? (
                <ul aria-label={`Comments used before on question ${path}`} className="flex flex-wrap gap-1.5">
                  {comments.map((c) => (
                    <li key={c} className="min-w-0">
                      <button
                        type="button"
                        title={c}
                        disabled={readOnly}
                        onClick={() => onFeedback(q.id, withComment(feedback, c))}
                        className="border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring min-h-6 max-w-72 truncate rounded-full border px-2.5 text-left text-xs outline-none focus-visible:ring-2 disabled:opacity-50"
                      >
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* AnswerView — mirrors the read-only renderer on the grade review page.     */
/* ──────────────────────────────────────────────────────────────────────── */

function AnswerView({ type, value }: { type: string; value: unknown }) {
  const empty =
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (empty) {
    return (
      <p className="text-muted-foreground italic text-xs">No answer recorded.</p>
    );
  }
  const wrap = (body: React.ReactNode) => (
    <div className="bg-muted/40 rounded-md border border-border p-3 text-sm">
      {body}
    </div>
  );

  switch (type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "NUMERIC":
      return wrap(<p className="text-foreground">{String(value)}</p>);
    // Typed answers: any $…$ maths is typeset (B design 01, phase 1).
    case "SHORT_ANSWER":
    case "ESSAY":
      return wrap(<AnswerText text={String(value)} className="text-foreground" />);
    case "MATH_EXPRESSION":
      return wrap(<MathsAnswerText tex={String(value)} className="text-foreground" />);
    case "CODE":
      return wrap(
        <div className="font-mono whitespace-pre-wrap text-xs text-foreground">{String(value)}</div>,
      );
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ul className="list-disc pl-5 text-foreground">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ul>,
      );
    }
    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {arr.map((v, i) => (
            <li key={i}>{v || <span className="text-muted-foreground italic">blank</span>}</li>
          ))}
        </ol>,
      );
    }
    case "REORDER": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ol>,
      );
    }
    case "MATCHING": {
      const arr = Array.isArray(value)
        ? (value as Array<{ left: string; right: string }>)
        : [];
      return wrap(
        <ul className="space-y-1 text-foreground">
          {arr.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.left}</span>
              <span className="text-muted-foreground"> → </span>
              <span>{p.right}</span>
            </li>
          ))}
        </ul>,
      );
    }
    case "FILE_UPLOAD": {
      const uploads = toFileAnswers(value);
      if (uploads.length === 0) {
        return wrap(
          <p className="text-muted-foreground italic text-xs">No file uploaded.</p>,
        );
      }
      return wrap(
        <ul className="space-y-1">
          {uploads.map((f, i) => (
            <li key={`${f.fileUrl}-${i}`}>
              <a
                href={f.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-terracotta inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="size-3" />
                {f.fileName}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>,
      );
    }
    default:
      return wrap(
        <pre className="whitespace-pre-wrap text-xs text-foreground">
          {JSON.stringify(value, null, 2)}
        </pre>,
      );
  }
}



/* ─── CorrectAnswerView — tutor-side key display ─────────────────────── */

function CorrectAnswerView({ q }: { q: GradingQuestion }) {
  switch (q.type) {
    case "MATH_EXPRESSION": {
      const key = typeof q.correctAnswer === "string" ? q.correctAnswer : "";
      if (!key.trim()) return <p className="text-muted-foreground italic text-xs">No key set — grade manually.</p>;
      return (
        <div className="text-foreground space-y-1 text-sm">
          <MathsAnswerText tex={key} />
          <p className="text-muted-foreground text-xs">{MATH_MODE_LABEL[q.mathMode ?? "EQUIVALENT"] ?? ""}</p>
        </div>
      );
    }
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC": {
      const val = q.correctAnswer;
      if (val == null || (typeof val === "string" && val.trim() === "")) {
        return (
          <p className="text-muted-foreground italic text-xs">
            No key set — grade manually.
          </p>
        );
      }
      return (
        <div className="text-foreground text-sm">
          <LessonMarkdown content={String(val)} className="prose-sm" dynamic={false} />
        </div>
      );
    }
    case "MULTI_SELECT": {
      const arr = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ul className="text-foreground text-sm list-disc pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>
              <LessonMarkdown content={v} className="prose-sm" dynamic={false} />
            </li>
          ))}
        </ul>
      );
    }
    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ol>
      );
    }
    case "REORDER": {
      const arr = q.reorderItems ?? [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>
              <LessonMarkdown content={v} className="prose-sm" dynamic={false} />
            </li>
          ))}
        </ol>
      );
    }
    case "MATCHING": {
      const pairs = (q.matchPairs ?? []) as Array<{ left: string; right: string }>;
      if (pairs.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No pairs set.</p>;
      }
      return (
        <ul className="text-foreground text-sm space-y-1">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0">
                <LessonMarkdown content={p.left} className="prose-sm" dynamic={false} />
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="min-w-0">
                <LessonMarkdown content={p.right} className="prose-sm" dynamic={false} />
              </span>
            </li>
          ))}
        </ul>
      );
    }
    // Subjective types carry a model answer rather than a key. Showing it
    // here gives the tutor their own memo to mark against without leaving
    // the grading screen.
    case "ESSAY":
    case "CODE": {
      if (typeof q.correctAnswer !== "string" || q.correctAnswer.trim() === "") {
        return (
          <p className="text-muted-foreground italic text-xs">
            Subjective — no model answer recorded. Grade using your own criteria.
          </p>
        );
      }
      return q.type === "CODE" ? (
        <pre className="text-foreground whitespace-pre-wrap font-mono text-xs">
          {q.correctAnswer}
        </pre>
      ) : (
        <div className="text-foreground">
          <LessonMarkdown content={q.correctAnswer} className="prose-sm" dynamic={false} />
        </div>
      );
    }

    case "FILE_UPLOAD": {
      const solution = toFileUploadMemo(q.correctAnswer);
      if (solution?.kind === "text") {
        return (
          <div className="text-foreground">
            <LessonMarkdown content={solution.text} className="prose-sm" dynamic={false} />
          </div>
        );
      }
      const memo = solution?.files ?? [];
      if (memo.length === 0) {
        return (
          <p className="text-muted-foreground italic text-xs">
            Subjective — no model answer recorded. Grade using your own criteria.
          </p>
        );
      }
      return (
        <ul className="space-y-1">
          {memo.map((f, i) => (
            <li key={`${f.fileUrl}-${i}`}>
              <a
                href={f.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-terracotta inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="size-3" />
                {f.fileName}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      );
    }

    case "NONE":
      return null;
    default:
      return null;
  }
}

/**
 * Marks per rubric criterion (#216). Each change sets the question's Score
 * to the criteria's total (rounded to the rubric's step and capped at each
 * max). Typing in Score directly still works; the marks are saved with the
 * grade only while they add up to the Score, so the student never sees a
 * breakdown that disagrees with the mark.
 */
function CriterionMarks({
  rubric,
  questionId,
  disabled,
  marks,
  score,
  onChange,
}: {
  rubric: Rubric;
  questionId: string;
  disabled: boolean;
  marks: Record<string, string>;
  /** The Score box, to say when the marks no longer add up to it. */
  score: string;
  onChange: (next: Record<string, string>) => void;
}) {
  const step = rubric.halfMarks ? 0.5 : 1;
  const total = criterionScoreTotal(rubric, marks);
  const typed = Number(score.trim().replace(",", "."));
  const disagrees = total !== null && score.trim() !== "" && Number.isFinite(typed) && Math.abs(typed - total) > 1e-9;
  const set = (id: string, v: string) => onChange({ ...marks, [id]: v });
  return (
    <fieldset className="border-border space-y-2 rounded-md border p-3">
      <legend className="text-foreground px-1 text-xs font-medium">Marks by criterion</legend>
      <ul className="space-y-1.5">
        {rubric.criteria.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <label htmlFor={`crit-${questionId}-${c.id}`} className="min-w-0 flex-1">
              {c.label}
            </label>
            <Input
              id={`crit-${questionId}-${c.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={c.max}
              step={step}
              disabled={disabled}
              value={marks[c.id] ?? ""}
              onChange={(e) => set(c.id, e.target.value)}
              placeholder="0"
              className="h-8 w-20 text-right tabular-nums"
            />
            <span className="text-muted-foreground w-10 shrink-0 text-sm tabular-nums">/ {c.max}</span>
          </li>
        ))}
      </ul>
      {disagrees ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          These add up to {total}, not the Score, so they won&apos;t be saved.
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...marks })}
            className="text-foreground font-medium underline underline-offset-2 disabled:opacity-60"
          >
            Use {total} as the Score
          </button>
        </p>
      ) : null}
      {rubric.notes ? <p className="text-muted-foreground text-xs whitespace-pre-line">{rubric.notes}</p> : null}
    </fieldset>
  );
}
