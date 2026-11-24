/**
 * A message in the student's own chat, drawn over the gradient. Everyone else
 * reads the plain one (messages.tsx).
 */

import Link from "next/link";
import { BookOpen } from "lucide-react";

import LessonMarkdown from "@/app/components/markdown";
import { AnswerText } from "@/components/content/answer-text";

import type { StudyMessageView } from "../../lib/study-ui";

export function SceneQuestion({ text }: { text: string }) {
  return (
    <li className="ml-auto w-fit max-w-[88%] min-w-0">
      <span className="sr-only">You</span>
      <div className="as-said px-4 py-2.5">
        <AnswerText text={text} className="text-sm [overflow-wrap:anywhere]" />
      </div>
    </li>
  );
}

export function SceneAnswer({
  message: m,
  lessonHref,
}: {
  message: Pick<StudyMessageView, "content" | "citations">;
  lessonHref: (lessonId: string) => string;
}) {
  return (
    <li className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium">Study assistant</p>
      <div className="as-answer space-y-4 px-4 py-3.5">
        <LessonMarkdown content={m.content} dynamic={false} className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0" />
        {m.citations.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>From</span>
            {m.citations.map((c) => (
              <Link key={c.lessonId} href={lessonHref(c.lessonId)} className="as-pill max-w-full px-3 py-1.5 sm:max-w-72">
                <BookOpen aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{c.title}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
