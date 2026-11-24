/**
 * /design-system/ai-help — AI help for tutors on sample drafts, with no
 * session: nothing is sent to the AI and nothing is saved. Same gate as
 * /design-system.
 */

import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { MathProvider } from "@/app/components/math-provider";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

import { AiHelpDemo } from "./ai-help-demo";

export const metadata = { title: "AI help · Design system", robots: { index: false } };

export default function AiHelpPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <MathProvider version={mathJaxVersion()}>
        <PageFrame type="record" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "AI help" }]}>
          <PageTitle icon={<Sparkles />} title="AI help" description="Drafts a tutor checks, edits and keeps. Samples only." />
          <AiHelpDemo />
        </PageFrame>
      </MathProvider>
    </div>
  );
}
