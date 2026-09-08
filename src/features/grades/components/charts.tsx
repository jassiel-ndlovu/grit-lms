/**
 * Hand-rolled SVG chart primitives.
 *
 * No external chart library — this avoids adding recharts/chart.js to the
 * bundle for what are, in practice, four small chart types. All charts:
 *   - Use the palette CSS vars (--brand-terracotta, --brand-slate, etc.).
 *   - Are responsive: parent controls width, chart auto-fills via viewBox.
 *   - Are readable at small sizes: axes are minimal, labels are terse.
 *
 * Exports: LineChart, BarChart, DonutChart, Histogram.
 * All are Client Components (they render interactive tooltips on hover).
 */

"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* LineChart — score over time                                                */
/* ------------------------------------------------------------------------- */

export interface LinePoint {
  x: number; // timestamp ms
  y: number; // 0-100 percentage
  label?: string;
}

export interface LineSeries {
  name: string;
  color?: string; // any CSS color; defaults cycle through the palette
  points: LinePoint[];
}

const PALETTE = [
  "var(--brand-terracotta)",
  "var(--brand-slate)",
  "oklch(0.68 0.13 85)", // warm gold
  "oklch(0.60 0.08 155)", // sage
  "oklch(0.55 0.11 260)", // dusk blue
];

function niceExtent(values: number[], fallback: [number, number]): [number, number] {
  if (values.length === 0) return fallback;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [Math.max(0, min - 5), max + 5];
  return [min, max];
}

const monthDayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export function LineChart({
  series,
  height = 200,
  className,
}: {
  series: LineSeries[];
  height?: number;
  className?: string;
}) {
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 28, left: 32 };

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const [xMin, xMax] = niceExtent(allX, [Date.now() - 1, Date.now()]);
  const yMin = 0;
  const yMax = 100;

  function xScale(x: number) {
    if (xMax === xMin) return padding.left + (width - padding.left - padding.right) / 2;
    return (
      padding.left +
      ((x - xMin) / (xMax - xMin)) * (width - padding.left - padding.right)
    );
  }
  function yScale(y: number) {
    return (
      height -
      padding.bottom -
      ((y - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom)
    );
  }

  const gridY = [0, 25, 50, 75, 100];

  if (series.every((s) => s.points.length === 0)) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-md border border-dashed p-6 text-sm",
          className,
        )}
        style={{ height }}
      >
        No grades yet — this chart will populate as grades come in.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {gridY.map((g) => (
          <g key={g}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(g)}
              y2={yScale(g)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={padding.left - 6}
              y={yScale(g) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {g}%
            </text>
          </g>
        ))}

        {xMin !== xMax &&
          [xMin, (xMin + xMax) / 2, xMax].map((tx, i) => (
            <text
              key={i}
              x={xScale(tx)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {monthDayFmt.format(new Date(tx))}
            </text>
          ))}

        {series.map((s, si) => {
          const color = s.color ?? PALETTE[si % PALETTE.length];
          const pts = [...s.points].sort((a, b) => a.x - b.x);
          if (pts.length === 0) return null;
          const path = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.x)},${yScale(p.y)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={xScale(p.x)}
                  cy={yScale(p.y)}
                  r={3}
                  fill={color}
                >
                  <title>
                    {s.name}
                    {p.label ? ` — ${p.label}` : ""}: {Math.round(p.y)}%
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {series.map((s, si) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ background: s.color ?? PALETTE[si % PALETTE.length] }}
              />
              <span className="text-muted-foreground">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* BarChart — average per category                                            */
/* ------------------------------------------------------------------------- */

export interface BarDatum {
  label: string;
  value: number; // 0-100 percentage
  meta?: string;
}

export function BarChart({
  data,
  height = 220,
  className,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
}) {
  const width = 640;
  const padding = { top: 12, right: 16, bottom: 40, left: 32 };

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-md border border-dashed p-6 text-sm",
          className,
        )}
        style={{ height }}
      >
        No data.
      </div>
    );
  }

  const yMax = 100;
  const barWidth =
    (width - padding.left - padding.right) / data.length - 8;

  function yScale(v: number) {
    return (
      height -
      padding.bottom -
      (v / yMax) * (height - padding.top - padding.bottom)
    );
  }

  const gridY = [0, 50, 100];

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {gridY.map((g) => (
          <g key={g}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(g)}
              y2={yScale(g)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={padding.left - 6}
              y={yScale(g) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {g}%
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x =
            padding.left +
            (i * (width - padding.left - padding.right)) / data.length +
            4;
          const y = yScale(d.value);
          const h = height - padding.bottom - y;
          const label = d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                fill="var(--brand-terracotta)"
                rx={4}
                opacity={0.9}
              >
                <title>
                  {d.label}: {Math.round(d.value)}%
                  {d.meta ? ` — ${d.meta}` : ""}
                </title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium"
              >
                {Math.round(d.value)}%
              </text>
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* DonutChart — proportion split                                              */
/* ------------------------------------------------------------------------- */

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  slices,
  size = 180,
  centerLabel,
  centerValue,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 6;
  const inner = radius * 0.62;
  const cx = size / 2;
  const cy = size / 2;

  if (total <= 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-md border border-dashed text-sm",
          className,
        )}
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }

  let cursor = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const angle = (s.value / total) * Math.PI * 2;
    const x1 = cx + radius * Math.cos(cursor);
    const y1 = cy + radius * Math.sin(cursor);
    const x2 = cx + radius * Math.cos(cursor + angle);
    const y2 = cy + radius * Math.sin(cursor + angle);
    const xi1 = cx + inner * Math.cos(cursor + angle);
    const yi1 = cy + inner * Math.sin(cursor + angle);
    const xi2 = cx + inner * Math.cos(cursor);
    const yi2 = cy + inner * Math.sin(cursor);
    const large = angle > Math.PI ? 1 : 0;
    const path = [
      `M${x1},${y1}`,
      `A${radius},${radius} 0 ${large} 1 ${x2},${y2}`,
      `L${xi1},${yi1}`,
      `A${inner},${inner} 0 ${large} 0 ${xi2},${yi2}`,
      "Z",
    ].join(" ");
    cursor += angle;
    return {
      d: path,
      color: s.color ?? PALETTE[i % PALETTE.length],
      label: s.label,
      value: s.value,
    };
  });

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color}>
            <title>
              {p.label}: {Math.round((p.value / total) * 100)}%
            </title>
          </path>
        ))}
        {(centerLabel || centerValue) && (
          <>
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-foreground text-lg font-semibold"
            >
              {centerValue}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] uppercase tracking-wide"
            >
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <ul className="space-y-1 text-xs">
        {paths.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">
              {p.label}{" "}
              <span className="text-foreground font-medium">
                {Math.round((p.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Histogram — distribution of scores                                         */
/* ------------------------------------------------------------------------- */

export interface HistogramProps {
  /** Raw values in 0-100 range. */
  values: number[];
  /** Number of bins; default 10 (0-9, 10-19, …, 90-100). */
  bins?: number;
  height?: number;
  className?: string;
}

export function Histogram({
  values,
  bins = 10,
  height = 200,
  className,
}: HistogramProps) {
  const width = 640;
  const padding = { top: 12, right: 16, bottom: 32, left: 32 };

  if (values.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-md border border-dashed p-6 text-sm",
          className,
        )}
        style={{ height }}
      >
        No grades to distribute yet.
      </div>
    );
  }

  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const clamped = Math.max(0, Math.min(100, v));
    const idx = Math.min(bins - 1, Math.floor((clamped / 100) * bins));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);
  const barWidth =
    (width - padding.left - padding.right) / bins - 4;

  function yScale(v: number) {
    return (
      height -
      padding.bottom -
      (v / maxCount) * (height - padding.top - padding.bottom)
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {counts.map((c, i) => {
          const x =
            padding.left +
            (i * (width - padding.left - padding.right)) / bins +
            2;
          const y = yScale(c);
          const h = height - padding.bottom - y;
          const binStart = Math.round((i * 100) / bins);
          const binEnd = Math.round(((i + 1) * 100) / bins);
          const isTop = binStart >= 80;
          const isBottom = binEnd <= 50;
          const color = isTop
            ? "oklch(0.60 0.08 155)" // sage — top of class
            : isBottom
              ? "var(--destructive)"
              : "var(--brand-terracotta)";
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                fill={color}
                rx={3}
                opacity={0.85}
              >
                <title>
                  {binStart}-{binEnd}%: {c} {c === 1 ? "student" : "students"}
                </title>
              </rect>
              {c > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 3}
                  textAnchor="middle"
                  className="fill-foreground text-[9px] font-medium"
                >
                  {c}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 12}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {binStart}
              </text>
            </g>
          );
        })}
        <text
          x={width - padding.right}
          y={height - padding.bottom + 12}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          100
        </text>
      </svg>
    </div>
  );
}
