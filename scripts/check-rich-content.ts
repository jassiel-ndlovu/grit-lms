/**
 * Rich content conversion checks: npx tsx scripts/check-rich-content.ts
 *
 * For each fixture: markdown -> JSON -> markdown -> JSON must give the same
 * JSON twice (the derived markdown is a faithful copy), and the maths nodes
 * must hold exactly the TeX MathJax renders today. Fixtures copy the shapes
 * found in the stored-maths audit (research/13-math-audit.md); no real rows.
 */
import type { JSONContent } from "@tiptap/core";

import { docToMarkdown, markdownToDoc } from "../src/lib/content/markdown";
import { MAX_DOC_BYTES, validateDoc } from "../src/lib/content/schema";
import { readStoredContent, toStoredContent, CONTENT_SCHEMA_VERSION } from "../src/lib/content/value";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok && detail !== undefined) console.log(`        ${JSON.stringify(detail, null, 2).replace(/\n/g, "\n        ")}`);
}

function collect(doc: JSONContent, type: string, out: JSONContent[] = []): JSONContent[] {
  if (doc.type === type) out.push(doc);
  for (const c of doc.content ?? []) collect(c, type, out);
  return out;
}
const latexOf = (doc: JSONContent, type: string) => collect(doc, type).map((n) => n.attrs?.latex);
const textOf = (doc: JSONContent): string =>
  doc.type === "text" ? (doc.text ?? "") : (doc.content ?? []).map(textOf).join(doc.type === "doc" ? "\n" : "");

interface Fixture {
  name: string;
  md: string;
  inline?: string[];
  block?: string[];
  text?: string[]; // substrings the plain text must contain
  notText?: string[];
  more?: (doc: JSONContent) => [string, boolean, unknown?][];
}

const FIXTURES: Fixture[] = [
  {
    name: "prose: headings, emphasis, lists, link",
    md: "## Unit 3\n\nSolve **each** of the following, *showing* working.\n\n1. First\n2. Second\n\n- a\n- b\n\nSee [the notes](https://example.test/notes).",
    text: ["Unit 3", "showing", "First", "the notes"],
  },
  {
    name: "underline survives as <u>",
    md: "Read the <u>whole</u> question.",
    more: (doc) => [["underline mark", collect(doc, "text").some((t) => t.marks?.some((m) => m.type === "underline")), doc]],
  },
  {
    name: "inline dollars, underscores and stars stay TeX",
    md: "Let $a_1 * b_2 = c_{n}$ and $x^2$ be given.",
    inline: ["a_1 * b_2 = c_{n}", "x^2"],
  },
  {
    name: "paren and bracket delimiters become maths",
    md: "Since \\(f(x) = x^2\\), we get \\[ \\frac{a}{b} = \\frac{c}{d} \\] as shown.",
    inline: ["f(x) = x^2", "\\frac{a}{b} = \\frac{c}{d}"],
  },
  {
    name: "mark allocation stays text",
    md: "**Integration Techniques** &emsp; \\[26\\]",
    inline: [],
    text: ["[26]", " "],
    notText: ["&emsp;"],
  },
  {
    name: "named references decode outside code only",
    md: "A&nbsp;B &ndash; C, AT&T, and `&emsp;` stays.",
    text: ["A B – C, AT&T"],
    more: (doc) => {
      const out = docToMarkdown(doc);
      return [
        ["code keeps the reference", collect(doc, "text").some((t) => t.text === "&emsp;" && t.marks?.some((m) => m.type === "code")), doc],
        ["export has no double-encoded reference", !/&amp;[a-z]+;/i.test(out), out],
      ];
    },
  },
  {
    name: "display block: bmatrix keeps row breaks",
    md: "The matrix is\n\n$$\n\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}\n$$\n\nwhich is invertible.",
    block: ["\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}"],
  },
  {
    name: "display block on one line: aligned",
    md: "$$\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}$$",
    block: ["\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}"],
  },
  {
    name: "cases with braces",
    md: "$$f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}$$",
    block: ["f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}"],
  },
  {
    name: "$$ mid-paragraph stays inline display",
    md: "Hence $$\\int_0^1 x\\,dx = \\tfrac12$$ follows.",
    inline: ["\\int_0^1 x\\,dx = \\tfrac12"],
    more: (doc) => [["display flag set", collect(doc, "inlineMath")[0]?.attrs?.display === true]],
  },
  {
    name: "literal dollar is text, not maths",
    md: "It costs \\$5 and \\$10 in total.",
    inline: [],
    text: ["$5", "$10"],
  },
  {
    name: "maths inside code is code",
    md: "Use `$x$` in code, and:\n\n```\nprice = $total$\n```",
    inline: [],
    text: ["$x$", "price = $total$"],
  },
  {
    name: "image width moves to an attribute",
    md: "![Graph of f [50%]](https://example.test/f.png)",
    more: (doc) => {
      const img = collect(doc, "image")[0];
      return [
        ["width 50%", img?.attrs?.width === "50%", img?.attrs],
        ["alt cleaned", img?.attrs?.alt === "Graph of f", img?.attrs],
        ["exported with width", docToMarkdown(doc).includes("![Graph of f [50%]](https://example.test/f.png)"), docToMarkdown(doc)],
      ];
    },
  },
  {
    name: "image mid-sentence becomes its own block",
    md: "See ![icon](https://example.test/i.png) here, with $x$.",
    inline: ["x"],
    text: ["See", "here, with"],
    more: (doc) => [["paragraph, image, paragraph", JSON.stringify(doc.content?.map((n) => n.type)) === '["paragraph","image","paragraph"]', doc]],
  },
  {
    name: "image between lines of one paragraph",
    md: "Line one\n![a](https://example.test/a.png)\nLine two",
    text: ["Line one", "Line two"],
    notText: ["\n"],
  },
  {
    name: "table with maths in a cell",
    md: "| x | f(x) |\n| --- | --- |\n| 1 | $x^2$ |\n| 2 | 4 |",
    inline: ["x^2"],
    more: (doc) => [["table node", collect(doc, "table").length === 1, doc]],
  },
];

