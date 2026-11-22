/**
 * Every dashboard page uses the page frame (#205, step 5).
 *
 *   npx tsx scripts/check-page-frame.ts
 *
 * Fails when a `src/app/dashboard/**\/page.tsx` that renders UI doesn't
 * render a PageFrame, directly or through a component that does
 * (CourseFrame, TestFrame, BillingFrame, TutorHome, PageMessage, ...).
 * It also fails on the ad hoc layout the frame replaced: a page-level
 * `mx-auto max-w-*` wrapper, the white-on-brand banner, a bare PageHeader
 * or a hand-made `font-display` h1. Widths, padding and section gaps come
 * from src/app/page-frame.css only.
 *
 * Static: reads files, no database, no network. Exits 1 on any failure.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..");
const DASHBOARD = join(ROOT, "src", "app", "dashboard");
const SCAN = ["src/app", "src/components", "src/features"].map((d) => join(ROOT, d));

/**
 * Pages that render UI but not a PageFrame, and why. Keep this short.
 */
const EXCEPTIONS: Record<string, string> = {
  // The onboarding wizard: a focus route (no sidebar, no header) with its
  // own step frame (OnboardingFrame).
  "welcome/page.tsx": "onboarding wizard",
  "onboarding/page.tsx": "onboarding wizard",
  "onboarding/[step]/page.tsx": "onboarding wizard",
};

/** Layout the frame replaced; none of it may come back on a page. */
const BANNED: [RegExp, string][] = [
  // Page-sized widths only: a centred empty-state paragraph (max-w-sm) is fine.
  [
    /className="(?=[^"]*\bmx-auto\b)[^"]*\bmax-w-(?:2xl|3xl|4xl|5xl|6xl|7xl|screen-\w+|\[\d+px\])(?=[\s"])/,
    "an ad hoc page width (use PageFrame's type or width)",
  ],
  [/border-b-2 border-brand-terracotta bg-primary/, "the old white-on-brand banner (use PageTitle)"],
  [/<PageHeader\b/, "a bare PageHeader (use PageFrame)"],
  [/<h1 className="font-display/, "a hand-made h1 (use PageTitle)"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Source without comments, so a comment naming PageFrame doesn't count. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** `export function Name` blocks: each runs to the next top-level export. */
function exportedComponents(src: string): { name: string; body: string }[] {
  const re = /^export (?:default )?(?:async )?function ([A-Z]\w*)/gm;
  const starts = [...src.matchAll(re)];
  return starts.map((m, i) => ({
    name: m[1],
    body: src.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : src.length),
  }));
}

// Components that render a frame: PageFrame and PageMessage, then anything
// whose body renders one of those, until nothing new turns up.
const framed = new Set(["PageFrame", "PageMessage"]);
// Pages and layouts are not components other pages render.
const components = SCAN.flatMap((d) => walk(d))
  .filter((f) => !f.includes(`${sep}design-system${sep}`) && !/[\\/](page|layout)\.tsx$/.test(f))
  .flatMap((f) => exportedComponents(code(readFileSync(f, "utf8"))));
for (let grew = true; grew; ) {
  grew = false;
  for (const c of components) {
    if (framed.has(c.name)) continue;
    if ([...framed].some((n) => new RegExp(`<${n}[\\s>/]`).test(c.body))) {
      framed.add(c.name);
      grew = true;
    }
  }
}

let failures = 0;
let passed = 0;
let skipped = 0;
function fail(page: string, why: string) {
  failures++;
  console.log(`FAIL  ${page}: ${why}`);
}

for (const file of walk(DASHBOARD).filter((f) => f.endsWith(`${sep}page.tsx`))) {
  const page = relative(DASHBOARD, file).split(sep).join("/");
  const src = code(readFileSync(file, "utf8"));
  const rendersUi = /return\s*\(?\s*</.test(src);
  if (!rendersUi) {
    skipped++; // redirect-only
    continue;
  }
  for (const [re, what] of BANNED) if (re.test(src)) fail(page, what);
  if (EXCEPTIONS[page]) {
    skipped++;
    continue;
  }
  const uses = [...framed].filter((n) => new RegExp(`<${n}[\\s>/]`).test(src));
  if (uses.length === 0) fail(page, "renders UI without a PageFrame");
  else passed++;
}

// The exceptions must still exist, so the list can't rot.
for (const page of Object.keys(EXCEPTIONS)) {
  try {
    statSync(join(DASHBOARD, page));
  } catch {
    fail(page, "listed as an exception but no longer exists; remove it from EXCEPTIONS");
  }
}

console.log(`\n${passed} framed, ${skipped} redirect-only or excepted, ${failures} failure(s).`);
console.log(`Frame components: ${[...framed].sort().join(", ")}`);
process.exit(failures === 0 ? 0 : 1);
