# Contract: navigation and the app shell

Owner: Agent B. Reader: Agent A. Status: **Draft 1, 2026-11-16.** A asks for changes in `docs/revamp/a/HANDOFF.md` or an issue labelled `needs-b`; B edits this file in its own pull request.

**Answer first.** With `REVAMP_UI=1`, every `/dashboard` page renders inside `AppShell`: a Notion-style sidebar that holds everything global, and a content column where each page draws its own `PageHeader` (breadcrumb, one status, actions, help) and, if it has sub-views, a `Ribbon`. Navigation is plain data per persona in one file. A page never builds its own sidebar or global search. A's pages follow the same rules.

Research behind it: [b/research/05-navigation.md](../b/research/05-navigation.md).

## Where it lives

| Export | File | Runs on |
| --- | --- | --- |
| `AppShell`, `ShellUser` | `src/components/shell/app-shell.tsx` | Client |
| `NavLink`, `NavSection`, `navSectionsForRole()`, `FOOTER_LINKS`, `activeHref()` | `src/components/shell/nav-config.ts` | Both (pure data, no React) |
| `PageHeader`, `Crumb` | `src/components/shell/page-header.tsx` | Both (no hooks) |
| `Ribbon`, `RibbonNav`, `RibbonToolbar`, `RibbonButton`, `RibbonSeparator` | `src/components/shell/ribbon.tsx` | Client |
| `StatusChip`, `StatusTone` | `src/components/shell/status-chip.tsx` | Both |
| `LegacyProviders` | `src/app/dashboard/legacy-providers.tsx` | Client |
| `CommandPalette`, `useCommandPaletteShortcut` | `src/components/ui/command-palette.tsx` | Client |

The switch is in `src/app/dashboard/layout.tsx`: `isRevampUi()` picks `AppShell`, otherwise the legacy `DashboardShell`. Both wrap pages in `LegacyProviders`, so today's pages work unchanged in either frame.

## The frame

```
+----------------+----------------------------------------------------------+
| Account v  (o) | Courses > Maths > Unit 3 quiz  * Published  [Share] ?    |  PageHeader (sticky)
| Search  Ctrl K +----------------------------------------------------------+
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
- **Ctrl/⌘K** opens the command palette anywhere. It shows "Go to" (every nav link, matched on label and keywords) and, from two characters, live results from `searchEverything`.

## Rules for pages (both agents)

1. **Start every page with one `PageHeader`.** The breadcrumb runs from the section to this page; the last crumb is the page itself and is not a link. On small screens only the last crumb shows.
2. **One status at most**, as a `StatusChip` (dot plus word; tones neutral, info, success, warning, danger). It is the state of the thing on the page (Draft, Published, Open, Closed, Graded), not a count.
3. **One primary action at most** (`<Button>`); others are ghost or outline buttons, or go in the ribbon. Destructive actions never sit in the header.
4. **Help stays at the far right.** `helpHref` defaults to `/dashboard/help`; pass a deeper link when one exists. Pass `null` only on the help pages themselves.
5. **Sub-views use `RibbonNav`.** Each one is a URL (a route or a `?view=` param), so it can be linked to and the back button works. They are links with `aria-current="page"`, not ARIA tabs. The first link is the overview and only lights on its own URL.
6. **Commands for the current view use `RibbonToolbar`** (filter, sort, export, bulk actions). It is one `role="toolbar"` stop: Tab enters, the arrow keys move. Give it an `aria-label`.
7. **Do not add global things to a page:** no own sidebar, search box, account menu or notification bell. Ask B to add a nav link instead (below).
8. **Do not put a page's heading in the header.** The header carries the breadcrumb; the page's `<h1>` sits in the content, in `font-display`.

## Nav by role (today)

Until `getViewer()` ships, the layout reads `session.user.role` (`STUDENT`, `TUTOR`, `ADMIN`, `PARENT`; unknown values get the student nav). Every role gets Home and Notifications at the top and Settings and Help at the foot.

| Role | Sections |
| --- | --- |
| STUDENT | Learning: Courses, Calendar, Tests, Assignments, Grades |
| TUTOR | Teaching: Courses, Calendar, Tests, Assignments, Gradebook, Analytics. People: Users |
| ADMIN | Platform: Users |
| PARENT | (top and foot only) |

The current item is the longest nav href that equals the path or is a whole-segment prefix of it (`activeHref`). `/dashboard` only lights on itself. `scripts/check-shell-nav.ts` checks these rules.

## When `getViewer()` lands (contracts/viewer.md)

B will make these changes in its own PR, without changing the page rules above:

- `navSectionsForRole(role)` becomes `navSectionsFor(viewer)`, keyed by `viewer.persona` (`staff`, `learner`, `guardian`, `admin`) and filtered with `can(viewer, …)`. Links stay plain `NavLink` data.
- The account menu gains the **workspace switcher** (`viewer.workspaces`, calling A's `switchWorkspace`), and guardians get a child picker (`viewer.children`).
- The shell shows A's banners above the content column: impersonation (`viewer.impersonatedBy`, rule 5 of viewer.md) and read-only billing (`workspace.readOnly`, rule 4).
- `AppShell` takes only the fields it shows (name, email, image, persona, workspaces), never the whole `Viewer`.

## Adding a nav link

A link is one entry in `nav-config.ts`: `{ label, href, icon, keywords? }`. `icon` is a name from `NavIcon`; the client maps it to a lucide icon, so the data stays serialisable. A asks in HANDOFF with the label, route, which personas see it and the permission that gates it, and B adds it. Every href stays under `/dashboard` and appears once per role (the check script enforces both).

## Not in Phase 0

- Priority+ overflow ("More" menu) for long ribbons. Phase 0 ribbons scroll sideways.
- Collapsing the desktop sidebar to icons.
- Recent and favourite pages in the sidebar and palette.
- Unread counts on nav items (`SidebarItem` already takes `trailing`).
