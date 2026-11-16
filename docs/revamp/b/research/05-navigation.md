# Navigation: parent header and contextual ribbon

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Copy the Azure portal shell. It has a global header (search, help, notifications, account), a breadcrumb, a command bar with contextual actions, and a service menu ([Azure portal overview](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview)). Our version: **header = where am I + what's the main action**, **ribbon = the views and tools of this one object**.
- The ribbon is two ARIA things side by side. On the left is a `<nav>` of links with `aria-current` for views that change the URL (GitHub Primer UnderlineNav style). On the right is a `role="toolbar"` with roving tabindex for actions (WAI-ARIA toolbar pattern, Radix Toolbar). Don't use `role="tablist"` for anything that changes the URL.
- Overflow uses priority+. Items that don't fit move into a "More" menu, measured with `ResizeObserver`. On phones the ribbon scrolls sideways and the header keeps only Back, title and one primary action.
- Keep today's ⌘K `GlobalSearch` and grow it into a command palette. Moving it onto `cmdk` (MIT, React 18 and 19) is an option when we add actions.
- In the test runner, the timer and Submit live in the header. The question strip is the ribbon, and every chip states its status in words, not only colour.

## 1. What we have today

| File | What it does |
|---|---|
| `src/app/dashboard/dashboard-shell.tsx` | Sidebar `Nav` beside `main`. `Header` sits at the top of `main`. The window is the only scroller. `main` has `min-w-0` so wide tables scroll in place. It wraps 11 context providers. |
| `src/app/dashboard/models/header.tsx` | Sticky, `h-14` (56px) and `lg:h-20` (80px). Left: page title from the **first path segment only** (`PAGE_TITLES`), greeting and role chip. Centre: `GlobalSearch`. Right: help link, `NotificationBell`, profile dropdown (Profile, Settings, Sign out). Hamburger below `lg`. |
| `src/app/dashboard/models/nav.tsx` | Role-based lists (student, tutor, admin, parent) plus a footer (Profile, Settings, Help). Collapsible on desktop, Radix dialog drawer on mobile, `aria-label="Main"`. |
| `src/features/search/components/global-search.tsx` | Combobox with `role="combobox"`/`listbox`, ⌘K/Ctrl+K focus, a full-screen sheet below `md`, and server-side scoped search plus a "Pages" group. Already most of a command palette. |

Gaps: no breadcrumb (a lesson inside a course shows "Manage-courses"), no per-object actions in the header, no ribbon, and the 80px desktop header uses vertical space that Technical mode wants back.

## 2. Reference products

