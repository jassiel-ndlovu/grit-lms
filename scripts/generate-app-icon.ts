/**
 * The temporary Nexa app icon: a serif "Nx" on an ink tile (owner's pick,
 * 2026-11-20). Writes src/app/favicon.ico (16, 32, 48), src/app/icon.png
 * (512) and src/app/apple-icon.png (180), which Next links automatically.
 *
 *   npx tsx scripts/generate-app-icon.ts
 *
 * The glyphs come from Georgia (installed on Windows and macOS); the output
 * is committed, so the build never needs the font.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const APP = path.join(process.cwd(), "src", "app");
const svg = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1F1E1B"/>
<text x="32" y="46.5" text-anchor="middle" font-family="Georgia" font-size="40" letter-spacing="-1.5" fill="#F7F7F5">N<tspan font-size="35">x</tspan></text>
</svg>`;
const png = (size: number) => sharp(Buffer.from(svg(size))).png().toBuffer();

(async () => {
  await sharp(await png(512)).toFile(path.join(APP, "icon.png"));
  await sharp(await png(180)).toFile(path.join(APP, "apple-icon.png"));

  // favicon.ico with PNG entries, which every current browser reads.
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(png));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map((p, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0);
    e.writeUInt8(sizes[i], 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.length;
    return e;
  });
  fs.writeFileSync(path.join(APP, "favicon.ico"), Buffer.concat([head, ...dir, ...pngs]));
  console.log("Wrote favicon.ico, icon.png and apple-icon.png");
})();
