"use client";

/**
 * Where to cover the curriculum's gaps (Pro; contracts/viewer.md): for each
 * topic nothing is tagged with, the lesson to extend or a new lesson to
 * write, then a few changes to the order. Suggestions only: it changes
 * nothing in the course.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { PageSection } from "@/components/shell/page-frame";
import { useReadOnly } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { curriculumGapsAction } from "@/features/ai-assist/actions";
import type { GapsDraft } from "@/features/ai-assist/pro";

import { leftText, type AiHelp } from "../lib/ai-help";
import { plainMaths } from "../lib/ai-text";
import { AiError, AiNote, AiWorking, aiData, useAiRun } from "./ai-help";

async function findGaps(courseId: string): Promise<GapsDraft> {
  return aiData(await curriculumGapsAction({ courseId }), "The suggestions didn't arrive. Try again.");
}

export function AiGaps({ help, lessonsHref, runWith = findGaps }: {
  help: AiHelp;
  /** The course's lessons page. */
  lessonsHref: string;
  /** For samples. */
  runWith?: (courseId: string) => Promise<GapsDraft>;
}) {
  const readOnly = useReadOnly();
  const ai = useAiRun<GapsDraft>();
  if (readOnly) return null;
  const r = ai.result;
  return (
    <PageSection
      id="coverage-suggestions"
      title="Suggestions for the gaps"
      description="AI compares your lessons with the curriculum and suggests where each missing topic fits. It doesn't change your course."
    >
      {ai.pending ? (
        <AiWorking feature="GAPS" />
      ) : r ? (
        <div className="space-y-4">
          <AiNote>{r.note}</AiNote>
          {r.missing.length === 0 ? (
            <p className="text-foreground text-sm">Every topic has a lesson or a question tagged with it.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-lg border">
              {r.missing.map((m) => (
                <li key={m.code} className="space-y-1 px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{m.title}</p>
                  {m.suggestion ? <p className="text-muted-foreground text-sm">{plainMaths(m.suggestion)}</p> : <p className="text-muted-foreground text-sm">No suggestion for this one.</p>}
                  {m.lessonId && m.lessonTitle ? (
                    <p className="text-sm">
                      <Link href={`${lessonsHref}?lesson=${m.lessonId}`} className="text-foreground underline underline-offset-2">
                        Open {m.lessonTitle}
                      </Link>
                    </p>
                  ) : m.newLessonTitle ? (
                    <p className="text-sm">
                      New lesson: <span className="text-foreground">{plainMaths(m.newLessonTitle)}</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {r.restructure.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-foreground text-sm font-semibold">Changes to the order</h3>
              <ul className="space-y-2">
                {r.restructure.map((s) => (
                  <li key={s.suggestion} className="text-sm">
                    <span className="text-foreground">{plainMaths(s.suggestion)}</span> <span className="text-muted-foreground">{plainMaths(s.why)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void ai.run(() => runWith(help.courseId))} disabled={r.allowance.left === 0}>
              Check again
            </Button>
            <p className="text-muted-foreground text-xs">{leftText("GAPS", r.allowance)}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ai.error ? <AiError>{ai.error}</AiError> : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void ai.run(() => runWith(help.courseId))}>
            <Sparkles className="size-3.5" /> Suggest where to cover gaps
          </Button>
          {help.credits ? <p className="text-muted-foreground text-xs">Each run uses AI credits</p> : null}
        </div>
      )}
    </PageSection>
  );
}
