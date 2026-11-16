/**
 * The stored form of rich content (contracts/editor.md): a small envelope
 * around the Tiptap document, so the schema can change later without
 * guessing what an old row means.
 *
 *   { "schemaVersion": 1, "doc": { "type": "doc", "content": [...] } }
 *
 * It lives in a nullable Json column beside today's string column, which
 * keeps the derived markdown (./markdown.ts). Pure; safe anywhere.
 */

import type { JSONContent } from "@tiptap/core";

export const CONTENT_SCHEMA_VERSION = 1;

export interface StoredContent {
  schemaVersion: number;
  doc: JSONContent;
}

export function toStoredContent(doc: JSONContent): StoredContent {
  return { schemaVersion: CONTENT_SCHEMA_VERSION, doc };
}

/**
 * Read a Json column. Null when the column is empty or the value is not
 * rich content this build understands; callers then fall back to the
 * markdown column. Older schema versions are upgraded here when they exist.
 */
export function readStoredContent(value: unknown): StoredContent | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<StoredContent>;
  if (typeof v.schemaVersion !== "number" || v.schemaVersion < 1 || v.schemaVersion > CONTENT_SCHEMA_VERSION) return null;
  if (!v.doc || typeof v.doc !== "object" || v.doc.type !== "doc") return null;
  return { schemaVersion: v.schemaVersion, doc: v.doc };
}
