# Meeting app icons

The apps' own icons, unchanged, downloaded on 2026-11-24. They only say which
app a link opens; Nexa isn't affiliated with any of them.

| File | Owner | From |
| --- | --- | --- |
| `google-meet.svg` | Google | https://www.gstatic.com/images/branding/productlogos/meet_2026/v1/192px.svg |
| `microsoft-teams.svg` | Microsoft | https://res.cdn.office.net/files/fabric-cdn-prod_20251107.003/assets/brand-icons/product/svg/teams_48x1.svg |
| `zoom.png` | Zoom | https://st1.zoom.us/zoom.ico (a PNG) |

**Owner's decision, 2026-11-24:** use them for now, while the owner checks with
the legal team. Zoom's and Microsoft's published guidelines ask for a written
licence, and Google's cover approved uses only.

**To take them out:** set `SHOW_MEETING_LOGOS` to `false` in
`src/features/events/components/meeting-app-mark.tsx` (every place falls back
to a neutral mark) and delete this folder.
Don't recolour, crop or redraw them.
