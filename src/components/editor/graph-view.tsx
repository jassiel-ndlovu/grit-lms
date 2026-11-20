"use client";

/**
 * The graph block in the editor (contracts/editor.md, schema version 2):
 * the drawn graph with an Edit button, and the dialog that edits its spec
 * with a live preview. A new graph opens straight into the dialog.
 */

import * as React from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { GraphFigure } from "@/components/content/graph-figure";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Graph } from "@/lib/content/graph";
import {
  DEFAULT_GRAPH,
  GRAPH_COLORS,
  MAX_DESCRIPTION,
  MAX_GRAPH_ITEMS,
  MAX_LABEL,
  graphProblems,
  parseGraphSpec,
  type GraphColor,
  type GraphItem,
  type GraphSpec,
} from "@/lib/content/graph-spec";
import { cn } from "@/lib/utils";

/* ───── The form's draft: numbers as typed, so "-" and "1," can be on the way to a number ───── */

type DraftItem =
  | { kind: "function"; expr: string; label: string; color: GraphColor }
  | { kind: "point"; x: string; y: string; label: string; color: GraphColor }
  | { kind: "segment"; x1: string; y1: string; x2: string; y2: string; label: string; color: GraphColor };

type Draft = { description: string; xMin: string; xMax: string; yMin: string; yMax: string; grid: boolean; items: DraftItem[] };

const n = (s: string) => (s.trim() === "" ? NaN : Number(s.trim().replace(",", ".")));
const s = (v: number) => String(v);

function toDraft(spec: GraphSpec): Draft {
  return {
    description: spec.description,
    xMin: s(spec.x[0]),
    xMax: s(spec.x[1]),
    yMin: s(spec.y[0]),
    yMax: s(spec.y[1]),
    grid: spec.grid,
    items: spec.items.map((it): DraftItem => {
      const label = it.label ?? "";
      if (it.kind === "function") return { kind: "function", expr: it.expr, label, color: it.color };
      if (it.kind === "point") return { kind: "point", x: s(it.x), y: s(it.y), label, color: it.color };
      return { kind: "segment", x1: s(it.from[0]), y1: s(it.from[1]), x2: s(it.to[0]), y2: s(it.to[1]), label, color: it.color };
    }),
  };
}

/** The draft as a spec; numbers may be NaN here, graphProblems reports them. */
function fromDraft(d: Draft): GraphSpec {
  return {
    v: 1,
    description: d.description,
    x: [n(d.xMin), n(d.xMax)],
    y: [n(d.yMin), n(d.yMax)],
    grid: d.grid,
    items: d.items.map((it): GraphItem => {
      const label = it.label.trim() || undefined;
      if (it.kind === "function") return { kind: "function", expr: it.expr, label, color: it.color };
      if (it.kind === "point") return { kind: "point", x: n(it.x), y: n(it.y), label, color: it.color };
      return { kind: "segment", from: [n(it.x1), n(it.y1)], to: [n(it.x2), n(it.y2)], label, color: it.color };
    }),
  };
}

const NEW_ITEM: Record<DraftItem["kind"], (color: GraphColor) => DraftItem> = {
  function: (color) => ({ kind: "function", expr: "", label: "", color }),
  point: (color) => ({ kind: "point", x: "0", y: "0", label: "", color }),
  segment: (color) => ({ kind: "segment", x1: "0", y1: "0", x2: "1", y2: "1", label: "", color }),
};

const COLOR_NAMES: Record<GraphColor, string> = { blue: "Blue", red: "Red", green: "Green", orange: "Amber", violet: "Violet" };
const SELECT = "border-input bg-background h-9 rounded-md border px-2 text-sm";

/* ───── The dialog ───── */

