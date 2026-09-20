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

/* ─── Inline \(…\) ─────────────────────────────────────────────────────── */

check("inline paren becomes single dollar", n("Paren: \\(a^2 + b^2 = c^2\\)"), "Paren: $a^2 + b^2 = c^2$");
check("several inline spans on one line", n("\\(a\\), \\(b\\), and \\(c\\)"), "$a$, $b$, and $c$");
check("inline with no spaces around body", n("cm\\(^2\\)."), "cm$^2$.");
check("body is preserved verbatim", n("\\( \\frac{a}{b} \\)"), "$ \\frac{a}{b} $");
check("unmatched opener is left alone", n("a \\( b"), "a \\( b");
check("unmatched closer is left alone", n("a \\) b"), "a \\) b");
check("inline does not span a blank line", n("\\(a\n\nb\\)"), "\\(a\n\nb\\)");
check("inline may span one newline", n("\\(a\nb\\)"), "$a\nb$");

/* ─── Display \[…\] ────────────────────────────────────────────────────── */

check("display bracket becomes double dollar", n("\\[ x = 15 \\]"), "$$ x = 15 $$");
check("two display blocks in a row", n("\\[ 60 = 4x \\]\n\\[ x = 15 \\]"), "$$ 60 = 4x $$\n$$ x = 15 $$");
check("display with a newline inside", n("\\[\n  y = kx\n\\]"), "$$\n  y = kx\n$$");
check("display does not span a blank line", n("\\[a\n\nb\\]"), "\\[a\n\nb\\]");

/* ─── The \[26\] mark-allocation escape stays an escape ────────────────── */

check("compact numeric bracket is not maths", n("**Integration Techniques** &emsp; \\[26\\]"), "**Integration Techniques** &emsp; \\[26\\]");
check("compact word bracket is not maths", n("see \\[note\\]"), "see \\[note\\]");
check("whitespace inside means maths", n("\\[ 26 \\]"), "$$ 26 $$");
check("a backslash inside means maths", n("\\[\\pi\\]"), "$$\\pi$$");
check("empty bracket escape is left alone", n("\\[\\]"), "\\[\\]");
check("empty paren escape is left alone", n("\\(\\)"), "\\(\\)");
check("allocation and maths in one string", n("Q1 &emsp; \\[30\\]\n\n\\[ x = 1 \\]"), "Q1 &emsp; \\[30\\]\n\n$$ x = 1 $$");

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

/* ─── Existing dollar maths is never disturbed ─────────────────────────── */

check("single dollar span is untouched", n("$x^2$ and \\(y\\)"), "$x^2$ and $y$");
check("double dollar span is untouched", n("$$\\int_0^1 x\\,dx$$"), "$$\\int_0^1 x\\,dx$$");
check("paren delimiters inside a dollar span are left alone", n("$a \\( b$"), "$a \\( b$");
check("no delimiters means the string is returned as-is", n("plain **markdown** only"), "plain **markdown** only");
check("empty string", n(""), "");

/* ─── Other markdown escapes must survive ──────────────────────────────── */

check("escaped asterisk untouched", n("\\*not italic\\* and \\(x\\)"), "\\*not italic\\* and $x$");
check("markdown link is not mistaken for an escape", n("[label](https://example.com) \\(x\\)"), "[label](https://example.com) $x$");
check("image alt width hint survives", n("![pic [50%]](/a.png) \\(x\\)"), "![pic [50%]](/a.png) $x$");

/* ─── Real strings pulled from the database ────────────────────────────── */

check(
  "Lesson: ratio forms",
  n("- Colon form: \\( a : b \\)\n- Fraction form: \\( \\frac{a}{b} \\)"),
  "- Colon form: $ a : b $\n- Fraction form: $ \\frac{a}{b} $",
);
check(
  "Lesson: display ratio with parens in \\text{}",
  n("\\[ \\text{Ratio (boys : girls)} = 15 : 10 \\]"),
  "$$ \\text{Ratio (boys : girls)} = 15 : 10 $$",
);
check(
  "Lesson: conversions, inline exponent",
  n("6. Convert $3.5\\text{ m}^2$ to cm\\(^2\\)."),
  "6. Convert $3.5\\text{ m}^2$ to cm$^2$.",
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
