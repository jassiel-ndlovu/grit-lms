"use client";

/**
 * Client-side view of the signed-in user's display preferences (time zone,
 * locale, theme, list view). The dashboard's server layout reads
 * UserPreferences once per request and passes them in here, so client
 * components can format dates in the user's zone without another fetch.
 *
 * Also applies the theme and `lang` to <html>, and mirrors the theme into
 * localStorage so the inline script in the root layout can set it before
 * first paint on the next visit (including signed-out pages).
 */

import * as React from "react";

import { DEFAULT_TIME_ZONE, type DateContext } from "@/lib/datetime";
import { COLOR_THEME_STORAGE_KEY, DEVICE_THEME_STORAGE_KEY, THEME_STORAGE_KEY, effectiveTheme, themeAttr } from "@/lib/ui-themes";

// The keys and the boot script live in a plain module: the root layout is a
// server component, and a value imported from this "use client" file arrives
// there as a client reference, not the string.
export { COLOR_THEME_STORAGE_KEY, THEME_STORAGE_KEY };

export interface ClientPreferences {
  /** IANA zone the user chose, or null to follow the browser. */
  timeZone: string | null;
  locale: string;
  darkMode: boolean;
  /**
   * The account's colour theme (#206, A's UiTheme). Applied as data-theme
   * on <html>, unless it is CALM and this device keeps a newer theme the
   * account can't store yet (src/lib/ui-themes.ts).
   */
  theme?: "CALM" | "BRIGHT";
  preferredView: "LIST" | "GRID" | "TIMELINE";
}

const DEFAULTS: ClientPreferences = {
  timeZone: null,
  locale: "en-ZA",
  darkMode: false,
  preferredView: "GRID",
};

const PreferencesContext = React.createContext<ClientPreferences>(DEFAULTS);

export function PreferencesProvider({
  value,
  children,
}: {
  value: ClientPreferences;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", value.darkMode);
    root.style.colorScheme = value.darkMode ? "dark" : "light";
    root.lang = value.locale;
    let device: string | null = null;
    try {
      device = localStorage.getItem(DEVICE_THEME_STORAGE_KEY);
    } catch {
      // No storage: the account's theme it is.
    }
    const colour = themeAttr(effectiveTheme(value.theme, device));
    root.dataset.theme = colour;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value.darkMode ? "dark" : "light");
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, colour);
    } catch {
      // Storage can be unavailable (private mode); the class is still set.
    }
  }, [value.darkMode, value.locale, value.theme]);

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): ClientPreferences {
  return React.useContext(PreferencesContext);
}

/**
 * Date context for formatting. Before mount we can't know the browser's
 * zone, so a user without a saved zone gets DEFAULT_TIME_ZONE on both the
 * server and the first client render (hydration-safe), then their
 * browser's zone after mount.
 */
export function useDateContext(): DateContext {
  const { timeZone, locale } = usePreferences();
  const mounted = useMounted();
  return { locale, timeZone: timeZone ?? (mounted ? undefined : DEFAULT_TIME_ZONE) };
}

export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

