/**
 * The colour themes (#206; three more on 22 Nov). Their colours live in
 * src/app/themes.css (CALM in revamp-tokens.css), applied as
 * `data-theme="<attr>"` on <html>.
 *
 * A theme is saved on the account (viewer.user.theme) only when A's
 * UiTheme enum knows it (`UI_THEMES` in viewer-core). Until A adds the
 * newer ids, a pick of one of them is kept on this device (localStorage,
 * DEVICE_THEME_STORAGE_KEY) and wins over an account theme of CALM. Once
 * A's enum has them, the picker saves them on the account like the rest.
 *
 * Pure: safe in server and client components and in scripts.
 */

import { UI_THEMES, type UiTheme } from "@/lib/viewer-core";

export const COLOR_THEMES = ["CALM", "BRIGHT", "OCEAN", "SUNSET", "CONTRAST"] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export interface ThemeInfo {
  label: string;
  description: string;
}

export const THEME_INFO: Record<ColorTheme, ThemeInfo> = {
  CALM: { label: "Calm", description: "Quiet greys with blue actions. The default." },
  BRIGHT: { label: "Bright", description: "Warm and colourful, made for younger learners." },
  OCEAN: { label: "Ocean", description: "Cool sea greens and blues." },
  SUNSET: { label: "Sunset", description: "Warm peach, clay and orange." },
  CONTRAST: { label: "High contrast", description: "Black and white with violet. Easiest to read." },
};

/** The value of data-theme on <html>: the id in lower case. */
export const themeAttr = (t: ColorTheme) => t.toLowerCase();

/** Reads a data-theme value (or a stored one) back; null when unknown. */
export function themeFromAttr(v: string | null | undefined): ColorTheme | null {
  const up = (v ?? "").toUpperCase();
  return (COLOR_THEMES as readonly string[]).includes(up) ? (up as ColorTheme) : null;
}

/** True when the account can store this theme (A's enum has it). */
export function isAccountTheme(t: ColorTheme): t is UiTheme {
  return (UI_THEMES as readonly string[]).includes(t);
}

/** localStorage key for a theme kept on this device only (not yet in A's enum). */
export const DEVICE_THEME_STORAGE_KEY = "nexa-device-theme";

/**
 * The theme to show: the account's, unless the account is on the default
 * and this device holds a newer theme the account can't store yet.
 */
export function effectiveTheme(account: UiTheme | undefined, device: string | null | undefined): ColorTheme {
  const local = themeFromAttr(device);
  if ((account ?? "CALM") === "CALM" && local && !isAccountTheme(local)) return local;
  return account ?? "CALM";
}

/** Mirrors of the account's dark mode and theme, for the boot script. */
export const THEME_STORAGE_KEY = "nexa-theme";
/** The colour theme (#206), mirrored like the dark-mode flag. */
export const COLOR_THEME_STORAGE_KEY = "nexa-color-theme";

/**
 * Inline script for <head>: applies the last-known theme before React
 * hydrates, avoiding a light flash for dark-mode users. Kept here, not in
 * the "use client" provider, so the server layout gets the string itself.
 */
const BOOT_THEMES = JSON.stringify(COLOR_THEMES.filter((t) => t !== "CALM").map(themeAttr));
export const themeBootScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}var t=localStorage.getItem("${COLOR_THEME_STORAGE_KEY}");if(${BOOT_THEMES}.indexOf(t)>=0){document.documentElement.dataset.theme=t}}catch(e){}`;
