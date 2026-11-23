/**
 * Stock course covers (owner decision 2026-11-20, finding F11).
 *
 * A course cover stays required, but a tutor no longer has to upload one:
 * they can pick a stock cover, and if they pick nothing the form picks one
 * from the course name. Rows saved before this (seeded Preview courses have
 * `imageUrl: ""`) display the same name-based cover until they are saved.
 *
 * The drawings live in public/covers/ and are original artwork in the brand
 * palette. The photos (owner's request, 23 Nov) live in
 * public/images/stock/ with their credits; a course whose name says its
 * subject gets that subject's photo. Pure: checked by
 * scripts/check-stock-covers.ts.
 */

import { z } from "zod";

export const PHOTO_COVERS = [
  { id: "maths", label: "Maths", src: "/images/stock/cover-maths.webp" },
  { id: "science", label: "Science", src: "/images/stock/cover-science.webp" },
  { id: "life", label: "Life sciences", src: "/images/stock/cover-life.webp" },
  { id: "accounting", label: "Accounting", src: "/images/stock/cover-accounting.webp" },
  { id: "languages", label: "Languages", src: "/images/stock/cover-languages.webp" },
  { id: "computing", label: "Computing", src: "/images/stock/cover-computing.webp" },
] as const;

export const ART_COVERS = [
  { id: "horizon", label: "Horizon", src: "/covers/horizon.svg" },
  { id: "grid", label: "Shapes", src: "/covers/grid.svg" },
  { id: "waves", label: "Waves", src: "/covers/waves.svg" },
  { id: "arcs", label: "Arcs", src: "/covers/arcs.svg" },
  { id: "facets", label: "Facets", src: "/covers/facets.svg" },
  { id: "orbit", label: "Orbit", src: "/covers/orbit.svg" },
] as const;

export const STOCK_COVERS = [...PHOTO_COVERS, ...ART_COVERS] as const;

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

/**
 * The subject a course name points at, by whole words. First match wins, so
 * "Life Sciences" is tried before "Science". Afrikaans subject names count.
 */
const SUBJECT_WORDS: { id: (typeof PHOTO_COVERS)[number]["id"]; words: RegExp }[] = [
  { id: "life", words: /\b(life sciences?|biology|lewenswetenskappe)\b/ },
  { id: "maths", words: /\b(math|maths|mathematics|mathematical|wiskunde|algebra|geometry|calculus|trigonometry|statistics|numeracy)\b/ },
  { id: "accounting", words: /\b(accounting|rekeningkunde|economics|ekonomie|business studies|bookkeeping)\b/ },
  { id: "computing", words: /\b(computers?|computing|coding|programming|python|java|javascript|information technology)\b/ },
  { id: "science", words: /\b(sciences?|physics|chemistry|fisiese wetenskappe|natuurwetenskappe)\b/ },
  { id: "languages", words: /\b(english|afrikaans|isizulu|zulu|isixhosa|xhosa|sesotho|setswana|sepedi|xitsonga|tshivenda|siswati|isindebele|french|literature|languages?|reading)\b/ },
];

/** The subject photo for a course name, or null when the name doesn't say. */
export function subjectCoverFor(name: string): StockCover | null {
  const n = name.trim().toLowerCase();
  const id = SUBJECT_WORDS.find((s) => s.words.test(n))?.id;
  return PHOTO_COVERS.find((c) => c.id === id) ?? null;
}

/**
 * The stock cover used when nothing is picked, deterministic from the name:
 * the subject's photo when the name says the subject, else a drawing.
 */
export function stockCoverFor(name: string): StockCover {
  return subjectCoverFor(name) ?? ART_COVERS[hashName(name) % ART_COVERS.length];
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
