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

export interface ClientPreferences {
  /** IANA zone the user chose, or null to follow the browser. */
  timeZone: string | null;
  locale: string;
  darkMode: boolean;
  preferredView: "LIST" | "GRID" | "TIMELINE";
}

const DEFAULTS: ClientPreferences = {
  timeZone: null,
  locale: "en-ZA",
  darkMode: false,
  preferredView: "GRID",
};

const PreferencesContext = React.createContext<ClientPreferences>(DEFAULTS);

export const THEME_STORAGE_KEY = "nexa-theme";

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
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value.darkMode ? "dark" : "light");
    } catch {
      // Storage can be unavailable (private mode); the class is still set.
    }
  }, [value.darkMode, value.locale]);

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

/**
 * Inline script for <head>: applies the last-known theme before React
 * hydrates, avoiding a light flash for dark-mode users.
 */
export const themeBootScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}`;
