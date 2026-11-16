# Illustrations

Line-art people for empty states, onboarding, success and error screens, plus
default avatars. Preview: `/design-system/illustrations` (dev, or `REVAMP_UI=1`).

## Source and licence

- [Open Peeps](https://www.openpeeps.com/) by Pablo Stanley, CC0. Flat Assets
  `Templates/` (Bust, Standing, Sitting).
- Transhumans by Pablo Stanley, CC0. Four PNGs, 400 px on the long side.

No credit is required for either. Zanzi (marketing only) and Medical Icons are
not used here.

## Using them

```tsx
import EmptyCourses from "@/components/illustrations/generated/empty-courses";

<EmptyCourses className="h-40 w-auto" />                 // decorative (aria-hidden)
<NotFound className="h-56 w-auto" title="Page not found" /> // meaningful (role="img")
```

- Import each illustration from its own file. Do not build a barrel: one module
  per illustration keeps each page to what it renders.
  `generated/registry.ts` holds lazy loaders for code that picks one by name.
- **Theme.** Ink paths use `fill="currentColor"`, so lines take the text colour.
  Paper paths have no fill and inherit the `<svg>`'s fill,
  `var(--illustration-surface, var(--background))`. Both flip with the `dark`
  class. On a card, set `[--illustration-surface:var(--card)]` on an ancestor.
  In dark mode the art reads as a negative (light lines, dark paper).
- **Avatars.** `<PeepAvatar userId={id} size={40} />` is an async server
  component that picks one of 32 busts with `avatarIndexFor(id)` (FNV-1a, see
  `scripts/check-avatar-index.ts`). From a client component, call
  `avatars[avatarIndexFor(id)]()` and render the result.
- **Spot art.** `<SpotIllustration name="study" />` renders a Transhumans PNG
  through `next/image`, capped at 240 px wide. Raster, so it cannot follow the
  theme: it always sits on a white panel.

## Adding or changing one

1. Edit `SCENES`, `BUSTS` or `SPOTS` in `scripts/generate-illustrations.ts`.
   Append busts at the end: changing the list reshuffles default avatars.
2. Run `npx tsx scripts/generate-illustrations.ts [path/to/Illustrations]`
   (defaults to `~/Documents/Illustrations`). It runs `npx svgo` with
   `scripts/illustrations/svgo.config.mjs`, rewrites `generated/` and copies
   the PNGs to `public/illustrations/`. Do not edit `generated/` by hand.
3. Run `npx tsx scripts/check-avatar-index.ts` and look at the preview page.

The SVGO pass strips Sketch titles, ids, groups and metadata, maps black to
`currentColor`, and drops white fills so they inherit. It refuses any other
colour. 46 SVGs went from 1911 KB to 612 KB (68% smaller).

## Mapping

| Name | Source |
| --- | --- |
| `empty-courses` | Open Peeps `Templates/Sitting/peep-sitting-9.svg` |
| `empty-lessons` | Open Peeps `Templates/Sitting/peep-sitting-2.svg` |
| `empty-tests` | Open Peeps `Templates/Standing/peep-standing-6.svg` |
| `empty-submissions` | Open Peeps `Templates/Standing/peep-standing-4.svg` |
| `nothing-to-grade` | Open Peeps `Templates/Sitting/peep-sitting-12.svg` |
| `calendar-empty` | Open Peeps `Templates/Sitting/peep-sitting-1.svg` |
| `inbox-empty` | Open Peeps `Templates/Sitting/peep-sitting-6.svg` |
| `search-no-results` | Open Peeps `Templates/Standing/peep-standing-5.svg` |
| `onboarding-welcome` | Open Peeps `Templates/Sitting/peep-sitting-15.svg` |
| `onboarding-profile` | Open Peeps `Templates/Standing/peep-standing-1.svg` |
| `onboarding-courses` | Open Peeps `Templates/Standing/peep-standing-26.svg` |
| `success-submitted` | Open Peeps `Templates/Standing/peep-standing-12.svg` |
| `not-found` | Open Peeps `Templates/Standing/peep-standing-22.svg` |
| `error` | Open Peeps `Templates/Standing/peep-standing-16.svg` |
| `avatar-01` to `avatar-32` | Open Peeps `Templates/Bust/peep-N.svg`, N = 6, 8, 10, 11, 13, 14, 17, 19, 26, 31, 33, 34, 37, 38, 39, 43, 46, 47, 51, 57, 59, 63, 66, 76, 78, 79, 87, 93, 96, 99, 100, 102 (in order) |
| `spot-study` | Transhumans `Growth-Study.png` (login) |
| `spot-school-run` | Transhumans `School-Run-Innocent.png` (sign-up) |
| `spot-team` | Transhumans `Team-Cooperation.png` (sign-up, invites) |
| `spot-celebrate` | Transhumans `Chaos-Good-Dance.png` (test submitted) |

Busts left out on purpose: monster faces, knives, eye patches, scowls, shirts
with text, and three files with stray colours or masks.
