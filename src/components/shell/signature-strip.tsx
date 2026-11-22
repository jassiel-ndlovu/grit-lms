import { cn } from "@/lib/utils";

/**
 * The signature strip (owner, 22 Nov): a thin band of the theme's colours
 * along the bottom edge of the sticky headers. Purely decorative, so it is
 * aria-hidden, takes no clicks and takes no room: it hangs below its header
 * (absolute, `top: 100%`), so nothing under it moves.
 *
 * PageHeader and Ribbon each render one. While a Ribbon sits under the
 * PageHeader, the header's strip is hidden (src/app/page-frame.css), so
 * the band runs under the lowest header: under the Ribbon when there is
 * one, else under the PageHeader. When the Ribbon slides away on a phone,
 * the header's strip comes back.
 *
 * Colours come from `--strip-1..3`, set per theme, light and dark
 * (themes.css, revamp-tokens.css, Inkwell in globals.css). The test runner
 * gets a quieter one (`subtle`); a Pro lockdown sitting has no header, so
 * no strip.
 */
export function SignatureStrip({ subtle = false }: { subtle?: boolean }) {
  return (
    <span
      aria-hidden
      data-slot="signature-strip"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-full bg-linear-to-r from-(--strip-1) via-(--strip-2) to-(--strip-3)",
        subtle ? "h-px opacity-60" : "h-(--strip-height)",
      )}
    />
  );
}
