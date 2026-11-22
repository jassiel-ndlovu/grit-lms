"use client";

/**
 * Colour theme picker (#206, owner decision 2026-11-21). Calm, the grey
 * default, and Bright, meant for primary-school learners. Each choice shows
 * a small preview drawn in that theme's own tokens (src/app/themes.css), so
 * the swatches can't drift from the real colours. `ThemeSetting` (the
 * Settings card) saves a choice at once with updateOwnPreferences.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { updateOwnPreferences } from "@/features/users/actions";
import type { UiTheme } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

/**
 * The Settings card: picking a theme saves it at once (A's
 * updateOwnPreferences({ theme })) and shows it on <html> straight away;
 * the refresh brings the server's copy in line.
 */
export function ThemeSetting({ initial }: { initial: UiTheme }) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<UiTheme>(initial);
  const [, start] = React.useTransition();
  const pick = (next: UiTheme) => {
    if (next === theme) return;
    const before = theme;
    setTheme(next);
    document.documentElement.dataset.theme = next === "BRIGHT" ? "bright" : "calm";
    start(async () => {
      const res = await updateOwnPreferences({ theme: next });
      if (res?.data) {
        router.refresh();
        return;
      }
      setTheme(before);
      document.documentElement.dataset.theme = before === "BRIGHT" ? "bright" : "calm";
      toast.error("Couldn't change the theme. Try again.");
    });
  };
  return (
    <Card className="p-6">
      <ThemePicker value={theme} onChange={pick} />
    </Card>
  );
}

const OPTIONS: Array<{ value: UiTheme; label: string; description: string }> = [
  { value: "CALM", label: "Calm", description: "Quiet greys with blue actions. The default." },
  { value: "BRIGHT", label: "Bright", description: "Warm and colourful, made for younger learners." },
];

export function ThemePicker({ value, onChange }: { value: UiTheme; onChange: (t: UiTheme) => void }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  // Arrow keys move between the two, as in any radio group.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <p id="theme-label" className="text-foreground text-sm font-medium">
        Colour theme
      </p>
      <p className="text-muted-foreground text-xs">Applies to your account on every device. Dark mode works with both.</p>
      <div role="radiogroup" aria-labelledby="theme-label" className="mt-3 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o, i) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "focus-visible:ring-ring flex flex-col gap-2 rounded-lg border p-2 text-left outline-none focus-visible:ring-2",
                on ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
              )}
            >
              <ThemePreview theme={o.value} />
              <span className="flex items-start gap-2 px-1 pb-1">
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">{o.label}</span>
                  <span className="text-muted-foreground block text-xs">{o.description}</span>
                </span>
                {on ? <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A miniature page (sidebar, title, button) in the theme's own tokens. */
export function ThemePreview({ theme }: { theme: UiTheme }) {
  return (
    <span
      aria-hidden
      data-ui="revamp"
      data-theme={theme === "BRIGHT" ? "bright" : undefined}
      className="bg-background border-border flex h-20 overflow-hidden rounded-md border"
    >
      <span className="bg-sidebar border-sidebar-border flex w-1/3 flex-col gap-1.5 border-r p-2">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: "var(--nav-home)" }} />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
        <span className="bg-sidebar-accent flex items-center gap-1 rounded px-0.5 py-0.5">
          <span className="size-1.5 rounded-full" style={{ background: "var(--nav-book)" }} />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: "var(--nav-calendar)" }} />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="bg-foreground h-2 w-2/3 rounded" />
        <span className="bg-muted-foreground/60 h-1 w-full rounded" />
        <span className="bg-muted-foreground/60 h-1 w-4/5 rounded" />
        <span className="mt-auto flex gap-1">
          <span className="bg-primary h-3 w-10 rounded" />
          <span className="bg-secondary border-border h-3 w-8 rounded border" />
        </span>
      </span>
    </span>
  );
}
