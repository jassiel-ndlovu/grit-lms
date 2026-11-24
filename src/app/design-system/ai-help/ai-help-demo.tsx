"use client";

/** Sample drafts for /design-system/ai-help. Each run waits a moment, then answers. */

import * as React from "react";

import { PageSection } from "@/components/shell/page-frame";
import { RichEditor } from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import type { DraftQuestion } from "@/features/ai-assist/model";
import { AI_ASSIST_LIMITS, type AssistFeature } from "@/features/ai-assist/limits";
import { AiFeedback } from "@/features/assessments/components/ai-feedback";
import { AiQuestionsDialog } from "@/features/assessments/components/ai-questions-dialog";
import { AiGaps } from "@/features/courses/components/ai-gaps";
import { AiError, AiWorking } from "@/features/courses/components/ai-help";
import type { AiFeature, AiLeft } from "@/features/courses/lib/ai-help";
import { AiComments } from "@/features/grades/components/term-reports/ai-comments";
import { CommentBox } from "@/features/grades/components/term-reports/comment-box";
import { AiDocumentDialog, type DraftSaver } from "@/features/lessons/components/ai-document-dialog";
import { AiTidy } from "@/features/lessons/components/ai-tidy";

const HELP = { courseId: "sample", pro: true, credits: true };
const LESSONS = [
  { id: "l1", title: "Factorising trinomials" },
  { id: "l2", title: "Completing the square, and what the turning point of a parabola tells you about its graph" },
];

const wait = <T,>(value: T, ms = 900) => new Promise<T>((done) => setTimeout(() => done(value), ms));
const left = (feature: AssistFeature): AiLeft => {
  const limit = AI_ASSIST_LIMITS.PRO[feature];
  return { tier: "PRO", limit, used: 3, left: limit - 3 };
};
const loadLeft = async (): Promise<Partial<Record<AiFeature, AiLeft>>> => ({
  QUESTIONS: left("QUESTIONS"), OUTLINE: left("OUTLINE"), LESSONS: left("LESSONS"), TIDY: left("TIDY"), REPORT_COMMENTS: { tier: "PRO", limit: 100, used: 100, left: 0 },
});
const loadLeftSome = async (): Promise<Partial<Record<AiFeature, AiLeft>>> => ({ REPORT_COMMENTS: left("REPORT_COMMENTS") });

const q = (patch: Partial<DraftQuestion>): DraftQuestion => ({
  type: "ESSAY", question: "", points: 2, options: [], correctOptions: [], trueFalse: null, numericAnswer: null, numericTolerance: null, modelAnswer: "", explanation: "", topicCodes: [],
  difficulty: "medium", ...patch,
});

const QUESTIONS: DraftQuestion[] = [
  q({
    type: "MULTIPLE_CHOICE", question: "Which is a factor of \\(x^2 - 5x + 6\\)?", points: 1,
    options: ["\\(x - 2\\)", "\\(x + 2\\)", "\\(x - 6\\)", "\\(x + 3\\)"], correctOptions: [0], explanation: "\\(x^2 - 5x + 6 = (x-2)(x-3)\\).",
  }),
  q({ type: "NUMERIC", question: "Solve for the larger root of \\(x^2 = 2\\). Give two decimal places.", numericAnswer: 1.41, numericTolerance: 0.01, explanation: "\\(\\sqrt{2} \\approx 1.414\\)." }),
  q({ type: "TRUE_FALSE", question: "Every quadratic trinomial has two real factors.", points: 1, trueFalse: false, explanation: "\\(x^2 + 1\\) has none." }),
  q({ type: "SHORT_ANSWER", question: "Factorise \\(x^2 + 7x + 12\\), showing your steps.", points: 3, modelAnswer: "Find two numbers that multiply to 12 and add to 7: 3 and 4.\n\n\\(x^2 + 7x + 12 = (x+3)(x+4)\\)", explanation: "The pair must satisfy both conditions." }),
  q({ type: "MULTI_SELECT", question: "Which of these are quadratic?", points: 2, options: ["\\(x^2 - 1\\)", "\\(3x + 2\\)", "\\((x-1)(x+4)\\)"], correctOptions: [], explanation: "" }),
];

const SAVER: DraftSaver = { lessons: () => wait(undefined), test: () => wait(undefined), assignment: () => wait(undefined) };
const CLASS = [
  { learnerId: "a", name: "Thandi Mokoena", hasComment: false },
  { learnerId: "b", name: "Nkosinathi Johannes van der Westhuizen-Mokoena", hasComment: false },
  { learnerId: "c", name: "Zanele Mthembu", hasComment: true },
];

