/**
 * Stock course covers (owner decision 2026-11-20, finding F11).
 *
 * A course cover stays required, but a tutor no longer has to upload one:
 * they can pick a stock cover, and if they pick nothing the form picks one
 * from the course name. Rows saved before this (seeded Preview courses have
 * `imageUrl: ""`) display the same name-based cover until they are saved.
 *
 * The SVGs live in public/covers/ and are original artwork in the brand
 * palette. Pure: checked by scripts/check-stock-covers.ts.
 */

import { z } from "zod";

export const STOCK_COVERS = [
  { id: "horizon", label: "Horizon", src: "/covers/horizon.svg" },
  { id: "grid", label: "Shapes", src: "/covers/grid.svg" },
  { id: "waves", label: "Waves", src: "/covers/waves.svg" },
  { id: "arcs", label: "Arcs", src: "/covers/arcs.svg" },
  { id: "facets", label: "Facets", src: "/covers/facets.svg" },
  { id: "orbit", label: "Orbit", src: "/covers/orbit.svg" },
] as const;

export type StockCover = (typeof STOCK_COVERS)[number];
export type StockCoverSrc = StockCover["src"];

const STOCK_SRCS = STOCK_COVERS.map((c) => c.src) as [StockCoverSrc, ...StockCoverSrc[]];

/** True for one of the stock cover paths, exactly as stored. */
export function isStockCover(url: string | null | undefined): url is StockCoverSrc {
  return typeof url === "string" && (STOCK_SRCS as readonly string[]).includes(url);
}

/** The stock cover with this path, or null. */
export function findStockCover(url: string | null | undefined): StockCover | null {
  return STOCK_COVERS.find((c) => c.src === url) ?? null;
}

/**
 * FNV-1a over the name, trimmed and lowercased, so "Algebra 1" and
 * " algebra 1 " get the same cover. Stable across runtimes.
 */
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The stock cover used when nothing is picked: deterministic from the name. */
export function stockCoverFor(name: string): StockCover {
  return STOCK_COVERS[hashName(name) % STOCK_COVERS.length];
}

/**
 * What a course may store as its cover: an absolute URL (an upload) or one
 * of the stock paths. Any other relative string is rejected.
 */
const COVER_ERROR = "Upload a cover or pick one of the stock covers";
export const CourseCoverSchema = z.union(
  [z.string().url({ error: COVER_ERROR }), z.enum(STOCK_SRCS, { error: COVER_ERROR })],
  { error: COVER_ERROR },
);

/** True when the value is a cover the schema accepts (an upload URL or a stock path). */
export function isValidCover(url: string | null | undefined): url is string {
  return CourseCoverSchema.safeParse(url).success;
}

/**
 * The cover to display: the saved one, or the name's stock cover when it is
 * empty or not a cover the schema accepts (old rows held bare file names).
 */
export function courseCoverSrc(course: { name: string; imageUrl: string | null | undefined }): string {
  return isValidCover(course.imageUrl) ? course.imageUrl : stockCoverFor(course.name).src;
}
