/**
 * The `graph` node (contracts/editor.md, schema version 2): a block holding
 * a GraphSpec. Drawn with Mafs in the browser (components/content/graph-view);
 * here it has no React and no DOM, so the server can validate, serialise and
 * render it.
 *
 * - HTML: a <figure data-type="graph"> with the spec as JSON in data-spec
 *   and the summary as its text, so HTML without our script still says
 *   what the graph shows.
 * - Markdown: no markdown form. The derived copy is a one-line
 *   "[Graph: …]", so search and AI marking still see something. Markdown
 *   never reads back into a graph: the JSON is the source of truth.
 */

import { Node } from "@tiptap/core";

import { graphSummary, parseGraphSpec, type GraphSpec } from "./graph-spec";

export const Graph = Node.create({
  name: "graph",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { spec: { default: null } };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="graph"]',
        getAttrs: (el) => {
          try {
            const spec = parseGraphSpec(JSON.parse((el as HTMLElement).getAttribute("data-spec") ?? "null"));
            return spec ? { spec } : false;
          } catch {
            return false;
          }
        },
      },
    ];
  },

  renderHTML({ node }) {
    const spec = parseGraphSpec(node.attrs.spec);
    if (!spec) return ["figure", { "data-type": "graph" }, "Graph"];
    return ["figure", { "data-type": "graph", "data-spec": JSON.stringify(spec) }, `Graph: ${graphSummary(spec)}`];
  },

  renderMarkdown(node) {
    const spec = parseGraphSpec(node.attrs?.spec);
    return spec ? `[Graph: ${graphSummary(spec)}]` : "";
  },
});

/** The spec of a graph node's attrs, cleaned, or null. */
export function graphNodeSpec(attrs: unknown): GraphSpec | null {
  return parseGraphSpec((attrs as { spec?: unknown } | null)?.spec);
}
