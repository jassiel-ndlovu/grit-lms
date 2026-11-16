/**
 * Validate a rich document against the content schema (contracts/editor.md).
 * Server actions run every incoming document through `validateDoc` before
 * saving it: the JSON comes from the browser, so unknown nodes or marks, bad
 * nesting and oversized documents are refused here, not trusted.
 */

import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as PMNode, type Schema } from "@tiptap/pm/model";

import { contentExtensions } from "./extensions";

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
    return node.toJSON() as JSONContent;
  } catch {
    return null;
  }
}
