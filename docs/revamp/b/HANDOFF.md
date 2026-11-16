# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 Legacy Batch 1 (B's half), `revamp/b-legacy-batch1`
Done (design 07, Batch 1):
- `src/app/providers.tsx` no longer mounts `ActivityLogProvider` and
  `NotificationProvider`. That stops the root's calls to `/api/activity`
  and `/api/notifications` on every page.
- The eight dead providers are unmounted: students, tutors, lessons,
  tests, test submissions, grades, question grades and lesson completions.
  Since the shell PR they live in `src/app/dashboard/legacy-providers.tsx`,
  not `dashboard-shell.tsx`. Three are left (submissions, submission
  entries, events) for Batch 3.
- Deleted the dead files: `calendar/student-calendar.tsx`,
  `calendar/tutor-calendar.tsx`, `tests/hooks/use-test-session.ts`, and
  all eight files in `tests/components/`. That is 3,663 lines; nothing
  imported them.

**For A: Batch 1's deletions are clear to go once the owner has tested.**
- These 10 contexts have no consumer left: `ActivityLogContext`,
  `NotificationsContext`, `StudentContext`, `TutorContext`,
  `LessonContext`, `TestContext`, `TestSubmissionContext`, `GradeContext`,
  `QuestionGradeContext`, `LessonCompletionContext`.
- A search for each name outside `src/context/` finds only their own
  routes under `src/app/api/` and comments.
- So routes 1, 2 and 15-37 have no caller from a page.

Owner decisions (2026-11-16), answering design 07's open questions:
- **`deleteEntry` stays.** Tutors keep the right to delete a learner's
  hand-in. B adds a `deleteEntry` server action to
  `src/features/submissions/actions.ts` in Batch 3, limited to the tutor
  who owns the course, with a confirm step, and moves the overview list
  onto it. Route 9's DELETE is then deleted in Batch 4 as planned. A:
  please update open question 1 in design 07.
- **`providers.tsx` is B's** (open question 2), as this PR does.

Checked:
- `tsc --noEmit` and eslint pass.
- In the dev server, `/` and `/design-system/content` load with the root
  providers, with no server or console errors.
- `/dashboard`, `/dashboard/calendar` and `/dashboard/tests` redirect to
  sign-in as expected.

Not checked: signed-in dashboard pages, because the dev database is
production. Owner test from design 07, on Preview:
- sign in as a tutor and as a student
- open the dashboard, a course, the bell and the notifications page
- take a test and open the calendar

Next: Batch 2 once `getViewer()` lands; Batch 3 (with `deleteEntry`) after it.

Blocked on the other agent: `getViewer()` and `getOwnProfile()` for
Batch 2; the `assignment-brief` Blob kind for Batch 3.

## 2026-11-16 Contracts: editor.md and navigation.md Draft 2, `revamp/b-contracts-editor-shell`
Done:
- `contracts/editor.md` Draft 2:
  - It lists the shipped components and `RichEditor`'s real props.
  - `onChange` returns the envelope only, and the server derives the markdown (rule 2).
  - Email HTML is A's `renderEmailHtml`; B's `renderContentHtml` is dropped. The rules for it are in "For A".
  - The Phase 0 toolbar sits above the field, not in the page ribbon.
  - Empty maths writes no markdown.
  - MathJax is 4 with `REVAMP_UI` and 3 until then.
- `contracts/navigation.md` Draft 2:
  - The `banner` slot in `AppShell`, and what may go in it.
  - A's slot names mapped to B's components.
  - The panel convention for A's content on B's pages.

For A: the banner slot and the email rules are ready to build against.
Stacked on #56 (the editor), so merge that first.

Next: the first screens on the editor, or the shell work when `getViewer()` lands.

Blocked on the other agent: `getViewer()`, for the workspace switcher, the
banners' data and nav by persona.

Questions for the owner:
- `deleteEntry` (design 07, route 9): may tutors lose "delete this hand-in"
  on the assignment overview list? B recommends yes. Tutors return or grade
  instead, and the learner resubmits within `maxAttempts`.

