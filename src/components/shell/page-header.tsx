import * as React from "react";
import Link from "next/link";
import { ChevronRight, HelpCircle } from "lucide-react";

import { HEADER_TOP_CLASS } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

/**
 * PageHeader — the primary header of the page frame (#205,
 * contracts/navigation.md): breadcrumb on the left, then the page's one
 * status, its actions, and help in a fixed slot at the far right. 48 px,
 * sticky under the shell's mobile bar (`--shell-top`, src/app/page-frame.css)
 * and at the top of the window on lg+. The page title is in the content
 * (PageTitle), not here.
 *
 * `density="runner"`: the test runner's strip, 28 px, small text, no help.
 *
 * Server-safe. The last crumb is the current page and is not a link.
 */
export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumb: Crumb[];
  /** One StatusChip, or nothing. */
  status?: React.ReactNode;
  /** One primary action at most, plus quiet secondary ones. */
  actions?: React.ReactNode;
  /** Where the help button goes. Pass null to hide it. */
  helpHref?: string | null;
  /** "runner" shrinks the header to a thin strip for the test runner. */
  density?: "default" | "runner";
  className?: string;
}

export function PageHeader({ breadcrumb, status, actions, helpHref = "/dashboard/help", density = "default", className }: PageHeaderProps) {
  const runner = density === "runner";
  return (
    <header
      data-slot="page-header"
      data-density={density}
      className={cn(
        "bg-background/95 border-border sticky z-20 flex items-center border-b backdrop-blur",
        HEADER_TOP_CLASS,
        runner ? "h-(--header-runner) gap-2 px-3" : "h-(--header-primary) gap-3 px-4",
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className={cn("flex min-w-0 items-center gap-1", runner ? "text-xs" : "text-sm")}>
          {breadcrumb.map((c, i) => {
            const last = i === breadcrumb.length - 1;
            return (
              <li key={`${i}-${c.label}`} className={cn("flex min-w-0 items-center gap-1", !last && "hidden sm:flex")}>
                {c.href && !last ? (
                  <Link href={c.href} className="text-muted-foreground hover:text-foreground truncate rounded px-1 hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("truncate px-1", last ? "font-medium" : "text-muted-foreground")}>
                    {c.label}
                  </span>
                )}
                {!last ? <ChevronRight aria-hidden className="text-muted-foreground size-3.5 shrink-0" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      {status}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {helpHref && !runner ? (
        <Link
          href={helpHref}
          aria-label="Help"
          className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-8 shrink-0 place-items-center rounded-md"
        >
          <HelpCircle className="size-4" />
        </Link>
      ) : null}
    </header>
  );
}
