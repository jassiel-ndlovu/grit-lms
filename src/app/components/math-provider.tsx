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

const config = {
  loader: { load: ["input/tex", "output/svg"] },
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
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
};

export function MathProvider({ children }: { children: React.ReactNode }) {
  return (
    <MathJaxContext version={3} config={config}>
      {children}
    </MathJaxContext>
  );
}
