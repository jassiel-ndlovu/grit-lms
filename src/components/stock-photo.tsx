/**
 * One of the stock photos in public/images/stock (credits in CREDITS.md
 * there). Fills its parent, which needs `relative` and a size; give the
 * parent `bg-muted` too, since data saver leaves the photo out.
 *
 * Always lazy, even above the fold: only a lazy image inside a hidden box
 * stays unfetched (hiding the <img> itself isn't enough in Chrome). Works on static public pages, without a provider.
 */

import Image from "next/image";

import { cn } from "@/lib/utils";

export const STOCK_PHOTOS = {
  hero: "A tutor sits beside a student who is writing in a workbook",
  tutor: "A woman with glasses smiles while she works at a table with a laptop",
  student: "A student reads a book beside an open laptop",
  parent: "A woman on a sofa reads something on her laptop",
  organisation: "Three people go through a textbook at a table",
  johannesburg: "The Johannesburg skyline at golden hour",
  "sign-in": "A student reads on the floor of a library",
  join: "A smiling student with a backpack and books",
} as const;

export type StockPhotoName = keyof typeof STOCK_PHOTOS;

export function StockPhoto({
  name,
  sizes,
  alt = STOCK_PHOTOS[name],
  className,
}: {
  name: StockPhotoName;
  sizes: string;
  /** Pass "" when the photo is decoration. */
  alt?: string;
  className?: string;
}) {
  return (
    <span data-stock-photo="" className="absolute inset-0 block">
      <Image src={`/images/stock/${name}.webp`} alt={alt} fill sizes={sizes} loading="lazy" className={cn("object-cover", className)} />
    </span>
  );
}
