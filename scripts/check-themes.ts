/**
 * Checks the colour themes (#206) and the page-frame layout file (#205).
 *
 *   npx tsx scripts/check-themes.ts
 *
 * Pure: reads src/app/themes.css and src/app/page-frame.css, no network.
 * For the BRIGHT theme, light and dark, every text colour must reach 4.5:1
 * on the surfaces it sits on, and control outlines, focus rings and nav
 * icons 3:1 (WCAG 2.2 AA). The layout file must hold the approved widths,
 * paddings and gaps. Exits 1 on any failure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { UI_THEMES } from "../src/lib/viewer-core";
import { DEFAULT_WIDTH, FRAME_WIDTHS, PAGE_TYPES } from "../src/lib/ui-layout";

let failures = 0;
function pass(ok: boolean, name: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// --- Contrast ------------------------------------------------------------

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The custom properties of the first block whose selector list contains `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const vars: Record<string, string> = {};
    for (const d of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
    return vars;
  }
  throw new Error(`No block for ${selector}`);
}

const themes = readFileSync(join(__dirname, "../src/app/themes.css"), "utf8");
const modes = {
  "bright light": block(themes, ':root[data-ui="revamp"][data-theme="bright"]'),
  "bright dark": block(themes, ':root[data-ui="revamp"][data-theme="bright"].dark'),
};

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

for (const [mode, vars] of Object.entries(modes)) {
  for (const [k, v] of Object.entries(vars)) {
    if (k === "radius") continue;
    pass(/^#[0-9a-f]{6}$/i.test(v), `${mode}: --${k} is a 6-digit hex`, v);
  }
  for (const [fg, bg, min] of PAIRS) {
    const r = contrast(vars[fg], vars[bg]);
    pass(r >= min, `${mode}: ${fg} on ${bg} ≥ ${min}`, r.toFixed(2));
  }
  for (const n of NAV) {
    for (const bg of ["sidebar", "sidebar-accent"]) {
      const r = contrast(vars[`nav-${n}`], vars[bg]);
      pass(r >= UI, `${mode}: nav ${n} on ${bg} ≥ ${UI}`, r.toFixed(2));
    }
  }
}

pass(JSON.stringify(UI_THEMES) === JSON.stringify(["CALM", "BRIGHT"]), "UI_THEMES is CALM and BRIGHT (one stylesheet per non-default theme)");

// --- The page frame's layout file ----------------------------------------

const frame = readFileSync(join(__dirname, "../src/app/page-frame.css"), "utf8");
const root = block(frame, ":root");
const want: Record<string, string> = {
  "frame-reading": "720px",
  "frame-standard": "1120px",
  "frame-pad": "16px",
  "frame-gap": "32px",
  "header-primary": "48px",
  "header-secondary": "40px",
};
for (const [k, v] of Object.entries(want)) pass(root[k] === v, `page-frame.css --${k} = ${v}`, root[k]);
pass(/min-width:\s*640px\)\s*\{\s*:root\s*\{\s*--frame-pad:\s*24px/.test(frame), "padding is 24px from 640px");
pass(/min-width:\s*1024px\)\s*\{\s*:root\s*\{\s*--frame-pad:\s*32px/.test(frame), "padding is 32px from 1024px");
pass(PAGE_TYPES.every((t) => FRAME_WIDTHS.includes(DEFAULT_WIDTH[t])), "every page type has a frame width");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll theme and frame checks passed.");
