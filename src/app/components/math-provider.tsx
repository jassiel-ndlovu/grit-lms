"use client";

/**
 * MathProvider - mounts MathJax v3 once for the dashboard tree.
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
const MATHJAX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js";

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

export function MathProvider({ children }: { children: React.ReactNode }) {
  return (
    <MathJaxContext version={3} src={MATHJAX_SRC} config={config}>
      {children}
    </MathJaxContext>
  );
}
