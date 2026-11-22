import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * StatTile — a small figure with its label, for a PageTitle's property row
 * (#205). Replaces the white-on-brand "hero stats" the home, course, child
 * and pre-test pages each drew inside their own banners.
 */
export function StatTile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="border-border min-w-0 rounded-lg border p-2.5 sm:p-3">
      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 truncate text-xs [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        {label}
      </div>
      <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Up to four StatTiles in a row, side by side even on phones. */
export function StatTiles({ className, children }: { className?: string; children: React.ReactNode }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  return (
    <div className={cn("grid max-w-xl gap-2 sm:gap-3", count >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3", className)}>
      {children}
    </div>
  );
}
