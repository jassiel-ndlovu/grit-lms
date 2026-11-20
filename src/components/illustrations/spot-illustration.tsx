import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Transhumans (CC0) as WebP, 400 px on the long side, written by
 * scripts/generate-illustrations.ts. Raster: they cannot follow the theme.
 */
const SPOTS = {
  study: { src: "/illustrations/spot-study.webp", width: 381, height: 400 },
  "school-run": { src: "/illustrations/spot-school-run.webp", width: 267, height: 400 },
  team: { src: "/illustrations/spot-team.webp", width: 400, height: 315 },
  celebrate: { src: "/illustrations/spot-celebrate.webp", width: 354, height: 400 },
  focus: { src: "/illustrations/spot-focus.webp", width: 274, height: 400 },
  reading: { src: "/illustrations/spot-reading.webp", width: 400, height: 349 },
} as const;

export type SpotName = keyof typeof SPOTS;
export const SPOT_NAMES = Object.keys(SPOTS) as SpotName[];

/** Wider than this and the 400 px source goes soft on a 2x screen. */
const MAX_WIDTH = 240;

/**
 * Small raster spot art for login, sign-up, "test submitted" and the landing
 * page. The images have black lines and a transparent background, so they
 * always sit on a light panel, in dark mode too. `width` caps the long side's
 * width; `maxHeight` keeps tall figures from towering over wide ones.
 */
export function SpotIllustration({
  name,
  width = 200,
  maxHeight,
  alt = "",
  className,
}: {
  name: SpotName;
  width?: number;
  maxHeight?: number;
  /** Empty by default: decorative. */
  alt?: string;
  className?: string;
}) {
  const spot = SPOTS[name];
  let w = Math.min(width, MAX_WIDTH);
  if (maxHeight && (w * spot.height) / spot.width > maxHeight) w = Math.round((maxHeight * spot.width) / spot.height);
  return (
    <span className={cn("inline-block rounded-xl bg-white p-3", className)}>
      <Image src={spot.src} alt={alt} width={w} height={Math.round((w * spot.height) / spot.width)} />
    </span>
  );
}
