"use client";

/**
 * TreeReorderDialog — drag-and-drop rearranging of a labelled hierarchy.
 *
 * Used for a test's question tree and a course's lesson tree. Each row
 * shows only the item's label (the full text is in its tooltip), tinted by
 * depth, with siblings alternating between two shades of that tint so
 * neighbouring items at the same level stay distinguishable.
 *
 *   - Drag a row up/down to reorder it.
 *   - Drag it right while moving to make it a sub-item of the row above;
 *     drag it left to lift it out of its parent. (Same model as an outline
 *     editor: horizontal offset picks the depth.)
 *   - Click to select, Ctrl/⌘-click to add to the selection, Shift-click
 *     for a range. Dragging any selected row moves the whole selection,
 *     which lands together, in its original order, where the row is dropped.
 *   - Indent / Outdent buttons do the same as horizontal dragging, for the
 *     selection, without a mouse.
 *   - Undo steps back one change; "Reset" rewinds to the last saved
 *     (applied) arrangement. Nothing reaches the form until Apply.
 *
 * Labels are recomputed live from `scheme`, so the tutor sees "1.2" become
 * "2.1" as they drop.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  RotateCcw,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLabel, type LabelScheme } from "@/lib/enum-labels";
import { cn } from "@/lib/utils";

export interface ReorderNode {
  id: string;
  children: ReorderNode[];
}

interface FlatItem {
  id: string;
  parentId: string | null;
  depth: number;
  /** 0-based positions from the root to this item — feeds formatLabel. */
  path: number[];
  childCount: number;
}

const INDENT = 22;
// Depth hues: terracotta, sage, slate-blue, plum, amber, teal.
const HUES = [14, 140, 215, 290, 38, 180];

function flatten(tree: ReorderNode[]): FlatItem[] {
  const out: FlatItem[] = [];
  function visit(list: ReorderNode[], parentId: string | null, prefix: number[]) {
    list.forEach((n, i) => {
      const path = [...prefix, i];
      out.push({
        id: n.id,
        parentId,
        depth: prefix.length,
        path,
        childCount: n.children.length,
      });
      visit(n.children, n.id, path);
    });
  }
  visit(tree, null, []);
  return out;
}

function indexTree(tree: ReorderNode[]): Map<string, ReorderNode> {
  const m = new Map<string, ReorderNode>();
  const walk = (l: ReorderNode[]) =>
    l.forEach((n) => {
      m.set(n.id, n);
      walk(n.children);
    });
  walk(tree);
  return m;
}

function cloneTree(tree: ReorderNode[]): ReorderNode[] {
  return tree.map((n) => ({ id: n.id, children: cloneTree(n.children) }));
}

/** Drop ids that sit under another id in the same set. */
function topmost(ids: Set<string>, flat: FlatItem[]): string[] {
  const parentOf = new Map(flat.map((f) => [f.id, f.parentId]));
  const order = new Map(flat.map((f, i) => [f.id, i]));
  return [...ids]
    .filter((id) => {
      let p = parentOf.get(id) ?? null;
      while (p) {
        if (ids.has(p)) return false;
        p = parentOf.get(p) ?? null;
      }
      return order.has(id);
    })
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

function descendantsOf(id: string, flat: FlatItem[]): Set<string> {
  const out = new Set<string>();
  let changed = true;
  out.add(id);
  while (changed) {
    changed = false;
    for (const f of flat) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        changed = true;
      }
    }
  }
  out.delete(id);
  return out;
}

function getProjection(
  items: FlatItem[],
  activeId: string,
  overId: string,
  offsetX: number,
  maxDepthCap: number,
) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const active = items[activeIndex];
  const moved = arrayMove(items, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const projected = active.depth + Math.round(offsetX / INDENT);
  const maxDepth = Math.min(prev ? prev.depth + 1 : 0, maxDepthCap);
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(projected, maxDepth));

  let parentId: string | null = null;
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId;
    else if (depth > prev.depth) parentId = prev.id;
    else
      parentId =
        moved
          .slice(0, overIndex)
          .reverse()
          .find((i) => i.depth === depth)?.parentId ?? null;
  }
  return { depth, parentId, moved, overIndex };
}

/**
 * Rebuild a tree from a flat list in document order where each entry names
 * its parent. Entries in `carry` keep their original children wholesale
 * (they were collapsed while dragging).
 */
