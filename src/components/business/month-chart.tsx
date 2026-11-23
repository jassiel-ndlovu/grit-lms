"use client";

/**
 * One measure over six months: one series, so one hue and no legend. The
 * readout above shows the month under the pointer, and rests on the
 * latest. Screen readers get the table under "Show as a table"; the
 * columns are one labelled image. Same marks as UsageChart.
 */

import * as React from "react";

export interface MonthPoint {
  month: string;
  /** "Jun" under the column, "June 2026" in the readout. */
  short: string;
  long: string;
  value: number;
  /** The value in words, e.g. "R4 200" or "3 students". */
  text: string;
}

export function MonthChart({
  points,
  summary,
  measure,
  max: maxText,
}: {
  points: MonthPoint[];
  /** One sentence for the image's label. */
  summary: string;
  /** The table's value column. */
  measure: string;
  /** The tallest column's value in words. */
  max: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const empty = points.every((p) => p.value <= 0);
  const shown = points[hover ?? points.length - 1];

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs tabular-nums" aria-hidden>
        <span className="text-foreground font-medium">{shown.long}</span> · {shown.text}
        {hover === null || hover === points.length - 1 ? " so far" : ""}
      </p>
      <div role="img" aria-label={summary} className="relative">
        {empty ? null : (
          <div aria-hidden className="border-border/60 text-muted-foreground pointer-events-none absolute inset-x-0 top-0 border-t text-[10px] leading-none">
            <span className="bg-background relative -top-1.5 pr-1 tabular-nums">{maxText}</span>
          </div>
        )}
        <div className="border-border flex h-32 items-end gap-0.5 border-b pt-2" onMouseLeave={() => setHover(null)}>
          {points.map((p, i) => (
            // The hit area is the whole column, wider and taller than the bar.
            <div
              key={p.month}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            >
              <div
                className={`w-full max-w-8 rounded-t-[4px] ${hover === i ? "bg-foreground" : "bg-primary"}`}
                style={{ height: p.value <= 0 ? 0 : `max(2px, ${(p.value / max) * 100}%)` }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="text-muted-foreground mt-1 flex gap-0.5 text-[11px]">
          {points.map((p) => (
            <span key={p.month} className="min-w-0 flex-1 text-center">
              {p.short}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">Show as a table</summary>
        <table className="mt-2 w-full max-w-xs text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Month
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {measure}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {points.map((p) => (
              <tr key={p.month}>
                <td className="py-1 pr-3">{p.long}</td>
                <td className="py-1 text-right tabular-nums">{p.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
