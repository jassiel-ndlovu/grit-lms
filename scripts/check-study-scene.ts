/**
 * Checks the study assistant's scene (assistant-scene.css) in every theme:
 *
 *   npx tsx scripts/check-study-scene.ts
 *
 * Pure: reads the CSS, no network. The gradient is painted only with the
 * --as-* colours, so every point of it is a blend of them. Text on it, on
 * pills and on answers must reach 4.5:1 on every such blend (WCAG 2.2 AA),
 * light and dark. High contrast and forced colours have no gradient, and
 * nothing moves.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COLOR_THEMES, themeAttr } from "../src/lib/ui-themes";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

type Rgb = [number, number, number];
type Vars = Record<string, string>;

/** The custom properties of the first block with this selector. */
function block(css: string, selector: string): Vars {
  for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1].split(";").pop() ?? "").split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    return Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
  }
  throw new Error(`No block for ${selector}`);
}

const revamp = read("src/app/revamp-tokens.css");
const themes = read("src/app/themes.css");
const scene = read("src/features/courses/components/study/assistant-scene.css");

function tokens(theme: string, dark: boolean): Vars {
  const calm = { ...block(revamp, ':root[data-ui="revamp"]'), ...(dark ? block(revamp, '[data-ui="revamp"].dark') : {}) };
  const own = `:root[data-ui="revamp"][data-theme="${themeAttr(theme as never)}"]`;
  const base = theme === "CALM" ? calm : { ...calm, ...block(themes, own), ...(dark ? block(themes, `${own}.dark`) : {}) };
  return { ...base, ...block(scene, ".as-scene"), ...(dark ? block(scene, ".dark .as-scene") : {}) };
}

/** A hex, a var() or a two-colour srgb mix. */
function colour(v: string, vars: Vars): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const name = /^var\(--([\w-]+)\)$/.exec(v);
  if (name) return colour(vars[name[1]], vars);
  const mix = /^color-mix\(in srgb, (.+?) ([\d.]+)%, (.+)\)$/.exec(v);
  if (!mix) throw new Error(`Can't read colour ${v}`);
  return blend([colour(mix[1], vars), colour(mix[3], vars)], [Number(mix[2]) / 100, 1 - Number(mix[2]) / 100]);
}

const blend = (cs: Rgb[], w: number[]): Rgb => [0, 1, 2].map((k) => cs.reduce((s, c, i) => s + c[k] * w[i], 0)) as Rgb;

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((x) => (x / 255 <= 0.04045 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Every split of 1 into `n` parts, in steps of 1/`steps`. */
function* weights(n: number, steps: number, left = steps): Generator<number[]> {
  if (n === 1) yield [left / steps];
  else for (let i = 0; i <= left; i++) for (const rest of weights(n - 1, steps, left - i)) yield [i / steps, ...rest];
}

const GRADIENT = ["as-deep", "as-heart", "as-bloom"];
/** Calm is one plain tint; the rest are the gradient. */
const skyOf = (theme: string) => (theme === "CALM" ? ["as-tint"] : GRADIENT);
const lowest = (ink: Rgb, cs: Rgb[]) => Math.min(...[...weights(cs.length, 8)].map((w) => contrast(ink, blend(cs, w))));

for (const theme of COLOR_THEMES.filter((t) => t !== "CONTRAST")) {
  for (const dark of [false, true]) {
    const mode = `${theme.toLowerCase()} ${dark ? "dark" : "light"}`;
    const vars = tokens(theme, dark);
    const get = (n: string) => colour(vars[n], vars);
    const sky = lowest(get("as-ink"), [...skyOf(theme), "card"].map(get));
    pass(sky >= 4.5, `${mode}: text anywhere on the sky ≥ 4.5`, `lowest ${sky.toFixed(2)}`);
    // Table heads, code and quotes sit on --muted over the mist.
    const inset = lowest(get("as-ink"), [...skyOf(theme), "card", "muted"].map(get));
    pass(inset >= 4.5, `${mode}: text in an answer's tables and code ≥ 4.5`, `lowest ${inset.toFixed(2)}`);
    const card = Math.min(...["card-foreground", "muted-foreground", "destructive"].map((n) => contrast(get(n), get("card"))));
    pass(card >= 4.5, `${mode}: text on the question card ≥ 4.5`, `lowest ${card.toFixed(2)}`);
    const edge = contrast(get("input"), get("card"));
    pass(edge >= 3, `${mode}: the question card's outline ≥ 3`, edge.toFixed(2));
    // It has to differ from the app's other pages.
    const seen = contrast(get(theme === "CALM" ? "as-tint" : "as-heart"), get("background"));
    pass(seen >= 1.2, `${mode}: the gradient differs from a plain page`, seen.toFixed(2));
  }
}

// The gradient is only ever painted with the colours above.
const skyCss = [...bare(scene).matchAll(/(\.as-sky|\.as-sky-view)\s*\{([^{}]*)\}/g)].map((m) => m[2]).join("\n");
const used = new Set([...skyCss.matchAll(/var\(--(?!as-headers|as-top|as-gradient|shell|header)([\w-]+)/g)].map((m) => m[1]));
pass([...used].every((v) => v === "as-tint" || GRADIENT.includes(v)), "the sky uses only the checked colours", [...used].join(", "));
pass(!/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(/i.test(skyCss), "the sky has no colour of its own");

const plain = bare(scene);
pass(/\[data-theme="contrast"\] \.as-scene \.as-sky\s*\{\s*display: none/.test(plain), "high contrast: no gradient");
pass(/@media \(prefers-contrast: more\), \(forced-colors: active\) \{\s*\.as-scene \.as-sky\s*\{\s*display: none/.test(plain), "forced colours: no gradient");
pass(!/animation|transition|@keyframes|filter:/.test(plain), "nothing moves or is blurred");

const themed = /:is\(([^)]*)\)\s*\{\s*--as-gradient: 1;/.exec(plain)?.[1] ?? "";
pass(
  COLOR_THEMES.every((t) => themed.includes(`"${themeAttr(t)}"`) === (t !== "CALM" && t !== "CONTRAST")),
  "every theme but Calm and High contrast has the gradient",
  themed,
);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
