"use client";

/**
 * Curriculum topics on a lesson or a test question (#216,
 * contracts/curriculum.md). The topic list comes from the course
 * (topicsFor); a course without one shows nothing here. Chosen topics show
 * as chips; "Topics" opens a checklist in teaching order.
 */

import * as React from "react";
import { Tags, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { MAX_TOPICS, topicByCode, type Topic } from "../lib/curriculum";

/** The topics a form can tag from, set once by the form for its course. */
export const TopicsContext = React.createContext<Topic[]>([]);

/** Sets the topic list for the pickers inside; usable from server components. */
export function TopicsProvider({ topics, children }: { topics: Topic[]; children: React.ReactNode }) {
  return <TopicsContext.Provider value={topics}>{children}</TopicsContext.Provider>;
}

export function TopicPicker({
  value,
  onChange,
  disabled,
  what = "question",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** "question" or "lesson", for the labels. */
  what?: string;
}) {
  const topics = React.useContext(TopicsContext);
  if (topics.length === 0 && value.length === 0) return null;

  const toggle = (code: string, on: boolean) =>
    onChange(on ? [...value.filter((c) => c !== code), code].slice(0, MAX_TOPICS) : value.filter((c) => c !== code));
  // Topics outside the course's list (the course changed grade) stay visible so they can be removed.
  const chosen = value.map((c) => topics.find((t) => t.code === c) ?? topicByCode(c) ?? { code: c, title: c });

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Topics for this ${what}`}>
      {chosen.map((t) => (
        <span
          key={t.code}
          className="bg-muted text-foreground inline-flex h-6 items-center gap-1 rounded-full pr-1 pl-2.5 text-xs"
        >
          {t.title}
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggle(t.code, false)}
            aria-label={`Remove topic ${t.title}`}
            className="hover:bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-full p-0.5 outline-none focus-visible:ring-2"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      {topics.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} className="h-6 px-2 text-xs">
              <Tags aria-hidden className="size-3.5" />
              {value.length ? "Topics" : "Add topics"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Topics this {what} covers</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {topics.map((t) => {
              const on = value.includes(t.code);
              return (
                <DropdownMenuCheckboxItem
                  key={t.code}
                  checked={on}
                  disabled={!on && value.length >= MAX_TOPICS}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => toggle(t.code, v === true)}
                >
                  {t.title}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
