"use client";

/**
 * A graph in rich content: the figure, its key, and the Mafs drawing loaded
 * in the browser only. Before it loads (and in the server HTML) the figure
 * shows the graph's summary, so the page never jumps and screen readers get
 * the description either way. Used by renderRichContent and the editor.
 */

import * as React from "react";
import dynamic from "next/dynamic";

import { graphSummary, type GraphSpec } from "@/lib/content/graph-spec";
import { cn } from "@/lib/utils";

const GraphMafs = dynamic(() => import("./graph-mafs"), {
  ssr: false,
  loading: () => <div className="bg-muted/40 h-full w-full animate-pulse rounded-md" />,
});

// The same hues as graph.css (loaded with Mafs); the hex is the light value until it loads.
const SWATCH: Record<string, string> = {
  blue: "var(--mafs-blue, #2563eb)",
  red: "var(--mafs-red, #c53030)",
  green: "var(--mafs-green, #0f7b6c)",
  orange: "var(--mafs-orange, #8a6116)",
  violet: "var(--mafs-violet, #7c3aed)",
};

export function GraphFigure({ spec, height = 320, className }: { spec: GraphSpec; height?: number; className?: string }) {
  const summary = graphSummary(spec);
  const keyed = spec.items.filter((it) => it.kind === "function");
  return (
    <figure data-type="graph" className={cn("nexa-graph my-4", className)}>
      <div role="img" aria-label={`Graph: ${summary}`} className="overflow-hidden rounded-md border" style={{ height }}>
        <GraphMafs spec={spec} height={height} />
      </div>
      {keyed.length > 0 || spec.description ? (
        <figcaption className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {keyed.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: SWATCH[it.color] }} />
              <span className="text-foreground font-mono">
                {it.label ? `${it.label}: ` : ""}y = {it.expr}
              </span>
            </span>
          ))}
          {spec.description ? <span>{spec.description}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
