# Dual-mode UX: Simple and Technical

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Mature products split "how dense is it" from "how much is shown". Density is a per-user setting (Gmail, Cloudscape/AWS, Notion). Disclosure is handled in each screen with an "Advanced" section or an override toggle (Vercel, Stripe, Linear).
- Build one codebase. Put a `data-mode` attribute on the dashboard root, define the density in CSS variables, and add a Tailwind v4 `technical:` variant. Components never fork.
- Rule that prevents most support pain: **a mode never removes a capability**. Technical mode only changes density and which sections start expanded. Every advanced field is reachable in Simple mode behind "More settings".
- Store the mode in `UserPreferences` next to `darkMode`, and render it on the server so there is no flash. Students and parents default to Simple. The toggle sits in Settings, the profile menu and the command palette.
- Testing cost is real but bounded. Visual tests run on about 10 key screens x 2 modes x light/dark. Behaviour tests run once, because behaviour is identical.

## 1. What others do

| Product | Setting | Scope | What changes | Notes for us |
|---|---|---|---|---|
| Gmail | Density: Default, Comfortable, Compact, in quick settings ([Google Workspace help](https://goo.gle/3su4528)) | Per user | Row spacing. Default also shows attachment chips ([same](https://goo.gle/3su4528)) | Classic example of a pure density switch. Google said Compact matched the line spacing long-time users were used to ([Gmail blog, 2011](https://gmail.googleblog.com/2011/11/changing-information-density-in-gmails.html)). |
| AWS console / Cloudscape | Comfortable (default) and compact density ([Cloudscape content density](https://cloudscape.design/foundation/visual-foundation/content-density/)). Console Unified Settings cover language, Region, visual mode (light/dark/browser) and favourites display ([AWS visual mode](https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/visual-mode-unified-settings.html), [Unified Settings](https://docs.aws.eu/awsconsolehelpdocs/latest/gsg/unified-settings.html)) | Per user, whole app | Compact reduces spacing only. Alerts, help panels and validation messages stay comfortable for readability ([Cloudscape](https://cloudscape.design/foundation/visual-foundation/content-density/)) | Cloudscape rules we should copy: comfortable is always the default, compact never replaces it, apply app-wide not per page, users can always switch ([same](https://cloudscape.design/foundation/visual-foundation/content-density/)). Their pattern names it "Density settings" with tiles and a Confirm button, stored and applied across the service ([density settings pattern](https://cloudscape.design/patterns/general/density-settings/)). |
| Azure portal | Menu behaviour flyout or docked. Service menu groups collapsed or expanded. Themes including high contrast ([Azure set preferences](https://learn.microsoft.com/en-us/azure/azure-portal/set-preferences), [portal overview](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview)) | Per user | Chrome layout and disclosure defaults, not density | "Expanded by default" is a disclosure preference. That is close to what Technical mode should do for config panels. |
| Linear | Display options per view: grouping, ordering, which properties show. Personal or "Set as default" for the workspace ([Linear display options](https://linear.app/docs/display-options)) | Per view, per user or team | Information shown, not spacing | Per-view options suit tables (gradebook, submissions). They are not a global mode. |
| Notion | Per page: font (Default/Serif/Mono), Small text, Full width. Desktop and web only ([Notion styling help](https://www.notion.com/help/customize-and-style-your-content)) | Per page | Type size and width | Per-page density works for documents. It is wrong for an app shell. |
| GitHub | Accessibility settings: link underlines, hovercards, single-key shortcuts, motion, increased contrast ([GitHub docs](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/managing-accessibility-settings)) | Per user | Behaviour and contrast | Worth copying: a "turn off single-key shortcuts" switch once we add keyboard shortcuts. |
| Vercel | Build settings show detected framework values. Each field has an **Override** toggle to edit it ([Vercel configure a build](https://vercel.com/docs/builds/configure-a-build)) | Per field | Defaults stay read-only until overridden | Best pattern for test settings: show the sensible default and let the tutor override one field. |
| Stripe | Payment link creation has **Options** and **Advanced options** sections ([Stripe Connect payment links](https://docs.stripe.com/connect/payment-links), [customise checkout](https://docs.stripe.com/payment-links/customize)) | Per form | Rare settings sit in Advanced | Whether Advanced starts collapsed is (unverified). |
| Microsoft Office | Simplified (single-line) vs classic ribbon, switched with a caret on the ribbon. Overflow behind "...", plus search ([Microsoft support](https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon)) | Per app | Command density and disclosure | A third-party guide notes the toggle has to be set in each Office app separately ([How-To Geek](https://www.howtogeek.com/714701/how-to-switch-back-to-the-classic-ribbon-in-microsoft-office/)). Lesson: one global switch, not one per screen. |
| Google Ads | Smart Mode vs Expert Mode. Smart Campaigns only exist in Smart Mode ([Google Ads help](https://support.google.com/google-ads/answer/9520605?hl=en)) | Per account | Whole feature set | Third parties say switching to Expert is one-way and that accounts get "stuck" in Smart Mode ([FeedArmy](https://feedarmy.com/kb/how-to-fix-google-ads-stuck-in-smart-mode-even-after-switching-to-expert-mode/), [megadigital](https://megadigital.ai/en/blog/google-ads-expert-mode/)) (unverified on Google's own pages). This is the anti-pattern: modes that gate features. |

Design guidance from the systems:

- Material: don't change density of one component in isolation. Lists, tables and long forms benefit most from higher density ([Material applying density](https://material.io/design/layout/applying-density.html), [@material/density README](https://cdn.jsdelivr.net/npm/@material/density@14.0.0/README.md)). MUI warns against applying a high-density theme to a whole app ([MUI density](https://v7.mui.com/material-ui/customization/density.md)).
- NN/g: progressive disclosure defers rare features to a secondary screen. More than two levels usually hurts usability. The advanced control must be easy to find and clearly labelled ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)).

## 2. Two axes, one switch

Users experience one switch: **Simple / Technical**. Inside the code it drives two separate axes:

| Axis | Simple | Technical | How |
|---|---|---|---|
| Density | 14px body, 8px radius, 36px rows, 32px min controls | 13px body, 2px radius, 28px rows, 24px min controls | CSS variables under `[data-mode]` |
| Disclosure default | Config panels show the core fields. "More settings (n)" is collapsed. | All sections start expanded with a sticky section index on the left (Azure "Expanded" behaviour). | `useUiMode()` sets the initial `open` state of disclosures only |

Things that **do not** change by mode: which features exist, permissions, tier gating, URLs, validation rules, keyboard shortcuts, wording.

Things that stay "comfortable" even in Technical mode (Cloudscape exception list): alerts and toasts, help text, form validation messages, lesson reading view, and the student test runner.

## 3. Per-service config panels

Each service (test settings, course settings, assignment settings, live session, branding) gets one schema with fields tagged by level:

```ts
// features/<service>/settings-schema.ts
export const testSettingsFields = [
  { name: "title",        level: "core" },
  { name: "dueDate",      level: "core" },
  { name: "timeLimit",    level: "core" },
  { name: "shuffle",      level: "advanced" },
  { name: "attempts",     level: "advanced" },
  { name: "lockdown",     level: "advanced", tier: "PRO" },
] as const;
```

Rendering rules:

1. One `<SettingsPanel fields schema>` component renders both modes. Simple shows `core` and a `<Disclosure label="More settings (4)">` for `advanced`. Technical shows everything, grouped, with section anchors.
2. **Changed-advanced badge.** If any advanced field differs from its default, Simple mode shows "2 advanced settings changed" on the disclosure and opens it. Nothing is hidden silently. This is the main protection against "my test behaves oddly and I can't see why".
3. Use the Vercel pattern for derived defaults. Show the computed value greyed out with an "Override" switch (for example pass mark from course default, or time limit from question count).
4. Tier-gated fields appear in both modes with a lock and the tier name. They are never hidden by mode. Hiding them is the Google Ads trap.
5. Validation lives in one zod schema (next-safe-action already uses this pattern), so the server never knows the mode.

## 4. Implementation: one codebase

### Where the mode lives

Today `UserPreferences` stores `darkMode`, `preferredView` and others (prisma `UserPreferences` model). `src/app/dashboard/settings/page.tsx` reads it server-side, and `src/components/preferences-provider.tsx` gets it as `ClientPreferences` and toggles `.dark` on `<html>` in an effect. A localStorage boot script avoids the dark flash.

Changes:

- Prisma: `uiMode UiMode @default(SIMPLE)` with `enum UiMode { SIMPLE TECHNICAL }`. Per the project memory, schema changes use `db push` against the remote Neon DB, so ask the owner before pushing.
- `ClientPreferences.uiMode` plus a `useUiMode()` hook in `preferences-provider.tsx`.
- Render `data-mode` **on the server** in the dashboard layout wrapper (the server layout already reads preferences). Then there is no flash and no boot script for the dashboard. Signed-out pages are always Simple.
- Settings form: new "Interface" section with two preview tiles (Cloudscape style), saved through the existing `updateOwnPreferences` action.
- Quick toggle in the profile menu (`src/app/dashboard/models/header.tsx` dropdown) and a command palette entry "Switch to Technical mode". After a toggle, call `router.refresh()` so the server attribute updates.

### CSS

```css
/* globals.css */
@custom-variant technical (&:where([data-mode=technical], [data-mode=technical] *));

:root, [data-mode=simple] {
  --text-body: 14px;  --radius: 8px;  --row-h: 36px;
  --control-h: 32px;  --gap: 12px;    --ribbon-h: 40px;
}
[data-mode=technical] {
  --text-body: 13px;  --radius: 2px;  --row-h: 28px;
  --control-h: 28px;  --gap: 8px;     --ribbon-h: 36px;
}
/* Readability islands stay comfortable */
[data-mode=technical] :where(.reading, [role=alert], .test-runner) {
  --text-body: 14px; --row-h: 36px; --gap: 12px;
}
```

The `@custom-variant` syntax is the same one Tailwind v4 documents for a data-attribute dark mode ([Tailwind dark mode](https://tailwindcss.com/docs/dark-mode)). Today `--radius` is `0.625rem` in `globals.css` and the shadcn radius scale derives from it, so changing one variable flows through. Prefer variables over `technical:` utilities. Use the variant only for layout differences (for example `technical:grid-cols-[200px_1fr]` for the section index).

Do not use React context to choose different components per mode. That doubles the component tree and the test matrix.

## 5. Testing burden

| Layer | Matrix | Guess: effort |
|---|---|---|
| Unit / action tests | Once. Behaviour is mode-free. | None extra |
| Component tests for `SettingsPanel` | Simple collapsed, Simple with changed-advanced badge, Technical | Small, once |
| Visual regression (Playwright screenshots) | About 10 key screens x {simple, technical} x {light, dark} = about 40 shots | Guess: 1-2 days to set up, then cheap |
| Accessibility (axe) | Run in both modes. Technical is where target size and contrast break. | Same job, two projects |
| Manual QA | Every new screen checked in both modes before merge (PR checklist item) | Ongoing |

A Playwright `projects` entry per mode that sets the preference via a cookie or seeded test user keeps it to one test file.

## 6. Pitfalls and mitigations

| Pitfall | Seen in | Mitigation |
|---|---|---|
| Users stuck in the wrong mode | Google Ads Smart/Expert ([FeedArmy](https://feedarmy.com/kb/how-to-fix-google-ads-stuck-in-smart-mode-even-after-switching-to-expert-mode/)) | Always reversible. Toggle in three places. Never gate features by mode. |
| Toggle has to be set per screen | Office ribbon per app ([How-To Geek](https://www.howtogeek.com/714701/how-to-switch-back-to-the-classic-ribbon-in-microsoft-office/)) | One per-user setting, applied app-wide (Cloudscape rule). |
| Compact hurts low-vision and motor-impaired users | Cloudscape density pattern ([Cloudscape](https://cloudscape.design/patterns/general/density-settings/)) | Simple is default. Technical keeps 24px targets and 4.5:1 text (see 11-fonts-accessibility.md). |
| Hidden advanced setting causes confusion | Common support pattern (Guess) | Changed-advanced badge. Auto-open the disclosure. |
| Docs and support split in two | Guess | Write docs and screenshots in Simple only. Add one line "In Technical mode this section is expanded" where it matters. Same labels in both modes, so instructions work in both. Add `uiMode` to support/feedback metadata and analytics events. |
| A tutor screenshares Technical mode to a student who sees Simple | Guess | Same labels and order in both modes. Only spacing and expansion differ. |
| Students switching into Technical | Guess | Allow it but don't promote it. Keep it out of student onboarding. |
| Mode-based code paths creep in (`if (mode === ...)`) | Guess | Lint rule or code review rule: `useUiMode()` may only be read by `Disclosure`, `SettingsPanel` and layout primitives. |

## Recommendation

**Pick:** One per-user `uiMode` (default SIMPLE) stored in `UserPreferences` and rendered server-side as `data-mode`. Density comes from CSS variables. Disclosure comes from a shared `SettingsPanel` with core/advanced field tags and a changed-advanced badge. Modes never gate features. Reasons: matches Cloudscape's tested guidance, adds no new dependency, keeps one component tree, and the only schema change is one enum column.

**Fallback:** If the owner wants to ship faster, release density only (CSS variables plus a toggle) and keep every config panel in its current single layout. Add the core/advanced split service by service later. The `data-mode` attribute and preference column are the same either way.

## Open questions for the owner

1. Should students and parents see the mode toggle at all, or only tutors and admins?
2. Should Technical mode be suggested automatically, for example to tutors with more than N courses or after they open "More settings" several times?
3. Is per-view display configuration (Linear style columns and grouping on gradebook and submissions) in scope now, or later?
4. OK to add `uiMode` to `UserPreferences` with `db push` on the shared Neon database?
5. Should the student test runner always stay Simple, even for a student who chose Technical? (Recommended: yes.)

## Sources

- https://goo.gle/3su4528 (checked 2026-11-16)
- https://gmail.googleblog.com/2011/11/changing-information-density-in-gmails.html (checked 2026-11-16)
- https://cloudscape.design/foundation/visual-foundation/content-density/ (checked 2026-11-16)
- https://cloudscape.design/patterns/general/density-settings/ (checked 2026-11-16)
- https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/visual-mode-unified-settings.html (checked 2026-11-16)
- https://docs.aws.eu/awsconsolehelpdocs/latest/gsg/unified-settings.html (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/azure-portal/set-preferences (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview (checked 2026-11-16)
- https://linear.app/docs/display-options (checked 2026-11-16)
- https://www.notion.com/help/customize-and-style-your-content (checked 2026-11-16)
- https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/managing-accessibility-settings (checked 2026-11-16)
- https://vercel.com/docs/builds/configure-a-build (checked 2026-11-16)
- https://docs.stripe.com/connect/payment-links (checked 2026-11-16)
- https://docs.stripe.com/payment-links/customize (checked 2026-11-16)
- https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon (checked 2026-11-16)
- https://www.howtogeek.com/714701/how-to-switch-back-to-the-classic-ribbon-in-microsoft-office/ (checked 2026-11-16)
- https://support.google.com/google-ads/answer/9520605?hl=en (checked 2026-11-16)
- https://feedarmy.com/kb/how-to-fix-google-ads-stuck-in-smart-mode-even-after-switching-to-expert-mode/ (checked 2026-11-16)
- https://megadigital.ai/en/blog/google-ads-expert-mode/ (checked 2026-11-16)
- https://material.io/design/layout/applying-density.html (checked 2026-11-16)
- https://cdn.jsdelivr.net/npm/@material/density@14.0.0/README.md (checked 2026-11-16)
- https://v7.mui.com/material-ui/customization/density.md (checked 2026-11-16)
- https://www.nngroup.com/articles/progressive-disclosure/ (checked 2026-11-16)
- https://tailwindcss.com/docs/dark-mode (checked 2026-11-16)
