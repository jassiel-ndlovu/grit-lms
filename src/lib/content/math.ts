/**
 * Maths nodes for rich content (contracts/editor.md). Ours, not
 * @tiptap/extension-mathematics: that one renders with KaTeX, and the owner
 * chose MathJax 4 everywhere so the editor and the student page always agree.
 *
 * - `inlineMath` { latex, display }: `$x$` in text. `display` keeps a `$$x$$`
 *   written mid-paragraph as display maths, as MathJax shows it today.
 * - `blockMath` { latex }: a `$$…$$` that starts and ends its own lines.
 *
 * Both are atoms: the editor edits `latex` in a popover, never as text.
 * These definitions hold no React and no DOM, so the server can parse,
 * serialise and render with them. The editor adds node views on top.
 */

import { Node, type MarkdownToken } from "@tiptap/core";

/** Offset of the first `$` not escaped by an odd run of backslashes, or -1. */
function firstDollar(src: string): number {
  for (let i = src.indexOf("$"); i !== -1; i = src.indexOf("$", i + 1)) {
    let n = 0;
    while (src[i - 1 - n] === "\\") n++;
    if (n % 2 === 0) return i;
  }
  return -1;
}

// `$$…$$` or `$…$`, never across a blank line, with escaped dollars inside.
const INLINE_DISPLAY = /^\$\$((?:\\[\s\S]|(?!\n[ \t]*\n)[^\\$])+?)\$\$/;
const INLINE = /^\$((?:\\[\s\S]|(?!\n[ \t]*\n)[^\\$])+?)\$/;
// `$$` at the start of a line (up to three spaces), closed by `$$` at the end of one.
const BLOCK = /^ {0,3}\$\$((?:\\[\s\S]|(?!\n[ \t]*\n)[^\\$])+?)\$\$[ \t]*(?:\n|$)/;

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
      display: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
        getAttrs: (el) => ({
          latex: (el as HTMLElement).getAttribute("data-latex") ?? "",
          display: (el as HTMLElement).getAttribute("data-display") === "true",
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const { latex, display } = node.attrs as { latex: string; display: boolean };
    // The text is the TeX in MathJax's own delimiters, so HTML output (emails,
    // the static renderer) typesets wherever MathJax runs and reads sensibly
    // where it does not.
    return [
      "span",
      { "data-type": "inline-math", "data-latex": latex, "data-display": String(display) },
      display ? `\\[${latex}\\]` : `\\(${latex}\\)`,
    ];
  },

  markdownTokenizer: {
    name: "inlineMath",
    level: "inline",
    start: (src: string) => firstDollar(src),
    tokenize(src: string): MarkdownToken | undefined {
      const m = INLINE_DISPLAY.exec(src) ?? INLINE.exec(src);
      if (!m) return undefined;
      return { type: "inlineMath", raw: m[0], text: m[1], display: m[0].startsWith("$$") };
    },
  },

  parseMarkdown(token, helpers) {
    return helpers.createNode("inlineMath", { latex: (token.text ?? "").trim(), display: Boolean(token.display) });
  },

  renderMarkdown(node) {
    const latex = String(node.attrs?.latex ?? "");
    // Empty maths writes nothing: "$$" would read back as display maths.
    if (!latex.trim()) return "";
    return node.attrs?.display ? `$$${latex}$$` : `$${latex}$`;
  },
});

export const BlockMath = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { latex: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="block-math"]',
        getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }),
      },
    ];
  },

  renderHTML({ node }) {
    const latex = String(node.attrs.latex ?? "");
    return ["div", { "data-type": "block-math", "data-latex": latex }, `\\[${latex}\\]`];
  },

  markdownTokenizer: {
    name: "blockMath",
    level: "block",
    start: (src: string) => {
      const m = /^ {0,3}\$\$/m.exec(src);
      return m ? m.index : -1;
    },
    tokenize(src: string): MarkdownToken | undefined {
      const m = BLOCK.exec(src);
      if (!m) return undefined;
      return { type: "blockMath", raw: m[0], text: m[1] };
    },
  },

  parseMarkdown(token, helpers) {
    return helpers.createNode("blockMath", { latex: (token.text ?? "").trim() });
  },

  renderMarkdown(node) {
    const latex = String(node.attrs?.latex ?? "");
    return latex.trim() ? `$$\n${latex}\n$$` : "";
  },
});