## 2026-11-16 Phase 0: RichEditor, `revamp/b-rich-editor`
Done:
- `RichEditor` (`src/components/editor/rich-editor.tsx`), the client
  editor of `contracts/editor.md`. Props: `label` (accessible name),
  `value` (the stored `xJson`), `fallbackMarkdown` (the markdown column,
  used while there is no JSON), `onChange(StoredContent)`, `name` (adds a
  hidden input holding the envelope as JSON, for server-action forms),
  `features` (`math`, `tables`, `headings`), `placeholder`, `editable`.
  - It emits the envelope only. The server validates it with
    `validateDoc` and derives markdown with `docToMarkdown`; the editor
    never sends markdown.
  - Its schema is `contentExtensions()` plus editing-only extensions, so
    anything `RichContent` renders loads, and the reverse holds too.
    `features` hides commands; it never removes nodes.
  - It needs a `MathProvider` above it. The dashboard layout mounts one.
- Maths: inline maths and maths blocks show MathJax output, with a TeX box
  open while the node is selected, empty, or being typed in.
  - `$x^2$` after a space becomes inline maths (a lone `$5` stays text).
  - `$$` then space on an empty line makes a maths block.
  - Enter (inline) or Escape returns to the text; a node left empty is
    removed.
- A slash menu (`/`) and a Radix toolbar share one command list
  (`commands.tsx`). The menu is a listbox driven from the editor
  (`aria-activedescendant`); the toolbar is one tab stop with arrow keys
  and `aria-pressed` marks.
- `AppShell` takes a `banner` prop for A's account banner. It renders
  full width above the page, in `data-slot="account-banner"`.
- `docToMarkdown` writes nothing for empty maths. It used to write `$$`,
  which reads back as display maths. A check for this was added to
  `check-rich-content.ts`.
- Preview: `/design-system/editor`, which shows the emitted JSON, the
  derived markdown, and whether the JSON passes `validateDoc`.

Gotchas:
- Tiptap 3.34's `nodeInputRule` duplicates the typed character when the
  rule has a capture group (the stray `$`). Write a plain `InputRule`.
- `updateAttributes` on a leaf node replaces it, which moves a node
  selection off it. Node views that edit their own attributes use
  `tr.setNodeAttribute`.
- The `focus()` command focuses a frame later. Code that moves focus out
  of a node view calls `editor.view.focus()` first.

Checked: tsc, eslint, and all four check scripts. In the browser, MathJax
3 with no console errors:
- the slash menu: filtering, the arrow keys and Enter
- both input rules
- the TeX box from the toolbar and from the slash menu, then typing on
- the Bold toolbar button keeps the selection
- undo
- the output passes `validateDoc`, and the derived markdown escapes a
  literal `$`

Not checked: screen readers; the editor in a real form (no screen uses it
yet).

Reply to A: noted. MathJax 4 stays on the pinned jsDelivr URL in v1, and
self-hosting is revisited with CSP in Stage 2. B needs nothing sooner.

Next: the contracts PR (the banner slot, the email-rendering owner, and
`onChange` returning the envelope). Then the first screens on the editor.

## 2026-11-16 MathJax 3 hydration fix and replies to A, `revamp/b-mathjax3-hydration`
Done:
- The owner approved the fix raised in the RichContent entry: MathJax 3
  (production) no longer typesets the whole page at startup
  (`startup.typeset: false`). Each `<MathJax>` component typesets its own
  subtree after React renders it, so server-rendered maths no longer
  changes under React before hydration. Checked on `/design-system/content`
  with MathJax 3.2.2: three loads (two with the script cached), no console
  errors, 15 of 15 formulas typeset in each column.

Replies to A's HANDOFF (2026-11-16 entries):
- **Shell slots (A3 flows).** `contracts/navigation.md` is merged. A's
  names map to B's as follows:
  - "parent header" is `PageHeader`: breadcrumb, `status` (one
    `StatusChip`), `actions`, help at the far right.
  - "child ribbon" is `Ribbon`, with `RibbonNav` (views) and
    `RibbonToolbar` (tools).
  - "account banner slot" will be `AppShell`'s `banner` prop. B adds it
    with the editor PR and a contract update. Today's AppShell has no
    banner slot.

  Differences from A's wireframe:
  - The workspace switcher and the avatar live in the sidebar account
    menu, not in the header (Notion-style).
  - The header has no logo.
  - Ribbon overflow scrolls in Phase 0; there is no "More" menu yet.
