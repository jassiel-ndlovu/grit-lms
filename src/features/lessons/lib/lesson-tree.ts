/**
 * Lesson hierarchy helpers. Pure — shared by the tutor manager, the
 * student lesson view and the reorder action.
 *
 * Lessons are stored flat with `parentId` + `order` (position among
 * siblings). A NONE-typed lesson is a content-free group heading, the
 * lesson equivalent of a NONE context question.
 */

import { formatLabel, normalizeScheme, type LabelScheme } from "@/lib/enum-labels";

export interface LessonTreeRow {
  id: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
}

export type LessonTreeNode<T> = T & { children: LessonTreeNode<T>[] };

/**
 * Group by parent, order siblings by `order` then createdAt, recurse.
 * Rows whose parent is missing (deleted, or in another course) surface
 * at the top level instead of disappearing.
 */
export function buildLessonTree<T extends LessonTreeRow>(rows: T[]): LessonTreeNode<T>[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) && r.parentId !== r.id ? r.parentId : null;
    const list = byParent.get(key);
    if (list) list.push(r);
    else byParent.set(key, [r]);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
  const seen = new Set<string>();
  function build(parentId: string | null): LessonTreeNode<T>[] {
    return (byParent.get(parentId) ?? []).flatMap((r) => {
      if (seen.has(r.id)) return []; // cycle guard
      seen.add(r.id);
      return [{ ...r, children: build(r.id) }];
    });
  }
  const roots = build(null);
  // Rows caught in a parent cycle are unreachable from the top; surface
  // them rather than lose them.
  for (const r of rows) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      roots.push({ ...r, children: build(r.id) });
    }
  }
  return roots;
}

export interface FlatLesson<T> {
  lesson: LessonTreeNode<T>;
  depth: number;
  label: string;
}

/** Depth-first flatten with each lesson's label under `scheme`. */
export function flattenLessonTree<T>(
  tree: LessonTreeNode<T>[],
  scheme: LabelScheme | unknown,
): FlatLesson<T>[] {
  const s = normalizeScheme(scheme);
  const out: FlatLesson<T>[] = [];
  function visit(list: LessonTreeNode<T>[], prefix: number[]) {
    list.forEach((l, i) => {
      const path = [...prefix, i];
      out.push({ lesson: l, depth: prefix.length, label: formatLabel(s, path) });
      visit(l.children, path);
    });
  }
  visit(tree, []);
  return out;
}

/** Ids of `id` and everything below it. */
export function subtreeIds<T extends LessonTreeRow>(rows: T[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        changed = true;
      }
    }
  }
  return out;
}
