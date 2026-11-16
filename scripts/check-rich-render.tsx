/**
 * Rich content rendering checks: npx tsx scripts/check-rich-render.tsx
 *
 * Renders documents with renderRichContent to static HTML (no browser) and
 * checks the maths markup MathJax needs, image and table handling, and that
 * hostile input comes out inert.
 */
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { renderRichContent } from "../src/components/content/render";
import { markdownToDoc } from "../src/lib/content/markdown";
import { validateDoc } from "../src/lib/content/schema";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok && detail !== undefined) console.log(`        ${String(detail)}`);
}
const html = (doc: JSONContent | null) => (doc ? renderToStaticMarkup(React.createElement(React.Fragment, null, renderRichContent(doc))) : "");
const fromMd = (md: string) => html(validateDoc(markdownToDoc(md)));
const para = (content: JSONContent[]): JSONContent => ({ type: "doc", content: [{ type: "paragraph", content }] });

// Maths: TeX reaches the page inside MathJax's delimiters, escaped as HTML.
const inline = fromMd("Let $a < b_1$ hold.");
check("inline maths in \\( \\)", inline.includes('data-type="inline-math"') && inline.includes("\\(a &lt; b_1\\)"), inline);
const display = fromMd("$$\n\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}\n$$");
check("block maths in \\[ \\] with row breaks", display.includes('data-type="block-math"') && display.includes("\\[\\begin{bmatrix} 1 &amp; 2 \\\\ 3 &amp; 4 \\end{bmatrix}\\]"), display);
const mid = fromMd("Hence $$x = 1$$ follows.");
check("mid-line $$ renders as display", mid.includes("\\[x = 1\\]"), mid);

// Prose and structure.
const prose = fromMd("## Unit 3\n\n**Bold** and *italic*, with `code`.\n\n- one\n- two");
check("heading, marks, code, list", ["<h2>Unit 3</h2>", "<strong>Bold</strong>", "<em>italic</em>", "<code>code</code>", "<li>"].every((s) => prose.includes(s)), prose);
const table = fromMd("| x | f(x) |\n| --- | --- |\n| 1 | $x^2$ |");
check("table wrapped to scroll", table.startsWith('<div class="my-4 overflow-x-auto"><table>') && table.includes("\\(x^2\\)"), table);

// Images.
const img = fromMd("![Graph of f [50%]](https://example.test/f.png)");
check("image width as max-width", img.includes('style="max-width:50%;height:auto"') && img.includes('alt="Graph of f"') && img.includes('loading="lazy"'), img);
check("data: image dropped", !html(validateDoc({ type: "doc", content: [{ type: "image", attrs: { src: "data:image/png;base64,AAAA" } }] })).includes("<img"));
check("protocol-relative image dropped", !html(validateDoc({ type: "doc", content: [{ type: "image", attrs: { src: "//evil.test/x.png" } }] })).includes("<img"));
check("same-site image kept", html(validateDoc({ type: "doc", content: [{ type: "image", attrs: { src: "/api/blob/x.png" } }] })).includes('src="/api/blob/x.png"'));

// Hostile input.
const js = html(validateDoc(para([{ type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }])));
check("javascript: link has no javascript href", !/href="javascript:/i.test(js), js);
const link = html(validateDoc(para([{ type: "text", text: "notes", marks: [{ type: "link", attrs: { href: "https://example.test" } }] }])));
check("https link kept, opens safely", link.includes('href="https://example.test"') && link.includes("noopener"), link);
const script = html(validateDoc(para([{ type: "text", text: "<script>alert(1)</script>" }])));
check("text is escaped", !script.includes("<script>") && script.includes("&lt;script&gt;"), script);
const texScript = html(validateDoc(para([{ type: "inlineMath", attrs: { latex: "</span><script>alert(1)</script>" } }])));
check("TeX is escaped", !texScript.includes("<script>"), texScript);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
