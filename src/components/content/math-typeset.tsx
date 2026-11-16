"use client";

import { MathJax } from "better-react-mathjax";
import type { ReactNode } from "react";

/**
 * Typesets the maths inside server-rendered rich content once, on mount.
 * Needs a MathProvider above it (the dashboard layout mounts one).
 */
export function MathTypeset({ children }: { children: ReactNode }) {
  return <MathJax dynamic={false}>{children}</MathJax>;
}
