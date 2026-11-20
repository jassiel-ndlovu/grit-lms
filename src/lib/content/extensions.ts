/**
 * The one extension list that defines rich content (contracts/editor.md).
 * The editor, the markdown converter and the static renderer all build from
 * it, so a document that one of them accepts, the others accept too.
 *
 * No React and no DOM: safe on the server. The editor (client) extends some
 * nodes with node views and adds editing-only extensions (placeholder, slash
 * menu, drag handle) that do not change the schema.
 *
 * Adding or changing a node here changes the stored format: bump
 * CONTENT_SCHEMA_VERSION in ./value.ts and add an upgrade step there.
 */

import type { AnyExtension } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

import { Graph } from "./graph";
import { ContentImage } from "./image";
import { BlockMath, InlineMath } from "./math";

export function contentExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      // Editing behaviour only; the editor turns these on itself.
      dropcursor: false,
      gapcursor: false,
      trailingNode: false,
      undoRedo: false,
      link: { openOnClick: false, autolink: true },
    }),
    ContentImage,
    Table,
    TableRow,
    TableHeader,
    TableCell,
    InlineMath,
    BlockMath,
    Graph, // schema version 2
  ];
}
