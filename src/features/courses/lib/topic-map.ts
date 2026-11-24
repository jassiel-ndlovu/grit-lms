/**
 * The topic map (owner, 24 Nov): each curriculum topic is a nexus, a centre
 * with three points that light up as it is taught, questioned and passed.
 * Pure: scripts/check-topic-map.ts covers it.
 */

import { seeded, type Point } from "@/lib/nexus";

/** A topic is passed from this average up. */
export const TOPIC_PASS = 50;

export type TopicState = "none" | "started" | "passed";

export interface TopicNode {
  code: string;
  title: string;
  /** Learner: lessons done. Class: lessons there are (done is null). */
  lessons: { done: number | null; total: number };
  /** Learner: questions with a released mark, and only those, so nothing hints at a test to come. Class: questions there are (tried is null). */
  questions: { tried: number | null; total: number };
  /** Marks earned on the topic's questions, or null before any. */
  percent: number | null;
  /** The three points: lessons, questions, passed. */
  steps: [boolean, boolean, boolean];
  state: TopicState;
}

type Tagged = { topics: readonly string[] };
type Marked = Tagged & { score: number; outOf: number };

function percentOf(marks: readonly Marked[]): number | null {
  const outOf = marks.reduce((n, m) => n + m.outOf, 0);
  if (outOf <= 0) return null;
  return Math.round((marks.reduce((n, m) => n + m.score, 0) / outOf) * 100);
}

function node(
  topic: { code: string; title: string }, lessons: TopicNode["lessons"], questions: TopicNode["questions"],
  taught: boolean, tried: boolean, percent: number | null,
): TopicNode {
  const steps: TopicNode["steps"] = [taught, tried, percent !== null && percent >= TOPIC_PASS];
  const state: TopicState = steps[2] ? "passed" : steps[0] || steps[1] || (lessons.done ?? 0) > 0 ? "started" : "none";
  return { code: topic.code, title: topic.title, lessons, questions, percent, steps, state };
}

/** One learner: their finished lessons and their released marks. */
export function learnerTopics(
  topics: ReadonlyArray<{ code: string; title: string }>,
  lessons: ReadonlyArray<Tagged & { id: string }>,
  done: ReadonlySet<string>,
  marks: readonly Marked[],
): TopicNode[] {
  return topics.map((t) => {
    const ls = lessons.filter((l) => l.topics.includes(t.code));
    const finished = ls.filter((l) => done.has(l.id)).length;
    const ms = marks.filter((m) => m.topics.includes(t.code));
    return node(
      t, { done: finished, total: ls.length }, { tried: ms.length, total: ms.length },
      ls.length > 0 && finished === ls.length, ms.length > 0, percentOf(ms),
    );
  });
}

/** A class: what the course holds on each topic, and how the class did. */
export function classTopics(
  topics: ReadonlyArray<{ code: string; title: string }>,
  lessons: readonly Tagged[],
  questions: readonly Tagged[],
  marks: readonly Marked[],
): TopicNode[] {
  return topics.map((t) => {
    const ls = lessons.filter((l) => l.topics.includes(t.code)).length;
    const qs = questions.filter((q) => q.topics.includes(t.code)).length;
    return node(
      t, { done: null, total: ls }, { tried: null, total: qs },
      ls > 0, qs > 0, percentOf(marks.filter((m) => m.topics.includes(t.code))),
    );
  });
}

export function topicCounts(nodes: readonly TopicNode[]): { passed: number; started: number; total: number } {
  return {
    passed: nodes.filter((n) => n.state === "passed").length,
    started: nodes.filter((n) => n.state === "started").length,
    total: nodes.length,
  };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "2 of 3 lessons · 4 questions · 64%", in words for everyone. */
export function topicLine(n: TopicNode): string {
  const parts: string[] = [];
  if (n.lessons.total) parts.push(n.lessons.done === null ? plural(n.lessons.total, "lesson") : `${n.lessons.done} of ${plural(n.lessons.total, "lesson")}`);
  if (n.questions.total) parts.push(n.questions.tried === null ? plural(n.questions.total, "question") : `${plural(n.questions.tried, "question")} marked`);
  if (n.percent !== null) parts.push(n.questions.tried === null ? `class average ${n.percent}%` : `${n.percent}%`);
  return parts.length ? parts.join(" · ") : "Nothing on this topic yet";
}

/* ------------------------------------------------------------------------- */
/* The drawing                                                                */
/* ------------------------------------------------------------------------- */

export const TRAIL_STEP = 64;
export const TRAIL_HEIGHT = 96;

const round = (v: number) => Math.round(v * 100) / 100;

/** The map's hubs, left to right, gently up and down; the same every time. */
export function topicTrail(codes: readonly string[]): { hubs: Point[]; width: number; height: number } {
  const hubs = codes.map((code, i): Point => {
    const wobble = (seeded(code)() - 0.5) * 18;
    return { x: TRAIL_STEP / 2 + i * TRAIL_STEP, y: round(TRAIL_HEIGHT / 2 + (i % 2 === 0 ? -12 : 12) + wobble), r: 11, hue: ((i % 3) + 1) as 1 | 2 | 3 };
  });
  return { hubs, width: Math.max(TRAIL_STEP, codes.length * TRAIL_STEP), height: TRAIL_HEIGHT };
}
