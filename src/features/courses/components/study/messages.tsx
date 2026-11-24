/**
 * A study chat's messages, as the student and their tutors read them: what
 * was asked, and the answer with the lessons it came from. Works in server
 * and client pages. Samples on /design-system/study.
 */

import Link from "next/link";
import { BookOpen } from "lucide-react";

import LessonMarkdown from "@/app/components/markdown";
import { AnswerText } from "@/components/content/answer-text";
import { StatusChip } from "@/components/shell/status-chip";

import { concernChip, type StudyCitation, type StudyMessageView } from "../../lib/study-ui";

const PILL = "border-border inline-flex max-w-64 items-center gap-1.5 rounded-full border px-2.5 py-1";

function Citation({ citation, href }: { citation: StudyCitation; href: string | null }) {
  const inner = (
    <>
      <BookOpen aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{citation.title}</span>
    </>
  );
  if (!href) return <span className={`${PILL} text-muted-foreground`}>{inner}</span>;
  return (
    <Link href={href} className={`${PILL} text-foreground hover:bg-muted/60 transition-colors`}>
      {inner}
    </Link>
  );
}

export function StudyMessage({
  message: m,
  asker,
  lessonHref,
}: {
  message: StudyMessageView;
  /** "You", or the student's name for a tutor. */
  asker: string;
  /** Where a cited lesson opens; null leaves the titles unlinked. */
  lessonHref: ((lessonId: string) => string) | null;
}) {
  if (m.role === "USER") {
    const chip = concernChip(m.concern);
    return (
      <li className="ml-auto w-fit max-w-[85%] space-y-1">
        <p className="text-muted-foreground flex flex-wrap items-center justify-end gap-2 text-xs">
          {chip ? <StatusChip tone={chip.tone}>{chip.label}</StatusChip> : null}
          {asker}
        </p>
        <div className="bg-muted rounded-2xl rounded-tr-sm px-4 py-2.5">
          <AnswerText text={m.content} className="text-foreground text-sm break-words" />
        </div>
      </li>
    );
  }
  return (
    <li className="min-w-0 space-y-2">
      <p className="text-muted-foreground text-xs">Study assistant</p>
      <LessonMarkdown
        content={m.content}
        dynamic={false}
        className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0"
      />
      {m.citations.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <span className="text-muted-foreground">From</span>
          {m.citations.map((c) => (
            <Citation key={c.lessonId} citation={c} href={lessonHref ? lessonHref(c.lessonId) : null} />
          ))}
        </div>
      ) : null}
    </li>
  );
}
