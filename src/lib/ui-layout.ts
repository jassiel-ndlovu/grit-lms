/**
 * Page frame layout (#205). The values live in one file,
 * `src/app/page-frame.css`, as CSS variables; this module names them for
 * TypeScript so components never hard-code a width or a padding.
 *
 * Pure: safe in server and client components and in scripts.
 */

export const FRAME_WIDTHS = ["reading", "standard", "full"] as const;
export type FrameWidth = (typeof FRAME_WIDTHS)[number];

/** The page types the frame is built for (shown on /design-system/frame). */
export const PAGE_TYPES = ["home", "list", "record", "editor", "runner", "settings"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** Each page type's usual width. Pass `width` to PageFrame to override. */
export const DEFAULT_WIDTH: Record<PageType, FrameWidth> = {
  home: "standard",
  list: "standard",
  record: "standard",
  editor: "full",
  runner: "reading",
  settings: "reading",
};

/**
 * Tailwind classes for each width. Literal strings, so Tailwind's scanner
 * sees them; the numbers come from the CSS variables.
 */
export const FRAME_WIDTH_CLASS: Record<FrameWidth, string> = {
  reading: "max-w-(--frame-reading)",
  standard: "max-w-(--frame-standard)",
  full: "max-w-none",
};

/** Horizontal padding, top padding and the gap between sections. */
export const FRAME_BODY_CLASS = "mx-auto flex w-full flex-col gap-(--frame-gap) px-(--frame-pad) pt-(--frame-pad-top)";

/** Sticky offsets: the primary header sits under the shell bar, the secondary under both. */
export const HEADER_TOP_CLASS = "top-(--shell-top)";
export const SECONDARY_TOP_CLASS = "top-[calc(var(--shell-top)+var(--header-primary))]";

/** Below this width the secondary header hides while scrolling down. */
export const SECONDARY_HIDE_BELOW_PX = 768;