for (const f of FIXTURES) {
  const doc1 = markdownToDoc(f.md);
  const md2 = docToMarkdown(doc1);
  const doc2 = markdownToDoc(md2);
  check(`${f.name}: round trip is stable`, JSON.stringify(doc1) === JSON.stringify(doc2), { md2, doc1, doc2 });
  if (f.inline) check(`${f.name}: inline maths`, JSON.stringify(latexOf(doc1, "inlineMath")) === JSON.stringify(f.inline), { got: latexOf(doc1, "inlineMath"), md2 });
  if (f.block) check(`${f.name}: block maths`, JSON.stringify(latexOf(doc1, "blockMath")) === JSON.stringify(f.block), { got: latexOf(doc1, "blockMath"), md2 });
  for (const t of f.text ?? []) check(`${f.name}: text has ${JSON.stringify(t)}`, textOf(doc1).includes(t), { text: textOf(doc1), doc1 });
  for (const t of f.notText ?? []) {
    const inText = collect(doc1, "text").some((n) => (n.text ?? "").includes(t));
    check(`${f.name}: no text node has ${JSON.stringify(t)}`, !inText, doc1);
  }
  for (const [n, ok, d] of f.more?.(doc1) ?? []) check(`${f.name}: ${n}`, ok, d);
}

// Stored value envelope.
const stored = toStoredContent(markdownToDoc("Hello $x$"));
check("stored value carries the schema version", stored.schemaVersion === CONTENT_SCHEMA_VERSION);
check("stored value reads back", readStoredContent(JSON.parse(JSON.stringify(stored)))?.doc.type === "doc");
check("garbage reads as null", readStoredContent({ nope: 1 }) === null && readStoredContent(null) === null && readStoredContent("x") === null);
check("newer schema reads as null", readStoredContent({ schemaVersion: CONTENT_SCHEMA_VERSION + 1, doc: { type: "doc" } }) === null);

// Schema validation: every fixture is valid; tampered documents are not.
for (const f of FIXTURES) check(`valid: ${f.name}`, validateDoc(markdownToDoc(f.md)) !== null);
const para = (content: JSONContent[]): JSONContent => ({ type: "doc", content: [{ type: "paragraph", content }] });
check("refuses an unknown node", validateDoc(para([{ type: "script", text: "x" }])) === null);
check("refuses an unknown mark", validateDoc(para([{ type: "text", text: "x", marks: [{ type: "onclick" }] }])) === null);
check("refuses a block inside a paragraph", validateDoc(para([{ type: "blockMath", attrs: { latex: "x" } }])) === null);
check("refuses a non-doc root", validateDoc({ type: "paragraph" }) === null && validateDoc(null) === null);
check("refuses an oversized doc", validateDoc(para([{ type: "text", text: "x".repeat(MAX_DOC_BYTES) }])) === null);
const cleaned = validateDoc(para([{ type: "inlineMath", attrs: { latex: "x", evil: "<img>" } }]));
check("drops unknown attributes", cleaned !== null && !JSON.stringify(cleaned).includes("evil"), cleaned);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
