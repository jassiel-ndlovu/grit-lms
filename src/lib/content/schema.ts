/**
 * Validate a rich document against the content schema (contracts/editor.md).
 * Server actions run every incoming document through `validateDoc` before
 * saving it: the JSON comes from the browser, so unknown nodes or marks, bad
 * nesting and oversized documents are refused here, not trusted.
 */

import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as PMNode, type Schema } from "@tiptap/pm/model";

import { contentExtensions } from "./extensions";
import { parseGraphSpec } from "./graph-spec";

/** About 50 pages of dense text. A lesson body is a few KB today. */
export const MAX_DOC_BYTES = 512 * 1024;

let schema: Schema | null = null;
export function contentSchema(): Schema {
  schema ??= getSchema(contentExtensions());
  return schema;
}

/**
 * The document as the schema reads it (unknown attributes dropped, defaults
 * filled), or null when it is not valid rich content.
 */
export function validateDoc(doc: unknown): JSONContent | null {
  if (!doc || typeof doc !== "object" || (doc as JSONContent).type !== "doc") return null;
  try {
    if (JSON.stringify(doc).length > MAX_DOC_BYTES) return null;
    const node = PMNode.fromJSON(contentSchema(), doc);
    node.check(); // content expressions and marks, recursively
    return cleanGraphs(node.toJSON() as JSONContent);
  } catch {
    return null;
  }
}

/**
 * Every graph's spec through parseGraphSpec: the schema only knows `spec` is
 * an attribute, not what's in it. A graph that isn't valid refuses the whole
 * document, like any other bad node.
 */
class BadGraph extends Error {}
function cleanGraphs(doc: JSONContent): JSONContent | null {
  const walk = (n: JSONContent): JSONContent => {
    if (n.type === "graph") {
      const spec = parseGraphSpec(n.attrs?.spec);
      if (!spec) throw new BadGraph();
      return { ...n, attrs: { ...n.attrs, spec } };
    }
    return n.content ? { ...n, content: n.content.map(walk) } : n;
  };
  try {
    return walk(doc);
  } catch (e) {
    if (e instanceof BadGraph) return null;
    throw e;
  }
}
