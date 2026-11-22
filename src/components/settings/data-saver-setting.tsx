"use client";

/**
 * Settings › Data saver (#216, low-data mode). Per device: it's about this
 * phone's data plan, not the account. Automatic follows the browser's own
 * data saver (the Save-Data hint). Applies at once; see lib/data-saver.ts.
 */

import * as React from "react";

import { useDataSaver } from "@/components/data-saver";
import { Card } from "@/components/ui/card";
import { DATA_SAVER_CHOICES, type DataSaverChoice } from "@/lib/data-saver";
import { cn } from "@/lib/utils";

const LABEL: Record<DataSaverChoice, string> = { auto: "Automatic", on: "On", off: "Off" };

export function DataSaverSetting() {
  const { on, choice, hint, setChoice } = useDataSaver();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + DATA_SAVER_CHOICES.length) % DATA_SAVER_CHOICES.length;
    setChoice(DATA_SAVER_CHOICES[next]);
    refs.current[next]?.focus();
  };

  return (
    <Card className="space-y-3 p-6">
      <div>
        <h2 id="data-saver-label" className="text-foreground text-sm font-medium">
          Data saver
        </h2>
        <p className="text-muted-foreground text-xs">
          For mobile data. Lesson pictures and videos load only when you tap them, and course cover photos are left out. This
          device only.
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="data-saver-label" className="grid grid-cols-3 gap-2">
        {DATA_SAVER_CHOICES.map((c, i) => {
          const picked = c === choice;
          return (
            <button
              key={c}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={picked}
              tabIndex={picked ? 0 : -1}
              onClick={() => setChoice(c)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "focus-visible:ring-ring rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2",
                picked ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
              )}
            >
              {LABEL[c]}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {choice === "auto"
          ? hint
            ? "Your browser's data saver is on, so this is on."
            : "On when your browser's or phone's data saver is on. It's off now."
          : on
            ? "On."
            : "Off."}
      </p>
    </Card>
  );
}
