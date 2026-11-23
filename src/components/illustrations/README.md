# Illustrations

Line-art people for empty states, onboarding, success and error screens,
dashboard page headers and the landing page, plus default avatars. Preview:
`/design-system/illustrations` (dev, or `REVAMP_UI=1`).

These replaced the Storyset SVGs on 2026-11-21. Nothing in the app uses
Storyset any more, and its files are gone from `public/illustrations/`.

## Source and licence

- [Open Peeps](https://www.openpeeps.com/) by Pablo Stanley, CC0. Flat Assets
  `Templates/` (Bust, Standing, Sitting).
- [Transhumans](https://www.transhumans.xyz/) by Pablo Stanley, CC0. Six
  PNGs, 400 px on the long side, shipped as WebP (about 15 KB each).

No credit is required for either. The owner's asset folders carry no licence
file of their own (checked 2026-11-21); the CC0 terms come from the packs'
sites and the revamp plan. Zanzi (marketing only) and Medical Icons are not
used here.

## Using them

```tsx
import EmptyCourses from "@/components/illustrations/generated/empty-courses";

<EmptyCourses className="h-40 w-auto" />                 // decorative (aria-hidden)
<NotFound className="h-56 w-auto" title="Page not found" /> // meaningful (role="img")
```

- Import each illustration from its own file. Do not build a barrel: one module
  per illustration keeps each page to what it renders.
  `generated/registry.ts` holds lazy loaders for code that picks one by name.
- **Theme.** Ink paths use `fill="currentColor"`, so lines take
  `--illustration-ink` or the text colour. Paper paths have no fill and
  inherit the `<svg>`'s fill, `var(--illustration-surface, var(--background))`.
  On a card, set `[--illustration-surface:var(--card)]` on an ancestor.
  In dark mode the figures stay light (dark ink on `#F7F7F5` paper), set on
  the `<svg>` by `illustrations.css`; they are not inverted. Where the text
  colour is light in both modes (the dashboard page headers on the primary
  panel, the landing page's closing panel), put `illustration-paper` on the
  wrapper to pin the same light figure.
- **Avatars.** `<PeepAvatar userId={id} size={40} />` is an async server
  component that picks one of 32 busts with `avatarIndexFor(id)` (FNV-1a, see
  `scripts/check-avatar-index.ts`). From a client component, call
  `avatars[avatarIndexFor(id)]()` and render the result.
- **Spot art.** `<SpotIllustration name="study" />` renders a Transhumans WebP
  through `next/image`, capped at 240 px wide (`maxHeight` caps tall ones).
  Raster, so it cannot follow the theme: it always sits on a white panel. Keep
  it small; never use it as a hero.

## Adding or changing one

1. Edit `SCENES`, `BUSTS` or `SPOTS` in `scripts/generate-illustrations.ts`.
   Append busts at the end: changing the list reshuffles default avatars.
2. Run `npx tsx scripts/generate-illustrations.ts [path/to/Illustrations]`
   (defaults to `~/Documents/Illustrations`). It runs `npx svgo` with
   `scripts/illustrations/svgo.config.mjs`, rewrites `generated/` and writes
   the spots to `public/illustrations/` as WebP with sharp (it comes with
   next). Do not edit `generated/` by hand.
3. Run `npx tsx scripts/check-avatar-index.ts` and look at the preview page.

The SVGO pass strips Sketch titles, ids, groups and metadata, maps black to
`currentColor`, and drops white fills so they inherit. It refuses any other
colour. 58 SVGs went from 2507 KB to 819 KB (67% smaller); the six spots went
from 247 KB of PNG to 85 KB of WebP.

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
| `error` | Open Peeps `Templates/Standing/peep-standing-16.svg` (500) |
| `unauthorized` | Open Peeps `Templates/Standing/peep-standing-10.svg` (401, 403) |
| `header-analytics` | Open Peeps `Templates/Standing/peep-standing-17.svg` |
| `header-assignments` | Open Peeps `Templates/Standing/peep-standing-23.svg` |
| `header-grades` | Open Peeps `Templates/Standing/peep-standing-11.svg` |
| `header-help` | Open Peeps `Templates/Standing/peep-standing-14.svg` |
| `header-people` | Open Peeps `Templates/Sitting/peep-sitting-14.svg` (Manage users) |
| `header-profile` | Open Peeps `Templates/Standing/peep-standing-7.svg` |
| `header-settings` | Open Peeps `Templates/Sitting/peep-sitting-11.svg` |
| `header-tests` | Open Peeps `Templates/Sitting/peep-sitting-10.svg` |
| `landing-tutor` | Open Peeps `Templates/Standing/peep-standing-24.svg` (not used since 23 Nov) |
| `landing-student` | Open Peeps `Templates/Sitting/peep-sitting-12.svg` (not used since 23 Nov) |
| `landing-launch` | Open Peeps `Templates/Standing/peep-standing-25.svg` (not used since 23 Nov) |
| `avatar-01` to `avatar-32` | Open Peeps `Templates/Bust/peep-N.svg`, N = 6, 8, 10, 11, 13, 14, 17, 19, 26, 31, 33, 34, 37, 38, 39, 43, 46, 47, 51, 57, 59, 63, 66, 76, 78, 79, 87, 93, 96, 99, 100, 102 (in order) |
| `spot-study` | Transhumans `Growth-Study.png` (login; landing, for students) |
| `spot-school-run` | Transhumans `School-Run-Innocent.png` (sign-up; landing step 1) |
| `spot-team` | Transhumans `Team-Cooperation.png` (sign-up, invites; landing step 3) |
| `spot-celebrate` | Transhumans `Chaos-Good-Dance.png` (test submitted) |
| `spot-focus` | Transhumans `Perserverance-Dedication-Focus.png` (landing step 2) |
| `spot-reading` | Transhumans `Chill-Sitting.png` (landing, for tutors) |

Busts left out on purpose: monster faces, knives, eye patches, scowls, shirts
with text, and three files with stray colours or masks.
