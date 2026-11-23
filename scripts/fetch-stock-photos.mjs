/**
 * Downloads the stock photos (all Unsplash, free licence), resizes and
 * compresses them to WebP, and writes public/images/stock/CREDITS.md.
 *
 *   node scripts/fetch-stock-photos.mjs          # all
 *   node scripts/fetch-stock-photos.mjs hero     # one, by name
 *
 * The list is the source of truth: add or swap a photo here, run it, and
 * look at the result. Real photos only, never AI-generated; check the
 * photo's page says "Free to use under the Unsplash License" first.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "images", "stock");
const MAX_BYTES = 200 * 1024;

/** name, width, height, Unsplash photo page id, image id, photographer, profile, what it shows, crop focus. */
const PHOTOS = [
  ["hero", 1400, 1050, "qNCXEi8OCwk", "photo-1758525861614-4d3cb34751d8", "Vitaly Gariev", "silverkblack", "A woman helps a girl with her homework", "right"],
  ["tutor", 1000, 750, "fW_Qc_KoSXg", "photo-1628645288866-908f2c43da39", "Helena Lopes", "helenalopesph", "A woman at a table with a laptop and a pen", "centre"],
  ["student", 1000, 750, "T7uknN3RPXQ", "photo-1765650114537-423a387b4520", "FOTOGRAFÍA EDITORIAL", "fotografiaeditorial", "A student with a book and a laptop", "centre"],
  ["parent", 1000, 750, "fjza4oBV8ic", "photo-1573496800440-5c9c48a8d0f0", "Christina @ wocintechchat.com", "wocintechchat", "A woman on a sofa with a laptop", "centre"],
  ["organisation", 1000, 750, "cjGreGYO5Sk", "photo-1653669487177-d7c8e245f0f2", "The Jopwell Collection", "jopwell", "A group at a table with an open book", "centre"],
  ["johannesburg", 1600, 800, "_h-L45TSmGM", "photo-1636706519609-988babca3dd5", "Simon Hurry", "bullterriere", "Johannesburg skyline at golden hour", "centre"],
  ["sign-in", 1000, 1250, "QLSTZdXrBkE", "photo-1716654716572-7b13ad56ba63", "Makmot Robin", "makmot", "A student reading on the floor of a library", "centre"],
  ["join", 1000, 1250, "dPQBwZ6d-NU", "photo-1759852692971-a2abc6799cbd", "Oluwaseyi Akinlolu", "seyilostboy", "A smiling student with a backpack and books", "centre"],
  ["cover-maths", 960, 540, "7RgWuLlea24", "photo-1676302447092-14a103558511", "Antony Hyson Seltran", "hyson", "A pen on a page of maths", "centre"],
  ["cover-science", 960, 540, "6SDyqhHb4rg", "photo-1601961545517-59307b1fbac3", "Girl with red hat", "girlwithredhat", "Test tubes in a beaker", "centre"],
  ["cover-life", 960, 540, "HC4kAQIUrfM", "photo-1714844437236-de8ef1c7286f", "Bioscience Image Library by Fayette Reynolds", "berkshirecommunitycollege", "Plant cells under a microscope", "centre"],
  ["cover-accounting", 960, 540, "JhevWHCbVyw", "photo-1626266061368-46a8f578ddd6", "Towfiqu barbhuiya", "towfiqu999999", "Hands using a calculator at a desk", "centre"],
  ["cover-languages", 960, 540, "ZkR9yT1cR7g", "photo-1585521747230-516376e5a85d", "Priscilla Du Preez", "priscilladupreez", "A stack of old books", "centre"],
  ["cover-computing", 960, 540, "mZnx9429i94", "photo-1619410283995-43d9134e7656", "Juanjo Jaramillo", "juanjodev02", "Code in an editor", "centre"],
];

mkdirSync(OUT, { recursive: true });
const only = process.argv[2];

for (const [name, w, h, , image, , , , position] of PHOTOS) {
  if (only && only !== name) continue;
  const res = await fetch(`https://images.unsplash.com/${image}?w=2000&q=85&fm=jpg`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());
  let quality = 74;
  let out;
  do {
    out = await sharp(src).resize(w, h, { fit: "cover", position }).webp({ quality, effort: 6 }).toBuffer();
    quality -= 6;
  } while (out.length > MAX_BYTES && quality > 30);
  writeFileSync(path.join(OUT, `${name}.webp`), out);
  console.log(`${name}.webp ${w}x${h} ${Math.round(out.length / 1024)} KB`);
}

const rows = PHOTOS.map(
  ([name, , , page, , who, profile, shows]) =>
    `| \`${name}.webp\` | ${shows} | [${who}](https://unsplash.com/@${profile}) | [unsplash.com/photos/${page}](https://unsplash.com/photos/${page}) | [Unsplash License](https://unsplash.com/license) |`,
);
writeFileSync(
  path.join(OUT, "CREDITS.md"),
  `# Stock photo credits

Every photo here is a real photo from Unsplash, under the Unsplash License:
free for commercial and non-commercial use, no permission needed, credit
appreciated. Licence checked on each photo's page on 2026-11-23. The people
shown don't use or endorse Nexa: don't put names, quotes or results beside them.

Written by \`scripts/fetch-stock-photos.mjs\`; change the list there.

| File | Shows | Photographer | Source | Licence |
| --- | --- | --- | --- | --- |
${rows.join("\n")}
`,
);