export function GraphDialog({
  open,
  initial,
  onSave,
  onCancel,
}: {
  open: boolean;
  initial: GraphSpec;
  onSave: (spec: GraphSpec) => void;
  onCancel: () => void;
}) {
  const ids = React.useId();
  const [d, setD] = React.useState(() => toDraft(initial));
  React.useEffect(() => {
    if (open) setD(toDraft(initial));
  }, [open, initial]);

  const spec = fromDraft(d);
  const problems = graphProblems(spec);
  const valid = parseGraphSpec(spec);
  const ok = !problems.range && problems.items.every((p) => !p) && valid != null;
  // The preview keeps the last good graph while a formula is half typed.
  const [preview, setPreview] = React.useState<GraphSpec>(initial);
  React.useEffect(() => {
    if (valid) setPreview(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(valid)]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<DraftItem>) =>
    setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? ({ ...it, ...patch } as DraftItem) : it)) }));
  const add = (kind: DraftItem["kind"]) =>
    setD((x) => ({ ...x, items: [...x.items, NEW_ITEM[kind](GRAPH_COLORS[x.items.length % GRAPH_COLORS.length])] }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Graph</DialogTitle>
          <DialogDescription>
            Curves, points and line segments on a grid. Write formulas in x, for example 2x^2 - 3, sin(x) or sqrt(x).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-desc`}>Description</Label>
              <Input
                id={`${ids}-desc`}
                value={d.description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="The parabola y = x² and its turning point"
              />
              <p className="text-muted-foreground text-xs">Read out by screen readers and shown under the graph. Optional.</p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Show</legend>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground w-4">x</span>
                <Input aria-label="x from" inputMode="decimal" className="w-20" value={d.xMin} onChange={(e) => set({ xMin: e.target.value })} />
                <span className="text-muted-foreground">to</span>
                <Input aria-label="x to" inputMode="decimal" className="w-20" value={d.xMax} onChange={(e) => set({ xMax: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground w-4">y</span>
                <Input aria-label="y from" inputMode="decimal" className="w-20" value={d.yMin} onChange={(e) => set({ yMin: e.target.value })} />
                <span className="text-muted-foreground">to</span>
                <Input aria-label="y to" inputMode="decimal" className="w-20" value={d.yMax} onChange={(e) => set({ yMax: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.grid} onChange={(e) => set({ grid: e.target.checked })} />
                Grid lines
              </label>
              {problems.range ? (
                <p role="alert" className="text-destructive text-xs">
                  {problems.range}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">On the graph</legend>
              {d.items.length === 0 ? <p className="text-muted-foreground text-sm">Nothing yet. Add a curve, point or segment.</p> : null}
              <ol className="space-y-3">
                {d.items.map((it, i) => (
                  <li key={i} className="border-border space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {it.kind === "function" ? "Curve" : it.kind === "point" ? "Point" : "Segment"}
                      </span>
                      <select
                        aria-label={`Colour of item ${i + 1}`}
                        className={cn(SELECT, "ml-auto h-8")}
                        value={it.color}
                        onChange={(e) => setItem(i, { color: e.target.value as GraphColor })}
                      >
                        {GRAPH_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {COLOR_NAMES[c]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Remove item ${i + 1}`}
                        onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    {it.kind === "function" ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono whitespace-nowrap">y =</span>
                        <Input
                          aria-label={`Formula of item ${i + 1}`}
                          className="font-mono"
                          value={it.expr}
                          spellCheck={false}
                          autoFocus={it.expr === ""}
                          onChange={(e) => setItem(i, { expr: e.target.value })}
                          placeholder="x^2 - 2x + 1"
                        />
                      </div>
                    ) : it.kind === "point" ? (
                      <div className="flex items-center gap-1 font-mono text-sm">
                        (<Input aria-label={`x of item ${i + 1}`} inputMode="decimal" className="w-20" value={it.x} onChange={(e) => setItem(i, { x: e.target.value })} />,
                        <Input aria-label={`y of item ${i + 1}`} inputMode="decimal" className="w-20" value={it.y} onChange={(e) => setItem(i, { y: e.target.value })} />)
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1 font-mono text-sm">
                        from (<Input aria-label={`Start x of item ${i + 1}`} inputMode="decimal" className="w-16" value={it.x1} onChange={(e) => setItem(i, { x1: e.target.value })} />,
                        <Input aria-label={`Start y of item ${i + 1}`} inputMode="decimal" className="w-16" value={it.y1} onChange={(e) => setItem(i, { y1: e.target.value })} />) to (
                        <Input aria-label={`End x of item ${i + 1}`} inputMode="decimal" className="w-16" value={it.x2} onChange={(e) => setItem(i, { x2: e.target.value })} />,
                        <Input aria-label={`End y of item ${i + 1}`} inputMode="decimal" className="w-16" value={it.y2} onChange={(e) => setItem(i, { y2: e.target.value })} />)
                      </div>
                    )}
                    <Input
                      aria-label={`Label of item ${i + 1}`}
                      value={it.label}
                      maxLength={MAX_LABEL}
                      onChange={(e) => setItem(i, { label: e.target.value })}
                      placeholder={it.kind === "function" ? "Label, for example f (optional)" : "Label, for example A (optional)"}
                    />
                    {problems.items[i] ? (
                      <p role="alert" className="text-destructive text-xs">
                        {problems.items[i]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
              {d.items.length < MAX_GRAPH_ITEMS ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => add("function")}>
                    <Plus aria-hidden /> Curve
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => add("point")}>
                    <Plus aria-hidden /> Point
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => add("segment")}>
                    <Plus aria-hidden /> Segment
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">A graph holds up to {MAX_GRAPH_ITEMS} items.</p>
              )}
            </fieldset>
          </div>

          <div className="md:sticky md:top-0 md:self-start">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Preview</p>
            <GraphFigure spec={preview} height={300} className="my-0" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!ok} onClick={() => valid && onSave(valid)}>
            Save graph
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── The node view ───── */

/**
 * Set by the Graph command just before it inserts a graph, and taken by the
 * node view that mounts next: that graph opens into its dialog, and
 * cancelling removes it. Loading a document never sets it.
 */
export const pendingNewGraph = { current: false };

function GraphNodeView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const spec = parseGraphSpec(node.attrs.spec) ?? DEFAULT_GRAPH;
  // A graph just inserted from the menu opens into the dialog.
  const [isNew] = React.useState(() => {
    const taken = pendingNewGraph.current;
    pendingNewGraph.current = false;
    return taken && editor.isEditable;
  });
  const [open, setOpen] = React.useState(isNew);
  const fresh = React.useRef(isNew);

  return (
    <NodeViewWrapper data-type="graph" className={cn("group relative my-4 rounded-md", selected && "ring-ring ring-2 ring-offset-2")}>
      <div contentEditable={false}>
        <GraphFigure spec={spec} height={260} className="my-0" />
        {editor.isEditable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background absolute top-2 right-2 opacity-90 group-hover:opacity-100"
            onClick={() => setOpen(true)}
          >
            <Pencil aria-hidden /> Edit graph
          </Button>
        ) : null}
        <GraphDialog
          open={open}
          initial={spec}
          onSave={(next) => {
            fresh.current = false;
            updateAttributes({ spec: next });
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
            // Cancelling a graph that was never saved removes it.
            if (fresh.current) deleteNode();
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const EditorGraph = Graph.extend({
  addNodeView() {
    return ReactNodeViewRenderer(GraphNodeView, {
      // Typing in the dialog stays in the dialog (it's portalled, but be safe).
      stopEvent: ({ event }) => {
        const t = event.target as HTMLElement | null;
        return !!t?.closest('[role="dialog"]');
      },
    });
  },
});
