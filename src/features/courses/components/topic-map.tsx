import Link from "next/link";

import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { hubFigure } from "@/lib/nexus";
import { cn } from "@/lib/utils";

import { topicLine, topicTrail, type TopicNode, type TopicState } from "../lib/topic-map";

/**
 * The topic map: a trail of topics joined by lines, then each topic as a
 * tile. The trail is a picture of the list below it, so it is hidden from
 * screen readers; the tiles say everything in words.
 */
export function TopicMap({ nodes, hrefs = {}, labels }: {
  nodes: TopicNode[];
  /** Where a tile goes: the learner's next lesson on the topic. */
  hrefs?: Record<string, string | undefined>;
  labels: Record<TopicState, string>;
}) {
  return (
    <div className="space-y-5">
      <Trail nodes={nodes} />
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((n) => {
          const href = hrefs[n.code];
          const body = (
            <>
              <TopicFigure node={n} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="text-foreground block text-sm font-medium [overflow-wrap:anywhere]">{n.title}</span>
                <span className="text-muted-foreground block text-xs">{topicLine(n)}</span>
                <StatusChip tone={TONE[n.state]}>{labels[n.state]}</StatusChip>
              </span>
            </>
          );
          const cls = "flex h-full items-center gap-4 rounded-lg p-4";
          return (
            <li key={n.code}>
              {href ? (
                <Link href={href} data-slot="tone-panel" data-tone={PANEL[n.state]} className={cn(cls, "focus-visible:ring-ring outline-none hover:shadow-sm focus-visible:ring-2")}>
                  {body}
                </Link>
              ) : (
                <div data-slot="tone-panel" data-tone={PANEL[n.state]} className={cls}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TONE: Record<TopicState, StatusTone> = { none: "neutral", started: "info", passed: "success" };
const PANEL = { none: "neutral", started: "accent", passed: "success" } as const;

const FIGURE = hubFigure(3, 56, { hub: 0.19, node: 0.1 });

/** One topic as a nexus: lessons (top), questions (right), passed (left). */
export function TopicFigure({ node, size = 56 }: { node: TopicNode; size?: number }) {
  return (
    <svg data-slot="topic-figure" data-state={node.state} aria-hidden focusable="false" width={size} height={size} viewBox="0 0 56 56" className="shrink-0">
      {FIGURE.lines.map((l, i) => (
        <line key={i} {...l} data-lit={node.steps[i] || undefined} />
      ))}
      <circle cx={FIGURE.hub.x} cy={FIGURE.hub.y} r={FIGURE.hub.r} data-hub="" />
      {FIGURE.nodes.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} data-lit={node.steps[i] || undefined} />
      ))}
    </svg>
  );
}

function Trail({ nodes }: { nodes: TopicNode[] }) {
  const { hubs, width, height } = topicTrail(nodes.map((n) => n.code));
  return (
    <svg data-slot="topic-trail" aria-hidden focusable="false" viewBox={`0 0 ${width} ${height}`} className="hidden max-h-28 w-full sm:block" preserveAspectRatio="xMidYMid meet">
      {hubs.slice(1).map((h, i) => {
        const a = hubs[i];
        const d = Math.hypot(h.x - a.x, h.y - a.y);
        const ux = (h.x - a.x) / d;
        const uy = (h.y - a.y) / d;
        return <line key={i} x1={a.x + ux * a.r} y1={a.y + uy * a.r} x2={h.x - ux * h.r} y2={h.y - uy * h.r} data-lit={(nodes[i].state === "passed" && nodes[i + 1].state !== "none") || undefined} />;
      })}
      {hubs.map((h, i) => (
        <g key={nodes[i].code} data-state={nodes[i].state}>
          <circle cx={h.x} cy={h.y} r={h.r} data-hub="" />
          {nodes[i].steps.map((lit, k) => {
            const t = ((-90 + 120 * k) * Math.PI) / 180;
            const x = Math.round((h.x + Math.cos(t) * 22) * 100) / 100;
            const y = Math.round((h.y + Math.sin(t) * 22) * 100) / 100;
            return lit ? <circle key={k} cx={x} cy={y} r={3} data-lit="" /> : null;
          })}
        </g>
      ))}
    </svg>
  );
}
