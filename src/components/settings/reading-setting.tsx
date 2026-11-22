"use client";

/**
 * Settings › Reading (#216, accessibility): text size and a
 * dyslexia-friendly font. Changes apply at once and are kept on this
 * device until A's preferences can store them (src/lib/ui-a11y.ts).
 */

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  READING_FONT_STORAGE_KEY, TEXT_SIZES, TEXT_SIZE_LABEL, TEXT_SIZE_STORAGE_KEY, applyReading, readReadingFont, readTextSize,
  type ReadingFont, type TextSize,
} from "@/lib/ui-a11y";
import { cn } from "@/lib/utils";

/** Sample size of each choice, relative to the default 14 px copy. */
const SAMPLE: Record<TextSize, string> = { DEFAULT: "text-sm", LARGE: "text-base", LARGER: "text-lg" };

export function ReadingSetting() {
  const [size, setSize] = React.useState<TextSize>("DEFAULT");
  const [font, setFont] = React.useState<ReadingFont>("DEFAULT");
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    try {
      setSize(readTextSize(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)));
      setFont(readReadingFont(localStorage.getItem(READING_FONT_STORAGE_KEY)));
    } catch {
      // No storage: the defaults.
    }
  }, []);

  const pickSize = (next: TextSize) => {
    setSize(next);
    applyReading(next, font);
  };
  const pickFont = (on: boolean) => {
    const next: ReadingFont = on ? "DYSLEXIA" : "DEFAULT";
    setFont(next);
    applyReading(size, next);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + TEXT_SIZES.length) % TEXT_SIZES.length;
    pickSize(TEXT_SIZES[n]);
    refs.current[n]?.focus();
  };

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-foreground text-sm font-medium">Reading</h2>
        <p className="text-muted-foreground text-xs">Saved on this device. Works with every theme.</p>
      </div>

      <div>
        <p id="text-size-label" className="text-foreground text-sm">
          Text size
        </p>
        <div role="radiogroup" aria-labelledby="text-size-label" className="mt-2 grid grid-cols-3 gap-2">
          {TEXT_SIZES.map((s, i) => {
            const on = size === s;
            return (
              <button
                key={s}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => pickSize(s)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "focus-visible:ring-ring flex flex-col items-center gap-1 rounded-lg border px-2 py-3 outline-none focus-visible:ring-2",
                  on ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
                )}
              >
                <span aria-hidden className={cn("text-foreground font-semibold", SAMPLE[s])}>
                  Aa
                </span>
                <span className="text-muted-foreground text-xs">{TEXT_SIZE_LABEL[s]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <label htmlFor="reading-font" className="min-w-0">
          <span className="text-foreground block text-sm">Easier-to-read font</span>
          <span className="text-muted-foreground block text-xs">
            Lexend, with more space between letters, words and lines. Can help readers with dyslexia.
          </span>
        </label>
        <Switch id="reading-font" checked={font === "DYSLEXIA"} onCheckedChange={pickFont} />
      </div>
    </Card>
  );
}
