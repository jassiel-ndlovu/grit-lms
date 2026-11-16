/**
 * Markdown <-> rich content (contracts/editor.md).
 *
 * - markdownToDoc: today's stored markdown + TeX to a Tiptap document. Runs
 *   the delimiter rewrite first (`\(…\)` and `\[…\]` to dollars, without the
 *   react-markdown escaping), so the maths tokenizers see raw TeX.
 * - docToMarkdown: the derived markdown copy written beside the JSON on every
 *   save, for search, AI marking, export, the LLM import guide and old
 *   renderers. Maths comes out as `$…$` / `$$…$$`.
 *
 * Server-safe. One MarkdownManager per module: building it registers the
 * tokenizers with marked, which is not free.
 */

import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";

import { normalizeTexDelimiters } from "@/lib/tex-delimiters";

import { contentExtensions } from "./extensions";

let manager: MarkdownManager | null = null;
function md(): MarkdownManager {
  if (manager) return manager;
  const m = new MarkdownManager({ extensions: contentExtensions() });
  // Its text escaping covers backslash, backtick, * _ [ ] ~ but not `$`, so a
  // literal dollar in text ("costs $5 and $10") would come back as maths. The
  // method is private in the types only; scripts/check-rich-content.ts fails
  // if a Tiptap update renames it.
  const inner = m as unknown as { escapeMarkdownSyntax: (text: string) => string };
  const escape = inner.escapeMarkdownSyntax.bind(m);
  inner.escapeMarkdownSyntax = (text) => escape(text).replace(/\$/g, "\\$$");
  manager = m;
  return m;
}

export function markdownToDoc(markdown: string): JSONContent {
  const src = normalizeTexDelimiters(markdown ?? "", { escapeMath: false });
  return liftImages(md().parse(src));
}

/**
 * Images are blocks in rich content, but markdown allows one mid-line
 * ("See ![icon](…) here"). Split the paragraph or heading around it, so the
 * image becomes its own block between the two halves.
 */
function liftImages(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const content: JSONContent[] = [];
  for (const child of node.content.map(liftImages)) {
    const isTextblock = child.type === "paragraph" || child.type === "heading";
    if (!isTextblock || !child.content?.some((c) => c.type === "image")) {
      content.push(child);
      continue;
    }
    let run: JSONContent[] = [];
    const flush = () => {
      const trimmed = trimRun(run);
      if (trimmed.length) content.push({ ...child, content: trimmed });
      run = [];
    };
    for (const c of child.content) {
      if (c.type === "image") {
        flush();
        content.push(c);
      } else {
        run.push(c);
      }
    }
    flush();
  }
  return { ...node, content };
}

/** Drop the line breaks and spaces left at the cut, and empty text. */
function trimRun(run: JSONContent[]): JSONContent[] {
  const out = run.filter((c) => c.type !== "hardBreak" || (c !== run[0] && c !== run[run.length - 1]));
  if (out[0]?.type === "text") out[0] = { ...out[0], text: (out[0].text ?? "").replace(/^\s+/, "") };
  const last = out.length - 1;
  if (out[last]?.type === "text") out[last] = { ...out[last], text: (out[last].text ?? "").replace(/\s+$/, "") };
  return out.filter((c) => c.type !== "text" || c.text);
}

export function docToMarkdown(doc: JSONContent): string {
  return md().serialize(doc).trimEnd();
}
