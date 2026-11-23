"use client";

/**
 * Offline reading in the dashboard (viewer.md Draft 1.18): registers A's
 * service worker once, and says so when the connection goes. The layout
 * renders it above every page; the test runner has its own notice.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";

import { isFocusRoute } from "@/components/shell/nav-config";
import { clearOfflineData, registerOfflineSupport } from "@/lib/offline";

import { someoneElse } from "./saved";
import { useOnline } from "./use-online";

let ready: Promise<boolean> | null = null;

/** True once the service worker is registered; false where it can't be (development, old browsers). */
export const offlineReady = () => (ready ??= registerOfflineSupport());

export function OfflineSupport({ userId }: { userId: string }) {
  React.useEffect(() => {
    void offlineReady();
    let other = false;
    try {
      other = someoneElse(window.localStorage, userId);
    } catch {
      // No storage in this window.
    }
    if (other) void clearOfflineData();
  }, [userId]);

  const pathname = usePathname() ?? "";
  if (isFocusRoute(pathname)) return null;
  return <OfflineNotice />;
}

export function OfflineNotice() {
  const online = useOnline();
  return (
    <div role="status">
      {online ? null : (
        <p className="border-warning/40 bg-warning/5 text-foreground flex items-start gap-2 border-b px-4 py-2 text-sm">
          <WifiOff aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
          <span>You&apos;re offline. Lessons you saved still open. Changes don&apos;t save until you&apos;re connected.</span>
        </p>
      )}
    </div>
  );
}
