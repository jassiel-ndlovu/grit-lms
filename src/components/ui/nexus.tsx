import * as React from "react";

import { cornerFigure, hubFigure, type Figure, type Tone } from "@/lib/nexus";
import { cn } from "@/lib/utils";

/**
 * Nexa's geometry (src/lib/nexus.ts, styled by src/app/nexus.css): circles
 * joined by line segments. Decoration only, and sparing: one figure to a
 * panel, in its top right corner, on a few panels of a page.
 */
function Shape({ figure: f }: { figure: Figure }) {
  return (
    <>
      {f.lines.map((l, i) => (
        <line key={i} {...l} />
      ))}
      <circle cx={f.hub.x} cy={f.hub.y} r={f.hub.r} data-hue={f.hub.hue} />
      {f.nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} data-hue={n.hue} />
      ))}
    </>
  );
}

/** The corner figure. Its parent is `relative isolate`; text stays clear of the corner. */
export function NexusCorner({ seed, size = 88, className }: { seed: string; size?: number; className?: string }) {
  return (
    <svg
      data-slot="nexus"
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={cn("absolute top-0 right-0 -z-10", className)}
    >
      <Shape figure={cornerFigure(seed)} />
    </svg>
  );
}

type TonePanelProps = React.HTMLAttributes<HTMLElement> & {
  tone?: Tone;
  /** Seed for the corner figure; leave out for none. */
  nexus?: string;
  as?: "div" | "section" | "article" | "aside" | "p";
};

/**
 * A panel whose colour says how much it matters (TONES). The tone is never
 * the only signal: the panel's words say it too.
 */
export function TonePanel({ tone = "neutral", nexus, as: As = "div", className, children, ...props }: TonePanelProps) {
  return (
    <As data-slot="tone-panel" data-tone={tone} className={cn("text-card-foreground rounded-lg p-4", className)} {...props}>
      {nexus ? <NexusCorner seed={nexus} /> : null}
      {children}
    </As>
  );
}

const LOADER = hubFigure(6, 48);

/** The loader: the same figure, its points lighting up in turn. */
export function NexusLoader({ size = 32, label = "Loading", className }: {
  size?: number;
  /** Null where words beside it already say so. */
  label?: string | null;
  className?: string;
}) {
  return (
    <span role={label ? "status" : undefined} className={cn("text-primary inline-flex", className)}>
      <svg data-slot="nexus-loader" aria-hidden focusable="false" width={size} height={size} viewBox="0 0 48 48">
        {LOADER.lines.map((l, i) => (
          <line key={i} {...l} />
        ))}
        <circle cx={LOADER.hub.x} cy={LOADER.hub.y} r={LOADER.hub.r} />
        {LOADER.nodes.map((n, i) => (
          <circle key={i} data-node="" cx={n.x} cy={n.y} r={n.r} style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }} />
        ))}
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
