"use client";

/**
 * MathProvider - mounts MathJax once for the dashboard tree: v3 today,
 * v4 with REVAMP_UI (the owner's choice: MathJax 4 everywhere; the stored
 * maths audit found no formula that renders differently, research/13).
 *
 * MathJax loads its script lazily via better-react-mathjax. The config
 * below enables both $...$ / $$...$$ and \(...\) / \[...\] delimiters,
 * matching legacy lesson + test content. We skip code/pre so authors can
 * write literal $ in code blocks without it being typeset.
 *
 * Note on \(...\) and \[...\]: MathJax accepts them, but it never actually
 * sees them in content rendered through LessonMarkdown. CommonMark treats a
 * backslash before ASCII punctuation as an escape, so react-markdown would
 * turn `\(x\)` into the plain text `(x)` long before MathJax ran. Those
 * delimiters are rewritten to the dollar forms in lib/tex-delimiters.ts,
 * ahead of markdown parsing — that is what makes them work. The pairs stay
 * configured here for any MathJax consumer that doesn't go through
 * LessonMarkdown.
 */

import { MathJaxContext } from "better-react-mathjax";

/*
 * One self-contained bundle: TeX input, SVG output, nothing else.
 *
 * This used to be better-react-mathjax's default `tex-mml-chtml.js` plus
 * `loader.load: ["input/tex", "output/svg"]`. That never switched the
 * output to SVG (startup had already picked CHTML), and the late SVG font
 * data could corrupt CHTML's, so some formulas came out as
 * "Math input error". Worse, the bundle's MathML *input* jax re-typeset the
 * hidden <math> copy MathJax keeps in each formula's mjx-assistive-mml:
 * every re-typeset nested another full, invisible formula inside the last,
 * and those copies count toward the page's scroll height (see the
 * mjx-assistive-mml rules in globals.css).
 */
const MATHJAX_SRC = {
  3: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js",
  // Pinned. v4 fetches extra glyphs and its speech engine from jsDelivr at
  // run time, so self-hosting means serving the font package too; that is a
  // build step (A's root config), noted in B's HANDOFF.
  4: "https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-svg.js",
} as const;

export type MathJaxVersion = keyof typeof MATHJAX_SRC;

const config = {
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
    processEscapes: true,
  },
  svg: {
    // One shared <defs> block for glyphs instead of a copy per formula.
    fontCache: "global",
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
};

/*
 * v4 only: no typeset pass over the whole page at startup. The <MathJax>
 * components typeset their own subtree; a page-wide pass could run before
 * React hydrates server-rendered maths and cause a hydration mismatch.
 */
const configV4 = { ...config, startup: { typeset: false } };

/** `version` must come from mathJaxVersion() (lib/ui-flags): one per process. */
export function MathProvider({ children, version = 3 }: { children: React.ReactNode; version?: MathJaxVersion }) {
  return (
    <MathJaxContext version={version} src={MATHJAX_SRC[version]} config={version === 4 ? configV4 : config}>
      {children}
    </MathJaxContext>
  );
}
