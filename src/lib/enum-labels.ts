/**
 * Hierarchical labels in the style of LaTeX `enumerate` / `enumitem`.
 *
 * Rather than naming every question (or lesson) by hand, the tutor picks one
 * label template per nesting level — exactly like `\begin{enumerate}[label=…]`
 * — and every item's label is derived from its position in the tree.
 *
 * A scheme is an array of templates, index 0 = top level. Supported tokens:
 *
 *   \arabic*   \alph*   \Alph*   \roman*   \Roman*      this level's counter
 *   \arabic{enumi}  \alph{enumii}  …                     an ancestor's counter
 *   \arabic{1}      \alph{2}       …                     same, by level number
 *
 * `enumi … enumiv` are the LaTeX counter names for levels 1–4; deeper levels
 * continue the pattern (enumv, enumvi, …) or can be addressed by number.
 * Anything else in the template is copied literally, so `(\alph*)`,
 * `Q\arabic*.` and `\arabic{enumi}.\arabic*` all work.
 *
 * Levels deeper than the scheme fall back to "<parent label>.\arabic*", and
 * an empty scheme means DEFAULT_LABEL_SCHEME — which reproduces the labels
 * the app has always shown (1, 1.a, 1.a.1) so existing tests look unchanged.
 */

export type LabelScheme = string[];

/** The historical labels: 1 → 1.a → 1.a.1 → 1.a.1.1 … */
export const DEFAULT_LABEL_SCHEME: LabelScheme = [
  "\\arabic*",
  "\\arabic{enumi}.\\alph*",
  "\\arabic{enumi}.\\alph{enumii}.\\arabic*",
];

export const LABEL_PRESETS: Array<{ id: string; name: string; scheme: LabelScheme }> = [
  { id: "default", name: "Default (1, 1.a, 1.a.1)", scheme: DEFAULT_LABEL_SCHEME },
  {
    id: "decimal",
    name: "Decimal (1, 1.1, 1.1.1)",
    scheme: [
      "\\arabic*",
      "\\arabic{enumi}.\\arabic*",
      "\\arabic{enumi}.\\arabic{enumii}.\\arabic*",
      "\\arabic{enumi}.\\arabic{enumii}.\\arabic{enumiii}.\\arabic*",
    ],
  },
  {
    id: "latex",
    name: "LaTeX enumerate (1., (a), i., A.)",
    scheme: ["\\arabic*.", "(\\alph*)", "\\roman*.", "\\Alph*."],
  },
  {
    id: "exam",
    name: "Exam paper (Question 1, 1.1, (a), (i))",
    scheme: ["Question \\arabic*", "\\arabic{enumi}.\\arabic*", "(\\alph*)", "(\\roman*)"],
  },
  {
    id: "roman",
    name: "Roman (I, I.A, I.A.1)",
    scheme: ["\\Roman*", "\\Roman{enumi}.\\Alph*", "\\Roman{enumi}.\\Alph{enumii}.\\arabic*"],
  },
];

/** Normalise whatever came out of the DB / a form into a usable scheme. */
export function normalizeScheme(raw: unknown): LabelScheme {
  if (!Array.isArray(raw)) return DEFAULT_LABEL_SCHEME;
  const clean = raw.filter((s): s is string => typeof s === "string").map((s) => s.trim());
  // Trailing blanks mean "fall back" for those levels; drop them so they
  // don't masquerade as an explicit empty label.
  while (clean.length > 0 && clean[clean.length - 1] === "") clean.pop();
  return clean.length > 0 ? clean : DEFAULT_LABEL_SCHEME;
}

/** True when a scheme is the same as the default (so it needn't be stored). */
export function isDefaultScheme(scheme: LabelScheme): boolean {
  const n = normalizeScheme(scheme);
  return (
    n.length === DEFAULT_LABEL_SCHEME.length &&
    n.every((s, i) => s === DEFAULT_LABEL_SCHEME[i])
  );
}

/* ─── Counter styles ─────────────────────────────────────────────────────── */

function alph(n: number): string {
  // 1 → a, 26 → z, 27 → aa (spreadsheet-style, so it never runs out).
  let s = "";
  let x = n;
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(97 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s || "0";
}

function roman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const table: Array<[number, string]> = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  let x = n;
  for (const [v, sym] of table) {
    while (x >= v) {
      out += sym;
      x -= v;
    }
  }
  return out;
}

function styled(style: string, n: number): string {
  switch (style) {
    case "arabic":
      return String(n);
    case "alph":
      return alph(n);
    case "Alph":
      return alph(n).toUpperCase();
    case "roman":
      return roman(n);
    case "Roman":
      return roman(n).toUpperCase();
    default:
      return String(n);
  }
}

/** enumi → 1, enumii → 2, … ; "3" → 3. Returns null when unrecognised. */
function levelOfCounter(name: string): number | null {
  if (/^\d+$/.test(name)) return Number(name);
  const m = name.match(/^enum([ivxlcdm]+)$/);
  if (!m) return null;
  const r = m[1];
  for (let i = 1; i < 40; i++) if (roman(i) === r) return i;
  return null;
}

const TOKEN = /\\(arabic|alph|Alph|roman|Roman)(\*|\{([^}]*)\})/g;

/**
 * Label for an item at `path`, where `path[i]` is the 0-based position of
 * the item (or its ancestor) among its siblings at depth `i`.
 */
export function formatLabel(scheme: LabelScheme, path: number[]): string {
  const s = normalizeScheme(scheme);
  const depth = path.length - 1;
  const template = s[depth];
  if (template === undefined || template === "") {
    if (depth === 0) return String(path[0] + 1);
    return `${formatLabel(s, path.slice(0, -1))}.${path[depth] + 1}`;
  }
  return template.replace(TOKEN, (_m, style: string, star: string, ref?: string) => {
    if (star === "*") return styled(style, path[depth] + 1);
    const level = levelOfCounter((ref ?? "").trim());
    if (level == null || level < 1 || level > path.length) return "";
    return styled(style, path[level - 1] + 1);
  });
}

/* ─── Tree helpers ───────────────────────────────────────────────────────── */

/**
 * Walk any tree and return id → label. `children` reads an item's
 * sub-items and `id` its key — so the same helper labels questions,
 * runner questions, grading rows and lessons.
 */
export function labelTree<T>(
  roots: T[],
  scheme: LabelScheme,
  id: (item: T) => string,
  children: (item: T) => T[],
): Map<string, string> {
  const out = new Map<string, string>();
  function visit(list: T[], prefix: number[]) {
    list.forEach((item, i) => {
      const path = [...prefix, i];
      out.set(id(item), formatLabel(scheme, path));
      visit(children(item), path);
    });
  }
  visit(roots, []);
  return out;
}

/** Validate a template; returns an error message or null. */
export function templateError(template: string): string | null {
  if (template.trim() === "") return null;
  const tokens = [...template.matchAll(TOKEN)];
  if (tokens.length === 0) {
    return "Needs a counter such as \\arabic* or \\alph*.";
  }
  for (const t of tokens) {
    if (t[2] !== "*" && levelOfCounter((t[3] ?? "").trim()) == null) {
      return `Unknown counter "${t[3]}". Use enumi, enumii, … or a level number.`;
    }
  }
  return null;
}
