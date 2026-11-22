/**
 * Checks the stock course covers (finding F11, owner decision 2026-11-20).
 *
 *   npx tsx scripts/check-stock-covers.ts
 *
 * Pure: no database, no network. Checks that every stock cover has an SVG
 * in public/covers/, that stockCoverFor is deterministic and spreads names
 * over all covers, that courseCoverSrc falls back for empty and invalid
 * values, and that the course schemas accept upload URLs and stock paths
 * but no other relative string. Exits 1 on any failure.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CourseCoverSchema,
  STOCK_COVERS,
  courseCoverSrc,
  findStockCover,
  isStockCover,
  isValidCover,
  stockCoverFor,
} from "../src/features/courses/lib/stock-covers";
import { CreateCourseSchema, UpdateCourseSchema } from "../src/features/courses/schemas";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${g}`);
    console.log(`        want: ${w}`);
  }
}

// --- The list and the files ---------------------------------------------
check("five or six covers", STOCK_COVERS.length >= 5 && STOCK_COVERS.length <= 6, true);
check("ids unique", new Set(STOCK_COVERS.map((c) => c.id)).size, STOCK_COVERS.length);
check("labels unique", new Set(STOCK_COVERS.map((c) => c.label)).size, STOCK_COVERS.length);
for (const c of STOCK_COVERS) {
  check(`${c.id}: src is /covers/<id>.svg`, c.src, `/covers/${c.id}.svg`);
  const file = join(process.cwd(), "public", c.src);
  const exists = existsSync(file);
  check(`${c.id}: file exists`, exists, true);
  if (!exists) continue;
  const svg = readFileSync(file, "utf8");
  check(`${c.id}: is a 16:9 svg`, /<svg[^>]*viewBox="0 0 1600 900"/.test(svg), true);
  check(`${c.id}: no scripts, links or embedded images`, /<script|href=|<image|<foreignObject/i.test(svg), false);
}

// --- Picking by name ----------------------------------------------------
check("deterministic", stockCoverFor("Grade 10 Algebra").id, stockCoverFor("Grade 10 Algebra").id);
check("trim and case ignored", stockCoverFor("  grade 10 ALGEBRA ").id, stockCoverFor("Grade 10 Algebra").id);
check("empty name still gets a cover", isStockCover(stockCoverFor("").src), true);
const names = Array.from({ length: 300 }, (_, i) => `Course ${i}`);
const used = new Set(names.map((n) => stockCoverFor(n).id));
check("300 names use every cover", used.size, STOCK_COVERS.length);

// --- Lookups --------------------------------------------------------------
check("isStockCover: stock path", isStockCover("/covers/waves.svg"), true);
check("isStockCover: other path", isStockCover("/covers/nope.svg"), false);
check("isStockCover: empty", isStockCover(""), false);
check("isStockCover: null", isStockCover(null), false);
check("findStockCover", findStockCover("/covers/orbit.svg")?.label, "Orbit");
check("findStockCover: upload", findStockCover("https://x.public.blob.vercel-storage.com/a.png"), null);

// --- Display fallback ---------------------------------------------------
const upload = "https://abc.public.blob.vercel-storage.com/courses/c1/cover.png";
check("display: upload kept", courseCoverSrc({ name: "Maths", imageUrl: upload }), upload);
check("display: stock kept", courseCoverSrc({ name: "Maths", imageUrl: "/covers/arcs.svg" }), "/covers/arcs.svg");
check("display: empty -> name's cover", courseCoverSrc({ name: "Maths", imageUrl: "" }), stockCoverFor("Maths").src);
check("display: null -> name's cover", courseCoverSrc({ name: "Maths", imageUrl: null }), stockCoverFor("Maths").src);
check("display: bare file name -> name's cover", courseCoverSrc({ name: "Maths", imageUrl: "algebra.png" }), stockCoverFor("Maths").src);

// --- Schemas --------------------------------------------------------------
const ok = (v: unknown) => CourseCoverSchema.safeParse(v).success;
check("schema: upload URL", ok(upload), true);
check("schema: every stock path", STOCK_COVERS.every((c) => ok(c.src)), true);
check("schema: empty rejected", ok(""), false);
check("schema: other relative path rejected", ok("/covers/../secret.svg"), false);
check("schema: other public file rejected", ok("/next.svg"), false);
check("schema: bare file name rejected", ok("algebra.png"), false);
check("isValidCover matches schema", isValidCover("/covers/grid.svg") && !isValidCover("x"), true);

const base = { name: "Maths", description: null };
check("create: stock cover", CreateCourseSchema.safeParse({ ...base, imageUrl: "/covers/horizon.svg" }).success, true);
check("create: upload", CreateCourseSchema.safeParse({ ...base, imageUrl: upload }).success, true);
check("create: empty rejected", CreateCourseSchema.safeParse({ ...base, imageUrl: "" }).success, false);
const err = CreateCourseSchema.safeParse({ ...base, imageUrl: "nope" }).error?.issues[0]?.message;
check("create: message is not 'Must be a valid URL'", err, "Upload a cover or pick one of the stock covers");
check("update: stock cover", UpdateCourseSchema.safeParse({ id: "c1", imageUrl: "/covers/facets.svg" }).success, true);
check("update: cover optional", UpdateCourseSchema.safeParse({ id: "c1", name: "Maths" }).success, true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
