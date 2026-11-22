# Contract: navigation and the app shell

Owner: Agent B. Reader: Agent A. Status: **Draft 4, 2026-11-18.** A asks for changes in `docs/revamp/a/HANDOFF.md` or an issue labelled `needs-b`; B edits this file in its own pull request.

**Answer first.** With `REVAMP_UI=1`, every `/dashboard` page renders inside `AppShell`: a Notion-style sidebar that holds everything global, and a content column where each page draws its own `PageHeader` (breadcrumb, one status, actions, help) and, if it has sub-views, a `Ribbon`. Navigation is plain data per persona in one file. A page never builds its own sidebar or global search. A's pages follow the same rules.

Research behind it: [b/research/05-navigation.md](../b/research/05-navigation.md).

Changes in Draft 4:
- `<AccountBanners viewer />` has shipped (A) and is in the layout's `banner` slot (B).
- `LegacyProviders` now holds only `MathProvider`; no page reads a legacy context.

Changes in Draft 3:
- The nav goes by `viewer.persona` and permissions (`navSectionsFor`).
- The account menu has the workspace switcher.
- The banner content is A's `<AccountBanners viewer />`.

Changes in Draft 2:
- `AppShell` has a `banner` slot for account-wide notices.
- A's wireframe names are mapped to these components (see "A's slot names").

## Where it lives

| Export | File | Runs on |
| --- | --- | --- |
| `AppShell`, `ShellUser` | `src/components/shell/app-shell.tsx` | Client |
| `NavLink`, `NavSection`, `NavViewer`, `navSectionsFor()`, `FOOTER_LINKS`, `activeHref()` | `src/components/shell/nav-config.ts` | Both (pure data, no React) |
| `PageHeader`, `Crumb` | `src/components/shell/page-header.tsx` | Both (no hooks) |
| `Ribbon`, `RibbonNav`, `RibbonToolbar`, `RibbonButton`, `RibbonSeparator` | `src/components/shell/ribbon.tsx` | Client |
| `StatusChip`, `StatusTone` | `src/components/shell/status-chip.tsx` | Both |
| `LegacyProviders` | `src/app/dashboard/legacy-providers.tsx` | Client |
| `CommandPalette`, `useCommandPaletteShortcut` | `src/components/ui/command-palette.tsx` | Client |

The switch is in `src/app/dashboard/layout.tsx`: `isRevampUi()` picks `AppShell`, otherwise the legacy `DashboardShell`. Both wrap pages in `LegacyProviders`, which is now only the `MathProvider`.

## The frame

```
+----------------+----------------------------------------------------------+
| Account v  (o) | Your account is read-only until payment.      [Pay now]  |  banner (optional)
| Search  Ctrl K +----------------------------------------------------------+
|                | Courses > Maths > Unit 3 quiz  * Published  [Share] ?    |  PageHeader (sticky)
|                +----------------------------------------------------------+
|                | Overview  Questions  Submissions    Filter  Sort  Export |  Ribbon (optional)
| Home           +----------------------------------------------------------+
| Notifications  |                                                          |
| Teaching       |   page content                                           |
|   Courses      |                                                          |
|   ...          |                                                          |
| Settings       |                                                          |
| Help           |                                                          |
+----------------+----------------------------------------------------------+
```

- **lg (1024 px) and up:** the sidebar is sticky beside the content.
- **Below lg:** a 48 px top bar (menu, product name, search) replaces the sidebar. The menu opens the same sidebar as a drawer. `PageHeader` sticks under the top bar.
- **Scrolling:** the window is the only vertical scroller. Wide tables and code scroll inside themselves.
- **Banner:** `AppShell`'s `banner` prop (a React node) renders full width at the top of the content column, above every page, in `data-slot="account-banner"`. It is for account-wide notices only: verify your email, impersonation, read-only billing. A owns what goes in it; the dashboard layout passes it in. It scrolls away with the page, and `PageHeader` still sticks. Notices about one page belong in that page.
- **Ctrl/⌘K** opens the command palette anywhere. It shows "Go to" (every nav link, matched on label and keywords) and, from two characters, live results from `searchEverything`.

### PageFrame (#205, from 2026-11-22)

New pages use `PageFrame` and `PageTitle` from `@/components/shell/page-frame`. Existing pages move over in later steps of #205; A's `/admin/**` pages too.

```tsx
<PageFrame type="record" breadcrumb={[…]} status={<StatusChip …/>} actions={…} secondary={<RibbonNav …/>}>
  <PageTitle icon={<BookOpen />} eyebrow="Course" title="…" description="…" properties={<PropertyList>…</PropertyList>} />
  <PageSection title="Lessons">…</PageSection>
</PageFrame>
```

- **Primary header:** the existing `PageHeader`, 48 px, sticky. Breadcrumb, one status, actions, help. Never the title.
- **Secondary header:** the `Ribbon` (`secondary` prop), 40 px, sticky directly under the primary. Below 768 px it hides while scrolling down and returns on scroll up.
- **Widths:** `type` picks one (home, list and record: Standard 1120 px; editor: Full; settings and runner: Reading 720 px); `width` overrides it.
- **One layout file:** widths, padding (16/24/32 px at <640, 640+, 1024+), top padding and the 32 px section gap are CSS variables in `src/app/page-frame.css`, named for TypeScript in `src/lib/ui-layout.ts`. Don't hard-code them.
- **Test runner:** `type="runner"` shrinks the primary header to a 28 px strip; add `lockdown` for Pro lockdown tests to hide it.
- **Switchers** (workspace, Organisation / Tutor mode) are in the sidebar, never in a page header.
- Every type is on `/design-system/frame?type=…`.

