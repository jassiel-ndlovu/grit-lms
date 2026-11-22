"use client";

/**
 * Client pieces for /design-system/frame and /design-system/decisions:
 * the theme picker with local state (nothing is saved here), and a switch
 * that previews a theme on the page by setting data-theme on <html>.
 */

import * as React from "react";
import Link from "next/link";

import { ThemePicker } from "@/features/courses/components/theme-picker";
import type { UiTheme } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

export function ThemePickerDemo({ initial = "CALM" }: { initial?: UiTheme }) {
  const [theme, setTheme] = React.useState<UiTheme>(initial);
  return <ThemePicker value={theme} onChange={setTheme} />;
}

/** Sets data-theme on <html> while the page is open, from `?theme=bright`. */
export function PageTheme({ theme }: { theme: "calm" | "bright" }) {
  React.useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (before) root.dataset.theme = before;
      else delete root.dataset.theme;
    };
  }, [theme]);
  return null;
}

/** Links between the page types (plain links, so each type is its own URL). */
export function TypeSwitcher({ types, current, base, query = "" }: { types: readonly string[]; current: string; base: string; query?: string }) {
  return (
    <nav aria-label="Page types" className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <Link
          key={t}
          href={`${base}?type=${t}${query}`}
          aria-current={t === current ? "page" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs capitalize",
            t === current ? "border-foreground text-foreground font-medium" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {t}
        </Link>
      ))}
    </nav>
  );
}
