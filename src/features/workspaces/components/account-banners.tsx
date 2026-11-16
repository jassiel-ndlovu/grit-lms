/**
 * <AccountBanners viewer /> — the content of AppShell's `banner` slot
 * (docs/revamp/contracts/navigation.md). Server component; the dashboard
 * layout passes it in:
 *
 *   <AppShell ... banner={<AccountBanners viewer={viewer} />}>
 *
 * Renders nothing when no banner applies. Which banners show is decided in
 * ../account-banners.ts.
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

import { accountBannersFor, type BannerTone } from "../account-banners";
import { ResendVerificationButton } from "./resend-verification-button";

const TONE: Record<BannerTone, string> = {
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-border bg-muted text-foreground",
};

export function AccountBanners({ viewer, now }: { viewer: Viewer; now?: Date }) {
  const banners = accountBannersFor(viewer, now);
  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col">
      {banners.map((b) => (
        <div
          key={b.id}
          role={b.tone === "info" ? "status" : "alert"}
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 text-sm",
            TONE[b.tone],
          )}
        >
          <p className="min-w-0 flex-1">{b.message}</p>
          {b.actions.length > 0 ? (
            <div className="flex shrink-0 gap-2">
              {b.actions.map((a) =>
                a.kind === "link" ? (
                  <Button key={a.label} asChild size="sm" variant="outline">
                    <Link href={a.href}>{a.label}</Link>
                  </Button>
                ) : (
                  <ResendVerificationButton key={a.label} label={a.label} />
                ),
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
