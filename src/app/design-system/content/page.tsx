/**
 * /design-system/content — one sample lesson rendered two ways: today's
 * LessonMarkdown from the markdown, and RichContent from the JSON that
 * markdownToDoc makes of it. They should read the same. MathJax is the
 * app's version (4 with REVAMP_UI, else 3): one version per process, so
 * compare by running with and without the flag.
 * Same gate as /design-system: development, or REVAMP_UI=1. Sample data only.
 */

import { notFound } from "next/navigation";

import LessonMarkdown from "@/app/components/markdown";
import { MathProvider } from "@/app/components/math-provider";
import { RichContent } from "@/components/content/rich-content";
import { docToMarkdown, markdownToDoc } from "@/lib/content/markdown";
import { toStoredContent } from "@/lib/content/value";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

export const metadata = { title: "Content · Design system", robots: { index: false } };

const SAMPLE = String.raw`## Quadratic equations

A quadratic has the form $ax^2 + bx + c = 0$ with $a \neq 0$. Its roots are
\[ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} \]
and the **discriminant** $\Delta = b^2 - 4ac$ tells us how many there are.

**Worked example** &emsp; \[6\]

1. Solve $x^2 + 3x + 2 = 0$.
2. Factorise: $(x + 1)(x + 2) = 0$, so $x = -1$ or $x = -2$.

$$
\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}
\begin{bmatrix} x \\ y \end{bmatrix} =
\begin{bmatrix} 5 \\ 6 \end{bmatrix}
$$

$$f(x) = \begin{cases} x^2 & x \geq 0 \\ -x & \text{otherwise} \end{cases}$$

| $x$ | $f(x)$ |
| --- | --- |
| 1 | $1$ |
| $-2$ | $2$ |

`;

// Outside String.raw, which would keep the backslash in an escaped backtick.
const SAMPLE_TAIL = [
  "> Check: a tutor's fee of \\$5 is not maths, and neither is `$x$` in code.",
  "",
  "![Globe icon [15%]](/globe.svg)",
  "",
].join("\n");
const SOURCE = SAMPLE + SAMPLE_TAIL;

export default function ContentPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  const version = mathJaxVersion();

  const doc = markdownToDoc(SOURCE);
  const stored = toStoredContent(doc);
  const derived = docToMarkdown(doc);

  return (
    <div data-ui="revamp" className="bg-background text-foreground font-sans min-h-screen">
      <MathProvider version={version}>
        <main className="mx-auto max-w-6xl space-y-8 p-6">
          <header className="space-y-1">
            <h1 className="font-display text-3xl">Rich content</h1>
            <p className="text-muted-foreground">
              MathJax {version} ({version === 4 ? "REVAMP_UI on" : "REVAMP_UI off; set it to see version 4"}).
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="border-border min-w-0 rounded-lg border p-5" aria-labelledby="old">
              <h2 id="old" className="text-muted-foreground mb-4 text-xs font-medium uppercase">Today: LessonMarkdown</h2>
              <LessonMarkdown content={SOURCE} dynamic={false} />
            </section>
            <section className="border-border min-w-0 rounded-lg border p-5" aria-labelledby="new">
              <h2 id="new" className="text-muted-foreground mb-4 text-xs font-medium uppercase">New: RichContent (JSON)</h2>
              <RichContent value={stored} markdown={SOURCE} />
            </section>
          </div>

          <details className="border-border rounded-lg border p-5">
            <summary className="cursor-pointer text-sm font-medium">Derived markdown (saved beside the JSON)</summary>
            <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-4 font-mono text-xs">{derived}</pre>
          </details>
        </main>
      </MathProvider>
    </div>
  );
}
