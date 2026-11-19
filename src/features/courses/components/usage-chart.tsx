"use client";

/**
 * Daily usage over a billing period: one series, so thin columns in one hue
 * and no legend (the section heading names it). Hovering a day shows its
 * value above the chart; the readout rests on the busiest day. The same
 * numbers are in a table under "Show as a table", which is also what screen
 * readers and keyboard users get; the chart itself is one labelled image.
 */

import * as React from "react";

export type UsageDay = { day: string; label: string; quantity: number };

export function UsageChart({
  days,
  unit,
  summary,
}: {
  days: UsageDay[];
  /** Singular and plural, e.g. ["student", "students"]. */
  unit: readonly [string, string];
  /** One sentence for the image's label, e.g. "Busiest day 3 Dec, 12 students". */
  summary: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.quantity));
  const peak = days.reduce((best, d, i) => (d.quantity > days[best].quantity ? i : best), 0);
  const shown = days[hover ?? peak];
  const words = (n: number) => `${n.toLocaleString("en-ZA")} ${n === 1 ? unit[0] : unit[1]}`;

  if (days.length === 0) return <p className="text-muted-foreground text-sm">No days in this period yet.</p>;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs tabular-nums" aria-hidden>
        <span className="text-foreground font-medium">{shown.label}</span> · {words(shown.quantity)}
        {hover == null && days.length > 1 ? " (busiest day)" : ""}
      </p>
      <div role="img" aria-label={summary} className="relative">
        {/* Recessive scale: the top value on a faint rule, the baseline below. */}
        <div aria-hidden className="border-border/60 text-muted-foreground absolute inset-x-0 top-0 border-t text-[10px] leading-none">
          <span className="bg-background relative -top-1.5 pr-1 tabular-nums">{max.toLocaleString("en-ZA")}</span>
        </div>
        <div className="border-border flex h-24 items-end gap-0.5 border-b pt-2" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            // The hit area is the whole column, wider and taller than the bar.
            <div key={d.day} className="flex h-full min-w-0 flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
              <div
                className={`w-full max-w-3 rounded-t-[4px] ${hover === i ? "bg-foreground" : "bg-primary"}`}
                style={{ height: d.quantity === 0 ? 0 : `max(2px, ${(d.quantity / max) * 100}%)` }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="text-muted-foreground mt-1 flex justify-between text-[10px]">
          <span>{days[0].label}</span>
          {days.length > 1 ? <span>{days[days.length - 1].label}</span> : null}
        </div>
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">Show as a table</summary>
        <table className="mt-2 w-full max-w-xs text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-1 pr-3 font-medium">Day</th>
              <th className="py-1 text-right font-medium">{unit[1][0].toUpperCase() + unit[1].slice(1)}</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {days.map((d) => (
              <tr key={d.day}>
                <td className="py-1 pr-3">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{d.quantity.toLocaleString("en-ZA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
