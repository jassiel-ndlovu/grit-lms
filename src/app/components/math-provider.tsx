"use client";

/**
 * MathProvider - mounts MathJax v3 once for the dashboard tree.
 *
 * MathJax loads its script lazily via better-react-mathjax. The config
 * below enables both $...$ / $$...$$ and \(...\) / \[...\] delimiters,
 * matching legacy lesson + test content. We skip code/pre so authors can
 * write literal $ in code blocks without it being typeset.
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
