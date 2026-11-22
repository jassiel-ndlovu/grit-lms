/**
 * Reading settings (#216, phase 1, accessibility): text size and a
 * dyslexia-friendly font. Applied as attributes on <html>, styled in
 * src/app/a11y.css:
 *
 *   data-text-size="large" | "larger"   (absent: the default size)
 *   data-reading-font="dyslexia"        (absent: the theme's font)
 *
 * Kept on the device (localStorage) until A's UserPreferences has fields
 * for them (asked on #216). The boot script in preferences-provider sets
 * the attributes before first paint; the Settings card changes them.
 *
 * Pure: safe in server and client components and in scripts.
 */

export const TEXT_SIZES = ["DEFAULT", "LARGE", "LARGER"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const READING_FONTS = ["DEFAULT", "DYSLEXIA"] as const;
export type ReadingFont = (typeof READING_FONTS)[number];

export const TEXT_SIZE_STORAGE_KEY = "nexa-text-size";
export const READING_FONT_STORAGE_KEY = "nexa-reading-font";

export const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  DEFAULT: "Default",
  LARGE: "Large",
  LARGER: "Larger",
};

/** The attribute value on <html>, or null for the default (no attribute). */
export const textSizeAttr = (s: TextSize) => (s === "DEFAULT" ? null : s.toLowerCase());
export const readingFontAttr = (f: ReadingFont) => (f === "DEFAULT" ? null : f.toLowerCase());

export function readTextSize(v: string | null | undefined): TextSize {
  const up = (v ?? "").toUpperCase();
  return (TEXT_SIZES as readonly string[]).includes(up) ? (up as TextSize) : "DEFAULT";
}

export function readReadingFont(v: string | null | undefined): ReadingFont {
  const up = (v ?? "").toUpperCase();
  return (READING_FONTS as readonly string[]).includes(up) ? (up as ReadingFont) : "DEFAULT";
}

/** Sets (or clears) the reading attributes on <html> and remembers them on this device. */
export function applyReading(size: TextSize, font: ReadingFont) {
  const root = document.documentElement;
  const s = textSizeAttr(size);
  const f = readingFontAttr(font);
  if (s) root.dataset.textSize = s;
  else delete root.dataset.textSize;
  if (f) root.dataset.readingFont = f;
  else delete root.dataset.readingFont;
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size);
    localStorage.setItem(READING_FONT_STORAGE_KEY, font);
  } catch {
    // Private mode: applies until reload.
  }
}

/** Inline script for <head>: the stored reading settings, before first paint. */
export const readingBootScript = `try{var s=localStorage.getItem("${TEXT_SIZE_STORAGE_KEY}");if(s==="LARGE"||s==="LARGER"){document.documentElement.dataset.textSize=s.toLowerCase()}if(localStorage.getItem("${READING_FONT_STORAGE_KEY}")==="DYSLEXIA"){document.documentElement.dataset.readingFont="dyslexia"}}catch(e){}`;
