"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** A page that never arrives stops looking busy after this long. */
const GIVE_UP_MS = 12_000;

/**
 * While a page is on its way, the signature strip moves (src/app/nexus.css
 * under html[data-navigating]). Starts on a click on a link inside the app;
 * ends when the address changes. Renders nothing.
 */
function Progress() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString();

  React.useEffect(() => {
    document.documentElement.removeAttribute("data-navigating");
  }, [pathname, search]);

  React.useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname.startsWith("/api/")) return;
      if (to.pathname === location.pathname && to.search === location.search) return;
      root.setAttribute("data-navigating", "");
      clearTimeout(timer);
      timer = setTimeout(() => root.removeAttribute("data-navigating"), GIVE_UP_MS);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimeout(timer);
      root.removeAttribute("data-navigating");
    };
  }, []);

  return null;
}

export function RouteProgress() {
  return (
    <React.Suspense fallback={null}>
      <Progress />
    </React.Suspense>
  );
}
