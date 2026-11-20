"use client";

/**
 * The Mafs drawing of a GraphSpec. Loaded lazily by GraphFigure, so pages
 * without a graph never fetch Mafs. Static: no pan or zoom, since a lesson
 * graph is a picture the tutor framed.
 */

import * as React from "react";
import { Coordinates, Line, Mafs, Plot, Point, Text, Theme } from "mafs";
import "mafs/core.css";

import { compileExpression } from "@/lib/content/expr";
import type { GraphColor, GraphSpec } from "@/lib/content/graph-spec";

import "./graph.css";

export const GRAPH_THEME: Record<GraphColor, string> = {
  blue: Theme.blue,
  red: Theme.red,
  green: Theme.green,
  orange: Theme.orange,
  violet: Theme.violet,
};

/** Grid lines every 1, 2, 5, 10… so a wide range doesn't become a solid mesh. */
function step(span: number): number {
  const raw = span / 10;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
}

/** Put a label on the side with room, so labels near the right or top edge stay inside. */
function attachFor(spec: GraphSpec, x: number, y: number): "ne" | "nw" | "se" | "sw" {
  const right = x > spec.x[0] + (spec.x[1] - spec.x[0]) * 0.6;
  const top = y > spec.y[0] + (spec.y[1] - spec.y[0]) * 0.85;
  return `${top ? "s" : "n"}${right ? "w" : "e"}` as "ne" | "nw" | "se" | "sw";
}

export default function GraphMafs({ spec, height = 320 }: { spec: GraphSpec; height?: number }) {
  const fns = React.useMemo(
    () =>
      spec.items.map((it) => {
        if (it.kind !== "function") return null;
        const c = compileExpression(it.expr);
        return "fn" in c ? c.fn : null;
      }),
    [spec.items],
  );
  const xs = step(spec.x[1] - spec.x[0]);
  const ys = step(spec.y[1] - spec.y[0]);
  return (
    <Mafs height={height} pan={false} zoom={false} viewBox={{ x: spec.x, y: spec.y, padding: 0 }} preserveAspectRatio={false}>
      {spec.grid ? (
        <Coordinates.Cartesian xAxis={{ lines: xs, labels: (n) => String(n) }} yAxis={{ lines: ys, labels: (n) => String(n) }} subdivisions={false} />
      ) : (
        <Coordinates.Cartesian xAxis={{ lines: false, labels: (n) => String(n) }} yAxis={{ lines: false, labels: (n) => String(n) }} subdivisions={false} />
      )}
      {spec.items.map((it, i) => {
        const color = GRAPH_THEME[it.color];
        if (it.kind === "function") {
          const fn = fns[i];
          return fn ? <Plot.OfX key={i} y={fn} color={color} /> : null;
        }
        if (it.kind === "point") {
          return (
            <React.Fragment key={i}>
              <Point x={it.x} y={it.y} color={color} />
              {it.label ? (
                <Text x={it.x} y={it.y} attach={attachFor(spec, it.x, it.y)} attachDistance={12} size={14} color={color}>
                  {it.label}
                </Text>
              ) : null}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={i}>
            <Line.Segment point1={it.from} point2={it.to} color={color} />
            {it.label ? (
              <Text x={(it.from[0] + it.to[0]) / 2} y={(it.from[1] + it.to[1]) / 2} attach="n" attachDistance={12} size={14} color={color}>
                {it.label}
              </Text>
            ) : null}
          </React.Fragment>
        );
      })}
    </Mafs>
  );
}