function buildTree(
  list: Array<{ id: string; parentId: string | null }>,
  carry: Map<string, ReorderNode[]>,
): ReorderNode[] {
  const nodes = new Map<string, ReorderNode>();
  for (const e of list) {
    nodes.set(e.id, { id: e.id, children: carry.get(e.id) ?? [] });
  }
  const roots: ReorderNode[] = [];
  for (const e of list) {
    const node = nodes.get(e.id)!;
    const parent = e.parentId ? nodes.get(e.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/* ─── Indent / outdent on a selection ─────────────────────────────────── */

function removeFrom(list: ReorderNode[], id: string): ReorderNode | null {
  const i = list.findIndex((n) => n.id === id);
  if (i !== -1) return list.splice(i, 1)[0];
  for (const n of list) {
    const r = removeFrom(n.children, id);
    if (r) return r;
  }
  return null;
}

function siblingsOf(tree: ReorderNode[], id: string): ReorderNode[] | null {
  if (tree.some((n) => n.id === id)) return tree;
  for (const n of tree) {
    const r = siblingsOf(n.children, id);
    if (r) return r;
  }
  return null;
}

function parentNodeOf(tree: ReorderNode[], id: string, parent: ReorderNode | null = null): ReorderNode | null | undefined {
  for (const n of tree) {
    if (n.id === id) return parent;
    const r = parentNodeOf(n.children, id, n);
    if (r !== undefined) return r;
  }
  return undefined;
}

function indent(tree: ReorderNode[], ids: string[]): ReorderNode[] {
  const next = cloneTree(tree);
  for (const id of ids) {
    const sibs = siblingsOf(next, id);
    if (!sibs) continue;
    const i = sibs.findIndex((n) => n.id === id);
    if (i <= 0) continue; // nothing above to nest under
    const [node] = sibs.splice(i, 1);
    sibs[i - 1].children.push(node);
  }
  return next;
}

function outdent(tree: ReorderNode[], ids: string[]): ReorderNode[] {
  const next = cloneTree(tree);
  // Reverse so several siblings lifted together keep their order.
  for (const id of [...ids].reverse()) {
    const parent = parentNodeOf(next, id);
    if (!parent) continue; // already top level
    const grand = siblingsOf(next, parent.id);
    if (!grand) continue;
    const node = removeFrom(parent.children, id);
    if (!node) continue;
    const pi = grand.findIndex((n) => n.id === parent.id);
    grand.splice(pi + 1, 0, node);
  }
  return next;
}

/* ─── Row ────────────────────────────────────────────────────────────── */

function rowStyle(depth: number, siblingIndex: number, selected: boolean) {
  const hue = HUES[depth % HUES.length];
  const alpha = siblingIndex % 2 === 0 ? 0.1 : 0.2;
  return {
    backgroundColor: `hsl(${hue} 55% 50% / ${selected ? 0.32 : alpha})`,
    borderLeftColor: `hsl(${hue} 55% 45%)`,
  } as React.CSSProperties;
}

function Row({
  item,
  label,
  tooltip,
  depth,
  selected,
  ghost,
  onSelect,
}: {
  item: FlatItem;
  label: string;
  tooltip?: string;
  depth: number;
  selected: boolean;
  ghost: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });
  const siblingIndex = item.path[item.path.length - 1] ?? 0;
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        paddingLeft: depth * INDENT,
      }}
      className={cn("list-none", ghost && "opacity-40")}
    >
      <div
        role="button"
        tabIndex={-1}
        title={tooltip}
        onClick={(e) => onSelect(item.id, e)}
        style={rowStyle(depth, siblingIndex, selected)}
        className={cn(
          "flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border-l-4 pr-2 text-xs font-medium tabular-nums text-foreground",
          selected && "ring-brand-terracotta ring-1",
        )}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex h-full cursor-grab items-center px-1 active:cursor-grabbing"
          aria-label={`Drag ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="truncate">{label}</span>
        {item.childCount > 0 && (
          <span className="text-muted-foreground ml-auto text-[10px] font-normal">
            {item.childCount} sub
          </span>
        )}
      </div>
    </li>
  );
}

/* ─── Dialog ─────────────────────────────────────────────────────────── */

export interface TreeReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  tree: ReorderNode[];
  scheme: LabelScheme;
  /** Hover text per id — e.g. the start of the question. */
  tooltip?: (id: string) => string | undefined;
  /** Deepest allowed nesting, 0-based. */
  maxDepth?: number;
  onApply: (tree: ReorderNode[]) => void;
}

export function TreeReorderDialog({
  open,
  onOpenChange,
  title,
  description,
  tree: savedTree,
  scheme,
  tooltip,
  maxDepth = 6,
  onApply,
}: TreeReorderDialogProps) {
  const [tree, setTree] = React.useState<ReorderNode[]>(() => cloneTree(savedTree));
  const [history, setHistory] = React.useState<ReorderNode[][]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [anchor, setAnchor] = React.useState<string | null>(null);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [offsetX, setOffsetX] = React.useState(0);
  const [moving, setMoving] = React.useState<string[]>([]);

  // Each time the dialog opens, start from the form's current (saved) tree.
  React.useEffect(() => {
    if (open) {
      setTree(cloneTree(savedTree));
      setHistory([]);
      setSelected(new Set());
      setAnchor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const flat = React.useMemo(() => flatten(tree), [tree]);
  const labels = React.useMemo(
    () => new Map(flat.map((f) => [f.id, formatLabel(scheme, f.path)])),
    [flat, scheme],
  );

  // While dragging, collapse what travels with the active row: its own
  // descendants and the rest of the selection (plus theirs).
  const hidden = React.useMemo(() => {
    if (!activeId) return new Set<string>();
    const h = new Set<string>();
    for (const id of moving) {
      if (id !== activeId) h.add(id);
      for (const d of descendantsOf(id, flat)) h.add(d);
    }
    return h;
  }, [activeId, moving, flat]);
  const visible = React.useMemo(() => flat.filter((f) => !hidden.has(f.id)), [flat, hidden]);

  const projection =
    activeId && overId
      ? getProjection(visible, activeId, overId, offsetX, maxDepth)
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next: ReorderNode[]) {
    setHistory((h) => [...h, tree]);
    setTree(next);
  }

  function onSelect(id: string, e: React.MouseEvent) {
    setSelected((prev) => {
      if (e.shiftKey && anchor) {
        const a = flat.findIndex((f) => f.id === anchor);
        const b = flat.findIndex((f) => f.id === id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        return new Set(flat.slice(lo, hi + 1).map((f) => f.id));
      }
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return prev.size === 1 && prev.has(id) ? new Set() : new Set([id]);
    });
    if (!e.shiftKey) setAnchor(id);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const group = selected.has(id) ? new Set(selected) : new Set([id]);
    if (!selected.has(id)) setSelected(new Set([id]));
    setMoving(topmost(group, flat));
    setActiveId(id);
    setOverId(id);
    setOffsetX(0);
  }
  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetX(delta.x);
  }
  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over ? String(over.id) : null);
  }
  function reset() {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
    setMoving([]);
  }
  function handleDragEnd({ over }: DragEndEvent) {
    if (!activeId || !over || !projection) {
      reset();
      return;
    }
    const { parentId, moved } = projection;
    const byId = indexTree(tree);
    // Moving roots keep their original subtrees.
    const carry = new Map<string, ReorderNode[]>();
    for (const id of moving) carry.set(id, cloneTree(byId.get(id)?.children ?? []));

    const list: Array<{ id: string; parentId: string | null }> = [];
    for (const it of moved) {
      if (it.id === activeId) {
        // The whole moving group lands here, as siblings, in document order.
        for (const id of moving) list.push({ id, parentId });
      } else {
        list.push({ id: it.id, parentId: it.parentId });
      }
    }
    // Non-moving items whose descendants were never hidden still need
    // their children; those are in `list` already. Hidden descendants of
    // the moving group come back via `carry`.
    const next = buildTree(list, carry);
    reset();
    if (JSON.stringify(next) !== JSON.stringify(tree)) commit(next);
  }

  const selectionRoots = topmost(selected, flat);
  const activeLabel = activeId ? labels.get(activeId) : null;
  const dirty = JSON.stringify(tree) !== JSON.stringify(savedTree.map(strip));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            {description ??
              "Drag to reorder. Drag right to nest under the row above, left to lift out. Ctrl/⌘ or Shift-click to move several at once."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectionRoots.length === 0}
            onClick={() => commit(indent(tree, selectionRoots))}
          >
            <IndentIncrease className="size-3.5" /> Indent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectionRoots.length === 0}
            onClick={() => commit(outdent(tree, selectionRoots))}
          >
            <IndentDecrease className="size-3.5" /> Outdent
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={history.length === 0}
              onClick={() => {
                setTree(history[history.length - 1]);
                setHistory((h) => h.slice(0, -1));
              }}
            >
              <Undo2 className="size-3.5" /> Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!dirty}
              title="Rewind to the last saved arrangement"
              onClick={() => {
                setHistory((h) => [...h, tree]);
                setTree(cloneTree(savedTree));
              }}
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {flat.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing to arrange yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              // Rows are collapsed out of the list when a drag starts (the
              // dragged row's children and the rest of the selection), so
              // droppable rects must be re-measured or the drop target is
              // computed against the pre-collapse layout.
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={reset}
            >
              <SortableContext items={visible.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {visible.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      label={labels.get(item.id) ?? ""}
                      tooltip={tooltip?.(item.id)}
                      depth={item.id === activeId && projection ? projection.depth : item.depth}
                      selected={selected.has(item.id)}
                      ghost={item.id === activeId}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              </SortableContext>
              {/* Portalled: the dialog is CSS-transformed, which turns the
                  overlay's position:fixed into "relative to the dialog" and
                  skews the collision rect dnd-kit measures from it. */}
              {typeof document !== "undefined" &&
                createPortal(
                  <DragOverlay zIndex={60}>
                    {activeId ? (
                      <div className="bg-card border-brand-terracotta flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium shadow-lg">
                        <GripVertical className="size-3.5" />
                        {activeLabel}
                        {moving.length > 1 && (
                          <span className="bg-brand-terracotta text-brand-terracotta-foreground rounded-full px-1.5 text-[10px]">
                            +{moving.length - 1}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
            </DndContext>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-muted-foreground text-xs">
            {selected.size > 0 ? `${selected.size} selected` : `${flat.length} items`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={!dirty}
              onClick={() => {
                onApply(cloneTree(tree));
                onOpenChange(false);
              }}
            >
              Apply order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function strip(n: ReorderNode): ReorderNode {
  return { id: n.id, children: n.children.map(strip) };
}