export function AiHelpDemo() {
  const [added, setAdded] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [saved, setSaved] = React.useState<string[]>([]);
  const save = React.useCallback(async (t: { learnerId: string }) => {
    setSaved((s) => [...s, t.learnerId]);
    return wait(t.learnerId === "b" ? "We couldn't save it. Check your connection." : null, 300);
  }, []);
  const keep = React.useCallback(async () => null, []);

  return (
    <>
      <PageSection id="questions" title="Questions" description="In the test designer.">
        <div className="flex flex-wrap items-center gap-3">
          <AiQuestionsDialog
            help={{ ...HELP, lessons: LESSONS }}
            loadLeft={loadLeft}
            onAdd={(nodes) => setAdded((n) => n + nodes.length)}
            runWith={() => wait({ runId: "r", questions: QUESTIONS, note: "The lesson doesn't cover completing the square, so no question uses it.", allowance: left("QUESTIONS") })}
          />
          <span className="text-muted-foreground text-sm">{added} added</span>
        </div>
      </PageSection>

      <PageSection id="document" title="From a document" description="Beside the lesson tree. The second sample is on Plus.">
        <div className="grid max-w-lg gap-3 sm:grid-cols-2">
          <AiDocumentDialog help={HELP} loadLeft={loadLeft} saver={SAVER} runWith={sampleDocument} />
          <AiDocumentDialog help={{ ...HELP, pro: false, credits: false }} loadLeft={loadLeft} saver={SAVER} runWith={sampleDocument} />
        </div>
      </PageSection>

      <PageSection id="tidy" title="Tidy or simplify" description="In the lesson editor.">
        <RichEditor
          label="Sample lesson"
          fallbackMarkdown={"## Factorising\n\nTo factorise a trinomial you must to find two number that multiply to give the last term and which adds to the middle one, for example \\(x^2 + 7x + 12\\).\n\n- Write down the pairs\n- Check the sum"}
          tools={(editor) => (
            <AiTidy
              editor={editor}
              help={HELP}
              loadLeft={loadLeft}
              runWith={() =>
                wait({
                  runId: "r",
                  text: "## Factorising\n\nTo factorise a trinomial, find two numbers that multiply to the last term and add to the middle one. For example, \\(x^2 + 7x + 12\\).\n\n- Write down the pairs\n- Check the sum",
                  changes: ["Fixed the grammar in the first sentence", "Split a long sentence in two"],
                  allowance: left("TIDY"),
                })
              }
            />
          )}
        />
      </PageSection>

      <PageSection id="feedback" title="A comment on an answer" description="While marking.">
        <div className="max-w-xl space-y-2">
          {comment ? <p className="border-border rounded-md border p-3 text-sm whitespace-pre-line">{comment}</p> : null}
          <AiFeedback
            context={{
              courseId: "sample",
              studentUserId: null,
              load: () =>
                wait({
                  runId: "r",
                  feedback: "You found the right pair of numbers and explained why they work. The last line needs the factors written out in full.",
                  strengths: ["Clear reason for choosing 3 and 4"],
                  nextSteps: ["Write the factorised form as the final line", "Multiply out to check"],
                  suggestedMark: 2,
                  allowance: left("FEEDBACK"),
                }),
            }}
            path="4"
            question="Factorise"
            answer="3 and 4 because 3 x 4 = 12"
            memo=""
            maxPoints={3}
            hasComment={comment !== ""}
            onUse={(t) => setComment((c) => (c ? `${c}\n${t}` : t))}
          />
        </div>
      </PageSection>

      <PageSection
        id="comments"
        title="Report comments"
        description="On a term's course page. Saving the second student fails here."
        actions={
          <div className="flex gap-2">
            <AiComments
              help={HELP}
              term={{ id: "t4", title: "Term 4 2026", from: "2026-10-06T00:00:00Z", to: "2026-12-10T00:00:00Z" }}
              students={CLASS}
              loadLeft={loadLeftSome}
              save={save}
              runWith={({ learnerIds }) =>
                wait({
                  runId: "r",
                  comments: CLASS.filter((s) => learnerIds.includes(s.learnerId)).map((s) => ({
                    learnerId: s.learnerId,
                    studentUserId: s.learnerId,
                    name: s.name,
                    comment: s.learnerId === "c" ? "" : `${s.name.split(" ")[0]} works steadily and asks good questions. Practise factorising before the exam, a few sums a day. ${"Keep going. ".repeat(s.learnerId === "b" ? 45 : 0)}`,
                  })),
                  allowance: left("REPORT_COMMENTS"),
                })
              }
            />
            <AiComments help={HELP} term={{ id: "t4", title: "Term 4 2026", from: "2026-10-06T00:00:00Z", to: "2026-12-10T00:00:00Z" }} students={CLASS} loadLeft={loadLeft} save={save} />
          </div>
        }
      >
        <div className="grid max-w-xl gap-3">
          {CLASS.map((s) => (
            <CommentBox key={s.learnerId} target={{ termId: "t4", learnerId: s.learnerId, courseId: "sample" }} initial={s.hasComment ? "Good progress this term." : ""} label={`Comment for ${s.name}`} save={keep} />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Sent: {saved.length}</p>
      </PageSection>

      <AiGaps
        help={HELP}
        lessonsHref="/design-system/ai-help"
        runWith={() =>
          wait({
            runId: "r",
            curriculum: true,
            covered: 8,
            total: 11,
            missing: [
              { code: "a", title: "Probability", suggestion: "Add a lesson after Statistics, starting with Venn diagrams.", lessonId: null, lessonTitle: null, newLessonTitle: "Venn diagrams and probability" },
              { code: "b", title: "Analytical geometry", suggestion: "Extend the straight-line lesson with distance and midpoint.", lessonId: "x", lessonTitle: "Straight lines", newLessonTitle: null },
              { code: "c", title: "Finance and growth", suggestion: "", lessonId: null, lessonTitle: null, newLessonTitle: null },
            ],
            restructure: [{ suggestion: "Move Number patterns before Functions.", why: "Functions builds on the general term." }],
            note: "",
            allowance: left("GAPS"),
          })
        }
      />

      <PageSection id="states" title="Waiting, and when it doesn't work">
        <AiWorking feature="LESSONS" />
        <AiError>You&apos;ve used this month&apos;s 10 question batches on Plus. Pro includes many more, or wait until the 1st.</AiError>
        <Button variant="outline" size="sm" asChild className="w-fit">
          <a href="#questions">Back to the top</a>
        </Button>
      </PageSection>
    </>
  );
}

type SampleResult = Awaited<ReturnType<NonNullable<React.ComponentProps<typeof AiDocumentDialog>["runWith"]>>>;

function sampleDocument(input: { kind: "outline" | "lessons" }): Promise<SampleResult> {
  if (input.kind === "outline") {
    return wait<SampleResult>({
      kind: "outline",
      draft: {
        runId: "r",
        allowance: left("OUTLINE"),
        outline: {
          title: "Grade 10 algebra",
          summary: "Products, factors and equations, in the order of the scheme of work.",
          note: "Week 6 in the document has no topic.",
          sections: [
            { title: "Products and factors", objectives: ["Multiply binomials", "Factorise trinomials"], lessons: [{ title: "Multiplying binomials", summary: "From the area model to FOIL.", topicCodes: [] }, { title: "Factorising trinomials", summary: "Finding the pair of numbers.", topicCodes: [] }] },
            { title: "Equations", objectives: ["Solve quadratic equations"], lessons: [{ title: "Solving by factorising", summary: "The zero-product rule.", topicCodes: [] }] },
          ],
        },
      },
    });
  }
  return wait<SampleResult>({
    kind: "lessons",
    draft: {
      runId: "r",
      allowance: left("LESSONS"),
      drafts: {
        lessons: [{ title: "Factorising trinomials", summary: "Finding the pair of numbers.", body: "## The idea\n\nFind two numbers that **multiply** to the last term and **add** to the middle one.\n\n- For \\(x^2 + 7x + 12\\), use 3 and 4.", topicCodes: [] }],
        tests: [{ title: "Factorising quiz", instructions: "No calculators.", questions: QUESTIONS }],
        assignments: [{ title: "Trinomials in practice", brief: "Factorise the ten trinomials on the worksheet and check each by multiplying out.", rubric: [{ criterion: "Correct factors", points: 10 }, { criterion: "Checks shown", points: 5 }], modelAnswer: "1. \\((x+3)(x+4)\\)" }],
        note: "",
      },
    },
  });
}
