/** The Nexa "Nx" tile, as in the app icon. Decorative: the name sits beside it. */

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-[#1f1e1b] font-serif text-sm text-[#f7f7f5] dark:ring-1 dark:ring-white/15",
        className,
      )}
    >
      Nx
    </span>
  );
}
