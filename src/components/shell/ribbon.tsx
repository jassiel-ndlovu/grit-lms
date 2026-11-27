"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";

import { SECONDARY_HIDE_BELOW_PX, SECONDARY_TOP_CLASS } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

import { activeHref } from "./nav-config";
import { SignatureStrip } from "./signature-strip";

/**
 * Ribbon — the strip under a PageHeader (contracts/navigation.md).
 *
 * RibbonNav: the page's sub-views (Overview, Lessons, Tests, People…). Plain
 * links in a <nav>; the current one has aria-current="page". Tab moves
 * through them like any links: they change the URL, so they are not ARIA
 * tabs.
 *
 * RibbonToolbar: commands for the current view (filter, sort, export…), a
 * Radix toolbar with role="toolbar" and arrow-key movement.
 *
 * Phase 0 scrolls sideways when there is not enough room; a Priority+
 * "More" menu can come later without changing the props.
 */
export interface RibbonLink {
  label: string;
  href: string;
}

/**
 * The secondary header of the page frame (#205): 40 px, sticky directly
 * under the PageHeader. Below 768 px it slides away while the page scrolls
 * down and comes back on the first scroll up, so phones keep the room.
 * The signature strip runs under it (and goes with it when it hides).
 */
export function Ribbon({ className, children }: { className?: string; children: React.ReactNode }) {
  const hidden = useHideOnScrollDown();
  return (
    <div
      data-slot="ribbon"
      data-hidden={hidden ? "" : undefined}
      className={cn(
        "bg-background/95 border-border sticky z-10 flex h-(--header-secondary) items-center gap-4 border-b px-4 backdrop-blur",
        "transition-[translate,opacity] duration-200 motion-reduce:transition-none",
        SECONDARY_TOP_CLASS,
        hidden && "pointer-events-none -translate-y-full opacity-0",
        className,
      )}
    >
      {children}
      <SignatureStrip />
    </div>
  );
}

/** Scroll distance before the direction counts, so small jitters don't flicker the bar. */
const SCROLL_SLOP_PX = 8;

/** True while a phone-width window is scrolling down (and past the headers). Always false from 768 px. */
export function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    const narrow = window.matchMedia(`(max-width: ${SECONDARY_HIDE_BELOW_PX - 1}px)`);
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (!narrow.matches || y < 96) {
          setHidden(false);
        } else if (y - last > SCROLL_SLOP_PX) {
          setHidden(true);
        } else if (last - y > SCROLL_SLOP_PX) {
          setHidden(false);
        } else {
          return; // too small to count; keep `last` where the move started
        }
        last = y;
      });
    };
    const onWidth = () => !narrow.matches && setHidden(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    narrow.addEventListener("change", onWidth);
    return () => {
      window.removeEventListener("scroll", onScroll);
      narrow.removeEventListener("change", onWidth);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return hidden;
}

export function RibbonNav({
  links,
  label = "Sections",
  className,
  current: forced,
}: {
  links: RibbonLink[];
  label?: string;
  className?: string;
  /** The href to light when the page's URL is outside every link (e.g. a child route elsewhere). */
  current?: string;
}) {
  const pathname = usePathname() ?? "";
  // Exact-or-child match; the first link (the overview) only lights on itself.
  const current =
    forced ?? activeHref(pathname, links.slice(1).map((l) => l.href)) ?? (pathname === links[0]?.href ? links[0].href : null);
  // A 4 px underline, so it still shows against the signature strip right under it.
  // Phones swipe the links, so their scrollbar would only cover it.
  return (
    <nav aria-label={label} className={cn("-mb-px flex min-w-0 flex-1 self-stretch overflow-x-auto max-md:[scrollbar-width:none]", className)}>
      <ul className="flex items-stretch gap-1">
        {links.map((l) => {
          const active = l.href === current;
          return (
            <li key={l.href} className="flex">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center border-y-4 border-t-transparent px-2 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-b-foreground font-medium" : "text-muted-foreground hover:text-foreground border-b-transparent",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RibbonToolbar({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <ToolbarPrimitive.Root aria-label={label} className={cn("flex shrink-0 items-center gap-1", className)}>
      {children}
    </ToolbarPrimitive.Root>
  );
}

export const RibbonButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  function RibbonButton({ className, ...props }, ref) {
    return (
      <ToolbarPrimitive.Button
        ref={ref}
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm outline-none",
          "focus-visible:ring-ring focus-visible:ring-2 [&_svg]:size-4",
          className,
        )}
        {...props}
      />
    );
  },
);

export const RibbonSeparator = () => <ToolbarPrimitive.Separator className="bg-border mx-1 h-4 w-px" />;
