/** A course's study chats as its tutors see them. Server-safe. */

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { formatDate, type DateContext } from "@/lib/datetime";

import { studyRoutes, type StudyMessageView } from "../../lib/study-ui";
import { ClearFlagButton } from "./clear-flag";
import { StudyMessage } from "./messages";

export const FORMER_STUDENT = "Former student";

export interface StudyChatRow {
  id: string;
  studentName: string;
  title: string;
  flaggedAt: Date | null;
  updatedAt: Date;
  messages: number;
}

export function StudyChatList({ courseId, rows, ctx }: { courseId: string; rows: StudyChatRow[]; ctx: DateContext }) {
  return (
    <ul className="divide-border border-border divide-y border-y">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={studyRoutes.chats(courseId, r.id)}
            className="hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3 transition-colors"
          >
            <span className="min-w-0 flex-1 basis-56 space-y-0.5">
              <span className="text-foreground block truncate text-sm font-medium">{r.title}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {r.studentName || FORMER_STUDENT} · {formatDate(r.updatedAt, ctx, { day: "numeric", month: "short" })} ·{" "}
                {r.messages} {r.messages === 1 ? "message" : "messages"}
              </span>
            </span>
            {r.flaggedAt ? <StatusChip tone="danger">Needs a look</StatusChip> : null}
            <ArrowRight aria-hidden className="text-muted-foreground size-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FlaggedNote({ chatId, flaggedAt, ctx }: { chatId: string; flaggedAt: Date; ctx: DateContext }) {
  return (
    <div
      role="note"
      className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm"
    >
      <TriangleAlert aria-hidden className="text-destructive size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-64 space-y-0.5">
        <p className="text-foreground font-medium">This student may need support</p>
        <p className="text-muted-foreground">
          Flagged {formatDate(flaggedAt, ctx)}. Read the chat and follow up with them, then clear the flag.
        </p>
      </div>
      <ClearFlagButton chatId={chatId} />
    </div>
  );
}

export function StudyTranscript({
  messages,
  studentName,
  lessonHref,
}: {
  messages: StudyMessageView[];
  studentName: string;
  lessonHref: ((lessonId: string) => string) | null;
}) {
  return (
    <ul className="space-y-6">
      {messages.map((m) => (
        <StudyMessage key={m.id} message={m} asker={studentName || FORMER_STUDENT} lessonHref={lessonHref} />
      ))}
    </ul>
  );
}
