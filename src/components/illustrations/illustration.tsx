import type { ReactNode, SVGProps } from "react";

export type IllustrationProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Give a title only when the picture carries meaning; without one it is hidden from assistive tech. */
  title?: string;
};

/**
 * Shared <svg> wrapper for the generated Open Peeps components.
 *
 * Theming: ink paths use fill="currentColor", so lines follow the text colour.
 * Paper paths carry no fill and inherit the <svg>'s fill, which reads
 * `--illustration-surface` and falls back to the page `--background`. On a
 * card, set `[--illustration-surface:var(--card)]` on any ancestor.
 */
export function Illustration({ title, children, style, viewBox, ...rest }: IllustrationProps & { children: ReactNode }) {
  const [, , width, height] = (viewBox ?? "").split(" ").map(Number);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
      style={{ fill: "var(--illustration-surface, var(--background, #fff))", ...style }}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
