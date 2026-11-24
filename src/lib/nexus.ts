/**
 * The nexus: Nexa's geometry (owner, 24 Nov). Nexa is the plural of nexus, so
 * the motif is points joined by lines: a hub with line segments out to
 * smaller circles. Pure maths for components/ui/nexus.tsx, checked by
 * scripts/check-nexus.ts.
 *
 * Deterministic: the same seed always draws the same figure, so server and
 * client agree and a page doesn't change between visits.
 */

export type Hue = 1 | 2 | 3;
export type Point = { x: number; y: number; r: number; /** 1 to 3: the theme's strip colour. */ hue: Hue };
export type Line = { x1: number; y1: number; x2: number; y2: number };
export type Figure = { hub: Point; nodes: Point[]; lines: Line[]; size: number };

/** A small, stable random source (mulberry32). */
export function seeded(seed: string): () => number {
  let a = 0x811c9dc5;
  for (const ch of seed) a = Math.imul(a ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points never come closer than this to the edge of the box. */
const MARGIN = 3;

/** Math.cos and friends may differ in the last digits between engines. */
const round = (v: number) => Math.round(v * 100) / 100;

const point = (x: number, y: number, r: number, hue: Hue): Point => ({ x: round(x), y: round(y), r: round(r), hue });

/** From rim to rim, so a line never shows through a circle. */
function edge(a: Point, b: Point): Line {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  return { x1: round(a.x + ux * a.r), y1: round(a.y + uy * a.r), x2: round(b.x - ux * b.r), y2: round(b.y - uy * b.r) };
}

/**
 * For the top right corner of a panel: the hub sits near the corner and its
 * spokes fan out to the left and down, where a panel is usually empty.
 */
export function cornerFigure(seed: string, size = 96): Figure {
  const rnd = seeded(seed);
  const hub = point(size * 0.74, size * 0.26, size * 0.06, 1);
  // From straight left (180 degrees) round to straight down (90), y pointing down.
  const nodes = [172, 140, 106].map((deg, i) => {
    const t = ((deg + (rnd() - 0.5) * 18) * Math.PI) / 180;
    const len = size * [0.56, 0.4, 0.6][i] * (0.82 + rnd() * 0.18);
    const r = size * (0.022 + rnd() * 0.016);
    const clamp = (v: number) => Math.min(size - MARGIN - r, Math.max(MARGIN + r, v));
    return point(clamp(hub.x + Math.cos(t) * len), clamp(hub.y + Math.sin(t) * len), r, (i + 1) as Hue);
  });
  return { hub, nodes, lines: nodes.map((n) => edge(hub, n)), size };
}

/** A hub in the middle with evenly spaced spokes: the loader and the topic map. */
export function hubFigure(count: number, size = 48, opts: { hub?: number; node?: number; start?: number } = {}): Figure {
  const c = size / 2;
  const hub = point(c, c, size * (opts.hub ?? 0.14), 1);
  const nr = size * (opts.node ?? 0.08);
  const ring = c - nr - 1;
  const nodes = Array.from({ length: count }, (_, i) => {
    const t = (((opts.start ?? -90) + (360 / count) * i) * Math.PI) / 180;
    return point(c + Math.cos(t) * ring, c + Math.sin(t) * ring, nr, ((i % 3) + 1) as Hue);
  });
  return { hub, nodes, lines: nodes.map((n) => edge(hub, n)), size };
}

/* ------------------------------------------------------------------------- */
/* Panel tones                                                                */
/* ------------------------------------------------------------------------- */

/** How much a panel matters. `accent` is "look here"; warning and danger need someone. */
export const TONES = ["neutral", "accent", "success", "warning", "danger"] as const;
export type Tone = (typeof TONES)[number];

/** Something with a due time: overdue is danger, within two days a warning. */
export function dueTone(due: Date, now: Date): Tone {
  const hours = (due.getTime() - now.getTime()) / 3_600_000;
  return hours < 0 ? "danger" : hours <= 48 ? "warning" : "neutral";
}
