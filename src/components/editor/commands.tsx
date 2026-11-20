"use client";

/**
 * Block commands, shared by the slash menu and the toolbar. A command whose
 * `feature` is off is hidden; it never changes the schema (editor.md).
 */

import type { ChainedCommands, Editor, Range } from "@tiptap/core";
import { DEFAULT_GRAPH } from "@/lib/content/graph-spec";
import {
  ChartSpline, Code2, Heading2, Heading3, List, ListOrdered, Minus, Pilcrow, Quote, Sigma, SquareFunction, Table,
  type LucideIcon,
} from "lucide-react";

import { pendingNewGraph } from "./graph-view";

export interface EditorFeatures {
  /** Maths nodes and the TeX box. On unless turned off. */
  math: boolean;
  /** Visual maths input with MathLive (Plus service `math-input`). Off unless the page turns it on; TeX stays available. */
  mathInput: boolean;
  /** The Graph block (Plus service `graphing`). Off unless the page turns it on. */
  graph: boolean;
  tables: boolean;
  headings: boolean;
}

export const DEFAULT_FEATURES: EditorFeatures = { math: true, mathInput: false, graph: false, tables: true, headings: true };

export interface BlockCommand {
  id: string;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  feature?: keyof EditorFeatures;
  apply: (chain: ChainedCommands) => ChainedCommands;
}

export const BLOCK_COMMANDS: BlockCommand[] = [
  { id: "text", label: "Text", keywords: ["paragraph", "plain"], icon: Pilcrow, apply: (c) => c.setParagraph() },
  { id: "h2", label: "Heading", keywords: ["title", "h2"], icon: Heading2, feature: "headings", apply: (c) => c.setHeading({ level: 2 }) },
  { id: "h3", label: "Subheading", keywords: ["h3"], icon: Heading3, feature: "headings", apply: (c) => c.setHeading({ level: 3 }) },
  { id: "bullets", label: "Bulleted list", keywords: ["ul", "unordered"], icon: List, apply: (c) => c.toggleBulletList() },
  { id: "numbers", label: "Numbered list", keywords: ["ol", "ordered"], icon: ListOrdered, apply: (c) => c.toggleOrderedList() },
  { id: "quote", label: "Quote", keywords: ["blockquote", "callout"], icon: Quote, apply: (c) => c.toggleBlockquote() },
  { id: "code", label: "Code block", keywords: ["pre", "snippet"], icon: Code2, apply: (c) => c.toggleCodeBlock() },
  { id: "divider", label: "Divider", keywords: ["hr", "line", "rule"], icon: Minus, apply: (c) => c.setHorizontalRule() },
  {
    id: "math-block", label: "Maths block", keywords: ["equation", "latex", "tex", "display", "formula"], icon: SquareFunction, feature: "math",
    apply: (c) => c.insertContent({ type: "blockMath", attrs: { latex: "" } }),
  },
  {
    id: "math-inline", label: "Inline maths", keywords: ["equation", "latex", "tex", "formula"], icon: Sigma, feature: "math",
    apply: (c) => c.insertContent({ type: "inlineMath", attrs: { latex: "" } }),
  },
  {
    id: "graph", label: "Graph", keywords: ["plot", "chart", "function", "parabola", "axes", "coordinates"], icon: ChartSpline, feature: "graph",
    apply: (c) => {
      pendingNewGraph.current = true;
      return c.insertContent({ type: "graph", attrs: { spec: DEFAULT_GRAPH } });
    },
  },
  {
    id: "table", label: "Table", keywords: ["grid", "rows", "columns"], icon: Table, feature: "tables",
    apply: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
];

export function commandsFor(features: EditorFeatures): BlockCommand[] {
  return BLOCK_COMMANDS.filter((c) => !c.feature || features[c.feature]);
}

export function filterCommands(commands: BlockCommand[], query: string): BlockCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => [c.label, ...c.keywords].some((w) => w.toLowerCase().includes(q)));
}

export function runCommand(editor: Editor, command: BlockCommand, range?: Range) {
  const chain = editor.chain().focus();
  command.apply(range ? chain.deleteRange(range) : chain).run();
}
