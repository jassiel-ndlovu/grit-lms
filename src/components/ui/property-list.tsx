import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * PropertyList / PropertyRow — the Notion "page properties" block: a muted
 * label column (with an optional icon) beside the value. Use it for the
 * facts about a thing (due date, course, time limit, status) at the top of
 * a detail page or in a side panel. Rendered as a description list.
 */
function PropertyList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl data-slot="property-list" className={cn("grid gap-0.5 text-sm", className)} {...props} />;
}

interface PropertyRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** A lucide icon element, sized by the row. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function PropertyRow({ label, icon, children, className, ...props }: PropertyRowProps) {
  return (
    <div
      data-slot="property-row"
      className={cn(
        "grid min-h-8 grid-cols-[minmax(7rem,10rem)_1fr] items-start gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60",
        className,
      )}
      {...props}
    >
      <dt className="text-muted-foreground flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      {/* overflow-wrap: anywhere, so a long email or link wraps instead of widening a phone page. */}
      <dd className="min-w-0 text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export { PropertyList, PropertyRow };
