import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Sidebar primitives — the Notion-style navigation panel: a grey column of
 * compact rows, a quiet section label, a soft fill on the current page.
 * Presentational only: the app shell decides which item is active and how
 * the panel collapses on small screens.
 */
function Sidebar({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar"
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-60 flex-col gap-4 border-r px-2 py-3 text-sm",
        className,
      )}
      {...props}
    />
  );
}

interface SidebarSectionProps extends React.ComponentProps<"div"> {
  label?: string;
}

/** Server-safe (no hooks): the list is named by `aria-label`. */
function SidebarSection({ label, className, children, ...props }: SidebarSectionProps) {
  return (
    <div data-slot="sidebar-section" className={cn("flex flex-col gap-px", className)} {...props}>
      {label ? (
        <p aria-hidden className="text-muted-foreground px-2 pb-1 text-xs font-medium">
          {label}
        </p>
      ) : null}
      <ul aria-label={label} className="flex flex-col gap-px">
        {children}
      </ul>
    </div>
  );
}

interface SidebarItemProps extends Omit<React.ComponentProps<typeof Link>, "children"> {
  icon?: React.ReactNode;
  active?: boolean;
  /** Small trailing count or badge, e.g. items waiting to be graded. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

function SidebarItem({ icon, active, trailing, className, children, ...props }: SidebarItemProps) {
  return (
    <li>
      <Link
        data-slot="sidebar-item"
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2 rounded-md px-2 outline-none transition-colors",
          "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "[&_svg]:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0",
          active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          className,
        )}
        {...props}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {trailing ? <span className="text-muted-foreground text-xs tabular-nums">{trailing}</span> : null}
      </Link>
    </li>
  );
}

export { Sidebar, SidebarSection, SidebarItem };
