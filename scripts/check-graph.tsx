/**
 * Graph checks (src/lib/content/expr.ts, graph-spec.ts, graph.ts):
 *   npx tsx scripts/check-graph.tsx
 */
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { renderRichContent } from "../src/components/content/render";
import { compileExpression } from "../src/lib/content/expr";
import { DEFAULT_GRAPH, graphProblems, graphSummary, parseGraphSpec } from "../src/lib/content/graph-spec";
import { docToMarkdown } from "../src/lib/content/markdown";
import { validateDoc } from "../src/lib/content/schema";
import { readStoredContent } from "../src/lib/content/value";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}
const at = (src: string, x: number) => {
  const c = compileExpression(src);
  return "fn" in c ? Math.round(c.fn(x) * 1e6) / 1e6 : c.error;
};

// Formulas.
check("polynomial with implicit x", at("2x^2 - 3x + 1", 2), 3);
check("y = prefix", at("y = 3x", 2), 6);
check("f(x) = prefix", at("f(x)=x+1", 1), 2);
check("power is right-associative", at("2^3^2", 0), 512);
check("unary minus binds after power", at("-x^2", 3), -9);
check("brackets and implicit product", at("3(x+1)(x-1)", 2), 9);
check("functions and constants", [at("sin(pi/2)", 0), at("sqrt(x)", 9), at("ln(e)", 0), at("log(1000)", 0)], [1, 3, 1, 3]);
check("absolute value bars", at("|x - 5|", 2), 3);
check("decimal comma", at("0,5x", 4), 2);
check("** and unicode", [at("x**2", 3), at("2×x − 1", 3), at("π", 0)], [9, 5, 3.141593]);
check("names run together", at("2xsin(x)", 0), 0);
check(
  "errors in words",
  [at("", 0), at("x +", 0), at("(x", 0), at("sin x", 0), at("foo(x)", 0), at("x # 2", 0), at("alert(1)", 0)],
  [
    "Enter a formula, for example 2x + 1.",
    "The formula ends too early.",
    "A bracket isn't closed.",
    "Put brackets after sin, for example sin(x).",
    'Unknown name "foo". Use x, pi, e and functions like sin, sqrt or ln.',
    '"#" can\'t be used in a formula.',
    'Unknown name "alert". Use x, pi, e and functions like sin, sqrt or ln.',
  ],
);
check("no code runs: constructor", at("constructor", 0), 'Unknown name "constructor". Use x, pi, e and functions like sin, sqrt or ln.');

// Specs.
const good = {
  v: 1,
  description: "  Parabola  ",
  x: [-4, 4],
  y: [-2, 10],
  items: [
    { kind: "function", expr: "x^2", color: "blue", label: "f", extra: "dropped" },
    { kind: "point", x: 0, y: 0, label: "O" },
    { kind: "segment", from: [0, 0], to: [2, 4] },
  ],
};
check("parse cleans and fills", parseGraphSpec(good), {
  v: 1,
  description: "Parabola",
  x: [-4, 4],
  y: [-2, 10],
  grid: true,
  items: [
    { kind: "function", expr: "x^2", label: "f", color: "blue" },
    { kind: "point", x: 0, y: 0, label: "O", color: "red" },
    { kind: "segment", from: [0, 0], to: [2, 4], color: "green" },
  ],
});
check(
  "parse refuses",
  [
    parseGraphSpec({ ...good, v: 2 }),
    parseGraphSpec({ ...good, x: [4, -4] }),
    parseGraphSpec({ ...good, x: [0, 1e9] }),
    parseGraphSpec({ ...good, items: [{ kind: "function", expr: "x +" }] }),
    parseGraphSpec({ ...good, items: [{ kind: "script", src: "x" }] }),
    parseGraphSpec({ ...good, items: Array(13).fill({ kind: "point", x: 0, y: 0 }) }),
    parseGraphSpec("x^2"),
  ],
  [null, null, null, null, null, null, null],
);
check("summary from items", graphSummary({ ...parseGraphSpec(good)!, description: "" }), "f y = x^2; point O (0, 0); segment from (0, 0) to (2, 4)");
check("problems per item", graphProblems({ ...DEFAULT_GRAPH, x: [1, 1], items: [{ kind: "function", expr: "x+", color: "blue" }, { kind: "point", x: NaN, y: 0, color: "red" }] }), {
  range: "Each range needs a smaller first number.",
  items: ["The formula ends too early.", "Enter numbers for each coordinate."],
});

// In a document.
const doc = (spec: unknown): JSONContent => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "See:" }] }, { type: "graph", attrs: { spec } }] });
const valid = validateDoc(doc(good));
check("validateDoc keeps a graph, cleaned", valid?.content?.[1]?.attrs?.spec?.description, "Parabola");
check("validateDoc refuses a bad graph", validateDoc(doc({ ...good, items: [{ kind: "function", expr: "eval(x)" }] })), null);
check("markdown copy", docToMarkdown(valid!), "See:\n\n[Graph: Parabola]");
const html = renderToStaticMarkup(React.createElement(React.Fragment, null, renderRichContent(valid!)));
check("rendered as a figure with its description", [html.includes('data-type="graph"'), html.includes('aria-label="Graph: Parabola"'), html.includes("y = <!-- -->x^2") || html.includes("y = x^2")], [true, true, true]);
check("version 1 documents still read", readStoredContent({ schemaVersion: 1, doc: { type: "doc", content: [] } })?.schemaVersion, 1);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
