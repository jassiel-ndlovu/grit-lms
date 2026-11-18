"use client";

import type { ReactNode } from "react";

import { MathProvider, type MathJaxVersion } from "@/app/components/math-provider";

/**
 * What both dashboard shells (legacy and REVAMP_UI) wrap pages in.
 *
 * Legacy Batches 1 to 3b (design 07) removed every legacy context provider:
 * no page reads a React context for data any more. Only MathJax is left, so
 * this can become the MathProvider itself once nothing imports the name.
 */
export function LegacyProviders({ children, mathjax = 3 }: { children: ReactNode; mathjax?: MathJaxVersion }) {
  return <MathProvider version={mathjax}>{children}</MathProvider>;
}
