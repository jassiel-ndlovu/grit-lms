/**
 * Build the runner-shaped question tree from Prisma's flat rows. Pure.
 *
 * This lives here rather than inside the student page because the tutor
 * preview renders the same runner and has to produce a byte-identical
 * tree. Two copies of this function would be two chances for the preview
 * to disagree with what students actually sit.
 */

import type { RunnerQuestion } from "../components/test-runner";

/** The subset of a TestQuestion row the tree needs. */
export interface TreeRow {
  id: string;
  question: string;
  type: string;
  points: number;
  options: string[];
  language: string | null;
  matchPairs: unknown;
  reorderItems: string[];
  blankCount: number | null;
  parentId: string | null;
  order: number | null;
  createdAt: Date;
}

/**
 * Group by parentId, sort each bucket by `order` (falling back to creation
 * time for rows authored before ordering existed), and recurse. Returns
 * top-level questions with children embedded.
 */
export function buildRunnerTree<T extends TreeRow>(all: T[]): RunnerQuestion[] {
  const byParent = new Map<string | null, T[]>();
  for (const q of all) {
    const key = q.parentId ?? null;
    const list = byParent.get(key);
    if (list) list.push(q);
    else byParent.set(key, [q]);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  function build(parentId: string | null): RunnerQuestion[] {
    const direct = byParent.get(parentId) ?? [];
    return direct.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type as RunnerQuestion["type"],
      points: q.points,
      options: q.options,
      language: q.language,
      matchPairs: q.matchPairs,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount,
      parentId: q.parentId,
      order: q.order,
      subQuestions: build(q.id),
    }));
  }

  return build(null);
}
