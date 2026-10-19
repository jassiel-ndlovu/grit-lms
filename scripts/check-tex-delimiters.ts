import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { normalizeTexDelimiters as n } from "../src/lib/tex-delimiters";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${g}`);
    console.log(`        want: ${w}`);
  }
}

/**
 * The text MathJax will scan: normalise, render through the same markdown
 * pipeline LessonMarkdown uses, then drop the tags. `n()` escapes every
 * punctuation character in a maths body, so assertions about maths read
 * better against this than against the normalised source.
 */
function seen(src: string): string {
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, n(src)),
  );
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/* ─── Inline \(…\) ─────────────────────────────────────────────────────── */

check("inline paren becomes single dollar", seen("Paren: \\(a^2 + b^2 = c^2\\)"), "Paren: $a^2 + b^2 = c^2$");
check("several inline spans on one line", n("\\(a\\), \\(b\\), and \\(c\\)"), "$a$, $b$, and $c$");
check("inline with no spaces around body", seen("cm\\(^2\\)."), "cm$^2$.");
check("body is preserved verbatim", seen("\\( \\frac{a}{b} \\)"), "$ \\frac{a}{b} $");
check("unmatched opener is left alone", n("a \\( b"), "a \\( b");
check("unmatched closer is left alone", n("a \\) b"), "a \\) b");
check("inline does not span a blank line", n("\\(a\n\nb\\)"), "\\(a\n\nb\\)");
check("inline may span one newline", n("\\(a\nb\\)"), "$a\nb$");

/* ─── Display \[…\] ────────────────────────────────────────────────────── */

check("display bracket becomes double dollar", seen("\\[ x = 15 \\]"), "$$ x = 15 $$");
check("two display blocks in a row", seen("\\[ 60 = 4x \\]\n\\[ x = 15 \\]"), "$$ 60 = 4x $$\n$$ x = 15 $$");
check("display with a newline inside", seen("\\[\n  y = kx\n\\]"), "$$\ny = kx\n$$");
check("display does not span a blank line", n("\\[a\n\nb\\]"), "\\[a\n\nb\\]");

/* ─── The \[26\] mark-allocation escape stays an escape ────────────────── */

check("compact numeric bracket is not maths", n("**Integration Techniques** &emsp; \\[26\\]"), "**Integration Techniques** &emsp; \\[26\\]");
check("compact numeric bracket renders as [26]", seen("**Integration Techniques** &emsp; \\[26\\]"), "Integration Techniques \u2003 [26]");
check("compact word bracket is not maths", n("see \\[note\\]"), "see \\[note\\]");
check("whitespace inside means maths", n("\\[ 26 \\]"), "$$ 26 $$");
check("a backslash inside means maths", seen("\\[\\pi\\]"), "$$\\pi$$");
check("empty bracket escape is left alone", n("\\[\\]"), "\\[\\]");
check("empty paren escape is left alone", n("\\(\\)"), "\\(\\)");
check("allocation and maths in one string", seen("Q1 &emsp; \\[30\\]\n\n\\[ x = 1 \\]"), "Q1 \u2003 [30]\n$$ x = 1 $$");

/* ─── Protected regions ────────────────────────────────────────────────── */

check("inline code is untouched", n("use `\\(x\\)` for maths"), "use `\\(x\\)` for maths");
check("double-backtick code span is untouched", n("``a \\(x\\) b``"), "``a \\(x\\) b``");
check("fenced block is untouched", n("```\n\\(x\\)\n```"), "```\n\\(x\\)\n```");
check("fenced block with a language is untouched", n("```tex\n\\[x\\]\n```"), "```tex\n\\[x\\]\n```");
check("tilde fence is untouched", n("~~~\n\\(x\\)\n~~~"), "~~~\n\\(x\\)\n~~~");
check("indented fence is untouched", n("   ```\n   \\(x\\)\n   ```"), "   ```\n   \\(x\\)\n   ```");
check("unclosed fence swallows the rest", n("```\n\\(x\\)"), "```\n\\(x\\)");
check("text after a closed fence is converted", n("```\n\\(a\\)\n```\n\\(b\\)"), "```\n\\(a\\)\n```\n$b$");
check("a lone backtick does not protect", n("50% ` off \\(x\\)"), "50% ` off $x$");
check("dollars inside code are untouched", n("`$a_1 \\\\ b$`"), "`$a_1 \\\\ b$`");

/* ─── Existing dollar maths keeps its delimiters ───────────────────────── */

check("single dollar span reaches MathJax as written", seen("$x^2$ and \\(y\\)"), "$x^2$ and $y$");
check("double dollar span reaches MathJax as written", seen("$$\\int_0^1 x\\,dx$$"), "$$\\int_0^1 x\\,dx$$");
check("paren delimiters inside a dollar span are left alone", seen("$a \\( b$"), "$a \\( b$");
check("no delimiters means the string is returned as-is", n("plain **markdown** only"), "plain **markdown** only");
check("empty string", n(""), "");

/* ─── Maths bodies survive markdown verbatim ───────────────────────────── */

check(
  "matrix keeps its \\\\ row break",
  seen("$$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$"),
  "$$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$",
);
check(
  "multi-line aligned block keeps every row break",
  seen("$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$"),
  "$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$",
);
check(
  "cases inside \\[…\\] keeps its row break and braces",
  seen("\\[ f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases} \\]"),
  "$$ f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases} $$",
);
check("inline matrix keeps its row break", seen("Let $A = \\begin{pmatrix} a \\\\ b \\end{pmatrix}$."), "Let $A = \\begin{pmatrix} a \\\\ b \\end{pmatrix}$.");
check("escaped braces keep their backslash", seen("$\\{1, 2\\}$"), "$\\{1, 2\\}$");
check("underscores are not emphasis", seen("$a_1 + b_1$ and $c_1$"), "$a_1 + b_1$ and $c_1$");
check("asterisks are not emphasis", seen("$a*b*c$"), "$a*b*c$");
check("brackets are not a link", seen("$[a](b)$"), "$[a](b)$");
check("angle brackets are not html", seen("$a<b>c$"), "$a<b>c$");
check("entity-looking text is left alone", seen("$a &amp; b$"), "$a &amp; b$");
check("line-start dash inside display maths is not a list", seen("$$\na\n- b\n$$"), "$$\na\n- b\n$$");
check("pipe inside maths in a table cell", seen("| a |\n| - |\n| $|x| + 1$ |"), "a$|x| + 1$");
check("markdown around maths still works", seen("**bold** $x_1$ *em*"), "bold $x_1$ em");

/* ─── Escaped dollars ──────────────────────────────────────────────────── */

check("escaped dollars in prose reach MathJax escaped", seen("costs \\$5 or \\$6"), "costs \\$5 or \\$6");
check("an escaped dollar does not close maths", seen("$\\$5 + x$"), "$\\$5 + x$");
check("an escaped backslash before a dollar still opens maths", seen("\\\\$x$"), "\\$x$");

/* ─── Other markdown escapes must survive ──────────────────────────────── */

check("escaped asterisk untouched", n("\\*not italic\\* and \\(x\\)"), "\\*not italic\\* and $x$");
check("markdown link is not mistaken for an escape", n("[label](https://example.com) \\(x\\)"), "[label](https://example.com) $x$");
check("image alt width hint survives", n("![pic [50%]](/a.png) \\(x\\)"), "![pic [50%]](/a.png) $x$");

/* ─── Real strings pulled from the database ────────────────────────────── */

check(
  "Lesson: ratio forms",
  seen("- Colon form: \\( a : b \\)\n- Fraction form: \\( \\frac{a}{b} \\)"),
  "\nColon form: $ a : b $\nFraction form: $ \\frac{a}{b} $\n",
);
check(
  "Lesson: display ratio with parens in \\text{}",
  seen("\\[ \\text{Ratio (boys : girls)} = 15 : 10 \\]"),
  "$$ \\text{Ratio (boys : girls)} = 15 : 10 $$",
);
check(
  "Lesson: conversions, inline exponent",
  seen("6. Convert $3.5\\text{ m}^2$ to cm\\(^2\\)."),
  "\nConvert $3.5\\text{ m}^2$ to cm$^2$.\n",
);
check(
  "TestQuestion: asymptotes",
  n("Determine the equations of all asymptotes of \\(f\\)."),
  "Determine the equations of all asymptotes of $f$.",
);
check(
  "TestQuestion: mark allocation heading",
  n("## QUESTION 1 **Algebra and Complex Numbers** &emsp; \\[30\\]"),
  "## QUESTION 1 **Algebra and Complex Numbers** &emsp; \\[30\\]",
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