## Rules for pages (both agents)

1. **Start every page with one `PageHeader`.** The breadcrumb runs from the section to this page; the last crumb is the page itself and is not a link. On small screens only the last crumb shows.
2. **One status at most**, as a `StatusChip` (dot plus word; tones neutral, info, success, warning, danger). It is the state of the thing on the page (Draft, Published, Open, Closed, Graded), not a count.
3. **One primary action at most** (`<Button>`); others are ghost or outline buttons, or go in the ribbon. Destructive actions never sit in the header.
4. **Help stays at the far right.** `helpHref` defaults to `/dashboard/help`; pass a deeper link when one exists. Pass `null` only on the help pages themselves.
5. **Sub-views use `RibbonNav`.** Each one is a URL (a route or a `?view=` param), so it can be linked to and the back button works. They are links with `aria-current="page"`, not ARIA tabs. The first link is the overview and only lights on its own URL.
6. **Commands for the current view use `RibbonToolbar`** (filter, sort, export, bulk actions). It is one `role="toolbar"` stop: Tab enters, the arrow keys move. Give it an `aria-label`.
7. **Do not add global things to a page:** no own sidebar, search box, account menu or notification bell. Ask B to add a nav link instead (below).
8. **Do not put a page's heading in the header.** The header carries the breadcrumb; the page's `<h1>` sits in the content, in `font-display`.

## A's slot names

A's UX flows (`a/ux/`) name shell slots. They map to these components:

| A's name | Component |
| --- | --- |
| Parent header | `PageHeader`: breadcrumb, `status`, `actions`, help |
| Child ribbon | `Ribbon`, with `RibbonNav` (views) and `RibbonToolbar` (tools) |
| Account banner slot | `AppShell`'s `banner` prop |
| Workspace switcher, avatar | The sidebar account menu, not the header (there is no header logo) |
| Ribbon "More" | Not in Phase 0: ribbons scroll sideways |

**Panels on B's pages.** Where A owns a panel's content on one of B's pages, such as course "Services" and "Fees", or a student's "Sign-in", "Parents" and "Fees":
- A ships the panel as a server component that takes ids and the viewer as props, such as `<CourseServicesPanel courseId viewer />`.
- B mounts it as a `RibbonNav` view of that page.

## Nav by persona

The layout calls `getViewer()` once and passes `navSectionsFor(viewer)` to `AppShell`. Sections are chosen by `viewer.persona`. Every persona gets Home and Notifications at the top and Settings and Help at the foot. A link with `requires` shows only when the viewer holds that permission. A section left with no links is dropped. Signed out (no viewer) gets the `none` sections.

| Persona | Sections (permission that shows the link) |
| --- | --- |
| `learner` | Learning: Courses, Calendar, Tests, Assignments, Grades (`grades.view`) |
| `staff` | Teaching: Courses (`courses.edit`), Calendar, Tests, Assignments, Gradebook and Analytics (`grades.view`). People: Users (`learners.invite`) |
| `admin` | Platform: Users (`admin.console`) |
| `guardian`, `none` | Top and foot only. Guardians get their children's pages in Phase 1 |

Through today's bridge viewer, each legacy role keeps exactly its old links. The permission check hides UI only: pages and actions check again on the server (viewer.md rule 3).

The current item is the longest nav href that equals the path or is a whole-segment prefix of it (`activeHref`). `/dashboard` only lights on itself. `scripts/check-shell-nav.ts` checks these rules.

## Account menu and banners

- **The account menu** (sidebar top) shows the name, email and avatar.
  - With more than one entry in `viewer.workspaces`, it lists them as a radio group marked "Teaching" (staff) or "Learning" (learner).
  - Picking one calls A's `switchWorkspace` and refreshes the page.
  - With one workspace, its name shows under the email.
  - `AppShell` receives a `ShellUser` (`name`, `email`, `imageUrl`, `role`, `workspaces`, `workspaceId`), never the whole `Viewer`.
- **Guardians** get a child picker (`viewer.children`) in Phase 1, when guardianships exist.
- **Banners.**
  - A's server component `<AccountBanners viewer />` (`src/features/workspaces/components/account-banners.tsx`) is the content. It covers impersonation (`viewer.impersonatedBy`, viewer.md rule 5), read-only billing (`workspace.readOnly`, rule 4) and email verification.
  - The dashboard layout passes it to the `banner` slot.
  - It renders nothing when no banner applies.

## Adding a nav link

A link is one entry in `nav-config.ts`: `{ label, href, icon, keywords? }`. `icon` is a name from `NavIcon`; the client maps it to a lucide icon, so the data stays serialisable. A asks in HANDOFF with the label, route, which personas see it and the permission that gates it, and B adds it. Every href stays under `/dashboard` and appears once per role (the check script enforces both).

## Not in Phase 0

- Priority+ overflow ("More" menu) for long ribbons. Phase 0 ribbons scroll sideways.
- Collapsing the desktop sidebar to icons.
- Recent and favourite pages in the sidebar and palette.
- Unread counts on nav items (`SidebarItem` already takes `trailing`).
