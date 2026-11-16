"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";

import { cn } from "@/lib/utils";

import { activeHref } from "./nav-config";

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

export function Ribbon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="ribbon" className={cn("border-border flex h-10 items-center gap-4 border-b px-4", className)}>
      {children}
    </div>
  );
}

export function RibbonNav({ links, label = "Sections", className }: { links: RibbonLink[]; label?: string; className?: string }) {
  const pathname = usePathname() ?? "";
  // Exact-or-child match; the first link (the overview) only lights on itself.
  const current = activeHref(pathname, links.slice(1).map((l) => l.href)) ?? (pathname === links[0]?.href ? links[0].href : null);
  return (
    <nav aria-label={label} className={cn("-mb-px flex min-w-0 flex-1 self-stretch overflow-x-auto", className)}>
      <ul className="flex items-stretch gap-1">
        {links.map((l) => {
          const active = l.href === current;
          return (
            <li key={l.href} className="flex">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center border-b-2 px-2 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
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