- **Email rendering.** `contracts/editor.md` is merged, so
  `renderEmailHtml` is unblocked. B agrees it is A's (design 05). The
  contract update will say so and drop B's planned `renderContentHtml`.
  Build it from `contentExtensions()` with the static renderer (now
  installed). Maths is `inlineMath`/`blockMath` with a `latex` attribute;
  render them as monospace TeX, as design 05 plans. Validate stored bodies
  with `validateDoc`. B's derived copy is markdown (`docToMarkdown`); A's
  `bodyText` can be that copy or plain text, A's choice.
- **Panel content on B's pages** (course "Services" and "Fees"; student
  profile "Sign-in", "Parents" and "Fees"). Agreed. A ships each panel as
  a server component that takes ids and the viewer as props
  (`<CourseServicesPanel courseId viewer />`), and B mounts it in a
  `RibbonNav` view of that page.
- **`src/app/providers.tsx`.** B edits it, in Batches 1 and 3 as design 07
  lists. A does not need to touch it.
- **`deleteEntry`.** B recommends dropping it, pending the owner's OK
  (below). Tutors should not delete a learner's hand-in: they return it
  or grade it, and the learner resubmits within `maxAttempts`. The only
  caller is the orphaned overview list, which Batch 3 redirects. So
  route 9's DELETE needs no replacement.
- Billing calls (`getCourseServices`, `previewServiceChange`,
  `setCourseServices`, `period.renewsAt`): noted for the course settings
  screens.

Next:
- The `RichEditor` PR, with the shell banner slot. Then a contracts PR
  for the banner slot and the email-rendering owner change.

Blocked on the other agent (A):
- `getViewer()` (`src/lib/viewer.ts`) for Batch 2.

Questions for the owner:
- May tutors lose the ability to delete a learner's hand-in (`deleteEntry`,
  reachable today only from an orphaned page)? B recommends yes.

## 2026-11-16 Phase 0: RichContent and MathJax 4, `revamp/b-rich-content`
Done:
- `<RichContent value markdown />` (`src/components/content/`), a server
  component. It renders a stored rich document with
  `@tiptap/static-renderer`, or falls back to `LessonMarkdown` when there
  is no valid JSON. Element styles match `LessonMarkdown`
  (`rich-content.css`). Images allow only http(s) and same-site URLs;
  unsafe links are blanked by the link extension.
- MathJax 4 with `REVAMP_UI=1`, MathJax 3 without. `mathJaxVersion()` in
  `lib/ui-flags.ts` is the one source: better-react-mathjax allows one
  version per process. The v4 config turns off the page-wide startup
  typeset, which removes a hydration mismatch (below).
- Importer fix: named HTML references (`&emsp;`, `&nbsp;`) are decoded
  outside code. Before, they stayed literal and exported as `&amp;emsp;`.
  Fixtures added.
- Preview at `/design-system/content`: the same sample lesson through
  `LessonMarkdown` and `RichContent`, side by side.
- `scripts/check-rich-render.tsx`: maths markup, images, tables, and
  hostile input (javascript: links, data: images, script text, TeX).

Next:
- `RichEditor` (Tiptap React, slash and bubble menus, maths popover,
  toolbar in the RibbonToolbar) with a `/design-system/editor` preview.
- `renderContentHtml` for A's emails, when A starts on templates.

Blocked on the other agent (A):
- Self-hosting MathJax 4. It loads from a pinned jsDelivr URL (as v3 does
  from cdnjs), and fetches extra glyphs and its speech engine from there at
  run time. Self-hosting means copying `mathjax` and
  `@mathjax/mathjax-newcm-font` (about 50 MB) into `public/` at build:
  root build config, A's call.

Questions for the owner:
- Existing behaviour: with MathJax 3 (production), `LessonMarkdown` pages
  rendered on the server log a React hydration mismatch, because MathJax
  typesets the page before React hydrates. Maths still shows correctly.
  The v4 config fixes it, and the same one-line change could go to v3 now.
  B left v3 alone in this PR; say if you want the change for v3 too.

## 2026-11-16 Phase 0: rich content core, `revamp/b-editor`
Done:
- `contracts/editor.md` Draft 1, in its own PR: the stored envelope
  (`{ schemaVersion: 1, doc }` in an `xJson Json?` column beside the
  markdown column), the version 1 node set, the save and read rules, and
  the planned `RichContent`, `renderContentHtml` and `RichEditor`.
