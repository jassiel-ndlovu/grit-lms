/**
 * A meeting app's icon, so the choice reads faster. It sits beside the app's
 * name, only where it says which app a link opens.
 *
 * The files are the apps' own icons, unchanged
 * (public/images/meeting-apps/README.md). The owner chose to use them on
 * 2026-11-24, pending the legal team: set SHOW_MEETING_LOGOS to false to go
 * back to a neutral mark everywhere.
 */

import Image from "next/image";
import { Link2, Video } from "lucide-react";

import type { MeetingProvider } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

const SHOW_MEETING_LOGOS: boolean = true;

const LOGO: Record<MeetingProvider, string | null> = {
  GOOGLE_MEET: "/images/meeting-apps/google-meet.svg",
  ZOOM: "/images/meeting-apps/zoom.png",
  TEAMS: "/images/meeting-apps/microsoft-teams.svg",
  OTHER: null,
};

/** The icon on its own; a link icon for "Something else", a camera when the app isn't known. */
export function MeetingAppMark({ provider, className }: { provider: MeetingProvider | null; className?: string }) {
  const logo = provider && SHOW_MEETING_LOGOS ? LOGO[provider] : null;
  if (logo) return <Image src={logo} alt="" width={24} height={24} unoptimized className={cn("size-5 shrink-0 object-contain", className)} />;
  const Icon = provider === "OTHER" ? Link2 : Video;
  return <Icon aria-hidden className={cn("text-muted-foreground size-5 shrink-0", className)} />;
}
