/**
 * /design-system/editor — RichEditor on sample content, with the envelope
 * it emits, the markdown the server would derive, and whether the JSON
 * passes validateDoc. Same gate as /design-system. Nothing is saved.
 */

import { notFound } from "next/navigation";

import { MathProvider } from "@/app/components/math-provider";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

import { EditorDemo } from "./editor-demo";

export const metadata = { title: "Editor · Design system", robots: { index: false } };

const SAMPLE = String.raw`## Quadratic equations

A quadratic has the form $ax^2 + bx + c = 0$ with $a \neq 0$. Its roots are

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

1. Solve $x^2 + 3x + 2 = 0$.
2. Factorise: $(x + 1)(x + 2) = 0$.

| $x$ | $f(x)$ |
| --- | --- |
| 1 | $1$ |
`;

export default function EditorPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  const version = mathJaxVersion();
  return (
    <div data-ui="revamp" className="bg-background text-foreground font-sans min-h-screen">
      <MathProvider version={version}>
        <main className="mx-auto max-w-6xl space-y-6 p-6">
          <header className="space-y-1">
            <h1 className="font-display text-3xl">Editor</h1>
            <p className="text-muted-foreground">
              Type <kbd>/</kbd> for blocks, <kbd>$x$</kbd> for inline maths, <kbd>$$</kbd> then space for a maths block.
              MathJax {version}.
            </p>
          </header>
          <EditorDemo sample={SAMPLE} />
        </main>
      </MathProvider>
    </div>
  );
}
