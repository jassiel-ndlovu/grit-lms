/**
 * Normalise LaTeX paren/bracket delimiters into the dollar forms that
 * actually survive markdown parsing.
 *
 * Why this exists
 * ---------------
 * MathJax is configured (see `app/components/math-provider.tsx`) to accept
 * `\(…\)` and `\[…\]` as well as `$…$` / `$$…$$`. But every piece of content
 * in the app is rendered through `LessonMarkdown`, and CommonMark treats a
 * backslash before ASCII punctuation as an *escape*: react-markdown consumes
 * `\(` and emits a bare `(`, so MathJax never sees a delimiter and the LaTeX
 * renders as literal text. Authors (and our own LLM import guide) have been
 * told the paren form works, and there is content in the database using it.
 *
 * So we rewrite the delimiters in the source string *before* markdown parses
 * it, handing MathJax the dollar form that is already known to work. We do
 * not touch `$…$` / `$$…$$` themselves.
 *
 * The `\[…\]` ambiguity
 * ---------------------
 * `\[` is genuinely overloaded. In LaTeX it opens display math; in markdown
 * it is the escape you write when you want a literal `[` that isn't a link.
 * Real content uses both — question prompts carry mark allocations like
 * `**Integration Techniques** &emsp; \[26\]`, which must stay `[26]`, while
 * lesson bodies carry `\[ \frac{a}{b} = \frac{c}{d} \]`, which must typeset.
 *
 * We split them on shape: a `\[…\]` whose body is a compact token — no
 * whitespace and no backslash inside — is left alone as a markdown escape.
 * Display maths is never written that tightly (you would reach for `\(` or
 * `$` for something that short), and mark allocations always are.
 *
 * `\(…\)` needs no such rule: `(` carries no meaning in markdown, so nobody
 * escapes it, and every occurrence in practice is maths.
 */

/**
 * Mark every offset we must leave untouched: fenced code blocks, inline code
 * spans, and existing `$…$` / `$$…$$` maths. A flat mask rather than a list
 * of ranges, so the scan below can test any offset in constant time.
 *
 * Indented (four-space) code blocks are not detected — telling one apart
 * from a wrapped list item needs a full block parse. Fenced code is the form
 * the editor produces, and MathJax skips `pre`/`code` at typeset time anyway.
 */
function protectedMask(src: string): Uint8Array {
  const mask = new Uint8Array(src.length);
  const mark = (start: number, end: number) => mask.fill(1, start, end);
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Fenced code block: ``` or ~~~ at the start of a line, closed by a
    // fence of the same character that is at least as long.
    if ((ch === "`" || ch === "~") && atLineStart(src, i)) {
      const fence = runLength(src, i, ch);
      if (fence >= 3) {
        const close = findClosingFence(src, i + fence, ch, fence);
        mark(i, close);
        i = close;
        continue;
      }
    }

    // Inline code span: a backtick run closed by a run of the same length.
    if (ch === "`") {
      const run = runLength(src, i, "`");
      const close = src.indexOf("`".repeat(run), i + run);
      if (close !== -1 && !hasBlankLine(src, i, close)) {
        mark(i, close + run);
        i = close + run;
        continue;
      }
    }

    // Existing maths — leave the dollar forms exactly as they are.
    if (ch === "$") {
      const run = Math.min(runLength(src, i, "$"), 2);
      const close = src.indexOf("$".repeat(run), i + run);
      if (close !== -1 && !hasBlankLine(src, i, close)) {
        mark(i, close + run);
        i = close + run;
        continue;
      }
    }

    i++;
  }

  return mask;
}

function atLineStart(src: string, i: number): boolean {
  // Allow up to three leading spaces, as CommonMark does for fences.
  let j = i;
  let spaces = 0;
  while (j > 0 && src[j - 1] === " " && spaces < 3) {
    j--;
    spaces++;
  }
  return j === 0 || src[j - 1] === "\n";
}

function runLength(src: string, i: number, ch: string): number {
  let n = 0;
  while (src[i + n] === ch) n++;
  return n;
}

function findClosingFence(
  src: string,
  from: number,
  ch: string,
  minLength: number,
): number {
  const re = new RegExp(`^ {0,3}\\${ch}{${minLength},}[ \\t]*$`, "m");
  const rest = src.slice(from);
  const m = re.exec(rest);
  // An unclosed fence runs to the end of the document, same as CommonMark.
  if (!m) return src.length;
  return from + m.index + m[0].length;
}

function hasBlankLine(src: string, start: number, end: number): boolean {
  return /\n[ \t]*\n/.test(src.slice(start, end));
}

/**
 * True when `\[…\]` should stay a markdown escape rather than become maths:
 * a compact body with no whitespace and no backslash, e.g. the `\[26\]` mark
 * allocation in a question heading.
 */
function isEscapedBracket(body: string): boolean {
  return !/[\s\\]/.test(body);
}

export function normalizeTexDelimiters(src: string): string {
  if (!src || (!src.includes("\\(") && !src.includes("\\["))) return src;

  const mask = protectedMask(src);
  const isProtected = (i: number) => mask[i] === 1;

  let out = "";
  let i = 0;

  while (i < src.length) {
    const two = src.slice(i, i + 2);
    const open = two === "\\(" ? "(" : two === "\\[" ? "[" : null;

    if (open === null || isProtected(i)) {
      out += src[i];
      i++;
      continue;
    }

    const closer = open === "(" ? "\\)" : "\\]";
    const bodyStart = i + 2;

    // Find the matching closer, skipping any that land inside code or an
    // existing dollar span. Maths never spans a paragraph break, so a blank
    // line means this was not a delimiter after all.
    let close = -1;
    for (
      let j = src.indexOf(closer, bodyStart);
      j !== -1;
      j = src.indexOf(closer, j + 2)
    ) {
      if (hasBlankLine(src, bodyStart, j)) break;
      if (!isProtected(j)) {
        close = j;
        break;
      }
    }

    if (close === -1) {
      // Unmatched — leave the escape exactly as the author wrote it.
      out += src[i];
      i++;
      continue;
    }

    const body = src.slice(bodyStart, close);

    // `\(\)` / `\[\]` is an empty pair, not maths — emitting `$$` for it
    // would leave a stray delimiter that swallows the rest of the document.
    if (body.length === 0 || (open === "[" && isEscapedBracket(body))) {
      out += src.slice(i, close + 2);
      i = close + 2;
      continue;
    }

    const dollar = open === "(" ? "$" : "$$";
    out += `${dollar}${body}${dollar}`;
    i = close + 2;
  }

  return out;
}