| Product | Header | Contextual bar | Overflow / mobile | Lesson for us |
|---|---|---|---|---|
| Azure portal | Global header with search, Copilot, Cloud Shell, notifications, settings, support, account. Breadcrumb under it ([overview](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview)) | **Command bar**: controls contextual to the current focus. **Service menu**: per-resource menu with its own search and favourites ([same](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview)) | Portal menu flyout or docked, a user setting ([set preferences](https://learn.microsoft.com/en-us/azure/azure-portal/set-preferences)) | Closest match to header + ribbon. Breadcrumb is "move back a level". |
| AWS console | Unified Navigation is the header and footer: services menu, unified search, CloudShell, notifications, support, settings, account ([AWS unified navigation](https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/unified-navigation.html)) | Services menu with recents, favourites and all services ([services menu](https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/service-menu.html)). Favourites bar, drag to sort, synced per account ([AWS 2021 announcement](https://aws.amazon.com/about-aws/whats-new/2021/11/aws-management-console-navigation-bar-improvements)) | Cloudscape: top nav for global utilities, side nav for service structure, breadcrumbs paired with side nav ([Cloudscape service navigation](https://cloudscape.design/patterns/general/service-navigation/)) | Service switcher = recents + favourites + all. Utilities never go in the side nav. |
| GitHub repo | Repo header with owner/repo breadcrumb | UnderlineNav: `nav` landmark with links, `aria-current="page"`, a "More" overflow, icons hidden at narrow widths ([Primer UnderlineNav](https://primer.style/product/components/underline-nav/)) | Overflow menu | Tabs that change the URL are links in a `nav`, not ARIA tabs. Primer keeps `UnderlinePanels` for real tabs ([same](https://primer.style/product/components/underline-nav/)). |
| Office (Simplified ribbon) | App header | Single-line ribbon with the most-used commands, pinning, a "..." overflow, and "Tell me" search ([Microsoft support](https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon)) | Caret toggles classic/simplified ([same](https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon)) | A single line plus overflow plus search covers most of what a full ribbon does. |
| Figma UI3 | Minimal | Tool bar moved to the bottom. Selected object's actions sit at the top of the properties panel. "Minimize UI" hides panels and keeps the toolbar ([Figma blog](https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/)) | Users report tools hidden behind "..." when the panel is narrow ([Figma forum](https://forum.figma.com/archive-21/ui3-properties-panel-gripes-8217)) | Contextual tools should follow the selection (lesson block, question). Overflow hides discoverability, so keep top tools pinned. |
| Google Docs | Title + menu bar + toolbar | Toolbar is a single line with overflow. "Hide the menus" (compact mode) is Ctrl+Shift+F. Tool finder (menu search) is Alt+/ ([Docs shortcuts](https://support.google.com/docs/answer/179738)) | | A menu search like Docs' tool finder is our ⌘K. A "compact" toggle matches Technical mode. |
| Vercel dashboard | Team/project switcher breadcrumb and a tab row per project (unverified, no official doc found) | | | Switcher in the breadcrumb itself (click the project name to switch) is a strong pattern for courses. |

## 3. Accessibility rules for the shell

| Part | Markup | Keyboard |
|---|---|---|
| Header | `<header>` landmark. Breadcrumb as `<nav aria-label="Breadcrumb"><ol>` with the last item `aria-current="page"` and not a link. | Normal tab order |
| Service switcher | Button with a menu (Radix DropdownMenu) or a combobox with search when there are more than about 10 items | Enter or Space opens. Type-ahead. Esc closes and returns focus. |
| Ribbon left: views | `<nav aria-label="Course">` with links and `aria-current="page"` ([Primer](https://primer.style/product/components/underline-nav/)) | Tab through links (few items) |
| Ribbon right: tools | `role="toolbar"` with `aria-label`. Only for 3 or more controls. Single tab stop, arrows move, Home/End optional. Avoid controls that need arrow keys inside, or put them last ([APG toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)). Radix Toolbar implements roving focus, Home/End, `loop` and `orientation` ([Radix Toolbar](https://www.radix-ui.com/primitives/docs/components/toolbar)). `@radix-ui/react-toolbar` 1.2.1, MIT, React 16.8 to 19 ([npm](https://registry.npmjs.org/@radix-ui/react-toolbar/latest)). | Tab in, arrows between, Tab out |
| Real tabs (same URL, panel swap) | `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`. Automatic activation only if panels show without delay ([APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)) | Arrows between tabs, Tab into panel |
| Overflow "More" | Menu button. Hidden items move into the menu in the same order. | Same as any menu |
| Sticky stack | Header + ribbon both sticky. Set `html { scroll-padding-top: calc(var(--header-h) + var(--ribbon-h)) }` so focused items aren't hidden (WCAG 2.4.11, see 11-fonts-accessibility.md). | |

Using `role="tablist"` for link navigation makes screen readers announce "tab 2 of 5" and expect arrow keys, while the links reload the page. APG's tabs pattern only covers in-place panel switching ([APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)). Today's `src/components/ui/tabs.tsx` (Radix Tabs) is fine for in-page panels only.

### Priority+ overflow

The priority+ pattern shows as many items as fit and puts the rest behind "More". It was coined by Michael Scharnagl ([CSS-Tricks](https://css-tricks.com/?p=207389), [Brad Frost](https://bradfrost.com/?p=8405)). Brad Frost notes the trade-off: someone must rank items by importance ([same](https://bradfrost.com/?p=8405)). Implementation: render all items, measure with `ResizeObserver`, hide from the end (lowest priority first), and mirror hidden items into the menu. The current view is never moved into overflow. Each item gets an explicit `priority` number, so the ranking is a reviewed decision.

### Command palette

| Option | Facts | Fit |
|---|---|---|
| Extend `GlobalSearch` | Already ⌘K, combobox/listbox ARIA, mobile sheet, server-scoped results | No new dependency. We have to maintain the keyboard and filtering code ourselves. |
| `cmdk` (or shadcn `Command`, which wraps it) | 1.1.1, MIT, peer React ^18 or ^19, depends on Radix Dialog ([npm](https://registry.npmjs.org/cmdk/latest)). Unstyled, filters and sorts automatically, tested with VoiceOver ([cmdk repo](https://github.com/dip/cmdk)) | Good for a mixed list of commands and results. It is a new dependency. |

Palette groups: **Go to** (pages, courses, recent items), **Actions in this page** (registered by the current ribbon, for example "Add question", "Publish"), **Create** (course, test, event), **Preferences** ("Switch to Technical mode", "Dark mode"). Ribbon actions register with the palette, so every ribbon command has a keyboard path, and overflowed items stay one shortcut away. Add a user setting to turn off single-key shortcuts, as GitHub does ([GitHub accessibility settings](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/managing-accessibility-settings)).

## 4. Proposed anatomy

```
┌ Header 48px (Simple) / 44px (Technical) ───────────────────────────────────┐
│ [≡] Nexa ▸ Courses ▸ Grade 11 Maths ▾ ▸ Lesson 4      ●Draft  [⌘K] [?] [🔔] [Avatar] │
│                                             [Secondary ▾] [Primary action] │
├ Ribbon 40px (Simple) / 36px (Technical) ───────────────────────────────────┤
│ Overview  Lessons  Tests  Students  Marks  More ▾ │ [tool][tool][tool] [⋯] │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Left sidebar.** Keep it for tutors and admins on `lg` and up (today's `nav.tsx`). Default to an icon rail in Technical mode and labels in Simple mode, like Azure's docked/flyout choice. Students and parents have 5-7 destinations, so they get the sidebar too, but no service switcher.
- **Breadcrumb.** Starts at the section ("Courses"), not "Dashboard". The object segment has a ▾ that opens the **service switcher** (recent and favourite courses, then all, with search), like AWS recents/favourites.
- **Status chip.** Draft, Published, Scheduled, Live, Closed. Text plus colour, using the fixed status tokens from 11-fonts-accessibility.md.
- **Main actions.** One primary button at most, plus one secondary menu. Everything else lives in the ribbon toolbar.
- **Help** stays in the same header slot on every page (WCAG 3.2.6).
- **Ribbon** appears only when the page is about one object. List pages (all courses, calendar) may skip it or use it for filters and views.

### Mobile (below `md`)

- Header: `[←]` back to the parent breadcrumb level, a truncated title, the status chip as a dot with text, one primary action, `[⋯]` for the rest. Search becomes an icon (today's sheet).
- Ribbon: the view links become a horizontally scrollable `nav` with the current item scrolled into view. Toolbar items collapse into `[⋯]`.
- Bottom-sheet menus instead of dropdowns for the switcher (Radix Dialog, as `nav.tsx` already does for the drawer).

## 5. Per-screen split

| Screen | Header: breadcrumb / status / main actions | Ribbon left: views (links) | Ribbon right: toolbar | Mobile notes |
|---|---|---|---|---|
| Tutor home | "Home". No status. Primary: **New** ▾ (course, test, event, announcement) | Today, Marking queue, Courses, Activity | Date range, Refresh | Ribbon views become a scroll row. "New" stays. |
| Course page | Courses ▸ **Grade 11 Maths ▾** (switcher). Status: Published/Draft. Primary: **Publish** or **Share**. Secondary ▾: Duplicate, Archive, Settings | Overview, Lessons, Tests, Assignments, Students, Marks, Live sessions (Plus), Settings | Context tools for the current view, for example on Lessons: Add lesson, Reorder, Import | Priority order: Lessons, Tests, Students, Marks first. Others go to "More". |
| Lesson editor | Courses ▸ Course ▾ ▸ **Lesson 4** ▾ (lesson switcher). Status: Draft / Saved 12:03 / Published. Primary: **Publish**. Secondary: Preview, Version history | Write, Preview, Resources, Settings | `role="toolbar"`: Heading, Bold, List, Math (TeX), Image, Table, Code, Callout, then overflow. Tools follow the selected block (Figma-style). | Toolbar becomes a sticky bar above the keyboard (Guess: needs a spike on iOS Safari). |
| Test designer | Courses ▸ Course ▾ ▸ Tests ▸ **Term 3 test** ▾. Status: Draft/Scheduled/Open/Closed. Primary: **Publish** / **Schedule**. Secondary: Preview as student, Duplicate | Questions, Settings, Assign, Results | Add question ▾ (12 types), Question bank (Plus), Reorder, Shuffle, Points total "45 pts" | Points total stays visible next to [⋯]. |
| Test runner (student) | **Test title** (no breadcrumb links out: leaving is a decision). Timer `mm:ss` in Geist Mono `tnum`. Primary: **Submit** (opens a confirm dialog listing unanswered and flagged). No global search. Help stays in its slot. | Question strip: `<nav aria-label="Questions">` with buttons 1..n. Current item has `aria-current="step"`. Accessible names like "Question 3, answered, flagged". The visual uses icon + colour. | Flag for review, Calculator (if allowed), Text size | Strip scrolls sideways with the current item centred. Timer and Submit stay in the header. Timer announces at 5 and 1 minutes with a polite live region, not every second. |
| Assignment marking | Courses ▸ Course ▾ ▸ Assignment ▸ **Thandi M. (3 of 28)** ▾ (student switcher). Status: Submitted late / Marked. Primary: **Save & next**. Secondary: Return to student | Submission, Rubric, History | Prev / Next student, Annotate, AI suggest (Pro), Plagiarism (Pro), Download | Prev/Next as large buttons. Single-key j/k shortcuts can be turned off. |
| Calendar | "Calendar". Primary: **New event** | Month, Week, Day, Agenda (these change the URL, so they are links) | Today, ◀ ▶, Course filter, Show (lessons, tests, live) | Default to Agenda on phones. |
| Student home | "Home". No primary action, or "Continue lesson" when there is one | Today, Courses, Tests, Grades | none | Fewer elements. Simple mode only by default. |
| Parent portal | **Child switcher** first: "Lerato ▾" (one parent, several children), then the section. Primary: **Message tutor** | Overview, Progress, Attendance (Plus), Payments | Term filter, Download report | The child switcher is the top element on mobile too. Never hide it in "More". |

## 6. Code impact

- New `src/components/shell/` with `AppHeader`, `Breadcrumbs`, `ServiceSwitcher`, `Ribbon` (`RibbonNav` + `RibbonToolbar`), `OverflowMenu`.
- Pages declare their header and ribbon through a small slot API, for example a `<PageChrome breadcrumb status actions ribbon>` server component rendered by the route layout. The header becomes data-driven, and `PAGE_TITLES` and `getPageTitle` in `header.tsx` go away.
- Nested layouts (`/dashboard/manage-courses/[id]/layout.tsx`) own the course ribbon, so it persists across child routes without remounting.
- The test runner route uses its own minimal layout without the sidebar, which removes the "leave the test by accident" risk.
- `GlobalSearch` gains an "Actions" group fed by a `useRegisterCommands()` hook from the ribbon.
- Header height drops from 80px to 44-48px on desktop. Together with a 36-40px ribbon, the total chrome is about the same as today's 80px.

## Recommendation

**Pick:** An Azure-style shell. A 48/44px header with a breadcrumb that contains the service switcher, a status chip, help in a fixed slot and one primary action. Under it a 40/36px ribbon split into a link `nav` (views, `aria-current`) and a Radix `Toolbar` (tools, roving tabindex). Priority+ overflow with explicit priorities. Extend today's ⌘K `GlobalSearch` into the command palette with page-registered actions. Reasons: it matches the AWS, Azure and GitHub patterns users know, keeps ARIA roles correct, adds one small MIT dependency at most, and removes the pathname-guessing title logic.

**Fallback:** If the ribbon slips, ship the header with breadcrumb and switcher first, and keep in-page view links in the page body. Move to `cmdk` only if extending `GlobalSearch` gets too complex.

## Open questions for the owner

1. Do students and parents keep a sidebar, or only the header + ribbon? (Fewer destinations make a sidebar optional.)
2. Should the test runner hide the sidebar and global search completely? Recommended: yes, help stays.
3. Single-key shortcuts (j/k in marking, ? for help): yes now, with an off switch, or later?
4. Is `@radix-ui/react-toolbar` (MIT) acceptable as a new dependency, or should the roving tabindex be hand-written?
5. Parent portal: is it inside `/dashboard` with the same shell, or a separate, lighter shell?

## Sources

- https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/azure-portal/set-preferences (checked 2026-11-16)
- https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/unified-navigation.html (checked 2026-11-16)
- https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/service-menu.html (checked 2026-11-16)
- https://aws.amazon.com/about-aws/whats-new/2021/11/aws-management-console-navigation-bar-improvements (checked 2026-11-16)
- https://cloudscape.design/patterns/general/service-navigation/ (checked 2026-11-16)
- https://primer.style/product/components/underline-nav/ (checked 2026-11-16)
- https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon (checked 2026-11-16)
- https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/ (checked 2026-11-16)
- https://forum.figma.com/archive-21/ui3-properties-panel-gripes-8217 (checked 2026-11-16)
- https://support.google.com/docs/answer/179738 (checked 2026-11-16)
- https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ (checked 2026-11-16)
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ (checked 2026-11-16)
- https://www.radix-ui.com/primitives/docs/components/toolbar (checked 2026-11-16)
- https://registry.npmjs.org/@radix-ui/react-toolbar/latest (checked 2026-11-16)
- https://registry.npmjs.org/cmdk/latest (checked 2026-11-16)
- https://github.com/dip/cmdk (checked 2026-11-16)
- https://css-tricks.com/?p=207389 (checked 2026-11-16)
- https://bradfrost.com/?p=8405 (checked 2026-11-16)
- https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/managing-accessibility-settings (checked 2026-11-16)
