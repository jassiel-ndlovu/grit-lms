"use client";

/**
 * A student's typed answer, shown as they wrote it, with any `$…$` maths
 * typeset (B design 01, phase 1). Only the maths spans go to MathJax;
 * the text around them is plain and marked `mathjax_ignore`, so a stray
 * dollar sign never turns into maths and markdown never applies.
 * Needs the dashboard's MathJax context (MathProvider).
 */

import * as React from "react";
import { MathJax } from "better-react-mathjax";

import { splitAnswerMaths } from "@/lib/content/answer-maths";
import { cn } from "@/lib/utils";

export function AnswerText({ text, className }: { text: string; className?: string }) {
  const segments = React.useMemo(() => splitAnswerMaths(text), [text]);
  if (!segments.some((s) => s.kind === "maths")) {
    return <div className={cn("whitespace-pre-wrap", className)}>{text}</div>;
  }
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i} className="mathjax_ignore">
            {s.text}
          </span>
        ) : (
          <MathJax key={i} inline={!s.display} dynamic={false} className={s.display ? "my-2 block overflow-x-auto" : undefined}>
            {s.display ? String.raw`\[` + s.tex + String.raw`\]` : String.raw`\(` + s.tex + String.raw`\)`}
          </MathJax>
        ),
      )}
    </div>
  );
}

/**
 * A maths answer or key stored as bare TeX (MATH_EXPRESSION, phase 2),
 * typeset inline. Blank shows a dash.
 */
export function MathsAnswerText({ tex, className }: { tex: string | null | undefined; className?: string }) {
  const t = (tex ?? "").trim();
  if (!t) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <MathJax inline dynamic className={cn("overflow-x-auto", className)}>
      {String.raw`\(` + t + String.raw`\)`}
    </MathJax>
  );
}