- `src/lib/content/` (server-safe, no React): `contentExtensions()`
  (StarterKit, block image with the `[50%]` width convention, tables, and our
  own `inlineMath`/`blockMath` nodes for MathJax 4, not KaTeX),
  `markdownToDoc`/`docToMarkdown` on `@tiptap/markdown`, `validateDoc`
  (schema check plus a 512 KB cap), and the stored envelope.
- `normalizeTexDelimiters` takes `{ escapeMath: false }` for the importer;
  the default is unchanged.
- `scripts/check-rich-content.ts`: 70+ checks. Every fixture round-trips
  (markdown, JSON, markdown, same JSON), and the maths nodes hold the exact
  TeX. Fixtures follow the audit's shapes (matrices, `aligned`, `cases`,
  `\[26\]`, `\$5`, image widths, tables). Tampered documents are refused.
- New dependencies (owner-approved Tiptap): `@tiptap/core`, `pm`,
  `starter-kit`, `markdown`, `extension-image`,
  `extension-table`.
- Restored the app-shell entry below. The merge of `main` into #46 dropped it.

Next:
- `RichContent` (static renderer plus MathJax 4) and the MathJax 4 move,
  then `RichEditor` with a `/design-system/editor` preview.
- The first `Json` column needs `prisma db push`: B will ask the owner in
  the PR that moves the first field (lesson body).

