"use client";

/**
 * "Generate from bank" in the test designer (contracts/question-bank.md).
 * The tutor asks for a number of questions per topic; the server draws
 * them at random from their bank and they're copied into the test. Every
 * student sits the same drawn questions, and the tutor can edit or swap
 * them before publishing.
 */

import * as React from "react";
import { Loader2, Plus, Shuffle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Topic } from "@/features/courses/lib/curriculum";

import { bankTopicCounts, drawBankQuestions, type BankListItem } from "../bank-actions";
import { MAX_DRAW_COUNT, MAX_DRAW_ROWS } from "../lib/question-bank";

type Row = { key: number; topic: string; count: string };

export function GenerateFromBankDialog({
  courseId,
  topics,
  exclude,
  onAdd,
}: {
  courseId: string;
  /** The course's topic list. */
  topics: Topic[];
  /** Bank items already in the test; the draw skips them. */
  exclude: string[];
  onAdd: (items: BankListItem[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);
  const [rows, setRows] = React.useState<Row[]>([{ key: 0, topic: "", count: "2" }]);
  const [pending, setPending] = React.useState(false);
  const nextKey = React.useRef(1);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    setCounts(null);
    bankTopicCounts({ courseId })
      .then((r) => live && setCounts(r?.data?.counts ?? {}))
      .catch(() => live && setCounts({}));
    return () => {
      live = false;
    };
  }, [open, courseId]);

  const title = (code: string) => topics.find((t) => t.code === code)?.title ?? code;
  const available = topics.filter((t) => (counts?.[t.code] ?? 0) > 0);
  const valid = rows.filter((r) => r.topic && Number(r.count) >= 1);
  const asked = valid.reduce((n, r) => n + Math.min(MAX_DRAW_COUNT, Math.floor(Number(r.count))), 0);

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function generate() {
    setPending(true);
    try {
      const r = await drawBankQuestions({
        courseId,
        exclude,
        picks: valid.map((row) => ({ topic: row.topic, count: Math.min(MAX_DRAW_COUNT, Math.floor(Number(row.count))) })),
      });
      if (r?.serverError) throw new Error(r.serverError);
      if (!r?.data) throw new Error("The draw didn't work. Try again.");
      const { items, short } = r.data;
      if (items.length) onAdd(items);
      if (short.length) {
        toast.warning(
          `Not enough saved questions: ${short.map((s) => `${title(s.topic)} ${s.got} of ${s.wanted}`).join("; ")}.`,
        );
      }
      if (items.length) setOpen(false);
      else if (!short.length) toast.error("Nothing to add.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The draw didn't work. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Shuffle className="size-3.5" /> Generate from bank
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate from your bank</DialogTitle>
          <DialogDescription>
            Pick topics and how many questions from each. They&apos;re drawn at random from your bank and added to
            this test, where you can edit or swap them. Every student gets the same questions.
          </DialogDescription>
        </DialogHeader>

        {counts === null ? (
          <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Counting your saved questions…
          </p>
        ) : available.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            None of your saved questions are tagged with this course&apos;s topics yet. Tag questions, then use
            “Save to bank” on them.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <Select value={row.topic} onValueChange={(topic) => update(row.key, { topic })}>
                  <SelectTrigger className="min-w-0 flex-1" aria-label={`Topic ${i + 1}`}>
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.title} ({counts[t.code]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_DRAW_COUNT}
                  value={row.count}
                  onChange={(e) => update(row.key, { count: e.target.value })}
                  className="w-20"
                  aria-label={`How many from topic ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={rows.length === 1}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  aria-label={`Remove topic ${i + 1}`}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={rows.length >= MAX_DRAW_ROWS}
              onClick={() => setRows((prev) => [...prev, { key: nextKey.current++, topic: "", count: "2" }])}
            >
              <Plus className="size-3" /> Add a topic
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || valid.length === 0 || !available.length} onClick={generate}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {asked ? `Add ${asked} ${asked === 1 ? "question" : "questions"}` : "Add questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
