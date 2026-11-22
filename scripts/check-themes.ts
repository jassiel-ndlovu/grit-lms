/**
 * Checks the colour themes (#206, 22 Nov), the nav icons, the signature
 * strip and the page-frame layout file (#205).
 *
 *   npx tsx scripts/check-themes.ts
 *
 * Pure: reads the CSS and the shell sources, no network. For every theme
 * (CALM, BRIGHT, OCEAN, SUNSET, CONTRAST), light and dark, every text
 * colour must reach 4.5:1 on the surfaces it sits on, and control outlines,
 * focus rings and nav icon outlines 3:1 on the sidebar and its active row
 * (WCAG 2.2 AA). The Inkwell look (the legacy shell without REVAMP_UI) gets
 * the nav icon checks too. Each theme defines its strip colours. The
 * layout file must hold the approved widths, paddings and gaps. Exits 1 on
 * any failure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { UI_THEMES } from "../src/lib/viewer-core";
import { COLOR_THEMES, themeAttr } from "../src/lib/ui-themes";
import { DEFAULT_WIDTH, FRAME_WIDTHS, PAGE_TYPES } from "../src/lib/ui-layout";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// --- Colour maths ----------------------------------------------------------

/** Linear sRGB channels (0..1) of a #rrggbb or an opaque oklch() colour. */
function linear(colour: string): [number, number, number] {
  const v = colour.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    const n = parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  }
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(v);
  if (!m) throw new Error(`Can't read colour ${v}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ];
}

function luminance(colour: string): number {
  const [r, g, b] = linear(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// --- Reading the CSS --------------------------------------------------------

/** The custom properties of the first block whose selector list contains `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    // Drop comments and any at-rule statements (@import …;) before the selector.
    const selectors = (m[1].replace(/\/\*[\s\S]*?\*\//g, "").split(";").pop() ?? "").split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const vars: Record<string, string> = {};
    for (const d of m[2].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
    return vars;
  }
  throw new Error(`No block for ${selector}`);
}

const globals = read("src/app/globals.css");
const revamp = read("src/app/revamp-tokens.css");
const themes = read("src/app/themes.css");

const ink = { light: block(globals, ":root"), dark: block(globals, ".dark") };
const calm = { light: block(revamp, ':root[data-ui="revamp"]'), dark: block(revamp, '[data-ui="revamp"].dark') };

/** What <html> resolves to, following the cascade of the three files. */
function resolved(theme: string, dark: boolean): { vars: Record<string, string>; own: Record<string, string> } {
  if (theme === "CALM") {
    const own = dark ? { ...calm.light, ...calm.dark } : calm.light;
    return { vars: { ...ink.light, ...(dark ? ink.dark : {}), ...own }, own };
  }
  const sel = `:root[data-ui="revamp"][data-theme="${themeAttr(theme as never)}"]`;
  const light = block(themes, sel);
  const own = dark ? { ...light, ...block(themes, `${sel}.dark`) } : light;
  const base = resolved("CALM", dark).vars;
  return { vars: { ...base, ...own }, own: dark ? block(themes, `${sel}.dark`) : light };
}

// --- The pairs --------------------------------------------------------------

/** [text, background, minimum] by token name. */
const TEXT = 4.5;
const UI = 3;
const PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", TEXT],
  ["foreground", "muted", TEXT],
  ["foreground", "accent", TEXT],
  ["card-foreground", "card", TEXT],
  ["popover-foreground", "popover", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "card", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["muted-foreground", "sidebar", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["secondary-foreground", "secondary", TEXT],
  ["accent-foreground", "accent", TEXT],
  ["destructive-foreground", "destructive", TEXT],
  ["success-foreground", "success", TEXT],
  ["warning-foreground", "warning", TEXT],
  ["brand-terracotta-foreground", "brand-terracotta", TEXT],
  ["link", "background", TEXT],
  ["link", "card", TEXT],
  ["destructive", "background", TEXT],
  ["success", "background", TEXT],
  ["warning", "background", TEXT],
  ["sidebar-foreground", "sidebar", TEXT],
  ["sidebar-accent-foreground", "sidebar-accent", TEXT],
  ["sidebar-primary-foreground", "sidebar-primary", TEXT],
  ["input", "background", UI],
  ["input", "card", UI],
  ["ring", "background", UI],
  ["sidebar-primary", "sidebar", UI],
];
const NAV = [
  "home", "inbox", "book", "calendar", "test", "assignment", "grades", "gradebook",
  "analytics", "users", "profile", "settings", "help", "billing", "fees",
];
const STRIP = ["strip-1", "strip-2", "strip-3"];

/** Nav icon outlines: the sidebar, its hover / active row, and (legacy shell) the muted active row. */
function navChecks(label: string, vars: Record<string, string>, rows: string[]) {
  let lowest = Infinity;
  for (const n of NAV) {
    for (const bg of rows) {
      const r = contrast(vars[`nav-${n}`], vars[bg]);
      lowest = Math.min(lowest, r);
      if (r < UI) pass(false, `${label}: nav ${n} on ${bg} ≥ ${UI}`, r.toFixed(2));
    }
  }
  pass(lowest >= UI, `${label}: every nav icon outline ≥ ${UI} on ${rows.join(", ")}`, `lowest ${lowest.toFixed(2)}`);
}

for (const theme of COLOR_THEMES) {
  for (const dark of [false, true]) {
    const mode = `${theme.toLowerCase()} ${dark ? "dark" : "light"}`;
    const { vars, own } = resolved(theme, dark);
    if (theme !== "CALM") {
      for (const [k, v] of Object.entries(own)) {
        if (k === "radius") continue;
        pass(/^#[0-9a-f]{6}$/i.test(v), `${mode}: --${k} is a 6-digit hex`, v);
      }
    }
    let lowestText = Infinity;
    let lowestUi = Infinity;
    for (const [fg, bg, min] of PAIRS) {
      const r = contrast(vars[fg], vars[bg]);
      if (min === TEXT) lowestText = Math.min(lowestText, r);
      else lowestUi = Math.min(lowestUi, r);
      if (r < min) pass(false, `${mode}: ${fg} on ${bg} ≥ ${min}`, r.toFixed(2));
    }
    pass(lowestText >= TEXT, `${mode}: every text pair ≥ ${TEXT}`, `lowest ${lowestText.toFixed(2)}`);
    pass(lowestUi >= UI, `${mode}: outlines and rings ≥ ${UI}`, `lowest ${lowestUi.toFixed(2)}`);
    navChecks(mode, vars, ["sidebar", "sidebar-accent"]);
    pass(STRIP.every((s) => own[s] || (theme === "CALM" && vars[s])), `${mode}: defines its strip colours`, STRIP.map((s) => vars[s]).join(" "));
  }
}

// The legacy shell without REVAMP_UI (Inkwell): its active row is --muted.
navChecks("inkwell light", ink.light, ["sidebar", "sidebar-accent", "muted"]);
navChecks("inkwell dark", { ...ink.light, ...ink.dark }, ["sidebar", "sidebar-accent", "muted"]);

pass(
  UI_THEMES.every((t) => (COLOR_THEMES as readonly string[]).includes(t)),
  "every account theme (A's UI_THEMES) has colours here",
  UI_THEMES.join(", "),
);
for (const t of COLOR_THEMES.filter((x) => x !== "CALM")) {
  pass(themes.includes(`[data-theme="${themeAttr(t)}"].dark`), `${t} has a dark block in themes.css`);
}

// --- Filled nav icons and the strip in the sources -------------------------

const navConfig = read("src/components/shell/nav-config.ts");
const sidebar = read("src/components/ui/sidebar.tsx");
const appShell = read("src/components/shell/app-shell.tsx");
const legacyNav = read("src/app/dashboard/models/nav.tsx");
const header = read("src/components/shell/page-header.tsx");
const ribbon = read("src/components/shell/ribbon.tsx");
const frameCss = read("src/app/page-frame.css");

pass(/export const navFill/.test(navConfig) && /--nav-fill-mix/.test(navConfig), "navFill mixes the fill from the hue token");
pass(/--nav-fill-mix:/.test(globals) && /--nav-fill-mix-active:/.test(globals), "globals.css defines the fill mix tokens");
pass(/iconFill/.test(sidebar) && /navFill\(/.test(appShell), "AppShell fills its nav icons");
pass(/navFill\(/.test(legacyNav), "the legacy shell fills its nav icons");
pass(!/BarChart3/.test(appShell) && !/BarChart3/.test(legacyNav), "no open-line chart icon in the nav (it fills as a triangle)");
pass(/SignatureStrip/.test(header) && /SignatureStrip/.test(ribbon), "the strip sits under the primary header and under the ribbon");
pass(/aria-hidden/.test(read("src/components/shell/signature-strip.tsx")), "the strip is aria-hidden");
pass(/:has\(\s*\+\s*\[data-slot="ribbon"\]/.test(frameCss), "the header's strip hides while a ribbon is under it");

// --- The page frame's layout file ----------------------------------------

const root = block(frameCss, ":root");
const want: Record<string, string> = {
  "frame-reading": "720px",
  "frame-standard": "1120px",
  "frame-pad": "16px",
  "frame-gap": "32px",
  "header-primary": "48px",
  "header-secondary": "40px",
};
for (const [k, v] of Object.entries(want)) pass(root[k] === v, `page-frame.css --${k} = ${v}`, root[k]);
pass(/min-width:\s*640px\)\s*\{\s*:root\s*\{\s*--frame-pad:\s*24px/.test(frameCss), "padding is 24px from 640px");
pass(/min-width:\s*1024px\)\s*\{\s*:root\s*\{\s*--frame-pad:\s*32px/.test(frameCss), "padding is 32px from 1024px");
pass(PAGE_TYPES.every((t) => FRAME_WIDTHS.includes(DEFAULT_WIDTH[t])), "every page type has a frame width");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll theme, nav icon, strip and frame checks passed.");
