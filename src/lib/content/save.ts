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
import { validateDoc } from "./schema";
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
