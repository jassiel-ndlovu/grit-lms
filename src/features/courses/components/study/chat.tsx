"use client";

/**
 * A student's chat with the course's study assistant (viewer.md "Study
 * assistant"). Each answer spends their own study credits. The page loads
 * the chat; asking without one starts a new chat and moves to its URL.
 * Drawn over a gradient (assistant-scene.tsx), unlike the other pages.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { askStudyAction } from "@/features/study/actions";
import { STUDY_LIMITS } from "@/features/study/study-rules";
import { cn } from "@/lib/utils";

import { studentCourseRoutes } from "../../lib/student-routes";
import { closedNote, leftLabel, studyRoutes, type StudyMessageView, type StudyReason } from "../../lib/study-ui";
import { AssistantScene } from "./assistant-scene";
import { SceneAnswer, SceneQuestion } from "./scene-message";

const LOST = "We didn't get the answer. Reload the page to check for it before you ask again.";

/** Put in the box to finish, on a new chat. Nothing is asked until they press Ask. */
const STARTERS = [
  { label: "Explain in simple words", text: "Explain this in simple words: " },
  { label: "Show me an example", text: "Show me an example of " },
  { label: "Tell two things apart", text: "What's the difference between " },
];

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
  top,
  creditsHref = null,
  bleed = true,
  sampleAsking = null,
}: {
  courseId: string;
  chatId: string | null;
  messages: StudyMessageView[];
  status: StudyChatStatus;
  /** Shown when the credits run out: how to get more. */
  buy: { href: string } | { note: string };
  /** The title and the chat picker (AssistantTop). */
  top?: React.ReactNode;
  creditsHref?: string | null;
  /** False draws a framed sample. */
  bleed?: boolean;
  /** Samples only: starts as if this question is being answered. */
  sampleAsking?: string | null;
}) {
  const router = useRouter();
  const id = React.useId();
  const [chat, setChat] = React.useState({ id: chatId, messages });
  const [shown, setShown] = React.useState(chatId);
  const [known, setKnown] = React.useState(status);
  const [left, setLeft] = React.useState(status.leftToday);
  const [question, setQuestion] = React.useState("");
  const [asking, setAsking] = React.useState<string | null>(sampleAsking);
  const [error, setError] = React.useState<string | null>(null);
  const box = React.useRef<HTMLTextAreaElement>(null);
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

  const note = closedNote({ reason: status.reason, leftToday: left, perDay: status.perDay });
  const closed = asking ? null : note;
  const empty = length === 0;
  const lessonHref = (lessonId: string) => studentCourseRoutes.lessons(courseId, lessonId);

  function start(text: string) {
    setQuestion(text);
    box.current?.focus();
  }

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
    <AssistantScene empty={empty} bleed={bleed}>
      {top}
      {empty ? (
        <div className="as-hero">
          {closed ? null : (
            <p className="max-w-lg text-3xl leading-tight font-light tracking-tight text-balance sm:text-[2.75rem]">
              What would you like to understand?
            </p>
          )}
        </div>
      ) : null}
      <div role="log" aria-label="Chat" aria-live="polite" className={empty ? undefined : "flex-1 pt-8 pb-10"}>
        {empty ? null : (
          <ul className="space-y-8">
            {chat.messages.map((m) =>
              m.role === "USER" ? (
                <SceneQuestion key={m.id} text={m.content} />
              ) : (
                <SceneAnswer key={m.id} message={m} lessonHref={lessonHref} />
              ),
            )}
            {asking ? <SceneQuestion text={asking} /> : null}
            {asking ? <Waiting /> : null}
          </ul>
        )}
      </div>
      <div className="as-dock">
        <div className="as-card">
          {closed ? (
            <div role="status" className="space-y-3 px-5 py-4 text-sm">
              <div className="space-y-0.5">
                <p className="text-base font-medium">{closed.title}</p>
                <p className="text-muted-foreground">
                  {closed.text}
                  {status.reason === "NO_CREDITS" && "note" in buy ? ` ${buy.note}` : ""}
                </p>
              </div>
              {status.reason === "NO_CREDITS" && "href" in buy ? (
                <Button asChild size="sm" className="rounded-full">
                  <Link href={buy.href}>Buy study credits</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <Label htmlFor={id} className="sr-only">
                Your question
              </Label>
              <textarea
                id={id}
                ref={box}
                value={question}
                rows={empty ? 3 : 1}
                maxLength={STUDY_LIMITS.questionChars}
                placeholder="Ask about this course's lessons"
                aria-describedby={`${id}-left`}
                className={cn("placeholder:text-muted-foreground px-5 pt-4 pb-2 text-base", empty ? "min-h-20" : "min-h-12 md:text-sm")}
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
                <p role="alert" className="text-destructive px-5 pb-2 text-sm">
                  {error}
                </p>
              ) : null}
              <div className="flex items-end justify-between gap-3 pr-3 pb-3 pl-5">
                <p id={`${id}-left`} className="text-muted-foreground min-w-0 flex-1 text-xs">
                  {leftLabel(left, status.perDay, status.credits)}
                </p>
                <Button type="submit" size="sm" className="rounded-full" disabled={question.trim().length < 2 || asking !== null}>
                  <SendHorizontal aria-hidden className="size-4" />
                  Ask
                </Button>
              </div>
            </form>
          )}
          <p className="border-border flex items-start gap-2 border-t px-5 py-2.5 text-sm">
            <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Your tutors and parents can read these chats. They&apos;re kept for a year.
              {creditsHref ? (
                <>
                  {" "}
                  <Link href={creditsHref} className="underline underline-offset-2">
                    Study credits
                  </Link>
                </>
              ) : null}
            </span>
          </p>
        </div>
      </div>
      {empty && !closed ? (
        <div className="flex flex-wrap justify-center gap-2 pt-5">
          {STARTERS.map((s) => (
            <button key={s.label} type="button" className="as-pill px-3.5 py-2 text-sm" onClick={() => start(s.text)}>
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {empty ? <div className="as-rest" /> : null}
      <div ref={bottom} />
    </AssistantScene>
  );
}

/** An answer takes up to about 20 seconds; after a few, say it's still going. */
function Waiting() {
  const [long, setLong] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setLong(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <li className="flex items-center gap-2 text-sm">
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      <span>{long ? "Still reading. This can take about 20 seconds." : "Reading the lessons…"}</span>
    </li>
  );
}
