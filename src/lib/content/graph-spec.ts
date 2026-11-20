/**
 * The graph spec stored in a `graph` node (contracts/editor.md): our own
 * small JSON, drawn with Mafs in the browser. Kept to what a lesson needs in
 * v1: function curves, points and line segments on a Cartesian grid, with
 * plain-text labels. Pure; the server checks every spec with parseGraphSpec
 * before a document is saved.
 */

import { compileExpression, MAX_EXPR_LENGTH } from "./expr";

export const GRAPH_COLORS = ["blue", "red", "green", "orange", "violet"] as const;
export type GraphColor = (typeof GRAPH_COLORS)[number];

export type GraphItem =
  | { kind: "function"; expr: string; label?: string; color: GraphColor }
  | { kind: "point"; x: number; y: number; label?: string; color: GraphColor }
  | { kind: "segment"; from: [number, number]; to: [number, number]; label?: string; color: GraphColor };

export interface GraphSpec {
  v: 1;
  /** What the graph shows, in words. Its alt text and its markdown copy. */
  description: string;
  x: [number, number];
  y: [number, number];
  grid: boolean;
  items: GraphItem[];
}

export const MAX_GRAPH_ITEMS = 12;
export const MAX_LABEL = 40;
export const MAX_DESCRIPTION = 200;
const MAX_COORD = 10_000;

export const DEFAULT_GRAPH: GraphSpec = {
  v: 1,
  description: "",
  x: [-5, 5],
  y: [-5, 5],
  grid: true,
  items: [{ kind: "function", expr: "x^2", color: "blue" }],
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_COORD ? v : null);
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const color = (v: unknown, i: number): GraphColor =>
  GRAPH_COLORS.includes(v as GraphColor) ? (v as GraphColor) : GRAPH_COLORS[i % GRAPH_COLORS.length];
function range(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  return a != null && b != null && a < b ? [a, b] : null;
}
function pair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  return a != null && b != null ? [a, b] : null;
}

function item(v: unknown, i: number): GraphItem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = text(o.label, MAX_LABEL);
  const c = color(o.color, i);
  if (o.kind === "function") {
    if (typeof o.expr !== "string" || o.expr.length > MAX_EXPR_LENGTH) return null;
    if ("error" in compileExpression(o.expr)) return null;
    return { kind: "function", expr: o.expr.trim(), ...(label ? { label } : {}), color: c };
  }
  if (o.kind === "point") {
    const x = num(o.x);
    const y = num(o.y);
    return x != null && y != null ? { kind: "point", x, y, ...(label ? { label } : {}), color: c } : null;
  }
  if (o.kind === "segment") {
    const from = pair(o.from);
    const to = pair(o.to);
    return from && to ? { kind: "segment", from, to, ...(label ? { label } : {}), color: c } : null;
  }
  return null;
}

/** The spec as stored, cleaned, or null when it isn't a valid graph. */
export function parseGraphSpec(value: unknown): GraphSpec | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (o.v !== 1) return null;
  const x = range(o.x);
  const y = range(o.y);
  if (!x || !y || !Array.isArray(o.items) || o.items.length > MAX_GRAPH_ITEMS) return null;
  const items: GraphItem[] = [];
  for (const [i, raw] of o.items.entries()) {
    const it = item(raw, i);
    if (!it) return null;
    items.push(it);
  }
  return { v: 1, description: text(o.description, MAX_DESCRIPTION) ?? "", x, y, grid: o.grid !== false, items };
}

/** One line for the markdown copy and screen readers: "y = x^2; point A (1, 2)". */
export function graphSummary(spec: GraphSpec): string {
  if (spec.description) return spec.description;
  const parts = spec.items.map((it) => {
    const name = it.label ? `${it.label} ` : "";
    if (it.kind === "function") return `${name}y = ${it.expr}`.trim();
    if (it.kind === "point") return `point ${name}(${it.x}, ${it.y})`;
    return `segment ${name}from (${it.from.join(", ")}) to (${it.to.join(", ")})`;
  });
  return parts.join("; ") || "empty grid";
}

/** What's wrong with a spec being edited, item by item, for the editor form. */
export function graphProblems(spec: GraphSpec): { range?: string; items: (string | null)[] } {
  const r =
    !(spec.x[0] < spec.x[1]) || !(spec.y[0] < spec.y[1])
      ? "Each range needs a smaller first number."
      : [...spec.x, ...spec.y].some((n) => !Number.isFinite(n) || Math.abs(n) > MAX_COORD)
        ? `Keep ranges between -${MAX_COORD} and ${MAX_COORD}.`
        : undefined;
  return {
    ...(r ? { range: r } : {}),
    items: spec.items.map((it) => {
      if (it.kind === "function") {
        const c = compileExpression(it.expr);
        return "error" in c ? c.error : null;
      }
      const nums = it.kind === "point" ? [it.x, it.y] : [...it.from, ...it.to];
      return nums.every((n) => Number.isFinite(n) && Math.abs(n) <= MAX_COORD) ? null : "Enter numbers for each coordinate.";
    }),
  };
}
