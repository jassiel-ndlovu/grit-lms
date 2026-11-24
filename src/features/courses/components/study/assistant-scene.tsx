/**
 * The study assistant's page: the gradient behind the chat, and the bar over
 * it (title, chats, New chat). Colours are in assistant-scene.css.
 * Samples on /design-system/study.
 */

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { LinkSelect } from "@/features/events/components/booking/pickers";

import "./assistant-scene.css";

const flag = (v: boolean | undefined) => (v ? "" : undefined);

export function AssistantScene({
  empty,
  bleed = true,
  children,
}: {
  /** No messages yet: the question card sits in the middle. */
  empty?: boolean;
  /** Edge to edge under the page's headers; false for a framed sample. */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="assistant-scene"
      data-empty={flag(empty)}
      data-bleed={flag(bleed)}
      className="as-scene"
    >
      <div aria-hidden className="as-sky">
        <div className="as-sky-view" />
      </div>
      <div className="as-column">{children}</div>
    </div>
  );
}

/** The title, what it answers from, and the student's chats. */
export function AssistantTop({
  as: Title = "h1",
  chats,
  current,
  newHref,
}: {
  as?: "h1" | "h3";
  chats: Array<{ id: string; title: string; href: string }>;
  /** The open chat; null on a new one. */
  current: string | null;
  newHref: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        <Title className="text-base font-semibold tracking-tight">Study assistant</Title>
        <p className="text-sm">
          Ask about this course&apos;s lessons. Answers come from the lessons, and can be wrong: check them against the lesson. Each answer
          uses your study credits.
        </p>
      </div>
      {chats.length ? (
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <div className="as-picker min-w-0 flex-1">
            <LinkSelect
              label="Chat"
              value={current ?? "new"}
              options={[{ value: "new", label: "New chat", href: newHref }, ...chats.map((c) => ({ value: c.id, label: c.title, href: c.href }))]}
            />
          </div>
          {current ? (
            <Link href={newHref} className="as-pill h-9 shrink-0 px-3 text-sm font-medium">
              <Plus aria-hidden className="size-4" />
              New chat
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
