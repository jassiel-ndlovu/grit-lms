"use client";

/**
 * "Add from bank" in the test designer (contracts/question-bank.md). Lists
 * the tutor's saved questions, filtered by topic or text; the chosen ones
 * are copied into the test. Items can be removed from the bank here too.
 * Practice sets use it as well, with `blocked` ruling out questions that
 * can't be practised.
 */

import * as React from "react";
import { Library, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { topicByCode, type Topic } from "@/features/courses/lib/curriculum";

import { deleteBankQuestion, listBankQuestions, type BankListItem } from "../bank-actions";
import { TYPE_LABELS, type EditorQuestionType } from "./test-question-editor";

const ALL = "all";

export function QuestionBankDialog({
  courseId,
  topics,
  onAdd,
  description = "Chosen questions are copied into this test. Editing the copy doesn't change the bank.",
  blocked,
}: {
  courseId: string;
  /** The course's topic list, for the filter. */
  topics: Topic[];
  onAdd: (items: BankListItem[]) => void;
  description?: string;
  /** Why an item can't be chosen here, or null when it can. */
  blocked?: (item: BankListItem) => string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<BankListItem[] | null>(null);
  const [more, setMore] = React.useState(false);
  const [chosen, setChosen] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Search waits for a pause in typing.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    setItems(null);
    setError(null);
    listBankQuestions({ courseId, topic: topic === ALL ? null : topic, search: query })
      .then((r) => {
        if (!live) return;
        if (r?.serverError || !r?.data) {
          setError(r?.serverError ?? "The bank didn't load. Try again.");
          setItems([]);
          return;
        }
        setItems(r.data.items);
        setMore(r.data.more);
      })
      .catch(() => live && (setError("The bank didn't load. Try again."), setItems([])));
    return () => {
      live = false;
    };
  }, [open, courseId, topic, query]);

  function toggle(id: string, on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function remove(item: BankListItem) {
    setBusy(item.id);
    const r = await deleteBankQuestion({ id: item.id });
    setBusy(null);
    if (r?.serverError) {
      toast.error(r.serverError);
      return;
    }
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
    toggle(item.id, false);
    toast.success("Removed from the bank. Copies already in use stay.");
  }

  function add() {
    const picked = (items ?? []).filter((i) => chosen.has(i.id) && i.data && !blocked?.(i));
    onAdd(picked);
    setChosen(new Set());
    setOpen(false);
  }

  const topicTitle = (code: string) => topics.find((t) => t.code === code)?.title ?? topicByCode(code)?.title ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setChosen(new Set());
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Library className="size-3.5" /> Add from bank
      </Button>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add from your question bank</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search aria-hidden className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions"
              aria-label="Search the bank"
              className="pl-8"
            />
          </div>
          {topics.length > 0 ? (
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-56" aria-label="Filter by topic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1" aria-busy={items === null}>
          {items === null ? (
            <p className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Loading the bank…
            </p>
          ) : error ? (
            <p className="text-destructive py-8 text-sm" role="alert">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-sm">
              {query || topic !== ALL
                ? "No saved questions match."
                : "Your bank is empty. Use “Save to bank” on a question in any test to keep it here."}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {items.map((item) => {
                const id = `bank-${item.id}`;
                const why = item.data ? (blocked?.(item) ?? null) : "can't be read";
                const tags = item.topics.map(topicTitle).filter(Boolean);
                return (
                  <li key={item.id} className="flex items-start gap-3 py-2.5">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      aria-labelledby={`${id}-stem`}
                      aria-describedby={`${id}-meta`}
                      checked={chosen.has(item.id)}
                      disabled={why !== null}
                      onCheckedChange={(v) => toggle(item.id, v === true)}
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-0.5">
                      <span id={`${id}-stem`} className="text-foreground block text-sm [overflow-wrap:anywhere]">{item.stem}</span>
                      <span id={`${id}-meta`} className="text-muted-foreground block text-xs">
                        {TYPE_LABELS[item.type as EditorQuestionType] ?? item.type} · {item.points}{" "}
                        {item.points === 1 ? "mark" : "marks"}
                        {item.parts > 1 ? ` · ${item.parts} parts` : ""}
                        {tags.length ? ` · ${tags.join(", ")}` : ""}
                        {why ? ` · ${why}` : ""}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                      disabled={busy === item.id}
                      onClick={() => remove(item)}
                      aria-label={`Remove from the bank: ${item.stem}`}
                    >
                      {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {more ? <p className="text-muted-foreground py-2 text-xs">Showing the newest 100. Search to find older ones.</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={chosen.size === 0} onClick={add}>
            {chosen.size ? `Add ${chosen.size} ${chosen.size === 1 ? "question" : "questions"}` : "Add questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
