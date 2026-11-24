"use client";

/**
 * A student's chat with the course's study assistant (viewer.md "Study
 * assistant"). Each answer spends their own study credits. The page loads
 * the chat; asking without one starts a new chat and moves to its URL.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { askStudyAction } from "@/features/study/actions";
import { STUDY_LIMITS } from "@/features/study/study-rules";

import { studentCourseRoutes } from "../../lib/student-routes";
import { closedNote, leftLabel, studyRoutes, type StudyMessageView, type StudyReason } from "../../lib/study-ui";
import { StudyMessage } from "./messages";

const LOST = "We didn't get the answer. Reload the page to check for it before you ask again.";

export interface StudyChatStatus {
  reason: StudyReason;
  credits: number;
  perDay: number;
  leftToday: number;
}

export function StudyChat({
  courseId,
  chatId,
  messages,
  status,
  buy,
}: {
  courseId: string;
  chatId: string | null;
  messages: StudyMessageView[];
  status: StudyChatStatus;
  /** Shown when the credits run out: how to get more. */
  buy: { href: string } | { note: string };
}) {
  const router = useRouter();
  const id = React.useId();
  const [chat, setChat] = React.useState({ id: chatId, messages });
  const [shown, setShown] = React.useState(chatId);
  const [known, setKnown] = React.useState(status);
  const [left, setLeft] = React.useState(status.leftToday);
  const [question, setQuestion] = React.useState("");
  const [asking, setAsking] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const bottom = React.useRef<HTMLDivElement>(null);
  const open = React.useRef(chatId);

  // Another chat was opened (not the one this question just started).
  if (chatId !== shown) {
    setShown(chatId);
    if (chatId !== chat.id) {
      setChat({ id: chatId, messages });
      setAsking(null);
      setError(null);
    }
  }
  if (status !== known) {
    setKnown(status);
    setLeft(status.leftToday);
  }

  React.useEffect(() => {
    open.current = chatId;
  }, [chatId]);

  const length = chat.messages.length + (asking ? 1 : 0);
  const before = React.useRef(length);
  React.useEffect(() => {
    if (length > before.current) bottom.current?.scrollIntoView({ block: "nearest" });
    before.current = length;
  }, [length]);

  const closed = closedNote({ reason: status.reason, leftToday: left, perDay: status.perDay });

  async function ask() {
    const q = question.trim();
    if (q.length < 2 || asking) return;
    const from = chatId;
    setAsking(q);
    setQuestion("");
    setError(null);
    const r = await askStudyAction({ courseId, question: q, ...(chat.id ? { chatId: chat.id } : {}) }).catch(() => null);
    // They opened another chat while waiting; the answer is saved in its own.
    if (open.current !== from) return router.refresh();
    setAsking(null);
    const data = r?.data;
    if (!data) {
      setQuestion(q);
      setError(r?.serverError ?? LOST);
      return;
    }
    setLeft(data.leftToday);
    setChat((c) => ({
      id: data.chatId,
      messages: [
        ...c.messages,
        { id: `${data.message.id}-q`, role: "USER", content: q, citations: [], concern: null },
        { id: data.message.id, role: "ASSISTANT", content: data.message.content, citations: data.message.citations, concern: null },
      ],
    }));
    if (data.chatId !== from) router.replace(studyRoutes.assistant(courseId, data.chatId), { scroll: false });
    else router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div role="log" aria-label="Chat" aria-live="polite">
        {length ? (
          <ul className="space-y-6">
            {chat.messages.map((m) => (
              <StudyMessage key={m.id} message={m} asker="You" lessonHref={(l) => studentCourseRoutes.lessons(courseId, l)} />
            ))}
            {asking ? (
              <StudyMessage
                message={{ id: "asking", role: "USER", content: asking, citations: [], concern: null }}
                asker="You"
                lessonHref={null}
              />
            ) : null}
            {asking ? (
              <li className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Reading the lessons…
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {closed && !asking ? (
        <div role="status" className="border-border space-y-3 rounded-lg border p-4 text-sm">
          <div className="space-y-0.5">
            <p className="text-foreground font-medium">{closed.title}</p>
            <p className="text-muted-foreground">
              {closed.text}
              {status.reason === "NO_CREDITS" && "note" in buy ? ` ${buy.note}` : ""}
            </p>
          </div>
          {status.reason === "NO_CREDITS" && "href" in buy ? (
            <Button asChild size="sm">
              <Link href={buy.href}>Buy study credits</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <Label htmlFor={id}>Your question</Label>
          <Textarea
            id={id}
            value={question}
            rows={3}
            maxLength={STUDY_LIMITS.questionChars}
            placeholder="Ask about this course's lessons"
            aria-describedby={`${id}-left`}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Enter asks; Shift+Enter starts a line. Not while an input method is composing.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`${id}-left`} className="text-muted-foreground min-w-0 flex-1 basis-60 text-xs">
              {leftLabel(left, status.perDay, status.credits)}
            </p>
            <Button type="submit" size="sm" disabled={question.trim().length < 2 || asking !== null}>
              <SendHorizontal aria-hidden className="size-4" />
              Ask
            </Button>
          </div>
        </form>
      )}
      <div ref={bottom} />
    </div>
  );
}
