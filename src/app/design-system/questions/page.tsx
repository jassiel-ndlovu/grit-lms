/**
 * /design-system/questions — the test runner's question inputs on sample
 * questions, to check them without a session or a test. Same gate as
 * /design-system. Answers live in page state only.
 */

import { notFound } from "next/navigation";

import { MathProvider } from "@/app/components/math-provider";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

import { QuestionsDemo } from "./questions-demo";

export const metadata = { title: "Questions · Design system", robots: { index: false } };

export default function QuestionsPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" className="bg-background text-foreground font-sans min-h-screen">
      <MathProvider version={mathJaxVersion()}>
        <main className="mx-auto max-w-3xl space-y-6 p-6">
          <h1 className="font-display text-3xl">Question inputs</h1>
          <QuestionsDemo />
        </main>
      </MathProvider>
    </div>
  );
}
