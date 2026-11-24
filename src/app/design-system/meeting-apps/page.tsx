/**
 * /design-system/meeting-apps — the meeting app icons without a session: the
 * Settings choice and the buttons that open a link. Same gate as
 * /design-system. The choice isn't saved here.
 */

import { notFound } from "next/navigation";
import { Video } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { MeetingAppMark } from "@/features/events/components/meeting-app-mark";
import { MeetingProviderSetting } from "@/features/events/components/meeting-provider-setting";
import { MEETING_PROVIDER_INFO, meetingProvider, meetingProviderOf } from "@/features/events/lib/calendar-ui";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Meeting apps · Design system", robots: { index: false } };

const APPS = ["GOOGLE_MEET", "ZOOM", "TEAMS"] as const;
const LINKS = ["https://meet.google.com/abc-defg-hij", "https://zoom.us/j/123", "https://teams.microsoft.com/l/meetup-join/x", "https://example.test/room"];

export default function MeetingAppsPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageFrame type="settings" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Meeting apps" }]}>
        <PageTitle icon={<Video />} title="Meeting apps" description="The choice in Settings, and the buttons that open a link." />
        <PageSection title="Settings">
          <MeetingProviderSetting initial="GOOGLE_MEET" />
        </PageSection>
        <PageSection title="Buttons">
          <div className="flex flex-wrap gap-2">
            {APPS.map((p) => (
              <Button key={p} variant="outline" type="button">
                <MeetingAppMark provider={p} className="size-4" />
                {MEETING_PROVIDER_INFO[p].newLabel}
              </Button>
            ))}
            {LINKS.map((link) => (
              <Button key={link} variant="outline" size="sm" type="button">
                <MeetingAppMark provider={meetingProviderOf(link)} className="size-4" />
                Open {meetingProvider(link) ?? "meeting"} link
              </Button>
            ))}
          </div>
        </PageSection>
      </PageFrame>
    </div>
  );
}
