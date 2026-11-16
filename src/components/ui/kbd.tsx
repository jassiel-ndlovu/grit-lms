import * as React from "react";

import { cn } from "@/lib/utils";

/** A keyboard key, for shortcut hints: <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "border-border bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
