/**
 * Question bank helpers (contracts/question-bank.md). Pure: no I/O.
 *
 * A bank item is one question tree (sub-questions included) in the test
 * JSON format of ./test-io.ts, so the bank and JSON import share one
 * validator. Saving copies a question out of a test; adding copies it back
 * in with fresh ids and a link to its bank item (`bankQuestionId`). Copies
 * never change when the bank item does.
 */

import type { EditorQuestion, EditorQuestionType } from "../components/test-question-editor";
import { topicsToStore } from "@/features/courses/lib/curriculum";
import { readRubric } from "./rubric";
import { ImportQuestionSchema, type ImportQuestion } from "./test-io";

/** Most questions one tree may hold, sub-questions included. */
export const MAX_BANK_TREE = 60;
/** Longest stored stem, in characters. */
export const STEM_LENGTH = 200;

/** An editor question (and its sub-questions) as a bank item. */
export function editorToBankNode(q: EditorQuestion): ImportQuestion {
  return {
    type: q.type,
    question: q.question,
    points: q.type === "NONE" ? 0 : q.points,
    options: q.options,
    answer: q.answer ?? null,
    language: q.language,
    matchPairs: q.matchPairs.length ? q.matchPairs : null,
    reorderItems: q.reorderItems,
    blankCount: q.blankCount,
    mathMode: q.type === "MATH_EXPRESSION" ? (q.mathMode ?? "EQUIVALENT") : null,
    rubric: q.rubric ?? null,
    topics: q.topics ?? [],
    subQuestions: q.subQuestions.map(editorToBankNode),
  };
}

/** A bank item as editor questions with new ids, linked to the item. */
export function bankNodeToEditor(node: ImportQuestion, newId: () => string, bankQuestionId: string | null = null): EditorQuestion {
  return {
    clientId: newId(),
    question: node.question,
    type: node.type as EditorQuestionType,
    points: node.type === "NONE" ? 0 : (node.points ?? 0),
    options: node.options ?? [],
    answer: node.answer ?? null,
    language: node.language ?? null,
    matchPairs: node.matchPairs ?? [],
    reorderItems: node.reorderItems ?? [],
    blankCount: node.blankCount ?? null,
    mathMode: node.mathMode ?? null,
    rubric: readRubric(node.rubric),
    topics: topicsToStore(node.topics),
    bankQuestionId,
    // Only the top of the tree names the bank item.
    subQuestions: (node.subQuestions ?? []).map((c) => bankNodeToEditor(c, newId)),
  };
}

/** Reads a stored item; null when it no longer parses. */
export function readBankNode(raw: unknown): ImportQuestion | null {
  const r = ImportQuestionSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Questions in the tree, the top one included. */
export function bankNodeCount(node: ImportQuestion): number {
  return 1 + (node.subQuestions ?? []).reduce((n, c) => n + bankNodeCount(c), 0);
}

/** Marks for the whole tree; context blocks carry none. */
export function bankNodePoints(node: ImportQuestion): number {
  const own = node.type === "NONE" ? 0 : (node.points ?? 0);
  return own + (node.subQuestions ?? []).reduce((n, c) => n + bankNodePoints(c), 0);
}

/** Every topic in the tree, once, top first. */
export function bankNodeTopics(node: ImportQuestion): string[] {
  const all = [...(node.topics ?? []), ...(node.subQuestions ?? []).flatMap(bankNodeTopics)];
  return [...new Set(all)];
}

/**
 * Plain text for lists and search: the question with markdown images,
 * links, maths delimiters and markup removed, else the first sub-question's.
 */
export function bankStem(node: ImportQuestion): string {
  const text = node.question
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/[#*_`>~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.length > STEM_LENGTH ? `${text.slice(0, STEM_LENGTH - 1)}…` : text;
  const first = node.subQuestions?.[0];
  return first ? bankStem(first) : "";
}

/* ─── Generate a test: a random draw by topic ───────────────────────────── */

/** One row of "Generate from bank": how many questions from a topic. */
export type DrawPick = { topic: string; count: number };
/** A topic that had fewer unused questions than asked for. */
export type DrawShort = { topic: string; wanted: number; got: number };

export const MAX_DRAW_ROWS = 20;
export const MAX_DRAW_COUNT = 50;

/**
 * Draws questions at random, row by row, never the same item twice. An
 * item tagged with two topics counts for whichever row draws it first.
 * Rows asking for the same topic add up. `random` returns [0, 1).
 */
export function drawFromPool<T extends { id: string; topics: string[] }>(
  pool: T[],
  picks: DrawPick[],
  random: () => number = Math.random,
): { drawn: T[]; short: DrawShort[] } {
  const used = new Set<string>();
  const drawn: T[] = [];
  const short: DrawShort[] = [];
  for (const pick of picks) {
    const want = Math.max(0, Math.min(MAX_DRAW_COUNT, Math.floor(pick.count)));
    if (want === 0) continue;
    const candidates = pool.filter((item) => !used.has(item.id) && item.topics.includes(pick.topic));
    // Partial Fisher-Yates: only the first `want` places need settling.
    const n = Math.min(want, candidates.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(random() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      used.add(candidates[i].id);
      drawn.push(candidates[i]);
    }
    if (n < want) short.push({ topic: pick.topic, wanted: want, got: n });
  }
  return { drawn, short };
}

/** How many bank items carry each topic. */
export function topicCounts(items: Array<{ topics: string[] }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) for (const t of new Set(item.topics)) out[t] = (out[t] ?? 0) + 1;
  return out;
}
