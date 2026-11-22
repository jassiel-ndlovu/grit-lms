"use client";

/**
 * Settings › Reading (#216, accessibility): text size and a
 * dyslexia-friendly font. Changes apply at once and save to the account
 * (updateOwnPreferences), so they follow the user to every device.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateOwnPreferences } from "@/features/users/actions";
import {
  READING_FONT_STORAGE_KEY, TEXT_SIZES, TEXT_SIZE_LABEL, TEXT_SIZE_STORAGE_KEY, applyReading, effectiveReading,
  type ReadingFont, type TextSize,
} from "@/lib/ui-a11y";
import { cn } from "@/lib/utils";

/** Sample size of each choice, relative to the default 14 px copy. */
const SAMPLE: Record<TextSize, string> = { DEFAULT: "text-sm", LARGE: "text-base", LARGER: "text-lg" };

export function ReadingSetting({ initial }: { initial: { textSize: TextSize; readingFont: ReadingFont } }) {
  const router = useRouter();
  const [size, setSize] = React.useState<TextSize>(initial.textSize);
  const [font, setFont] = React.useState<ReadingFont>(initial.readingFont);
  const [, start] = React.useTransition();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  // A choice kept on this device (before the account could store it) shows
  // while the account is at the defaults; the next pick saves it.
  React.useEffect(() => {
    try {
      const r = effectiveReading(initial, {
        textSize: localStorage.getItem(TEXT_SIZE_STORAGE_KEY),
        readingFont: localStorage.getItem(READING_FONT_STORAGE_KEY),
      });
      setSize(r.textSize);
      setFont(r.readingFont);
    } catch {
      // No storage: the account's settings.
    }
  }, [initial]);

  const save = (nextSize: TextSize, nextFont: ReadingFont) => {
    const before = { size, font };
    setSize(nextSize);
    setFont(nextFont);
    applyReading(nextSize, nextFont);
    start(async () => {
      const res = await updateOwnPreferences({ textSize: nextSize, readingFont: nextFont });
      if (res?.data) {
        router.refresh();
        return;
      }
      setSize(before.size);
      setFont(before.font);
      applyReading(before.size, before.font);
      toast.error("Couldn't save your reading settings. Try again.");
    });
  };
  const pickSize = (next: TextSize) => {
    if (next !== size) save(next, font);
  };
  const pickFont = (on: boolean) => save(size, on ? "DYSLEXIA" : "DEFAULT");
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
        <p className="text-muted-foreground text-xs">Saved to your account, so it follows you to every device. Works with every theme.</p>
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
