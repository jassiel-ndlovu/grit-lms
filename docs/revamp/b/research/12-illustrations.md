# Illustration packs: inventory

Checked: 2026-11-16. Author: Agent B research (main session). Source: the
owner's local folder `Documents/Illustrations`, read file by file. Licences
come from the plan doc ("Nexa LMS: Platform revamp plan", rev 2, Illustrations
table); this file does not re-verify them on the web.

## Bottom line

- Open Peeps is the only pack big enough and vector enough to be the in-app
  set. Use the SVG templates as they are, plus the Separate Atoms for avatars.
- Transhumans are 400 px PNGs. They are fine as small spot art (about
  200 px wide on a 2x screen) but too small for a landing hero. Hero use
  needs a vector or larger source.
- Zanzi stays zipped and stays on marketing pages only, as the plan says.
- The SVGs carry Sketch export cruft (titles, ids, unused defs). Optimise
  them with SVGO before they ship; budget about a third off.

## What is in the folder

| Pack | Files that matter | Format and size | Licence (from plan doc) | Use |
| --- | --- | --- | --- | --- |
| Open Peeps (`Open-Peeps/Flat Assets/Flat Assets`) | 105 bust, 30 standing, 18 sitting templates; 135 separate atoms (30 bodies, 30 faces, 46 heads, 16 facial hair, 8 accessories, 3 whole people, 2 poses) | SVG plus matching PNG for most templates. Standing figure: 213 x 715 viewBox, about 66 KB raw. Smallest atom about 1 KB | CC0 | In-app: empty states, onboarding steps, avatars |
| Open Peeps source files | `open-peeps-mono.fig`, `.sketch`, `.studio` | Design source | CC0 | Build new poses or crops in Figma |
| Transhumans | 20 PNGs (for example `Growth-Study`, `Team-Cooperation`, `School-Run-Innocent`, `Stop-Check-Caution`, `Perserverance-Dedication-Focus`) | PNG, longest side 400 px, 40 to 65 KB each | CC0 | Login, sign-up, "test submitted" style moments, at small size only |
| Zanzi | `Zanzi-illustrations--ALL.zip` (12 MB, holds an SVG zip) and `--ICONJAR.zip` (51 files, 4 MB) | Colour SVG and PNG | Free for commercial use; credit getillustrations.com | Marketing pages only |
| Medical Icons | One SVG contact sheet, "Vitals — Open Medical Icons", 816 x 1542 | SVG sheet with text labels | Not stated in the plan doc | No use found for an LMS. Leave out unless the owner has a plan for it |

Counts exclude macOS `__MACOSX` resource-fork copies, which double the raw
file count (712 SVG files on disk, 356 real ones).

## Notes for the design system (B3)

1. **One line style in the app.** Open Peeps and Transhumans are both black
   line art, so they can share screens. Zanzi's thick colour outlines must not
   appear inside the app (plan doc rule).
2. **Colour.** Open Peeps SVGs use fixed black strokes and white fills. To
   make them follow the theme (dark mode later, muted greys in Technical
   mode), rewrite `#000` strokes to `currentColor` during optimisation and
   set the colour with a text token. Transhumans are raster, so they cannot
   follow the theme; place them on white or the sidebar grey only.
3. **Technical mode shows no illustrations** (plan doc, UX revision 2). Empty
   states there use an icon and one line of text.
4. **Avatars.** The bust templates (105) give enough variety for default
   avatars. Pick by a hash of the user id so each person keeps the same one.
   Guess: a curated 24 to 32 busts is plenty and keeps the bundle small.
5. **Delivery.** Ship optimised SVGs as static files under `public/` (or
   inline the few used above the fold) and load them lazily. Do not import
   all 356 into a bundle.
6. **Transhumans at hero size.** Options: (a) use them at 200 to 240 px
   with generous whitespace, (b) trace them to SVG (quality risk), or (c) use
   an Open Peeps scene composed in Figma from the source file for the hero.
   Option (c) keeps one source of truth.

## Open questions for the owner

- Is the Medical Icons sheet meant for Nexa at all, or did it land in the
  folder from another project?
- Are there larger or vector originals of the Transhumans pack? The landing
  hero needs one.
- Should each person's default avatar be an Open Peeps bust, or initials (as
  today) with the bust as an option in Profile?

## Sources

- Local folder `C:\Users\User\Documents\Illustrations`, listed and measured
  on 2026-11-16.
- "Nexa LMS: Platform revamp plan", revision 2, section "Illustrations"
  (licences and intended use), read 2026-11-16.
