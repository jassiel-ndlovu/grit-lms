/**
 * What a server action saves for a rich field (contracts/editor.md, rules 1
 * and 2): the envelope the browser sent, validated against the content
 * schema, and the markdown copy derived from it here. Pure; safe anywhere,
 * but meant for server actions.
 *
 *   const rich = richFieldFromInput(parsedInput.bodyJson);
 *   if (!rich) throw new Error("…");
 *   data.body = rich.markdown; data.bodyJson = rich.json;
 */

import { docToMarkdown } from "./markdown";
import { Node as PMNode } from "@tiptap/pm/model";

import { MAX_DOC_BYTES, contentSchema, validateDoc } from "./schema";
import { readStoredContent, toStoredContent, type StoredContent } from "./value";

export interface RichFieldWrite {
  /** The validated envelope, for the `xJson` column. */
  json: StoredContent;
  /** The derived markdown, for the `x` column. */
  markdown: string;
  /** True when the document has no content worth keeping. */
  empty: boolean;
}

/**
 * Null when the value is not an envelope this build understands or its
 * document fails validation. Callers refuse the save then.
 */
export function richFieldFromInput(value: unknown): RichFieldWrite | null {
  const stored = readStoredContent(value);
  if (!stored) return null;
  const doc = validateDoc(stored.doc);
  if (!doc) return null;
  const markdown = docToMarkdown(doc).trim();
  return { json: toStoredContent(doc), markdown, empty: markdown === "" };
}

/**
 * Why `richFieldFromInput` refused a value, for server logs. Never throws.
 * The message names nodes and rules, not the content.
 */
export function richFieldRefusal(value: unknown): string {
  try {
    const stored = readStoredContent(value);
    if (!stored) return "not a content envelope this build understands";
    if (JSON.stringify(stored.doc).length > MAX_DOC_BYTES) return "document too large";
    PMNode.fromJSON(contentSchema(), stored.doc).check();
    return "no reason found";
  } catch (e) {
    // A browser that sends non-plain objects (an old RichEditor bundle)
    // lands here: React's server-action decoder refuses property access.
    return e instanceof Error ? e.message : String(e);
  }
}
