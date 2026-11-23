/**
 * /design-system/offline — offline reading (viewer.md Draft 1.18) without a
 * session: the save button working on this very page (production builds),
 * its states, the saved list, and what a lesson shows without a connection.
 * Same gate as /design-system.
 */

import { notFound } from "next/navigation";
import { CloudDownload } from "lucide-react";

import { SaveOffline } from "@/components/offline/save-offline";
import { SavedLessons } from "@/components/offline/saved-lessons";
import { OfflineSamples } from "@/components/offline/samples";
import { OfflineNotice } from "@/components/offline/offline-support";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Scene } from "@/components/ui/empty-state";
import { RichContent } from "@/components/content/rich-content";
import { MathProvider } from "@/app/components/math-provider";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

export const metadata = { title: "Offline · Design system", robots: { index: false } };

const ctx = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const LESSON = `The gradient of $y = ax^2 + bx + c$ is $\\frac{dy}{dx} = 2ax + b$, so its turning point is where

$$x = -\\frac{b}{2a}.$$

![A parabola](https://example.test/parabola.png)`;

export default function OfflinePreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <MathProvider version={mathJaxVersion()}>
        <OfflineNotice />
        <PageFrame type="settings" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Offline" }]}>
          <PageTitle
            icon={<CloudDownload />}
            title="Offline reading"
            description="Save this page, then go offline and open it again."
            properties={<SaveOffline path="/design-system/offline" title="Grade 12 Mathematics · Quadratics" version="1" />}
          />
          <PageSection title="A lesson">
            <RichContent value={null} markdown={LESSON} />
          </PageSection>
          <PageSection title="Saved on this device">
            <SavedLessons ctx={ctx} illustration={<Scene name="empty-lessons" />} />
          </PageSection>
          <OfflineSamples />
        </PageFrame>
      </MathProvider>
    </div>
  );
}
