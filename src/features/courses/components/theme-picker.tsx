"use client";

/**
 * Colour theme picker (#206, owner decisions 2026-11-21 and 22 Nov): Calm,
 * the grey default; Bright, for primary-school learners; Ocean, Sunset and
 * High contrast. Each choice shows a small preview drawn in that theme's own
 * tokens (src/app/themes.css), so the swatches can't drift from the real
 * colours. `ThemeSetting` (the Settings card) saves a choice at once.
 *
 * Saving: a theme A's UiTheme enum knows goes on the account
 * (updateOwnPreferences). A newer one is kept on this device until A's enum
 * has it (src/lib/ui-themes.ts), and the account goes back to Calm so the
 * device's choice shows.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { COLOR_THEME_STORAGE_KEY } from "@/components/preferences-provider";
import { navFill, navHue, type NavHue } from "@/components/shell/nav-config";
import { Card } from "@/components/ui/card";
import { updateOwnPreferences } from "@/features/users/actions";
import {
  COLOR_THEMES, DEVICE_THEME_STORAGE_KEY, THEME_INFO, effectiveTheme, isAccountTheme, themeAttr, type ColorTheme,
} from "@/lib/ui-themes";
import type { UiTheme } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode: the page still shows the theme until reload.
  }
}

function show(theme: ColorTheme) {
  document.documentElement.dataset.theme = themeAttr(theme);
  store(COLOR_THEME_STORAGE_KEY, themeAttr(theme));
}

/**
 * The Settings card: picking a theme shows it on <html> straight away and
 * saves it; the refresh brings the server's copy in line.
 */
export function ThemeSetting({ initial }: { initial: UiTheme }) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<ColorTheme>(initial);
  const [, start] = React.useTransition();

  // A theme kept on this device wins over an account theme of Calm.
  React.useEffect(() => {
    let device: string | null = null;
    try {
      device = localStorage.getItem(DEVICE_THEME_STORAGE_KEY);
    } catch {
      // No storage: the account's theme.
    }
    setTheme(effectiveTheme(initial, device));
  }, [initial]);

  const pick = (next: ColorTheme) => {
    if (next === theme) return;
    const before = theme;
    setTheme(next);
    show(next);
    const onDevice = !isAccountTheme(next);
    store(DEVICE_THEME_STORAGE_KEY, onDevice ? themeAttr(next) : null);
    const account: UiTheme = isAccountTheme(next) ? next : "CALM";
    if (account === initial) return;
    start(async () => {
      const res = await updateOwnPreferences({ theme: account });
      if (res?.data) {
        router.refresh();
        return;
      }
      setTheme(before);
      show(before);
      store(DEVICE_THEME_STORAGE_KEY, isAccountTheme(before) ? null : themeAttr(before));
      toast.error("Couldn't change the theme. Try again.");
    });
  };
  return (
    <Card className="p-6">
      <ThemePicker value={theme} onChange={pick} />
    </Card>
  );
}

export function ThemePicker({ value, onChange }: { value: ColorTheme; onChange: (t: ColorTheme) => void }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  // Arrow keys move between the themes, as in any radio group.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + COLOR_THEMES.length) % COLOR_THEMES.length;
    onChange(COLOR_THEMES[next]);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <p id="theme-label" className="text-foreground text-sm font-medium">
        Colour theme
      </p>
      <p className="text-muted-foreground text-xs">Dark mode works with every theme.</p>
      <div role="radiogroup" aria-labelledby="theme-label" className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {COLOR_THEMES.map((t, i) => {
          const on = value === t;
          const info = THEME_INFO[t];
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "focus-visible:ring-ring flex flex-col gap-2 rounded-lg border p-2 text-left outline-none focus-visible:ring-2",
                on ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
              )}
            >
              <ThemePreview theme={t} />
              <span className="flex items-start gap-2 px-1 pb-1">
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">{info.label}</span>
                  <span className="text-muted-foreground block text-xs">{info.description}</span>
                </span>
                {on ? <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {isAccountTheme(value) ? (
        <p className="text-muted-foreground mt-3 text-xs">Saved to your account, so it follows you to every device.</p>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">
          {THEME_INFO[value].label} is saved on this device for now. Your other devices stay on Calm.
        </p>
      )}
    </div>
  );
}

function PreviewIcon({ hue, active = false }: { hue: NavHue; active?: boolean }) {
  return (
    <span
      className="size-2 shrink-0 rounded-[2px] border"
      style={{ background: navFill(hue, active), borderColor: navHue(hue) }}
    />
  );
}

/** A miniature page (sidebar, strip, title, button) in the theme's own tokens. */
export function ThemePreview({ theme }: { theme: ColorTheme }) {
  return (
    <span
      aria-hidden
      data-ui="revamp"
      data-theme={theme === "CALM" ? undefined : themeAttr(theme)}
      className="bg-background border-border flex h-20 overflow-hidden rounded-md border"
    >
      <span className="bg-sidebar border-sidebar-border flex w-1/3 flex-col gap-1.5 border-r p-2">
        <span className="flex items-center gap-1">
          <PreviewIcon hue="home" />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
        <span className="bg-sidebar-accent flex items-center gap-1 rounded px-0.5 py-0.5">
          <PreviewIcon hue="book" active />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
        <span className="flex items-center gap-1">
          <PreviewIcon hue="calendar" />
          <span className="bg-sidebar-foreground/60 h-1 flex-1 rounded" />
        </span>
      </span>
      <span className="flex flex-1 flex-col">
        <span className="bg-linear-to-r from-(--strip-1) via-(--strip-2) to-(--strip-3) h-[3px] shrink-0" />
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
    </span>
  );
}
