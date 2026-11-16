import Image from "next/image";
import { cn } from "@/lib/utils";

/** Transhumans PNGs (CC0), 400 px on the long side. Raster: they cannot follow the theme. */
const SPOTS = {
  study: { src: "/illustrations/spot-study.png", width: 381, height: 400 },
  "school-run": { src: "/illustrations/spot-school-run.png", width: 267, height: 400 },
  team: { src: "/illustrations/spot-team.png", width: 400, height: 315 },
  celebrate: { src: "/illustrations/spot-celebrate.png", width: 354, height: 400 },
} as const;

export type SpotName = keyof typeof SPOTS;
export const SPOT_NAMES = Object.keys(SPOTS) as SpotName[];

/** Wider than this and the 400 px source goes soft on a 2x screen. */
const MAX_WIDTH = 240;

/**
 * Small raster spot art for login, sign-up and "test submitted". The PNGs have
 * black lines and a transparent background, so they always sit on a light
 * panel, in dark mode too.
 */
export function SpotIllustration({
  name,
  width = 200,
  alt = "",
  className,
}: {
  name: SpotName;
  width?: number;
  /** Empty by default: decorative. */
  alt?: string;
  className?: string;
}) {
  const spot = SPOTS[name];
  const w = Math.min(width, MAX_WIDTH);
  return (
    <span className={cn("inline-block rounded-xl bg-white p-3", className)}>
      <Image src={spot.src} alt={alt} width={w} height={Math.round((w * spot.height) / spot.width)} />
    </span>
  );
}
