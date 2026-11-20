"use client";

import * as React from "react";

import LessonMarkdown from "@/app/components/markdown";
import { QuestionRenderer, type RendererQuestion } from "@/features/assessments/components/question-renderer";

const BASE = { points: 2, options: [], language: null, matchPairs: null, reorderItems: [], blankCount: null };

const SAMPLES: RendererQuestion[] = [
  {
    ...BASE,
    id: "q-reorder",
    type: "REORDER",
    question: "Put the steps for solving $x^2 + 3x + 2 = 0$ in order.",
    reorderItems: ["Write the equation in standard form", "Factorise: $(x + 1)(x + 2) = 0$", "Set each factor to zero", "Solve: $x = -1$ or $x = -2$"],
  },
  {
    ...BASE,
    id: "q-essay",
    type: "ESSAY",
    question: "Show that $x^2 - 4x + 4 \\geq 0$ for every real $x$. Use **Insert maths** for your working.",
  },
];

export function QuestionsDemo() {
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  return (
    <div className="space-y-8">
      {SAMPLES.map((q) => (
        <section key={q.id} className="space-y-3 rounded-lg border p-5" aria-labelledby={`${q.id}-label`}>
          <p id={`${q.id}-label`} className="text-muted-foreground text-xs font-medium uppercase">{q.type}</p>
          <LessonMarkdown content={q.question} />
          <QuestionRenderer
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            testId="design-system"
            shuffleSeed="preview"
          />
          <pre data-testid={`${q.id}-answer`} className="bg-muted rounded p-2 font-mono text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(answers[q.id] ?? null)}
          </pre>
        </section>
      ))}
    </div>
  );
}