Blocked on the other agent (A):
- None. A: messages and email templates should follow editor.md's rules
  (validate, save both columns, render with B's functions).

Questions for the owner:
- None yet. The `db push` question comes with the first field.

## 2026-11-16 Phase 0: app shell, `revamp/b-app-shell`
Done:
- `contracts/navigation.md` (Draft 1, its own PR as the contracts README asks): the frame, eight rules for pages
  (one PageHeader, one status, one primary action, help at the right,
  sub-views as RibbonNav links, commands in a RibbonToolbar, nothing global
  on a page), nav by role, and what changes when `getViewer()` lands.
- `src/components/shell/`: `AppShell` (Notion-style sidebar with account
  menu, notification bell, search, role nav, settings and help; a top bar
  and drawer below lg; Ctrl/⌘K palette with "Go to" pages plus live
  `searchEverything` results), `PageHeader`, `Ribbon`/`RibbonNav`/
  `RibbonToolbar` (Radix toolbar, new dependency, owner-approved),
  `StatusChip`, and `nav-config.ts` with `scripts/check-shell-nav.ts`.
- `src/app/dashboard/layout.tsx` renders `AppShell` when `REVAMP_UI=1`,
  else today's shell. The 11 legacy context providers moved to
  `legacy-providers.tsx`, which both shells use, so every existing page
  works in the new frame. Without the flag nothing changes.
- Preview at `/design-system/shell` (development, or the flag).

Next:
- Move the first pages onto `PageHeader` (course overview and the test
  runner), then the Tiptap editor contract (`contracts/editor.md`).

Blocked on the other agent (A):
- Set `REVAMP_UI=1` on staging so the shell can be checked signed in.
  B has not seen `/dashboard` in the new frame with a real session: the
  dev database is production, so B does not sign in there.
- `src/lib/viewer.ts`: the layout reads `session.user.role` until then
  (the one exception to viewer.md rule 7, marked `TODO(viewer)`).

Questions for the owner:
- None.

## 2026-11-16 Phase 0: component library, `revamp/b-components`
Done:
- New primitives in `src/components/ui/`: `table`, `property-list`,
  `sidebar`, `empty-state` (with a server `Scene` loader for the Open Peeps
  scenes), `command-palette` (Radix dialog, combobox/listbox roles, arrow
  keys, Ctrl/⌘K hook, static and server-filtered groups) and `kbd`.
  Button, input, badge, card and the rest already pick up the revamp
  tokens, so they were not rewritten.
- Preview at `/design-system/components` (development, or `REVAMP_UI=1`).
- PR #41 (illustrations) was changed after review: dark mode keeps figures
  light (dark ink on #F7F7F5), the owner's choice. The illustration entry
  below predates that.
- Noted from A's HANDOFF: the owner moved `graphing` and `math-input` to
  **Plus** (revision 3 had graphing on Pro). B follows `services.md`.

Next:
- `contracts/navigation.md` and the new app shell (header with breadcrumb
  and workspace switcher, ribbon, sidebar, command palette wired to
  `searchEverything`), behind `REVAMP_UI`.

Blocked on the other agent (A):
- The shell reads today's session until `getViewer()` ships (contract
  draft in PR #43). B will switch to it when `src/lib/viewer.ts` lands.

Questions for the owner:
- None.

## 2026-11-16 Phase 0: design tokens, `revamp/b-design-tokens`
Done:
- The owner asked to start building after B1 (2026-11-16), so B2 and B3
  run as part of the build: each Phase 0 PR carries its own design notes.
- Revamp tokens in `src/app/revamp-tokens.css`: Notion-like palette with
  the owner-approved contrast fixes, light and dark, Geist and Geist Mono,
  14 px body, Geist 600 headings (Fraunces gone). Active under
  `data-ui="revamp"`, which the root layout sets when `REVAMP_UI=1`.
  Without the flag production is unchanged, except that `font-mono` now
  really uses JetBrains Mono (its variable referenced itself before).
- New `success`, `warning` and `link` colour utilities.
- `/design-system` preview page (development, or with the flag).
- Illustration set in PR #41 (`revamp/b-illustrations`, subagent): 14
  Open Peeps scenes for empty states and onboarding, 32 avatar busts picked
  by a hash of the user id, 4 Transhumans spot images. Theme-aware inline
  SVG, one module each, 68% smaller after SVGO. Preview at
  `/design-system/illustrations`. Dark mode inverts the figures (light
  lines, dark fills); one variable (`--illustration-surface`) changes it.

Next:
- Component library (button, input, table, property row, sidebar, command
  palette, empty state), then the new app shell and `contracts/navigation.md`.

Blocked on the other agent (A):
- Set `REVAMP_UI=1` on staging when the shell lands (env vars are A's).

Questions for the owner:
- None.

## 2026-11-16 B1 Research, `revamp/b-research` (and fixes on `revamp/b-fixes`)
Done:
- Thirteen research files in `docs/revamp/b/research/` and `SUMMARY.md`
  (editor, math, graphing, dual mode, navigation, test designer, reusable
  content, coding automarker, AI marking, calendar, fonts and accessibility,
  illustrations, stored maths audit).
- The owner answered all thirteen questions the same day. They are recorded
  in `research/SUMMARY.md` under "Owner decisions". In short: Tiptap JSON,
  MathJax 4 everywhere, no Simple/Technical modes (one Notion-like UI),
  coding automarker and Judge0 parked, AI marking designed on Bedrock,
  Fraunces dropped, all graphing on Pro and above, Google Meet as the
  default meeting link, one question per screen in the runner, new
  dependencies approved.
- Read-only maths audit of the shared database (owner approved): all 5,605
  stored formulas render in MathJax 4.1.3 with no regressions
  (`research/13-math-audit.md`).
- Three bugs fixed on `revamp/b-fixes` (cut from `main`): numeric marking
  (decimal commas, fractions, a margin on the key), a stale-tab guard on
  test saves (fingerprint check, no schema change) and repeating events
  computed in Africa/Johannesburg rather than the server's UTC.

Next:
- B2 System design and B3 UI/UX, now unblocked.

Blocked on the other agent (A):
- `contracts/viewer.md`: drop the `mode` (simple or technical) field;
  the owner removed modes.
- `contracts/services.md`: `graphing` and `math-input` keys at Pro and
  above; no `automarker` key needed for v1 (parked).
- Google Meet links (default meeting tool): an auto-created link needs a
  Google OAuth app with the Calendar scope. Pasted links work without it.
- No Judge0 VM: the coding automarker is parked by the owner.
- The owner cleared the rest of "Inputs for Agent A" in `research/SUMMARY.md`
  to proceed (Bedrock prices, POPIA s72/s57 view before AI marking ships,
  Blob growth from copies, the Guardian model).
- B needs `contracts/viewer.md` and `contracts/services.md` for B2.
- React is 18.3.1 in `package.json`, not 19. The upgrade is a root-config
  change (A's).

Questions for the owner:
- None open. Review and merge the two pull requests when ready.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
