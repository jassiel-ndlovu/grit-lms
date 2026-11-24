"use client";

/** Client samples for /design-system/nexus. Nothing here reaches the server. */

import * as React from "react";
import { toast } from "sonner";

import { MathProvider, type MathJaxVersion } from "@/app/components/math-provider";
import { PageSection } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { PeekButton } from "@/components/ui/peek-panel";
import { SaveState } from "@/components/ui/save-state";
import { StudentPeeks } from "@/features/activity/components/student-peek";
import type { StudentPeek } from "@/features/activity/peek-actions";
import { GradingForm, type GradingQuestion } from "@/features/assessments/components/grading-form";
import { GradingRibbon, GradingSessionProvider, LiveScore } from "@/features/assessments/components/grading-session";

export function ToastButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Grade saved for Lwazi Dube")}>Success</Button>
      <Button variant="outline" onClick={() => toast.info("Two students joined", { description: "They can see the course now." })}>Info</Button>
      <Button variant="outline" onClick={() => toast.warning("Question 2 has no mark yet.")}>Warning</Button>
      <Button variant="outline" onClick={() => toast.error("Couldn't save. Try again.")}>Error</Button>
      <Button variant="outline" onClick={() => toast("Copied to the clipboard")}>Plain</Button>
      <Button variant="outline" onClick={() => toast.loading("Saving lesson order…", { duration: 4000 })}>Loading</Button>
      <Button variant="outline" onClick={() => toast("Lesson deleted", { action: { label: "Undo", onClick: () => {} } })}>With a button</Button>
    </div>
  );
}

export function SaveStateSamples() {
  const at = new Date("2026-11-24T12:32:00Z");
  return (
    <PageSection title="One indicator" description="The same words and symbols wherever a page saves by itself.">
      <ul className="divide-border border-border divide-y rounded-lg border [&>li]:px-4 [&>li]:py-3">
        <li><SaveState kind="pending" announce={false} /></li>
        <li><SaveState kind="saving" announce={false} /></li>
        <li><SaveState kind="saved" at={at} announce={false} /></li>
        <li><SaveState kind="saved" at={at} where="device" announce={false} /></li>
        <li><SaveState kind="failed" announce={false} /></li>
        <li><SaveState kind="failed" error="It couldn't be saved. Check your connection." announce={false} /></li>
      </ul>
    </PageSection>
  );
}

const q = (id: string, order: number, question: string, points: number, answer: string): GradingQuestion => ({
  id, parentId: null, order, type: "SHORT_ANSWER", question, points, options: [], blankCount: null, reorderItems: [], matchPairs: null,
  correctAnswer: answer, subQuestions: [],
});

const QUESTIONS = [
  q("q1", 0, "Solve $2x + 3 = 11$.", 3, "$x = 4$"),
  q("q2", 1, "Give the inverse of $f(x) = 2x - 1$.", 4, "$f^{-1}(x) = \\frac{x + 1}{2}$"),
];

export function MarkingSample({ version }: { version: MathJaxVersion }) {
  return (
    <MathProvider version={version}>
    <GradingSessionProvider>
      <div className="border-border flex items-center gap-3 rounded-lg border p-2">
        <GradingRibbon prevHref="#" nextHref="#" position="3 of 23" rubrics={[]} aiEnabled={false} progress={{ marked: 7, total: 23 }} />
        <LiveScore initial={null} />
      </div>
      <GradingForm
        submissionId="sample"
        testId="sample"
        studentName="Lwazi Dube"
        questions={QUESTIONS}
        answers={{ q1: "x = 4", q2: "(x + 1)/2" }}
        existingQuestionGrades={[]}
        existingGrade={null}
        comments={{ q1: ["Show your working.", "Check the sign."], q2: ["Write it as an equation."] }}
        next={{ href: "/design-system/nexus?view=marking", name: "Amahle Nkosi" }}
      />
    </GradingSessionProvider>
    </MathProvider>
  );
}

const STUDENTS = [
  { id: "1", title: "Amahle Nkosi", href: "/design-system/nexus?view=peek" },
  { id: "2", title: "Lwazi Dube", href: "/design-system/nexus?view=peek" },
  { id: "3", title: "Thabo Mokoena", href: "/design-system/nexus?view=peek" },
];

async function loadSample(id: string): Promise<StudentPeek | null> {
  await new Promise((r) => setTimeout(r, 400));
  if (id === "3") return null;
  return {
    username: id === "1" ? "amahle.n" : "lwazi.d", email: id === "1" ? null : "lwazi@example.test", isMinor: id === "1", awaitingFirstSignIn: false, deleteOn: null,
    courses: [{ id: "c", name: "Mathematics Grade 12" }],
    marks: [
      { id: "m1", title: "Functions test", course: "Mathematics Grade 12", score: 34, outOf: 50, at: "2026-11-20T10:00:00Z" },
      { id: "m2", title: "Worksheet 4", course: "Mathematics Grade 12", score: 18, outOf: 20, at: "2026-11-14T10:00:00Z" },
    ],
    alerts: id === "2" ? [{ id: "a", course: "Mathematics Grade 12", level: "Watch", tone: "warning", summary: "Missed two pieces of work in the last three weeks." }] : [],
  };
}

export function PeekSample() {
  return (
    <PageSection title="Students" description="The row opens the page; the button beside it opens the panel.">
      <StudentPeeks items={STUDENTS} load={loadSample}>
        <ul className="divide-border border-border divide-y rounded-lg border">
          {STUDENTS.map((s) => (
            <li key={s.id} className="hover:bg-muted/50 flex items-center pr-1">
              <a href={s.href} className="text-foreground min-w-0 flex-1 p-3 text-sm font-medium">{s.title}</a>
              <PeekButton id={s.id} name={s.title} />
            </li>
          ))}
        </ul>
      </StudentPeeks>
    </PageSection>
  );
}
