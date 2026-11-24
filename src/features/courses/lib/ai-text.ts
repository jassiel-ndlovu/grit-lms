/**
 * Text from the AI, made fit for where it's shown (contracts/viewer.md).
 * Pure. The AI writes maths as TeX and breaks paragraphs with one newline;
 * titles and notes can't typeset, and markdown joins such lines up.
 */

const SYMBOLS: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", infty: "∞",
  degree: "°", circ: "°", rightarrow: "→", to: "→", Rightarrow: "⇒", implies: "⇒", leftarrow: "←", angle: "∠", triangle: "△", perp: "⊥", parallel: "∥",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ",
  sum: "Σ", phi: "φ", omega: "ω", Omega: "Ω", in: "∈", notin: "∉", cup: "∪", cap: "∩", subset: "⊂", ldots: "…", dots: "…", cdots: "…", quad: " ", qquad: " ",
};
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", "°": "°" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", n: "ₙ" };

const script = (map: Record<string, string>, mark: string) => (_: string, braced: string | undefined, one: string | undefined) => {
  const body = (braced ?? one ?? "").trim();
  if (body && [...body].every((c) => map[c])) return [...body].map((c) => map[c]).join("");
  return body.length > 1 ? `${mark}(${body})` : `${mark}${body}`;
};
const part = (s: string) => (/^[\p{L}\p{N}.]+$/u.test(s.trim()) ? s.trim() : `(${s.trim()})`);

function plainTex(tex: string): string {
  let s = tex.replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, "$1").replace(/\\(?:left|right|displaystyle)(?![A-Za-z])/g, "");
  // Symbols first, so `^\circ` has a plain character to lift. Words like \sin keep their name.
  s = s.replace(/\\([A-Za-z]+)/g, (all, name: string) => (["frac", "dfrac", "tfrac", "sqrt"].includes(name) ? all : (SYMBOLS[name] ?? name)));
  // Innermost first, so a power inside a fraction is done before the fraction.
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(/\^(?:\{([^{}]*)\}|([^\s{}]))/g, script(SUP, "^")).replace(/_(?:\{([^{}]*)\}|([^\s{}]))/g, script(SUB, "_"));
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => `${part(a)}/${part(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a: string) => `√${part(a)}`);
    if (s === before) break;
  }
  return s.replace(/\\[,;:! ]/g, " ").replace(/\\([%$#&_{}])/g, "$1").replace(/\\\\/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

/** TeX maths in a line of text as plain characters: "Expand \((x+1)^2\)" reads "Expand (x+1)²". */
export function plainMaths(text: string): string {
  return text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => plainTex(body))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => plainTex(body))
    .replace(/(?<!\\)\$\$([\s\S]+?)\$\$/g, (_, body: string) => plainTex(body))
    // A price isn't maths: the body must hug its dollars and not be a number alone.
    .replace(/(?<![\\\w])\$(?!\s)([^$\n]+?)(?<![\s\\])\$(?![\w])/g, (all, body: string) => (/^[\d.,]+$/.test(body) ? all : plainTex(body)));
}

/**
 * Text to edit in a plain box but shown typeset: maths a person can read as
 * typed becomes plain ("x² + 7x"), the rest keeps `$…$`, as the marking
 * screen's own hint says to write it.
 */
export function editableMaths(text: string): string {
  const one = (body: string) => {
    const plain = plainTex(body);
    // Anything that needs layout, or that lost its structure, stays as maths.
    return /\\(?:[dt]?frac|sqrt|sum|int|lim|begin|overline|vec)|\\\\/.test(body) || /[\^_]/.test(plain) ? `$${body.trim()}$` : plain;
  };
  return text.replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => one(body)).replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => (body.includes("\n") ? `$$${body}$$` : one(body)));
}

const LIST = /^\s*(?:[-*+]|\d+[.)])\s+/;
const QUOTE = /^\s*>/;
const ROW = /^\s*\|/;

/** Markdown from the AI with every line it ended as its own paragraph, as it meant. */
export function draftMarkdown(text: string): string {
  const out: string[] = [];
  let fence = false;
  let maths: string | null = null;
  let inList = false;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const prev = out[out.length - 1];
    const open = fence || maths !== null;
    const item = LIST.test(line);
    if (!open && prev !== undefined && prev.trim() && line.trim()) {
      const together =
        (item && inList) ||
        (inList && /^(?: {2,}|\t)/.test(line)) ||
        (QUOTE.test(prev) && QUOTE.test(line)) ||
        (ROW.test(prev) && ROW.test(line)) ||
        /(?: {2}|\\)$/.test(prev) ||
        // A line wrapped in the middle of a sentence.
        (!item && /^\s*\p{Ll}/u.test(line) && !/[.!?:]\s*$/.test(prev));
      if (!together) out.push("");
    }
    out.push(line);
    if (!open && line.trim()) inList = item || (inList && /^(?: {2,}|\t)/.test(line));
    if (maths === null && /^\s*(?:```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    if (maths !== null) {
      if (line.includes(maths)) maths = null;
    } else if (/^\s*\$\$/.test(line) && !/\$\$.*\$\$/.test(line)) maths = "$$";
    else if (/^\s*\\\[/.test(line) && !line.includes("\\]")) maths = "\\]";
  }
  return out.join("\n").trim();
}

/** `$…$` maths as `\(…\)`, the way the AI is asked to write it, so it doesn't report that as a change. */
export function texParens(markdown: string): string {
  return markdown
    .split(/(`[^`\n]*`)/)
    .map((s, i) =>
      i % 2
        ? s
        : s
            .replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (_, body: string) => (body.includes("\n") ? `\\[${body}\\]` : `\\[ ${body.trim()} \\]`))
            .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, body: string) => `\\(${body}\\)`),
    )
    .join("");
}
