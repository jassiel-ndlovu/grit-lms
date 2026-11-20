/**
 * Finds maths in a student's typed answer (B design 01, phase 1), so the
 * grading and review screens can typeset it and leave everything else as
 * plain text. Student text is never parsed as markdown: an asterisk or a
 * "#" stays what the student typed.
 *
 * Maths is `$…$`, `$$…$$`, `\(…\)` or `\[…\]`. To keep prices and the
 * like as text, a `$…$` pair follows the usual (Pandoc) rule:
 *   - the opening `$` is followed by a non-space,
 *   - the closing `$` is preceded by a non-space and not followed by a digit,
 *   - and it's the next bare `$`: if that one can't close, the opener is text.
 * So "R5 or $5 and $10" stays text, while "$x^2 + 1$" is maths. `\$` is a
 * literal dollar.
 */

export type AnswerSegment = { kind: "text"; text: string } | { kind: "maths"; tex: string; display: boolean };

/** Longest maths span we'll typeset; longer ones stay as text. */
const MAX_TEX = 2000;

function closeDollar(s: string, from: number): number {
  for (let j = from; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "\n" && s[j + 1] === "\n") return -1; // never across a blank line
    if (c === "$") {
      // The first bare `$` decides: inline maths never holds another one,
      // so "$5 and $10" can't pair with a formula's closing `$` later on.
      if (/\s/.test(s[j - 1] ?? "") || /[0-9]/.test(s[j + 1] ?? "")) return -1;
      return j;
    }
  }
  return -1;
}

export function splitAnswerMaths(input: string): AnswerSegment[] {
  const out: AnswerSegment[] = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ kind: "text", text });
    text = "";
  };
  const pushMaths = (tex: string, display: boolean, raw: string) => {
    const body = tex.trim();
    if (!body || body.length > MAX_TEX) {
      text += raw;
      return;
    }
    pushText();
    out.push({ kind: "maths", tex: body, display });
  };

  let i = 0;
  while (i < input.length) {
    const c = input[i];
    const next = input[i + 1];

    if (c === "\\" && next === "$") {
      text += "$";
      i += 2;
      continue;
    }
    if (c === "\\" && (next === "(" || next === "[")) {
      const close = next === "(" ? "\\)" : "\\]";
      const end = input.indexOf(close, i + 2);
      if (end > i + 2) {
        pushMaths(input.slice(i + 2, end), next === "[", input.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }
    if (c === "$" && next === "$") {
      const end = input.indexOf("$$", i + 2);
      if (end > i + 2) {
        pushMaths(input.slice(i + 2, end), true, input.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }
    if (c === "$" && next !== undefined && !/\s/.test(next)) {
      const end = closeDollar(input, i + 1);
      if (end > i + 1) {
        pushMaths(input.slice(i + 1, end), false, input.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    text += c;
    i++;
  }
  pushText();
  return out;
}

export function hasAnswerMaths(input: string): boolean {
  return splitAnswerMaths(input).some((s) => s.kind === "maths");
}

/** The text to insert for a formula from the maths field: inline `$…$`. */
export function inlineMaths(tex: string): string {
  return `$${tex.trim()}$`;
}
