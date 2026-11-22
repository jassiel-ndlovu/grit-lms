# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-22 Filled nav icons, three more themes, the signature strip, `claude/b-colour-touches-f66f7a`

The owner's three colour asks of 22 Nov, in one PR.

Done:
- **Filled nav icons, both shells.** The `--nav-*` hue is now the outline and
  the fill is the same hue mixed into the sidebar (`navFill` in
  `nav-config.ts`, `color-mix` by `--nav-fill-mix`, 42% light / 38% dark), so
  the outline is the darker shade in light mode and the lighter one in dark,
  in every theme, with no colour in code. The active row mixes in more
  (`--nav-fill-mix-active`, 70% / 55%) on top of its fill and weight.
  `SidebarItem` takes `iconFill`; the legacy `NavRow` sets `fill`. Checked
  every icon filled: all read except the bar chart (its open axis fills as a
  triangle), so Analytics is `ChartPie` in both shells.
- **Three themes:** Ocean (cool blue-green), Sunset (warm earth) and High
  contrast (black and white with violet), light and dark, in `themes.css`,
  each with its own nav hues and strip. The list, names and data-theme ids
  are in the new `src/lib/ui-themes.ts`. The picker shows all five with a
  preview (now with the filled icons and the strip), one column below
  420 px. **Calm dark fix:** `--destructive` was #c53030, 3.21:1 as text on
  the page; now #f07068 with dark text on it.
- **A's enum has only CALM and BRIGHT**, so Ocean, Sunset and High contrast
  are kept on the device (`nexa-device-theme`) and the account goes to Calm;
  the picker says so. `effectiveTheme()` lets a device theme win only over
  Calm. The boot script applies any known theme before paint. When A adds
  the ids to `UI_THEMES`, they save on the account with no B change. Asked in
  #217 (`needs-a`).
- **Signature strip:** `SignatureStrip`, 3 px, aria-hidden, absolute under
  its header, so it's sticky with it and moves nothing. PageHeader and
  Ribbon each render one, and `page-frame.css` hides the header's while a
  visible Ribbon follows. **Choice:** the strip runs under the lowest
  header, so under the ribbon when there is one; that reads as one band
  closing the header block instead of a line between the two bars. When
  the ribbon slides away on a phone, the header's strip comes back. Runner:
  1 px at 60%; Pro lockdown has no header, so no strip. Colours are
  `--strip-1..3` per theme and mode (Calm in revamp-tokens, Inkwell in
  globals).
- **Checks:** `scripts/check-themes.ts` now covers all five themes, light
  and dark (reads oklch too), plus the Inkwell nav hues for the legacy
  shell, the strip tokens and the wiring. Lowest: text 4.76 (Calm light),
  outlines 3.25 (Calm light), nav icon outlines 3.85 (Inkwell) / 3.91
  (Bright light). `/design-system/frame` takes `?theme=` any id and
  `&dark=1`. Local screenshots: every theme, light and dark, 375 and 1280.
- **Testing:** section G of `testing/preview-recheck-2026-11-22.md`, not run.

Next:
- Run the Preview rechecks (A to G).
- The command palette icons are still muted; they could take the fills.

Blocked on the other agent:
- #217: add OCEAN, SUNSET and CONTRAST to `UiTheme` and `UI_THEMES`.

Questions for the owner: none.

## 2026-11-22 Page frame rollout (#205 steps 2 to 5), `claude/b-frame-rollout-588b5d`

Every page under `src/app/dashboard/**` now renders `PageFrame` (directly or
through a frame component), with its type from the owner's table. Pages
don't branch on REVAMP_UI; only the shell does.

Done:
- **Frame additions:** `PageTitle` takes an `illustration` (beside the title
  from 768 px, at most 112 px tall, hidden on phones), so the #204 headers
  stay. `PageMessage` frames the one-line "No student profile" and "You
  don't own this" states. `StatTile` / `StatTiles` (`components/ui`) replace
  the white-on-brand hero stats. `--frame-pad-bottom` (48, 64 from 1024).
  `SIDE_PANEL_STICKY_CLASS` and `BELOW_RUNNER_STRIP_TOP_CLASS` in
  `lib/ui-layout.ts`.
- **Frame components** now wrap `PageFrame` and take a `type`: `CourseFrame`,
  `TestFrame`, `BillingFrame`, `AdminBillingFrame` and the new
  `StudentCourseFrame` (My courses › course, Overview / Lessons ribbon).
- **Step 2, students and parents:** homes, courses, a course, a lesson
  (editor type; Previous / Next / Mark complete in the header), tests,
  pre-test, review, grades, assignments, notifications, help, profile,
  settings, fees return, the parent home and a child. Banners became
  `PageTitle` with the illustration.
- **Step 3, tutors:** course pages, lessons workspace, test designer, new
  test, preview, submissions, assignments and the editor, gradebook (a
  course is full width), students, fees, discounts, members, payouts,
  analytics, manage-users.
- **Step 4:** admin billing pages use `AdminBillingFrame` (list or record).
- **Step 5:** `scripts/check-page-frame.ts` (static): every dashboard page
  that renders UI uses a frame component (found by following exports from
  `PageFrame` / `PageMessage`), and none has a page-sized `mx-auto max-w-*`,
  the brand banner, a bare `PageHeader` or a hand-made `font-display` h1.
  Exceptions: the onboarding wizard (welcome, onboarding). Deleted the unused
  `dashboard/components/*`, `tests/skeletons/*` and `tests/review/components/*`.
- **Checked** locally at 375, 768 and 1280 (widths, padding, sticky headers,
  ribbon hiding on phones, runner strip, no sideways scroll). **Testing:**
  section F of `testing/preview-recheck-2026-11-22.md`, not run.

Next:
- Run the Preview rechecks (A to F).
- Pro lockdown hiding the runner strip: there's no lockdown flag on a test
  yet. When A adds one, `PageFrame type="runner"` should drop the header.

Blocked:
- No GitHub workflow runs tsc, lint or `scripts/check-*`; the PR checks are
  Vercel only. Asked A for one (`needs-a`); `.github/` isn't B's.

Questions:
- Pre-test and review aren't focus routes, so they use record type at
  reading width with the full header, not the runner strip. Say if they
  should become focus routes.
- The admin home (`AdminDashboard`, A's `src/features/admin`) and
  `src/app/admin/**` are A's and unframed; offered the frame on #205.

## 2026-11-22 AI-assisted marking UI (#150), `claude/b-ai-marking-ui-6cc9a6`

Built on A's actions (`features/ai-marking/actions.ts`, PR 168). The tutor
accepts, edits or rejects every mark; nothing is filled in or saved by the AI.

Done:
- **Switch** in the test designer's settings (`AiMarkingSwitch`): turning it
  on asks the tutor to confirm parents' consent, then `setTestAiMarking`.
  Without the course's `ai-marking` service it shows "Part of the Pro plan"
  and links the course's Services page (billing on). Saves on its own.
- **Queue** on the test's submissions page (`AiMarkingQueue`): Mark with AI
  for all written questions or chosen ones (`requestAiMarking`), "N queued;
  M skipped", a progress bar that refreshes every 5 s while marking, and
  "N AI marks to review" per row. Off: a link to the setting.
- **Review** in the grading form: per short answer and essay, the AI's mark,
  reasoning per criterion, evidence highlighted in the answer, confidence,
  flags and "Re-marked by the larger model". Accept, Edit (fills and focuses
  the score), Reject, Undo. Chips say "AI suggestion: not confirmed" or
  "Confirmed by you". Decisions go to `recordAiSuggestionAction` when the
  grade is saved (Accept or Edit ending on the AI's mark is ACCEPTED, other
  marks EDITED; a typed score on an untouched suggestion counts too). Polls
  `getAiSuggestions` while any are queued or running.
- **Grading page framed** (the plan's example): PageFrame with the student,
  status and live score in the header; ‹ Previous · n of N · Next ›, Rubric
  and AI suggestions (riskiest first, Accept all safe ones, or all with a
  tick) in the ribbon. `grading-session.tsx` carries the form's state up.
- **Read-only** disables the switch, Mark with AI, every review button and
  Save grade. A's errors show as they come.
- **Checks:** `scripts/check-ai-marking-ui.ts`. **Testing:** section E of
  `testing/preview-recheck-2026-11-22.md`, not run.

Next:
- Run the Preview rechecks (A to E). E needs `ANTHROPIC_API_KEY` on Preview.
- #205 steps 2 to 4.
- A rubric editor in the question editor (A's `TestQuestion.rubric`).

Blocked on the other agent (in #150, `needs-a`):
- A's AI actions throw plain `Error`, so "isn't set up yet", the consent and
  Pro messages reach tutors as "Something went wrong". They need `UserError`.
- They run on `viewerActionClient`, which doesn't refuse writes in a
  read-only workspace. The screens disable them; the server should too.

Questions for the owner: none.

## 2026-11-22 Calendar and attendance UI (#149), `revamp/b-calendar-attendance`

Built on A's contract (`contracts/calendar.md`, PR 172).

Done:
- **Calendar** (`/dashboard/calendar`, framed): Month, Week, Day and Agenda
  in the ribbon with ‹ Today ›; "New session" and Subscribe in the header.
  One `listCalendarOccurrences` call per view (42 days at most), plus tests
  and assignments due, as before. Days are keyed in the viewer's zone
  (`lib/calendar-ui.ts`), so server and browser agree. Below 640 px the
  month shows dots and links to Day; the week stacks.
- **Session form:** new events take the tutor's zone
  (`CourseEvent.timeZone`; preference, else the workspace's). Editing a
  repeating series at one date offers This session / This and following
  (A's `editCourseEventOccurrence`, only changed fields) / All sessions
  (`updateCourseEvent`, shifted by as much as that date moved, with the
  repeat rule). Cancel and restore one session. `getCourseEventSeries`
  loads the series for the form. Wall times use the event's zone, which
  fixes the browser-zone date bug the research noted.
- **Meeting link:** pasted, with "New Google Meet" (meet.google.com/new)
  and the provider named. Join goes live 15 minutes before the start.
- **Attendance** (`/dashboard/calendar/attendance/[eventId]?at=`): P, L,
  A, E per learner, saved at once, notes, "Mark the rest present", and the
  rotating check-in code with a countdown. Students check in from the
  header or the session's dialog.
- **Parents:** Calendar in the guardian sidebar, one child at a time
  (`?child=`); Attendance (rate and recent marks) on the per-child page.
- **Feeds:** Subscribe (A's `getCalendarFeedUrl`: copy, Google, webcal, new
  link) and "Add to my calendar" per event (`/api/calendar/events/[id]/ics`).
- **Read-only** workspaces lock every write (WriteGuard, `useReadOnly`).
- **Checks:** `scripts/check-calendar-ui.ts`; `check-shell-nav.ts` updated.
  navigation.md: guardians get Calendar.
- **Testing:** section D of `testing/preview-recheck-2026-11-22.md`, not run.

Next:
- Run the Preview rechecks (A to D).
- Move the assignment page off `EventContext`, then ask A to retire
  `/api/events` (research 10, v1 item 6).
- #205 steps 2 to 4; #150.

Blocked on the other agent:
- A workspace setting for the default meeting provider (the plan: chosen in
  settings, Google Meet by default). The contract has none, so the form
  defaults to Meet in code. Asked in #211 (`needs-a`).

Questions for the owner: none.

## 2026-11-22 Account, privacy and two-factor screens, `claude/b-account-privacy-3baeb1`

Clears B's `needs-b` inbox: #182, #185, #178 and #174.

Done:
- **Settings › Account (#182, #185):** `/dashboard/settings/account`, framed
  (Settings, Reading width), linked from Settings.
  - Email address: `requestEmailChange` with a password, then "Check your
    new inbox" with `sentTo`. Placeholder accounts get "Add your email
    address"; Google-only accounts get a note instead of the form. Errors
    show as the server writes them.
  - Your data: `GET /api/account/export` from a button, so a 429 reads as
    "the next one is possible from …" instead of raw JSON.
  - Delete: `getAccountDeletionStatus` first (sole owners are told to hand
    over), then a dialog that needs DELETE typed in capitals,
    `requestAccountDeletion`, and `/account/deletion-requested?on=<date>`
    (only the date in the URL). The words list what the contract's
    housekeeping does; guardians are told their children's accounts stay;
    under-18s are told to talk to a parent first.
  - No pending-deletion banner: the contract defines none, and the user is
    signed out and can't sign in while one is pending.
- **Emailed-link pages (B's, signed out, framed):** `/account/cancel-deletion`,
  `/account/confirm-email`, `/account/revert-email`. Each acts only on a
  button click, and handles every status the contract lists.
- **Student profile:** an Account tab with Export data
  (`?userId=`), Delete account (parent's request, typed DELETE) and Cancel
  deletion. A "Deletion pending" chip on the profile and a badge in the
  Students list. Self-made accounts (Draft 1.13) get no delete and no
  new-code button. `RosterStudent` has `managed` and `deleteOn`.
- **Two-factor (#178):** `uqr@0.1.3` pinned exactly (A's OK on #178). The
  scan step shows a QR code beside the setup key (`TotpKeyBlock`).
  Accounts without a password skip the password step (`allowPasswordless`).
  "Remind me tomorrow" stays.
- **#174:** `actionError` already passes `UserError` messages through (it
  only drops a `CODE:` prefix), so Students, invites and the account tabs
  show A's words. `signUpWithPassword` still has no `callbackURL`, so the
  invite page keeps its note; asked again on #174.
- **Checks:** `scripts/check-account-privacy.ts` (31). Local preview with
  temporary fake-data pages, every screen at 1280 and 375 px, no console or
  server errors; the temporary pages are deleted.
- **Testing:** section C of `testing/preview-recheck-2026-11-22.md`.

Next:
- Run the Preview rechecks (sections A to C).
- #205 steps 2 to 4, then #149 and #150.

Blocked on the other agent:
- #185: `requestEmailChange` throws its two-factor message as a plain
  `Error`, so users get "Something went wrong". Asked A to make it a
  `UserError`. Same for the sole-owner throw in `deletion.ts` (the screen
  checks first, so only a race reaches it).
- #174: an optional `callbackURL` on `signUpWithPassword`.

Questions for the owner: none.

## 2026-11-22 Join requests, `revamp/b-join-requests`

Done:
- **Find courses (#206):** `/dashboard/courses/browse` (framed). Listed
  courses from `listListedCourses`, with search (`?q=`) and "More courses"
  (`?cursor=`). A student asks for themself, a parent for each linked
  child (`requestToJoin`, with an optional message). The card says
  "Request sent" once everyone has asked. "Your requests" lists
  `listMyJoinRequests` with Cancel while waiting.
- **Staff inbox:** `/dashboard/join-requests` (framed, `learners.invite`).
  `listJoinRequestsForStaff`, scoped by `needsScope`, with Waiting,
  Approved, Declined and Cancelled tabs. Approve asks whether the student
  is under 18. A minor who asked alone needs the consent box ticked
  (`needsConsent`); a trial student-limit error links to Billing. Decline
  takes an optional reason. Both are `WriteGuard`ed.
- **Listing switch:** course settings for workspace courses
  (`setCourseListed`), with "N requests waiting".
- **Nav:** Find courses for learners and guardians; Join requests under
  People for staff. navigation.md and `check-shell-nav.ts` updated.
  `/dashboard/browse-courses`, which listed every course on the platform,
  now redirects to Find courses.
- **Checks:** `scripts/check-join-requests.ts`. Sample screens:
  `/design-system/join`.
- **Testing:** `testing/preview-recheck-2026-11-22.md` lists the Preview
  rechecks for PR 207 and this batch, none run yet.

Next:
- Run the Preview rechecks.
- #205 steps 2 to 4.

Blocked on the other agent: none.

Questions for the owner: none.

## 2026-11-22 Page frame step 1 and the 21 Nov decision screens, `revamp/b-frame-and-decisions`

Done:
- **Page frame (#205, step 1).** `PageFrame`, `PageTitle` and `PageSection`
  in `components/shell/page-frame.tsx`. Widths (Reading 720, Standard 1120,
  Full), padding 16/24/32 px, top padding and the 32 px section gap live in
  one file, `src/app/page-frame.css`, named in `src/lib/ui-layout.ts`.
  `PageHeader` stays the 48 px sticky primary header (now `top:
  var(--shell-top)`, same place as before). `Ribbon` is the 40 px sticky
  secondary header under it, hidden while scrolling down below 768 px.
  The runner gets a 28 px strip (`density="runner"`); `lockdown` hides it.
  Every page type is on `/design-system/frame?type=home|list|record|editor|runner|settings`.
  No existing page was migrated (steps 2 to 4). navigation.md has the rules.
- **Mode switch (#192, #206):** Organisation / Tutor in the sidebar under
  the account menu (`ModeSwitch` in app-shell). Shown only when
  `viewer.mode` is set and `viewer.workspace.teaches`; `switchViewerMode`
  then a refresh.
- **Teaching switch:** new `/dashboard/settings/organisation` (framed).
  Owner only: typed organisation name, a warning, "only Nexa support can
  switch it back on" (`switchTeachingOff`). Admins of the organisation see
  the state. Linked from Settings for organisations.
- **Admin switch-on:** `/dashboard/admin/billing/workspaces/[id]` is B's, so
  the workspace detail now has a Teaching row with "Switch teaching on…"
  (`adminSwitchTeachingOn`, with a note) when it's off.
- **Tutor lists:** `ownerTutor` loads the membership role and the
  workspace's `teachingOffAt`; `tutorOf` and `otherTeacherName` return null
  for an owner or admin of an organisation that doesn't teach. Course cards
  say "No tutor yet" instead of "Unknown tutor".
- **Restart (#191):** `RestartPanel` on Billing for a CANCELLED workspace,
  or READ_ONLY with nothing overdue, replacing the first-payment button.
  Handles PAY_OUTSTANDING (a pay button per bill, then restart again),
  PAY_FIRST_PERIOD (`startFirstPayment`), CARD_REQUIRED (`CardButton`, then
  restart again) and RESTARTED (refresh).
- **Read-only (#189):** `WorkspaceAccessProvider` in the dashboard layout
  (staff in a read-only workspace) and `WriteGuard`, which swaps a write
  control for a disabled one with a lock and "Your workspace is read-only.
  Pay to unlock it." Used on New course, New event, New test, Import JSON,
  New assignment (list and course overview), Add student and Send invites.
  `exportTestJson` is on `tutorReadActionClient`.
- **Themes (#206):** a Calm / Bright picker card in Settings (revamp
  UI only) that saves at once (`updateOwnPreferences({ theme })`; A's settings form is untouched). Bright is in
  `src/app/themes.css` (light and dark), applied as `data-theme` on
  `<html>` by PreferencesProvider and the boot script.
- **#203:** `providers.tsx` (SessionProvider) deleted; search imports
  `Session` from `@/lib/auth`. No B code imports next-auth now.
- **#196:** `/dashboard/fees` for a learner who neither manages nor pays
  fees shows "Your fees are handled by your parent or your tutor. Ask your
  tutor if you need to pay." (framed) instead of a 404.
- **Checks:** `scripts/check-themes.ts` (every Bright text pair ≥ 4.5:1,
  outlines and nav icons ≥ 3:1, light and dark; the layout file's values)
  and `scripts/check-decision-screens.ts`. Screens with sample data:
  `/design-system/decisions`.

Next:
- #205 steps 2 to 4: move the pages that use `PageHeader`, then student and
  parent pages, then tutor pages; step 5 adds `check-page-frame.ts`.
- Join requests (browse, request, staff inbox) are the next batch.
- On Preview, recheck with real accounts: the mode switch as a teaching
  owner, Settings › Organisation, a cancelled workspace's Billing, and the
  read-only buttons on `seed.thuto.owner`. Locally only the design-system
  pages were checked (no sign-in).
- Dialogs portal outside a `data-ui="revamp"` wrapper, so on the
  design-system pages (not on Preview, where `<html>` carries it) they keep
  the old look.

Blocked on the other agent: none. #203 done on B's side: A can delete the
stand-in `/api/auth/[...nextauth]`, `lib/next-auth.d.ts` and the package.

Questions for the owner: none.

## 2026-11-21 Open Peeps everywhere, coloured nav icons, `revamp/b-peeps-nav-colour`

Done:
- **Storyset is gone.** All 59 Storyset SVGs (and `_originals/`) are deleted
  from `public/illustrations/`. The dashboard page headers (analytics,
  assignments, grades, help, manage users, profile, settings, tests) and the
  landing page now use Open Peeps, generated as before by
  `scripts/generate-illustrations.ts` (12 new scenes). On the primary panel
  the figures keep light paper through a new `illustration-paper` class.
- **401 and 403** get their own figure (`unauthorized`); 404 and 500 keep
  `not-found` and `error`.
- **Transhumans ship as WebP** (six spots, 85 KB in all, down from 247 KB of
  PNG), shown at 240 px or less on a white panel. The landing steps and
  audience cards use them. sharp comes with next; no new dependency.
- **Nav icons have colour.** One fixed hue per destination, as `--nav-*`
  tokens in `globals.css` (light and dark), resolved by `navHue()` in
  `nav-config.ts`. Both shells use them: `SidebarItem` takes `iconColor`, the
  legacy `models/nav.tsx` items carry a `hue`. Labels keep the text colours.
  Lowest contrast: 3.8:1 on the light sidebar or active row, 6.2:1 in dark.
  The active row keeps its fill and weight (and the terracotta tab in the
  legacy shell).
- Licences: the asset folders hold no licence files. Open Peeps and
  Transhumans are CC0, so no credit is needed; recorded in the illustrations
  README.

Next:
- The legacy shell was not checked in a browser (it needs a signed-in
  session). Look at it on Preview.
- The command palette icons are still muted. They could use the same hues.

## 2026-11-21 Owners see every course in their organisation, `revamp/b-owner-course-access`

Owner decision on #192 (2026-11-20), finding F3 of the Preview pass: an
organisation's owner saw only the courses they teach.

Done:
- **`CourseScope`** (`features/courses/lib/course-access.ts`, pure): the
  user id, plus the active workspace when the viewer's grants are unscoped
  (staff persona, `can(viewer, "courses.edit")` and
  `!needsScope(viewer, "courses.edit")`: OWNER and ADMIN). Tutors get no
  workspace. `manageableBy(scope)` is the Prisma filter (workspace OR
  teaches it); `managesCourse(scope, row)` is the same check on a row
  loaded with `{ workspaceId, staff: staffFor(email) }`.
- **Server half** (`features/courses/course-access.ts`): `getCourseScope`
  (per request, from `getViewer()`) and `canManageCourse(courseId, scope)`,
  which replaces both `courseBelongsToTutor`s (courses and gradebook).
- **Pages that now cover the whole workspace for owners and admins:**
  Manage courses, a course's overview, lessons, settings and services
  (`loadTutorCourse`), tests and grading, assignments, the assignment
  editor and marking, the gradebook, the schedule, and the dashboard home
  counts. The list queries take a `CourseScope` instead of a user id.
- **Actions**: every B action that checked `staff.length === 0` now uses
  `managesCourse`, so an owner can edit, mark and set weights on the
  courses they can see. Tutors are unchanged, including PR 186's 404.
- **Who teaches it**: course cards already name the teacher; the course
  overview adds "Taught by" when the viewer doesn't teach it.
- Analytics stays personal ("X's teaching analytics": `tutorScope`).
- Check: `npx tsx scripts/check-course-access.ts`.

Organisation / Tutor mode (#192): A's PR 198 landed first. Its
`needsScope` is true in Tutor mode, so a teaching owner in Tutor mode
gets only their own courses with no extra code here (checked in the
script). B still needs to build the switch in the shell.

To test on Preview as `seed.ubuntu.owner`: Manage courses lists "Maths
Grade 10 (seed)" (Ayanda Zulu) and "Physical Sciences Grade 11 (seed)"
(Bongani Nkosi) as well as their own course; each opens, with "Taught by"
on the overview; their tests, assignments, gradebook and schedule entries
show up; the home counts include them. As `seed.ubuntu.tutor1`, Physical
Sciences still 404s.

Next:
- Search still covers only courses the user teaches (`searchAsTutor`).

Blocked on the other agent:
- A's routes still check "teaches it" only: `api/blob/upload-token`
  (an assignment brief on a tutor's saved assignment) and
  `api/submission-entry/[id]` DELETE. An owner gets "another tutor's
  assignment" there.

## 2026-11-21 Stock course covers, `revamp/b-stock-covers`

Follows the owner's decision of 2026-11-20 (cover stays required, add stock
covers) for F11 in `b/testing/preview-e2e-2026-11-20.md`.

Done:
- **Six stock covers** in `public/covers/` (Horizon, Shapes, Waves, Arcs,
  Facets, Orbit): original abstract SVGs in the brand palette, no text or
  subject imagery. Typed list in `features/courses/lib/stock-covers.ts`.
- **Course form**: a stock-cover row under the upload box. Picking one sets
  the cover; picking it again clears it. With nothing picked or uploaded
  the form names the cover it will use and saves it: `stockCoverFor(name)`,
  an FNV-1a hash of the trimmed, lowercased name, so it is stable. "Must be
  a valid URL" can no longer appear for an empty cover.
- **Schema**: `CourseCoverSchema` accepts an absolute URL (an upload) or
  exactly one of the stock paths; any other relative string is refused with
  "Upload a cover or pick one of the stock covers". Create and update use
  it. The upload flow (`BlobKind.CourseCover`) is unchanged.
- **Display**: course cards, the student course page hero and the
  gradebook list use `courseCoverSrc`, which shows the name's stock cover
  when `imageUrl` is empty or not a valid cover (seeded rows have `""`).
  Their settings open with an empty cover and save with the stock one.
- `updateCourse` and `deleteCourse` no longer try to delete a stock cover
  as a blob.
- Check: `scripts/check-stock-covers.ts` (pure).

Next:
- Owner recheck on Preview: New course with no cover, then settings of a
  seeded course (6.3, `seed.thuto.owner`).
- `src/app/dashboard/components/course-card.tsx` (legacy, unused) still
  builds `/images/<imageUrl>`; delete it with the other legacy pages.

Blocked on the other agent: none.

Questions for the owner: none.

## 2026-11-20 Owner decisions after the Preview pass

- **`REVAMP_UI` on Preview:** yes, to start testing the revamp for its
  production release. The owner sets it in Vercel (Preview environment),
  then a redeploy. Re-run 5.1 (workspace switcher) and the trial chip in 6.1
  afterwards.
- **Course cover stays required.** Add a few stock covers and use one when
  none is chosen; the "Must be a valid URL" error then can't happen (F11).
- **Restarting a cancelled workspace:** allowed; the owner pays what the
  restart costs before it's recovered, even with no students. A designs
  `restartWorkspace` on #191; B builds the screen after.
- **Finding self-registered students (future, not decided):** B's
  suggestion on #191: students and parents browse courses and request to
  join; tutors may invite one known username or email; tutors never browse
  the global student list.
- **Owners see every course in their organisation; staff who teach switch
  between Organisation and Tutor mode** (#192). B can do the owner access
  part now; the mode needs `viewer.mode` from A.
- **PR 188** (parent per-child view) reviewed and merged.

## 2026-11-20 Parent child view, `revamp/b-parent-children`

Follow-up to F7 in the Preview pass (`b/testing/preview-e2e-2026-11-20.md`):
PR 187 listed a parent's children; per-child progress, marks and upcoming
work were still "Coming soon".

Done:
- **`/dashboard/children/[userId]`**: one child's courses grouped by
  workspace with lesson progress, the last six released marks, and tests
  and assignments due in the next 14 days with the child's status (not
  started, started, handed in, marked). Read-only. Gated on
  `viewer.children` plus `canIn(viewer, "grades.view", { childUserId })`;
  anything else is a 404.
- **Released marks only**: `isReleased` hides a test mark until the
  submission is GRADED, unless the test releases auto-marks at submit; an
  assignment mark until its entry is GRADED. (Tutor-triggered auto-marks
  write a Grade row before release; the student Grades page still lists
  those, worth a look separately.)
- **Parent home cards** link to the child view and show lesson progress,
  the latest mark and the number due soon. "Progress" and "Upcoming work"
  left "Coming soon"; "Tutor messages" stays.
- **Redirects**: a PARENT opening `/dashboard/courses`, `/assignments` or
  `/calendar` goes to their only child's view, or the parent home.
- Code: pure helpers in `features/activity/lib/child-overview.ts`
  (checked by `scripts/check-child-overview.ts`), loader in
  `features/activity/child-overview.ts`, reusing the student queries keyed
  by the child's Student profile (`Student.userId`). New query
  `listGradesWithReleaseForStudent` in `features/grades/queries.ts`.
- `features/parents/components/parent-dashboard.tsx` is the parent
  dashboard home, edited by B as in PR 187; no change to A's viewer or
  schema.

Next:
- Tutor messages for parents (needs A's messaging).
- Owner recheck on Preview as `seed.parent.siblings` (steps in F7).

Blocked on the other agent: none.

Questions for the owner: none.

## 2026-11-20 Preview end-to-end pass, fixes, `revamp/b-preview-pass-2`

The whole Preview pass (owner, tutor, students, parent, four workspace
states) is in `docs/revamp/b/testing/preview-e2e-2026-11-20.md`, findings
F1-F13. Fixes merged along the way: PR 171 (lesson editor), PR 186 (tutor
scoping, 404 for other tutors' courses), PR 187 (parent home lists
children). This branch adds:

- **Enrol picker scoped to the workspace (F11).** `listAllStudents` showed
  every student on Nexa with emails to any tutor. Now
  `listWorkspaceStudents(workspaceId)` (active learners there; legacy
  courses use `LEGACY_WORKSPACE_ID`). Owner's decision: workspace only,
  everywhere.
- **Account banners in the legacy shell (F10).** `DashboardShell` takes a
  `banner` slot; the layout passes A's `AccountBanners`, as for AppShell.
- **"Add students" on the home checklist (F9).** `checklist()` takes
  `hasStudents`.
- **Cancelled billing (F13).** "Access until", "Next payment: None", no R0
  pay button.

Waiting on A: #189 (read-only workspaces accept staff writes; enrolment
accepts any student id), the F5 billing question on #178, and F8 (fees 404
for a minor without a parent). Owner: `REVAMP_UI=1` on Preview to test the
switcher and trial chip; whether the course cover stays required (F11); how
a cancelled workspace with no students comes back (F13). Follow-ups for B:
owners seeing all workspace courses (F3); parent screens are PR 188.

## 2026-11-20 Teaching pages read workspaces, not the Tutor row, `revamp/b-tenancy-pages`

Found in the Preview pass (`b/testing/preview-e2e-2026-11-20.md`, F1):
the seeded tutors (and any tutor made through onboarding, invitations or
the role choice) have a Membership but no `Tutor` row, so 20 of B's pages
and actions stopped at "No tutor profile found for this account." The
owner chose to move the pages rather than add Tutor rows.

Done:
- **`taughtByUser(userId)`** in `tenancy-where.ts`: courses with an active
  CourseStaff membership for that user. `taughtBy(tutorId)` stays for A's
  API routes, which still pass Tutor ids.
- **`teacherFrom(user)`** (`features/courses/lib/teacher.ts`) replaces the
  `prisma.tutor.findUnique({ where: { email } })` lookups in the dashboard
  home, analytics, assignments, schedule, gradebook, manage courses, tests
  and grading, the assignment editor, `loadTutorCourse`, and the export,
  weights and test actions. Its `id` is a **user id**.
- B's feature queries (`tutor-home`, `courses`, `assessments`,
  `assignments`, `events`, `gradebook`, `lessons`, search) take
  `teacherUserId` and filter with `taughtByUser`.
- Tutors with a Tutor row are unaffected: their courses already go through
  CourseStaff, backfilled by tenancy.
- Left alone: the profile page still reads the Tutor row's bio and photo
  when there is one. Students keep their Student rows, which own their
  submissions and grades.

## 2026-11-20 Student limits and two-factor setup, `revamp/b-limit-warnings` (#178)

Screens for A's #177 (billing Draft 1.14, viewer Draft 1.7).

Done:
- **Student limits:** when adding students fails with `TRIAL_CAP_REACHED`,
  or `FORBIDDEN` for the workspace's own student limit
  (`isStudentLimitError` in `features/courses/lib/account-ui.ts`), the
  message shows with a link to billing: a toast with a "Billing" button
  in the course form, and "Go to billing" in the add-student form. Other
  errors show their message without the `CODE:` prefix. Only happens
  with BILLING=1.
- **Limit warnings:** emails only (A), no screen, as asked.
- **Two-factor:** with Better Auth on, the dashboard layout sends owners
  and Nexa admins with `twoFactorRequired` to `/two-factor-setup`:
  password → `twoFactor.enable` → add Nexa to an authenticator app (an
  "Open in the app" link for phones, or the setup key to type) →
  `verifyTotp` → backup codes, shown once. "Remind me tomorrow" sets a
  day-long cookie so an owner is never locked out mid-task. Under
  NextAuth nothing changes.

Checked:
- `tsc` and `eslint` clean; `scripts/check-account-screens.ts` passes
  (4 new limit cases).
- On a temporary page (deleted): the setup form's empty-password check,
  and the setup key read from a sample otpauth link. `/two-factor-setup`
  signed out goes to sign-in.
- Not checked: a real limit error or a real two-factor setup (no local
  sign-in). For the owner on Preview after #175, with the owner test
  account.

Blocked on the other agent:
- No QR code yet: there's no QR package. Asked A on #178 to OK a small
  one (for example `uqr`, no dependencies), pinned at a version at least
  two weeks old. Desktop users type the setup key until then.
- An owner who signed up with Google has no password, so
  `twoFactor.enable({ password })` fails for them. Asked A whether to
  turn on `allowPasswordless` or have them set a password first.

Owner decision (2026-11-20): keep "Remind me tomorrow"; two-factor is
not a hard stop for owners.

## 2026-11-20 Account screens, `revamp/b-accounts-screens` (#174)

Screens for A's #173 (viewer contract Draft 1.6, "Accounts and invites").

Done:
- **Students** (`/dashboard/students`, People in the nav): the roster
  (owners and admins see the workspace; a tutor sees their courses'
  students) and "Add a student" with `createStudentAccount`. The result
  is a printable, copyable **sign-in card** shown once. Minors need the
  consent tick. Roster queries are in `features/courses/lib/roster.ts`.
- **Student profile** (`/dashboard/students/[learnerId]`): Sign-in tab
  (`issueSignInCode`, after a confirm, then the card) and Parents tab
  (`listParents`, `linkParent` with a card for a new parent account,
  `revokeGuardianship`).
- **Onboarding:** a new optional "Students" step between the first course
  and payouts.
- **First sign-in:** the dashboard layout sends anyone with
  `mustChangePassword` to `/set-password` (outside /dashboard, so it can't
  loop), which calls `setOwnPassword`.
- **Members** (`/dashboard/settings/members`, also in the nav and on
  Settings): the staff list, "Invite people" (`inviteStaff`; Admin is
  offered only to the owner) and invites with Cancel (`revokeInvite`).
- **`/auth/invite/[token]`** (A asked for it on #174): `getInvite` signed
  out; "Join" with `acceptInvite` signed in; WRONG_ACCOUNT shows the
  masked address and offers to sign in with it.
- **Sign-in:** the password field now hints "First time? Use the sign-in
  code from your tutor" once Better Auth is on (the field already said
  "Email or username").
- The legacy Users link stays until the owner has tested Students.

Checked:
- `tsc` and `eslint` clean. `scripts/check-account-screens.ts` (new),
  `check-shell-nav.ts` and `check-onboarding-ui.ts` pass.
- With sample data on a temporary page (deleted): the add-student checks,
  the sign-in card, parents list, invite form (rejects a bad address) and
  invite list. A made-up invite token shows "This invite link isn't
  valid". `/set-password` signed out goes to sign-in.
- Not checked: the real create, code, link and invite calls (no local
  sign-in). The owner checks them on Preview after #175.

Blocked on the other agent:
- A's `accounts.ts` and `invites.ts` throw plain `Error`s ("That username
  is taken"), which `actionClient` turns into "Something went wrong". Asked
  A on #174 to let those messages through.
- Sign-up has no way back to an invite: `signUpWithPassword` always sends
  the verify link to `/dashboard/welcome`. The invite page says to open the
  link again after verifying. Asked A for a `callbackURL` option.

## 2026-11-20 Maths in answers, phase 2, `revamp/b-maths-answers-2`

Design `b/design/01-maths-in-answers.md`, phase 2: the Maths expression
question type, on A's migration 16 (#164).

Done:
- **`checkMaths`** (`src/features/assessments/lib/maths-check.ts`, server
  only) marks a TeX answer against the TeX key with Compute Engine
  (`@cortex-js/compute-engine` pinned at 0.180.0, A's OK on #161). Modes:
  any equivalent form (default), same form as the key, or a number within
  a `±` margin. It never throws; anything it can't decide is "undecided".
- **Auto-marking:** `autoGradeSubmission` takes the checker as an option.
  Undecided answers go to the tutor (owner decision 2), never marked wrong.
  Both marking actions pass it.
- **Tutor editor:** "Maths expression" type with a MathLive key and a
  Marking select. `mathMode` travels through the form, the edit page,
  the save actions, the fingerprint, the answer key and JSON import and
  export (documented in the import guide).
- **Plus gate:** adding a maths-expression question needs the `math-input`
  service on the course (`hasService`). Questions a test already has stay
  editable. The editor still offers the type everywhere; the save says
  it's a Plus feature when the course doesn't have it.
- **Student runner:** a MathLive answer box. MathLive starts loading when
  the attempt opens if the test has a maths question.
- **Grading form, review and grade pages:** the answer and key are
  typeset (`MathsAnswerText`); the grading form also says which mode marks it.
- `/design-system/questions` has a maths sample and the editor card.

Checked:
- `tsc` and `eslint` clean. `scripts/check-maths-answers.ts` (new):
  27 checker cases plus 2 marking cases pass.
- In `/design-system/questions`, typed x(x+3) in the student box: stored
  as TeX and typeset for the tutor. The editor card's key and Marking
  select update the question.
- Not checked: saving a real test and marking a real submission (no
  local sign-in). Fingerprints now include `mathMode`, so an editor
  opened before this deploys will be asked to reload once on save.

Next: owner checks a maths test on Preview once #175 is fixed.

## 2026-11-20 Maths in answers, phase 1, `revamp/b-maths-answers-1`

Design `b/design/01-maths-in-answers.md`, phase 1 (no schema change).

Done:
- **`splitAnswerMaths`** (`src/lib/content/answer-maths.ts`) finds `$…$`,
  `$$…$$`, `\(…\)` and `\[…\]` in a typed answer. A `$…$` pair needs
  non-space inside both dollars, and the next bare `$` must close it, so
  "$5 and $10" stays text. `\$` is a literal dollar.
- **`AnswerText`** (`src/components/content/answer-text.tsx`) shows a
  typed answer as written. Only the maths spans go to MathJax; the rest
  is plain text (no markdown), marked `mathjax_ignore`.
- Used for short answers and essays in the tutor's grading form, the
  student's grade page and the test review page. Code answers are
  unchanged. Short answers on the review page no longer go through
  markdown.
- **Essays: "Insert maths"** opens the MathLive field (from #157) and
  inserts `$…$` at the cursor, then puts the cursor back after it. A
  preview shows the answer typeset when it holds maths. Every tier, as
  decided.
- `/design-system/questions` now has an essay sample.

Checked:
- `tsc` and `eslint` clean. `scripts/check-answer-maths.ts` (new, 14
  cases) passes.
- In `/design-system/questions`, typed "It costs $5 and $10. So it gives",
  inserted (x-2)^2. The preview typeset only the formula, and focus came
  back to the essay box.
- Not checked: the grading and review pages with real submissions (no
  local sign-in). They use the same `AnswerText`.

Next: phase 2 (the Maths expression question type) once A's #164 is
applied.

## 2026-11-20 Visual maths input (MathLive), `revamp/b-math-input`

Owner's request; B research 02; Plus service `math-input`. Stacked on
`revamp/b-graphs` (#155).

Done:
- **`src/components/editor/math-field.tsx`**: `MathField` around MathLive's
  `<math-field>`.
  - It loads MathLive on first use and shows a plain TeX box until then.
  - Fonts come from `mathlive/fonts.css` (bundled), with no sounds.
  - Enter or Escape goes back to the text.
  - It takes focus when inserted, after Tiptap's own refocus.
- **Editor:** with `features.mathInput`, a maths node's box is the MathLive
  field (fractions, powers, roots, and its on-screen keyboard). A "TeX"
  button switches to the TeX box and back. The stored content is still TeX.
- **Lessons page:** `mathInput: hasService(viewer, courseId, "math-input")`,
  beside `graph`.

Checked:
- `tsc` and `eslint` clean.
- In `/design-system/editor`: inserted inline maths, the field took
  focus, typed `x^2 + 1/2` (typeset as you type), and the derived markdown
  updated. Escape went back to the text.

Not done:
- Maths in **students' answers**. Short answers are plain strings that
  auto-marking compares exactly, and the grading view shows them as plain
  text. Adding maths there needs a decision on how a maths answer is
  stored and compared. Raised with the owner.

Needs A:
- Nothing: A said OK to `mathlive` on #152, pinned at exactly 0.111.4.

## 2026-11-20 Graphs in lessons, `revamp/b-graphs`

Owner's request; B research 03 (Mafs) and contracts/editor.md (planned
`graph` node). Plus service `graphing`.

Done:
- **`graph` node, content schema version 2** (`src/lib/content/graph.ts`).
  - It holds a `GraphSpec` (`graph-spec.ts`): description, x and y ranges,
    grid, and up to 12 curves, points and segments with labels and colours.
  - `validateDoc` runs every spec through `parseGraphSpec` and refuses a
    bad one.
  - The markdown copy is `[Graph: …]`.
  - Version 1 documents read unchanged.
- **Formulas:** `expr.ts` parses `2x^2 - 3x + 1`, `sin(x)/x`, `|x - 5|`,
  `0,5x` and a leading `y =`. It's a parser, never `eval`, with plain-words
  errors.
- **Showing a graph:** `GraphFigure` shows the summary as the figure's
  label and a key of the curves. The Mafs drawing (`graph-mafs.tsx`)
  loads only in the browser and only where there's a graph. Fixed
  colours (blue, red, green, amber, violet) have light and dark values.
- **Editing:** a Graph button and slash command, off unless `features.graph`.
  - A new graph opens a dialog with a live preview. Cancelling a new
    graph removes it.
  - Errors show per item; the preview keeps the last good graph while a
    formula is half typed.
- **Lessons page:** passes `graph: hasService(viewer, courseId,
  "graphing")`. Graphs already in a lesson show for everyone, whatever
  their tier.

Checked:
- `tsc` and `eslint` clean.
- `scripts/check-graph.tsx` (new) passes, and so do `check-rich-content`
  and `check-rich-render`.
- In `/design-system/editor` I inserted a graph, typed a broken formula
  (it showed "The formula ends too early." and Save was off), fixed it,
  added a labelled point and saved. The derived markdown and
  `validateDoc` were right.

Needs A: nothing. A said OK to `mafs` on #152, pinned at exactly 0.21.0.

## 2026-11-20 Temporary app icon, `revamp/b-logo`

The owner chose option A of six: an ink tile with a serif "Nx".
- `src/app/favicon.ico` (16, 32, 48) replaces create-next-app's Vercel
  triangle. `src/app/icon.png` (512) and `src/app/apple-icon.png` (180)
  are new; Next links all three.
- `scripts/generate-app-icon.ts` makes them from one SVG with Georgia.
  The PNGs are committed, so builds don't need the font.
- Checked on the dev server: the three `<link>` tags are there and each
  file serves with status 200.

## 2026-11-20 Error pages (404, 500, 401, 403), `revamp/b-error-pages`

Owner's request: Nexa's own pages instead of Next's plain 404.

Done:
- **`src/components/error-screen.tsx`:** one layout for every error page.
  It has a small "Error 404" label, a plain-words title and description,
  buttons, "Still stuck? Contact support" and an Open Peeps figure on
  wide screens. `ErrorFrame` adds the Nexa wordmark for pages outside the
  dashboard.
- **`src/components/error-screen-client.tsx`:**
  - the missing address under the 404 text;
  - a Back button, shown only when there's history;
  - `ErrorBoundaryScreen`, which reports the error to Sentry and shows
    Try again plus the error reference (`digest`) for support.
- **Pages:**
  - `app/not-found.tsx`: any unknown address.
  - `app/dashboard/not-found.tsx`: `notFound()` inside the dashboard,
    in the shell.
  - `app/error.tsx` and `app/dashboard/error.tsx`: crashes.
  - `app/global-error.tsx`: the root layout itself fails.
  - `app/forbidden.tsx` and `app/unauthorized.tsx`: 403 and 401.

Checked:
- `tsc` and `eslint` clean.
- Dev server: an unknown address gives the new 404 with status 404 and
  the address. A temporary page that throws gave the 500 page (status 500)
  with Try again. Both were checked at narrow and wide widths, and the
  temporary page was removed.
- The dashboard 404 and 500 need a signed-in session, so they weren't
  seen locally. They use the same component.

For A:
- 403 and 401 render only once `experimental.authInterrupts: true` is in
  `next.config` (A's file). Pages can then call `forbidden()` and
  `unauthorized()` instead of `notFound()`.

## 2026-11-20 Discount codes on fees, `revamp/b-fee-codes`

From contract Draft 1.13 (`listFeeDiscountCodes`,
`createFeeDiscountCode`, `deactivateFeeDiscountCode`) and a/ux/05,
section 3.

Done:
- **`/dashboard/fees/discounts`** for owners and admins (`fees.manage`
  without a scope). Linked as "Discount codes" in the Fees page header.
  - The list shows each code with what it takes off, how many payments
    per student, its dates, students who used it (of the limit), the
    status (Live, Starts later, Ended, Used up, Off) and Turn off with a
    confirm.
  - A new-code form: code, description, percentage or rand amount, start
    and optional end, an optional student limit and optional payments per
    student.
- **Date fix**, also on the Nexa admin codes table: code dates are saved
  as whole UTC days, so they're now shown in UTC. Before, an end of
  31 Jul showed as 1 Aug in South Africa.

Checked:
- `tsc` and `eslint` clean.
- A temporary sample-data page showed the list, the empty state, the
  form's checks and the Turn off dialog. Nothing was written.

Not done:
- Limiting a code to some courses (in the design): A's action has no
  courses field.
- Applying a code to a student from their Fees tab (`applyFeeDiscount`,
  proposed in the design): not built by A yet.

## 2026-11-20 Workspace setup (onboarding), `revamp/b-onboarding`

From A's #142 (`createWorkspace`, `updateWorkspaceProfile`; viewer
contract Draft 1.3) and a/ux/01, sections 3 and 4.

Done:
- **`/dashboard/onboarding`** ("How will you use Nexa?"): Solo practice
  or Organisation. Choosing one calls `createWorkspace` with the browser's
  time zone and goes to the steps. If the email isn't verified, it says so
  instead.
- **`/dashboard/onboarding/[step]`**, with no sidebar (`isFocusRoute`),
  the Nexa logo, the trial chip and the step list:
  - **business:** name and time zone (`updateWorkspaceProfile`); required.
  - **course:** the existing course form (cover, name, description; the
    student picker is hidden with the new `showStudents` prop) via
    `createCourse`; can be skipped.
  - **payouts:** the existing `PayoutConnect`, or "I'll collect fees
    myself". People without `payouts.connect` see "Your owner connects
    payouts".
- **Way in:** "Create a workspace" in the account menu, when billing is on,
  the email is verified, and the viewer is staff or has no workspace.
- **"Finish setting up"** on the tutor home for whoever runs a workspace
  in its trial. It works out what's done from the workspace (name changed
  from the placeholder, a course exists, payouts connected). The × hides
  it in that browser.

Checked:
- `tsc` and `eslint` clean; `check-onboarding-ui` (new) and
  `check-shell-nav` (now with onboarding) pass.
- A temporary sample-data page showed the chooser, the business step
  with its frame and name check, and the checklist, whose × stays hidden
  after a reload. Nothing was written.

Not done, waiting on A:
- The design's subjects and students steps: no `Workspace.subjects`
  storage or `createStudents` action yet.
- Web address (slug) on the business step: `updateWorkspaceProfile`
  doesn't take one.
- `getOnboarding` / `dismissOnboarding`, which would replace the derived
  checklist and the browser-only dismiss.
- New sign-ups: `createCourse` still checks the old TUTOR role, so a new
  owner without it can't create a course. Asked A on #142.
- The design puts setup at `/auth/onboarding` (A's path); B's pages are
  under `/dashboard/onboarding`. A redirect from there would be A's.

## 2026-11-20 Fees, part 2: parents pay, `revamp/b-fees-pay`

From A's #125 (parent checkout, contract section 2, Draft 1.10 to 1.13).

Done:
- **`/dashboard/fees` for payers.** Staff with `fees.manage` still get
  the fees list. A guardian (`fees.pay`) or an adult student who sees
  their own fees now gets "To pay" instead of a 404
  (`listPayableInvoices`).
  - Open fees are grouped by child and ticked by default.
  - A fee held by a checkout shows "Payment in progress until 14:30"
    and can't be ticked.
  - Paid fees are listed below.
- **Discount code**: optional; Apply calls `previewCheckout` and shows the
  discount and the new total. Changing the ticked fees or the code drops
  the preview, so a stale discount never goes to Paystack.
- **Pay**: `startCheckout` with the ticked ids (and the code), then
  Paystack.
- **`/dashboard/fees/return`**: polls `getCheckoutStatus` every 2.5 s
  for up to 60 s. It then shows one of: paid, didn't go through (fees
  stay locked up to 30 minutes), still confirming, or couldn't check.
- **Sidebar**: "Fees" under Account for learners and guardians with
  `fees.pay` and billing on.

Checked:
- `tsc` and `eslint` clean; `check-fee-pay-ui` (new) and
  `check-shell-nav` pass.
- A temporary sample-data page showed two children's fees, a locked fee,
  totals changing as fees are unticked, the empty state and a return
  message, at desktop and phone width. Nothing was written.

Not done:
- Not paid end to end on Preview (needs a guardian test account and
  Paystack test mode).
- An adult student whose fees are visible but who also has a guardian can
  open the page but gets no sidebar link (they lack `fees.pay`).
- Owner screens for fee discount codes (`createFeeDiscountCode` and
  friends, Draft 1.13) aren't built.

## 2026-11-20 Refund recovery screens, `revamp/b-refund-recovery`

From A's #137 (PR #136, contract Draft 1.12).

Done:
- **Admin** `/dashboard/admin/billing/recoveries` (new ribbon link):
  every recovery (`adminListPayoutRecoveries`) with a status filter, the
  payee, the refund and its reason, what is still owed, when deductions
  start, and per-row Hold deductions, Repaid off-site and Waive. A
  "Refund a fee invoice" form (`adminRefundFeeInvoice`) takes the fee
  invoice id, an optional amount and a reason, labelled as quoted to the
  tutor.
- **Tutor** `/dashboard/fees`: active recoveries (`listPayoutRecoveries`)
  with what is still owed, when deductions start, and a plain "Pay by
  card" link when `payPath` is set; a message for each `?recovery=` value
  the pay and return routes send. If the recoveries fail to load, fees
  still show.
- `NoteForm`, `DialogButton` and `outcome` in admin-billing-dialogs are
  now exported and shared.

Checked:
- `tsc` and `eslint` clean; `check-recovery-ui` (new) passes.
- A temporary sample-data page showed the tutor section, the return
  messages and the admin table; the hold date guard and the required
  note worked. Nothing was written.

Not done:
- Admins have no fee invoice lookup, so the refund form needs the id.
  Asked A for a lookup by invoice number.

## 2026-11-20 Nexa admin billing, part 2 and usage limits, `revamp/b-admin-billing-2`

From A's #120 (admin queries in #133) and #106 (`setUsageCap`).

Done:
- **Workspace page** `/dashboard/admin/billing/workspaces/[id]`
  (`adminGetWorkspaceBilling`): state, renewal, overdue, the existing
  workspace actions; courses with billed tier, override or hold, seats and
  a per-course tier override (`adminOverrideCourseTier`); the 20 newest
  invoices. Workspace names in the list now link here.
- **Invoice page** `/dashboard/admin/billing/invoices/[id]`
  (`adminGetPlatformInvoice`): lines (shared `InvoiceLines`), payments,
  refunds on card payments (`adminRefundPayment`, amount optional, capped
  at what is refundable), and on an open invoice "Mark paid off-site"
  (full total only, a past date) and "Void". Every action needs a note.
- **Discount codes:** the list (`adminListDiscountCodes`) with All/On/Off,
  paging, status chips (Live, Starts later, Ended, Used up, Off) and Turn
  off (`adminDeactivateDiscountCode`), above the existing form.
- **Retention** `/dashboard/admin/billing/retention`
  (`adminRetentionPreview`): a dry run, with a banner saying whether
  deletes are on.
- **Usage limits** on `/dashboard/settings/billing/usage`: owners
  (billing.manage) can set, change or remove their own limit per meter in
  the current period. Sent with `hardStop: false`, and the copy says Nexa
  doesn't stop anything at the limit yet (caps aren't enforced, A #106).

Checked:
- `tsc` and `eslint` clean; `check-admin-billing-ui` passes with new
  checks for code status, discount labels, retention summary, refund
  amounts and limits.
- A temporary sample-data page showed every new section at desktop and
  mobile width; the refund guard, the required note and the limit form's
  validation worked, and unauthenticated saves were refused; nothing was
  written.

Not done:
- Not checked against real admin data on Preview.
- If A later enforces caps, the limit copy and `hardStop` need revisiting.

## 2026-11-20 Extra time per student, `revamp/b-extra-time` (#134)

Owner decision 7; the owner asked for the field in chat ("Yes, create the
field for extra time.").

Done:
- **Schema:** `TimeAccommodation` (assessments.prisma): one row per
  student per course, `extraTimePercent` (0/25/50/100) or `noTimeLimit`,
  cascades with the course. `studentId` has no relation because `Student`
  is in A's core.prisma. `TestSubmission` gains `extraTimePercent` and
  `noTimeLimit` (defaulted), copied from the grant when the attempt starts.
  Migration `12_time_accommodation` is additive.
- **Setting it:** "Extra time on timed tests" card on the course Settings
  page, a picker per enrolled student (`setExtraTime`: course staff only,
  enrolled students only). It also updates the student's open attempts on
  the course, so a mid-sitting grant counts at once.
- **Applying it:** `attemptDeadline` / `effectiveTimeLimit` stretch or drop
  the time limit; the runner's clock, the auto-submit job and the pre-test
  page use it. The due date still closes the test for everyone.

Checked:
- `tsc` and `eslint` clean; `check-extra-time` (new) and
  `check-runner-state` pass.
- A temporary sample-data page showed the card, its empty state, and a
  refused change (not signed in) going back; nothing was written.
- Preview: the PR's build applied the migration; `migrate status` is up to
  date.
- Production (read-only): `migrate status` shows only
  `12_time_accommodation` pending, and `migrate diff` from the live
  database equals that migration exactly.

Applied to production (2026-11-20, rule 4.1):
- Neon refused the backup branch at first ("branches limit exceeded"). The
  owner said to delete the oldest pre-migration backups, so I deleted
  `backup-pre-migrate-20261117`, `backup-pre-tenancy-20261119` and
  `backup-pre-tenancy2-20261119`.
- Backup branch `backup-time-accommodation-20261120` from production.
- `migrate diff` from production still equalled `12_time_accommodation`
  exactly; `migrate deploy` applied it; `migrate status` is up to date on
  both databases. Then #134 was merged.
- The Neon project now holds production, preview and six backups. Old
  backups need pruning before the branch limit (10) is hit again.

## 2026-11-20 Student test runner, `revamp/b-test-runner`

Owner decision 8 (one question per screen), b/research/05 "Test runner"
and 06 §3.

Done:
- **Focus layout:** with REVAMP_UI, `/dashboard/tests/<id>` shows without
  the sidebar, top bar or search (`isFocusRoute` in nav-config, used by
  AppShell). Pre-test and review keep the shell. "Back to course" is
  replaced by **Save and exit** in the header.
- **One header:** title, offline and save status, the clock, Save and exit,
  Save, Submit. It sticks to the top with the question strip under it.
  The legacy shell gets `top-14 lg:top-20` so it sits under its header.
- **Question strip** (replaces the side list): a button per question.
  Answered is solid, partly answered half filled, a failed save adds a red
  border and an icon, a flag a corner mark, the current one a ring. Each
  name spells the state out: "Question 2, partly answered, 1 of 2 parts,
  not saved, flagged". The current one scrolls into view.
- **Flag for review:** a button above the question, belongs to the
  student, kept in the browser (`localStorage`, per attempt, cleared on
  submit). No schema change, so tutors don't see flags.
- **Per-question save state:** a failed save marks the questions whose
  answers it carried; the next good save clears them.
- **Submit summary:** lists unanswered questions (parts too) and flagged
  ones as buttons that jump there, and warns when the last save failed.
- **Clock:** a polite live region says "5 minutes left." and "1 minute
  left." once each, not every second. Monospaced digits.
- **Shortcuts:** Alt+↑/↓ previous and next, Alt+F flag, Ctrl/Cmd+S save.
  Shown under the question on wider screens.
- Pure rules in `features/assessments/lib/runner-state.ts`; checks in
  `scripts/check-runner-state.ts` (new). Tutor preview uses the same
  runner, with the header not sticky inside the test frame.

Checked:
- `tsc` and `eslint` are clean; `check-runner-state` and `check-shell-nav`
  pass.
- A temporary sample-data page (24 questions, one with two parts) showed
  the strip states, flags kept across a reload, the "not saved" mark (the
  page wasn't signed in, so every save failed and nothing was written),
  the 5-minute announcement, the summary's jump links and the phone width.
  Nothing was submitted.
- Owner check on Preview: sit a timed test as a student, flag a question,
  go offline and back, open Submit, then Save and exit and come back.

Not done:
- Extra time per student (decision 7) needs a schema field; ask the owner.
- Flags are per browser. Showing them to the tutor needs a field on the
  submission.
- Pressing Alt+↓ twice while a save is running moves one question.

## 2026-11-20 Fees, part 1, `revamp/b-fees`

Built on A's billing contract section 3 (#125).

Done:
- **Fees** (`/dashboard/fees`, ux/04 §6), behind BILLING=1 and
  `fees.manage`. In the staff nav under Workspace, before Billing.
  - Filters: Open (default), Paid, All, and a course picker when there is
    more than one course. Paging with Newest / Older.
  - Table: student, number, paid to, fee, due, status. Status chips:
    Open, Overdue (past the due day in the viewer's zone), Paid online,
    Paid off-site, Cancelled.
  - **New fee:** course, student (open enrolments), description, amount,
    due day. Calls `issueInvoice` with one line.
  - Open rows have a menu: **Mark paid off-site** (cash, EFT or other,
    the full fee, received day, reference, note; `fees.markOffsite`) and
    **Cancel fee** (a reason; `voidInvoice`).
  - A banner links to Set up payouts when the account fees are paid into
    is missing (the workspace's, or in per-tutor mode the viewer's own).
- `features/courses/fee-courses.ts`: the courses a viewer may charge
  fees on, with their learners. Scoped tutors get the courses they own or
  teach, matching `listFeeInvoices`.
- `feeChip` and `FEE_FILTERS` in `lib/payouts-ui.ts`.

Checked:
- `tsc` and `eslint` are clean; `check-payouts-ui` and `check-shell-nav`
  pass with the new cases.
- A temporary sample-data page showed the table with every status, the
  empty state, the New fee check ("Choose the student."), both row dialogs
  and the mobile width. Nothing was submitted.
- Owner check on Preview: create a fee, mark one paid off-site, cancel one.

Not done (waits on #125):
- Course fee settings (`upsertFeeSchedule` needs `listFeeSchedules`).
- The one-fee panel (needs `getFeeInvoice`), and voiding an off-site
  payment from it.
- The table can't show each fee's course or link to the student until the
  list items carry `courseNames` and `learnerId`.

## 2026-11-20 Payouts settings, `revamp/b-fees-payouts`

Built on A's billing contract section 3 (Draft 1.9, #124, #125).

Done:
- **Payouts** (`/dashboard/settings/payouts`, ux/04 §7), behind BILLING=1.
  Open to `payouts.connect` or `fees.manage`. A Payouts card on Settings
  links to it.
  - **Who is paid** (organisations, `workspace.settings`): one account for
    the organisation, or each tutor's own (`setPayoutMode`).
  - **The account:** bank ••last4, holder, business name and status. To
    connect or change it, pick the bank and enter the account number,
    business name and an optional ID number.
    - "Check account" calls `resolvePayoutAccount` and saves nothing.
    - The holder's name is shown with "Yes, connect" / "No, edit".
    - Editing any field clears the name shown.
  - **In per-tutor mode** each tutor connects their own. People with
    `payouts.connect` or `workspace.settings` also see a table of the
    tutors' accounts.
  - Errors: an unknown account reads "Paystack couldn't find that account.
    Check the bank and number." Other messages from A and Paystack are
    shown as written.
- Helpers in `lib/payouts-ui.ts`: status chips, `accountLabel`,
  `cleanAccountNumber`, `payoutErrorMessage`.

Checked:
- `tsc` and `eslint` are clean, and `check-payouts-ui` (new) passes.
- A temporary sample-data page showed the mode switch, the connected
  account with Change account, and the empty form with its account-number
  check. No console errors.
- Owner check on Preview, with Paystack's test keys: connect a test bank
  account.

Not done:
- The tutors table can't name the tutor. `getPayoutSettings` gives
  `membershipId` but no name, so the table shows the business name.
- "Recent payouts" from ux/04 §7 has no query yet.
- Changing the account doesn't ask for the password again (a ux/04
  proposal, not in the contract).

## 2026-11-19 Nexa admin billing, part 1, `revamp/b-admin-billing`

Built on A's billing contract section 4 (Draft 1.7, #118, #120). Pages are
under `/dashboard/admin/billing` (AGENTS.md section 2: B builds A's admin
pages under `src/app/dashboard/**`). The sidebar link (admin persona,
Platform › Billing) needs `admin.console` and BILLING=1.

Done:
- **Workspaces** (`/dashboard/admin/billing`):
  - The Paystack volume meter against the sole-proprietor limit. It turns
    amber from 80%.
  - Filters by name or slug and by state (a GET form), with paging.
  - A table of workspaces: state chip, next date (renews, trial ends, or
    the day data is deleted, in red), last period's total and overdue
    amount.
- **Row actions** (`admin.override`), each in a dialog that says what
  happens and asks for the audit-log note:
  - extend the trial (TRIAL or READ_ONLY);
  - make the workspace complimentary, optionally until a date, or end it;
  - issue a credit.

  A's messages are shown as written. The page refreshes after each
  action, because A's `revalidatePath("/admin")` doesn't reach it.
- **Discount codes** (`/dashboard/admin/billing/discount-codes`): a
  create form.
  - Percentage or fixed amount.
  - Applies to the whole bill, one plan, or one premium service.
  - Start and end dates, number of uses, and how many payments it covers.
- **Helpers** in `lib/admin-billing-ui.ts`: rand and percent parsing, the
  note rule, code normalising, actions per state and error text.
  `requireAdminBillingPage()` is in `billing-page.ts`.

Checked:
- `tsc` and `eslint` are clean. `check-admin-billing-ui` (new),
  `check-shell-nav` (new admin cases) and `check-billing-ui` pass.
- A temporary sample-data page showed the list, the menu, the Extend trial
  dialog with its note check, and the code form with its checks. Every
  field has a label. No console or server errors.
- No action was sent: there is no admin account locally. Owner check on
  Preview: sign in as a Nexa admin, open Platform › Billing, and try
  Extend trial on a test workspace.

Waiting on A (asked on #120):
- `adminGetWorkspaceBilling`, for the workspace page: courses with tier
  overrides, and invoices for void and mark-paid-offsite.
- `adminGetPlatformInvoice` with payment ids, for refunds.
- `adminListDiscountCodes`, for the code list and Deactivate.

## 2026-11-19 Billing usage and payments history, `revamp/b-billing-history`

Built on A's billing contract Draft 1.6 (#116).

Done:
- **Billing ribbon.** `BillingFrame` now has an Overview / Usage / Payments
  ribbon and crumbs for sub-pages (Settings › Billing › Payments ›
  NX-…). `billingRoutes` holds the paths.
- **Usage** (`/dashboard/settings/billing/usage`, ux/03 §3):
  - Covers active students and AI-marked answers for the current period
    (the trial, before the first payment).
  - Each shows the period total, the charge so far (or what the first 30
    days would cost, in a trial), the limit bar when there is one, and a
    daily chart.
  - `?period=` picks an earlier period from the paid invoices' periods.
- **Daily chart** (`usage-chart.tsx`): one series, so thin columns in one
  hue and no legend. It has a hover readout (resting on the busiest day), a
  labelled image for screen readers, and "Show as a table".
- **Payments** (`/dashboard/settings/billing/payments`, ux/03 §6):
  - Invoices newest first, with period, number, amount and status.
  - "Older" and "Newest" page through A's cursor.
  - The empty state says when the first payment is due, from the trial
    end.
- **One payment** (`.../payments/[id]`):
  - The invoice's lines in A's order (discount, credit and VAT are A's own
    lines), then the total.
  - The payments made on it: card, failed, refunded, or paid outside Nexa.
  - Pay for an open invoice (`billing.manage`).
  - Download PDF once `pdfUrl` is set.
- **Return page:** the wording now comes from `getBillingPaymentStatus`'s
  `purpose`; `isCardCheckReference` is gone. Until the first poll answers,
  it says "Checking with Paystack…".
- `requireBillingPage()` (`features/courses/billing-page.ts`) holds the
  checks every billing page makes.
- **Fix:** `capLabel` grouped thousands with a no-break space, because its
  replace matched a plain space.

Checked:
- `tsc` and `eslint` are clean, and `check-billing-ui` passes, with new
  cases for the invoice and payment labels, `countLabel` and `peakDay`.
- A temporary sample-data page showed every view: usage with a limit,
  hover, the list, the empty state, a paid and an open invoice. No console
  errors.
- Owner check on Preview: Billing › Usage and Payments. The Preview
  workspace is complimentary, so Payments shows the empty state.

Not done:
- **Setting a usage limit** waits for A's `setUsageCap`, which is in the
  contract but not built yet. Asked on #106.

## 2026-11-19 Course content delete for A (#113), `revamp/b-course-delete`

Done:
- **`deleteCourseContent(tx, courseId)`** in
  `src/features/courses/delete-content.ts`, for A's course deletion
  (#113, option 1).
  - It deletes everything in B's tables under the course inside A's
    transaction, children first: uploaded answer files, grades, question
    grades, assessment completions, test submissions, test questions,
    tests, assignment entries, assignments, quizzes, lesson completions,
    attachments, lessons and events.
  - It leaves `Course` and A's rows (CourseStaff, Enrollment, billing,
    Notification).
  - It returns `{ blobUrls, counts }`. `blobUrls` are the de-duplicated
    Blob files to delete after the commit, found in every column of the
    rows (covers, attachments, videos, memos, briefs, students' uploads,
    and links inside rich text and answers). `counts` are rows deleted per
    table.
- **`countCourseContent(tx, courseId)`** returns the same shape without
  deleting, for A's dry run. Both share one filter per table, so they
  can't drift.
- **`collectBlobUrls`** (`src/features/courses/lib/blob-urls.ts`), pure.
  It uses the same regex as A's blob audit, and drops the query string and
  trailing punctuation.
- Neither function is a server action: the caller authorises.

Checked:
- `tsc` is clean.
- `scripts/check-course-delete.ts` passes on Preview (20 checks). It
  builds a fake course with one of everything inside one transaction that
  is always rolled back, then:
  - counts it, deletes it and counts again;
  - checks the Blob URLs, that another course is untouched, and that the
    Course row then deletes cleanly;
  - after the rollback, checks the fake course and student are gone.

For A:
- Call it first in your transaction, then delete your rows and the
  Course. No feature copies files between courses, but a URL could have
  been pasted elsewhere by hand, so your cleanup may want to check other
  references before deleting a file (research 08).

## 2026-11-19 Grading view in the test frame, `revamp/b-grading`

Done:
- **Grading a student's test**
  (`tutor-tests/submissions/[testId]/[studentId]`) is in `TestFrame`.
  - Breadcrumb: Tests › course › test › Submissions › student. The
    Submissions tab is lit.
  - Auto-grade is a header action.
  - The student's name and a status chip head the page, with email,
    submitted time and current grade in a PropertyList.
  - "No submission" uses the empty state.
- `TestFrame` takes `view` for pages inside a view, and `RibbonNav`
  takes `current` to light a tab when the URL is outside every link.
- **GradingForm:**
  - Questions are flat sections divided by rules, not cards.
    Sub-questions are indented with a terracotta rule.
  - The student's and correct answers use theme tokens (muted and
    success) instead of slate and emerald.
  - The save bar sticks to the bottom of the content column. It used to be
    `fixed` across the window and covered the sidebar.
- **The "Admin" box** is now a quiet "Submission" section at the end:
  status override and delete. Its status select has a label.

Checked:
- `tsc` and `eslint` are clean.
- A temporary sample page with MathJax showed the frame, a context with a
  sub-question, both answer boxes and the save bar.
- Owner check on Preview: open a submitted test and grade it.

## 2026-11-19 Legacy course links dropped (#93 step 5), `revamp/b-drop-legacy-course-links`

Owner's approval, quoted on #93: "We can proceed with step 5. You have my
approval for it." A's OK for its paths is on #93 too.

Done:
- **Schema:** `Course.tutorId`, `Course.tutor` and `Course.students` are
  gone from `learning.prisma`; `Student.courses` and `Tutor.courses` are
  gone from `core.prisma` (A's OK). Migration
  `10_drop_legacy_course_links` drops the foreign keys, the `tutorId`
  column and the `_CourseEnrollments` table. Its SQL is what `prisma
  migrate diff` gave against both production and Preview; both diffs were
  the same and showed no drift.
- **Writes:** `createCourse`/`updateCourse` no longer write the old
  columns. CourseStaff and Enrollment (through A's tenancy helpers) are
  the only record.
- **Scripts:**
  - `seed-fake` creates the workspace, owner membership, learners,
    CourseStaff and Enrollment rows, and its wipe clears them first.
  - `backfill-tenancy` loses its course part, which already ran on both
    databases (A's OK).
  - `check-answer-key-roundtrip` no longer reads the course's tutor.
- **`check-tenancy-parity.ts`** now checks integrity of the new tables
  alone: workspace, owner in that workspace, LEAD staff, owner has a Tutor
  profile, enrolments in the right workspace, no duplicate open
  enrolments.

Before the drop (read-only):
- The last old-vs-new parity run, from `main`, was clean on Preview
  (2 courses, 11 enrolments) and production (6 courses, 12 enrolments).
- The new integrity check was clean on both.

Applied (2026-11-19):
- **Preview:** the PR's Preview build applied the migration itself at
  20:56 (`scripts/vercel-build.mjs` migrates Preview on every build). That
  was before the backup, which I hadn't planned for, but Preview lost only
  the duplicate links that parity had just shown matched.
- **Backup:** the owner took a Neon snapshot of production.
- **Production:** after #115 merged and its production deployment was
  live, I ran `migrate deploy` by hand.
- **After, on both databases:**
  - the integrity check is clean (production 6 courses and 12 enrolments,
    Preview 2 and 11);
  - a read-only smoke test of the tenancy filters gave the pre-drop numbers;
  - production logs showed no errors.
- #93 is closed.

For A: Preview deployments of branches made before this merge select
`Course.tutorId` and fail on course pages once Preview has the
migration. Merge `main` into them.

## 2026-11-19 Tutor test pages in the new frame (Phase 1), `revamp/b-next`

Done:
- **`TestFrame`** (`src/features/assessments/components/test-frame.tsx`),
  like `CourseFrame`. It shows the breadcrumb (Tests › course › test ›
  view), a Published or Draft chip and a ribbon with Questions, Submissions
  and Preview. `testRoutes` holds the URLs. The edit, submissions and
  preview pages use it in place of their "Back to tests" bars. Export moved
  to the header's actions on Questions. The answered count moved there
  on Preview.
- **Tests list:** PageHeader with Import and New test as actions, a flat
  table and status chips. A published test opens on Submissions, a draft
  on Questions. **New test** gets a PageHeader too.
- **Submissions:** a flat list with chips: Graded, To mark, In progress.
  The "Manage course" button is gone; the breadcrumb links to the course.
- The question editor's move and remove buttons now name the question
  ("Move question 2 up").

Not checked with real data (sign-in needed). Owner check on Preview: Tests,
open a draft and a published test, and move through the three tabs.

Next in tests: restyle the grading view
(`tutor-tests/submissions/[testId]/[studentId]`), then the student runner
(one question per screen, owner decision 8) and extra time per student
(decision 7, needs a schema field).

## 2026-11-19 Billing nav, card and the folded lesson tree, `revamp/b-billing-shell`

Done:
- **Sidebar ▸ Workspace ▸ Billing** for `billing.view`, only with
  `BILLING=1`. `navSectionsFor(viewer, { billing })` takes the flag from
  the layout. A link marked `billing: true` in nav-config is hidden
  without it. `scripts/check-shell-nav.ts` covers billing off, billing on
  with and without `billing.view`, and which link lights up.
- **Add card / Change card** on the billing overview, for `billing.manage`
  (not when comped). It calls A's `startCardReplacement` (billing.md 1.4).
  On return, the same status poll as payments, with card wording: "Card
  saved. The R10 check is refunded to it."
- **Lesson tree folds on phones.** Below `lg` the tree sits behind a
  "Lessons · 2.1 · Title" toggle, open only when no lesson is selected; from
  `lg` nothing changes.

For A:
- B tells a card check from a payment by A's reference prefix `nx-card-`
  (`isCardCheckReference` in `courses/lib/billing-ui.ts`). The return path
  has no query of its own, because Paystack adds `?reference=`. If you
  change the prefix, tell B, or have `getBillingPaymentStatus` return a
  `purpose`.
- The banners already link to `/dashboard/settings/billing`; nothing to
  change there.

Still waiting on A: `getUsage`, `listPlatformInvoices` and
`getPlatformInvoice` for the usage and payments pages; step 5 on #93.

## 2026-11-19 Billing screens, `revamp/b-billing-screens`

Done, all behind `BILLING=1` (off in production, on for Preview):
- **Course ▸ Services** (`/dashboard/manage-courses/[id]/services`,
  a/ux/03 §2). Included services, then the Plus and Pro switches from
  `getCourseServices`. Each switch calls `previewServiceChange` first,
  through B's `previewCourseServiceChange` action
  (`src/features/courses/billing-actions.ts`). A plan change opens a
  confirmation with the from and to plan, `catchUpCents`, `holdUntil`
  and `nextRenewalDeltaCents`; a change within the plan applies at once.
  On an error the switch flips back and the message shows under it.
  Read-only and past-due workspaces may still switch services off. The
  ribbon shows "Services" only when billing is on.
- **Billing overview** (`/dashboard/settings/billing`, a/ux/03 §1),
  for `billing.view`: state chip, trial days, period and renews-on date,
  next payment, card, courses with plan and active students, the next
  payment line by line, limits with bars, and the unpaid-renewal notice
  with the deletion date. Settings links to it for `billing.view`.
- **Paying** (billing.md 1.3, issue #106), for `billing.manage`:
  "Pay now" on an overdue invoice calls `payPlatformInvoice`; a trial,
  read-only or cancelled workspace without one calls
  `startFirstPayment`. Both pass `returnPath`
  `/dashboard/settings/billing`. Back from Paystack (`?reference=`) the
  page polls `getBillingPaymentStatus` every 2.5 s for up to 60 s, then
  says "We're confirming your payment". The redirect itself never counts
  as paid. `NOTHING_TO_BILL` is mapped.
- Every amount comes from A's calls; nothing is multiplied on the client.
  Display helpers are in `src/features/courses/lib/billing-ui.ts`,
  checked by `scripts/check-billing-ui.ts`.

For A:
- **OK on #97's back-relations** on `Course` in `learning.prisma`
  (`services`, `tierHolds`, `tierOverride`, `feeSchedules`): fine by B,
  no change needed.
- `payPlatformInvoice`'s default `returnPath` is `/dashboard/billing`,
  which is not a route. B always passes `/dashboard/settings/billing`;
  consider making that the default.

Not yet: usage page (§3), payments history (§6), changing the card,
cancelling, the header chip and banners, Compare plans.

Owner check: on Preview, as a workspace owner, open Settings ▸ Billing,
then a course ▸ Services; switch a Plus service on and check the
confirmation's numbers; pay with a Paystack test card and come back to
"Payment received".

## 2026-11-19 Tenancy reads (#93 step 4), `revamp/b-tenancy-reads`

Done:
- B's code no longer reads `Course.tutorId`, `Course.tutor` or the
  implicit enrolment join; only `createCourse`/`updateCourse` still write
  them (dual write, until step 5). Everything goes through
  `src/features/courses/lib/tenancy-where.ts`:
  - `taughtBy(tutorId)` and `staffFor(email)`: an active `CourseStaff`
    membership (any role).
  - `enrolledStudent(studentId)`, `enrollmentFor(studentId)`,
    `studentsOf(courseId)`, `openEnrollmentCount`: an open
    `Enrollment`.
  - `ownerTutor` and `tutorOf(course)`: the teacher's name through
    `ownerMembership`.
  - They take the same Tutor and Student profile ids as before, so the
    call sites kept their signatures.
- This covers the list, detail and ownership queries for courses,
  lessons, tests, assignments, events, the gradebook, tutor Home and
  search. It also covers every action's "do you teach this" and "are you
  enrolled" check, and the "with {tutor}" lines on student pages.
- `_count.students` is now `_count.enrollments` (open only), and
  `getCourseDetailById` still returns `students`, built from open
  enrolments.
- `scripts/check-tenancy-parity.ts` gained a reads section. It runs each
  new filter against the old one for every tutor, student and course,
  plus the actions' nested checks. It is clean on production and Preview.
- Not `canIn` yet: with one workspace the staff and enrolment filters
  are the whole check. Workspace scoping comes with workspace switching.

Still reading the old columns, in A's paths (listed on #93): the
notifications fan-out and queries, `src/app/api/**` routes,
`src/lib/api-guard.ts`. Step 5 (dropping `tutorId` and the join) waits
for those and the owner's approval.

Owner check: on Preview, sign in as a tutor (courses, Home counts,
gradebook) and as a student (My courses, a lesson, a test, an
assignment); both should look exactly as before.

## 2026-11-19 Tenancy dual writes and parity (#93 steps 2 and 3), `revamp/b-tenancy-writes`

Done:
- `createCourse` and `updateCourse` now write the old columns and the new
  tables in one `$transaction` (15 s timeout), through A's
  `setUpCourseTenancy` and `setCourseEnrollment` (#100).
  - `updateCourse` always runs `setUpCourseTenancy`, which is
    idempotent.
  - It runs `setCourseEnrollment` only when the form sends `studentIds`.
  - These are the only writers of the enrolment join. The legacy
    `CourseContext.updateCourse` calls a PUT route that no longer exists.
- `scripts/check-tenancy-parity.ts` (read-only) compares, per course:
  - the workspace;
  - the owner membership and its LEAD staff row;
  - the old enrolment join against the open `Enrollment` rows.
  It prints counts and course ids only, and exits 1 on any difference.
- Parity is clean on production (6 courses, 12 enrolments) and Preview.
- On Preview, a fake course went through the same transaction steps:
  - create: workspace, owner, LEAD and 3 open rows;
  - change enrolment: 1 dropped, 1 added;
  - rename: no change to enrolments.
  Parity stayed clean. Emptying the old join alone made it report the
  course, as it should. The fake course is deleted.

Next (step 4): move B's reads to `CourseStaff`/`Enrollment` and
`canIn`, after this is live and parity is still clean. Then A drops
`tutorId` and the join (step 5, owner approval).

## 2026-11-19 Course page and lesson editor restyle (Phase 1), `revamp/b-course-lesson`

Done:
- The tutor's course pages follow the UI draft "Course page". They share
  `CourseFrame`: one `PageHeader` (Courses › course › view) and a ribbon
  with **Overview**, **Lessons** and **Settings**, each its own route.
  - **Overview** (`/dashboard/manage-courses/[id]`): a course tile and
    title, then properties (students, lessons, assessments, schedule from
    repeating events, next session). It also has the numbered lesson
    outline and the course's tests and assignments with Open, Draft or
    Closed chips.
  - **Lessons** (`/dashboard/manage-courses/lessons/[id]`, URL kept):
    the tree beside the editor. `LessonForm` has a `layout="document"`
    mode here: a large title, the content under it, the other fields in a
    Details box, and a sticky save bar. The create dialog keeps the
    stacked layout.
  - **Settings** (`/dashboard/manage-courses/[id]/settings`, new): the
    existing `CourseForm`. The course card's "Edit" now opens it.
- The loading and ownership check is shared in
  `src/features/courses/tutor-course.ts`; it still uses `tutorId` (#93).
  The markup lives in `CourseOverview` and `LessonsWorkspace`, so the
  pages only load data.
- Pure helpers are in `src/features/courses/lib/course-overview.ts`,
  checked by `npx tsx scripts/check-course-overview.ts`.
- The local dev server reads the shared production database, so I checked
  the pages with sample data on a temporary page, not by signing in.

Not done: on phones the lesson tree sits above the editor; it may later
fold away once a lesson is open. The student course page is unchanged.

Owner check: on Preview as a tutor, open a course and try Overview,
Lessons (edit and save a lesson) and Settings.

## 2026-11-19 Tutor home restyle (Phase 1), `revamp/b-tutor-home`

Done:
- The tutor's `/dashboard` now follows the UI draft "Main":
  - a greeting and a one-line summary ("N to mark · M due this week");
  - one primary action, "New ▾" (course, test, assignment, event);
  - a "Needs your attention" table with To mark, Due (next 7 days) and
    Draft rows, filtered by `?show=mark|due|draft`, with an empty state;
  - "This week" numbers and the next 5 sessions ("Coming up"),
    recurring events expanded.
- Rules live in `src/features/activity/lib/attention.ts` (pure, checked
  by `npx tsx scripts/check-tutor-attention.ts`); data in
  `src/features/activity/tutor-home.ts`. The old tutor tiles are gone.
- Queries still use `Course.tutorId` and the implicit enrolment join;
  they move with the rest after #93.
- A agreed the #93 order and is writing step 1
  (`setUpCourseTenancy`, `setCourseEnrollment` in
  `src/features/workspaces/tenancy.ts`). B starts step 2 (dual writes in
  `createCourse`/`updateCourse`) once A posts the merged PR.

Deferred: the draft's billing rows (Phase 2) and setup checklist
(onboarding wizard).

Owner check: sign in as a tutor on Preview and open Home.

Blocked on the other agent: A's step 1 PR on #93.

## 2026-11-19 Messaging across computers, `revamp/b-agent-messaging`

Done:
- The owner said A and B run on different computers and accounts, so
  `ListAgents` and `SendMessage` can't reach across. The agents now talk
  through GitHub issues labelled `needs-a` and `needs-b`
  (`docs/revamp/MESSAGING.md`, linked from AGENTS.md 4.3 and the README).
  The labels exist. The repo is public, so no secrets or personal data go
  in issues.
- First message: issue #93 to A, proposing the order for moving B's code
  off `Course.tutorId` and the enrolment join:
  1. A's write helpers;
  2. B writes both old and new;
  3. a parity check;
  4. B moves the reads;
  5. A drops the old columns, with the owner's approval.

Blocked on the other agent: A's reply on #93.

## 2026-11-19 Empty states on the main pages (Phase 1), `revamp/b-empty-states`

Done:
- `EmptyState` with an Open Peeps `Scene` now replaces the plain "nothing
  here" text on 14 screens:
  - **Home:** "Up next" and "Recent grades".
  - **Assignments:** the student list (per tab), the tutor list, and an
    assignment's class list.
  - **Tests:** the student list (per tab), the tutor list, and a test's
    attempts.
  - **Courses:** "My courses", the catalogue, Manage courses, a
    course's lessons, schedule and grades, and the student lesson
    reader.
  - **Lesson editor:** "No lessons yet" now has its "Create first
    lesson" action in the empty state.
  - **Also:** the gradebook with no students, and notifications.
- Titles are short and specific ("No upcoming tests", "Nothing waiting
  for a grade"). The tutor's assignment list no longer says to create
  one from the course page; it points to New assignment.
- Not changed:
  - per-field notes ("No answer recorded", "No key set");
  - small inline lists (videos, attachments, memo files);
  - the search palette's "No matches";
  - `tutor-tests/new`, whose "No courses yet" is the page's heading.

Checked:
- `tsc` and eslint pass.
- On a temporary page, the three layouts used here (dashed list, compact
  in a card, full card with an action) look right in light and dark
  mode and at phone width, with no sideways scroll and no console
  errors. The scenes are `aria-hidden`.
- The real pages weren't opened, because they need sign-in. Owner check
  on Preview: a new account, or a course with no lessons, tests or
  students, shows the illustrations.

Next: the rest of B's Phase 1 (plan doc) is the restyle of the tutor home,
the course page and the lesson editor, and the onboarding wizard UI once
A's sign-up API lands. Reading `Enrollment` and `CourseStaff` waits for
`6_tenancy_courses` on production.

## 2026-11-19 Review of A's tenancy part 2 (#88); answer restored, `revamp/b-handoff-restore`

Done:
- Restored the "Answer to A" entry below. #86 merged it, but resolving
  #87's conflict dropped it from `main`.
- Reviewed the `learning.prisma` part of #88 (`Course` fields) against
  that answer.
  - **As agreed:**
    - the three nullable fields, `staff`, `enrollments` and
      `@@index([workspaceId])`;
    - `tutorId` and `students` are unchanged;
    - `SetNull` for the team and the owner membership;
    - `6_tenancy_courses` only adds things.
  - **One difference:** the workspace relation has no `onDelete`. For
    an optional relation Prisma defaults to `SET NULL`, so the
    migration writes `Course_workspaceId_fkey ... ON DELETE SET NULL`
    where B asked for `Restrict`. Nothing deletes workspaces today, so
    this isn't a blocker for running `6_tenancy_courses` on production.

Blocked on the other agent:
- For A: when the later migration makes `Course.workspaceId` required,
  it becomes `Restrict` (Prisma's default for a required relation).
  Please check the generated SQL says `ON DELETE RESTRICT`. Don't edit
  `6_tenancy_courses` itself: Preview has already applied it, and
  editing it would change its checksum.

## 2026-11-19 Feature folder renamed to `assignments`, `revamp/b-assignments-folder`

Done:
- `src/features/submissions` is now `src/features/assignments`, as in
  the AGENTS.md ownership map. Only file moves and import paths change.
  The code's own names (`createSubmission`, the `Submission` model and
  so on) stay, because they follow the database.
- Updated every import, plus `scripts/check-assignment-routes.ts`.

Checked: `tsc` and eslint pass, and `check-assignment-routes` and
`check-shell-nav` pass.

Blocked on the other agent:
- For A: comments in `src/app/api/submissions/**` and
  `src/app/api/submission-entry/**` still name
  `src/features/submissions/...`. Those are comments only, nothing
  breaks; update them when you next touch those routes.

## 2026-11-19 Answer to A: `Course` fields for tenancy part 2, `revamp/b-answer-course-fields`

Replies to A's question in #81 ("May A add exactly these in its part 2
PR?"). A's HANDOFF entry for 2026-11-18 isn't on `main`; it seems to
have been lost in a later merge, so the question is quoted from the #81
diff.

Blocked on the other agent:
- **For A: yes, add the `Course` fields to `learning.prisma` in your
  part 2 PR. B will review it.** The migration and backfill need them,
  so they belong in one PR. Please keep to these terms:
  - Add exactly what you listed: `workspaceId String?`, `teamId
    String?`, `ownerMembershipId String?`, their relations, and
    `staff CourseStaff[]` and `enrollments Enrollment[]`. Also add
    `@@index([workspaceId])`.
  - Keep `tutorId`, its relation and `students` ("CourseEnrollments")
    as they are. B's queries still filter by `tutorId`, e.g.
    `listCoursesByTutorId` and `submissionBelongsToTutor`. B moves them
    to `CourseStaff` and `Enrollment` in its own PRs, then removes the
    old fields.
  - Use `onDelete: SetNull` for `teamId` and `ownerMembershipId`, so
    deleting a team or a membership never deletes a course. Use
    `Restrict` for `workspaceId`.
  - Make the migration additive only, as `4_tenancy_core` was. Making
    `workspaceId` required is a separate later migration, after the
    backfill.
  - Say in the PR body that it touches `learning.prisma`, so B reviews
    that part. Add a line to `a/HANDOFF.md` when it merges, so B can
    start reading `Enrollment`.
- **For A:** your 2026-11-18 "Phase 1 tenancy, part 1" entry is missing
  from `a/HANDOFF.md` on `main`. You may want to restore it.

## 2026-11-19 Submissions renamed to Assignments (Phase 0 item 4), `revamp/b-assignments-rename`

Done:
- Assignment pages moved to `/dashboard/assignments`:

  | Old | New |
  | --- | --- |
  | `/dashboard/submissions` | `/dashboard/assignments` |
  | `/submissions/[id]`, `overview/[id]`, `portal/[id]`, `review/[id]` | `/assignments/[id]` |
  | `/submissions/create` | `/assignments/new` |
  | `/submissions/create/[id]` | `/assignments/[id]/edit` |
  | `/submissions/overview/[id]/[studentId]` | `/assignments/[id]/students/[studentId]` |

- `src/features/submissions/routes.ts` holds every assignment URL
  (`assignmentRoutes`) and the old-to-new map (`legacyAssignmentPath`).
  All of B's links, `revalidatePath` calls and notification links now
  use it.
- `/dashboard/submissions/[[...path]]` redirects every old URL
  permanently (308) and keeps the query string. Old links stay in emails,
  stored notifications and bookmarks, so this page stays. It replaces the
  three Batch 3a redirect stubs, which this PR deletes.
- The editor is one server component,
  `features/submissions/components/assignment-editor-page.tsx`, behind
  `new` and `[id]/edit`.
- Visible names: the legacy nav says "Assignments", and the page titles
  are "Assignments", "Assignment", "New assignment" and "Edit
  assignment". "Submission" stays where it means a student's hand-in.
- The feature folder is still `src/features/submissions`. Renaming it
  touches only imports and can go in its own PR.

Checked:
- `tsc` and eslint pass.
- `scripts/check-assignment-routes.ts` passes all 21 checks.
- `scripts/check-shell-nav.ts` passes, with its expected link lists
  updated.
- On the dev server, the redirect page answered each old URL shape with
  a 308 to the right new URL, keeping the query string, including
  repeated keys. I mounted it at a temporary path because the pane isn't
  signed in.

Not checked: the new pages signed in. Owner test on Preview:
1. Open Assignments from the nav, then an assignment, then a student's
   work, as a tutor.
2. Create a new assignment and edit it.
3. Open an old link, e.g. `/dashboard/submissions/<id>`; it should land
   on `/dashboard/assignments/<id>`.

Blocked on the other agent:
- For A: `src/features/notifications/jobs.ts` and `src/app/api/**` still
  build `/dashboard/submissions/...` links. They redirect, so nothing
  breaks. Switch to `assignmentRoutes` from
  `@/features/submissions/routes` when convenient.

## 2026-11-19 Assignment brief on the rich editor, `revamp/b-assignment-rich-content`

Done:
- **Schema:** `Submission.descriptionJson Json?` beside the markdown
  `description`, in migration `5_submission_description_json` (one
  `ADD COLUMN`, hand-written). It follows A's `4_tenancy_core`.
- **Shared helper:** `richColumnsFromInput(value, area)` in
  `src/lib/content/columns.ts` returns both columns for a rich field
  (markdown, and the envelope or `DbNull` when empty), and throws a
  user-facing message when the document can't be read. Lessons now use it
  too; their behaviour is unchanged.
- **Actions:** `createSubmission` and `updateSubmission` accept
  `descriptionJson`. When it's sent, the server derives `description`
  from it and ignores the browser's markdown. Markdown alone clears the
  JSON so it can't go stale.
- **Form:** `AssignmentForm` uses `RichEditor`. Old briefs open from their
  markdown. `descriptionJson` is sent only after an edit, so saving an
  untouched old assignment leaves its row as it was. Drafts keep the
  document, and Restore remounts the editor; old markdown-only drafts
  still restore.
- **View:** the assignment page's Brief card renders `RichContent`
  (document, else markdown). The submission card keeps plain text.

Checked: `tsc` and eslint clean. On a temporary page under MathJax 3: an
old markdown brief opened in the editor with its maths; an emptied editor
failed "Description is required" and typed text passed; a saved draft
restored into the editor; the view rendered the maths.

Migration: with the owner's approval, `5_submission_description_json`
was applied on 2026-11-19 to Preview (role `nexa_preview`) and then
production, after A's `4_tenancy_core`. Afterwards `migrate status`
reported both up to date and `migrate diff` was empty on both.

Not done:
- Saving through the real action wasn't exercised locally; the owner
  tests it on the Preview deployment. It's the same path as lessons.

## 2026-11-18 Legacy Batch 3b: assignment editor as RSC; all context providers unmounted, `revamp/b-legacy-batch3b`

Done:
- `/dashboard/submissions/create/[[id]]` is now a server page. It does
  the following:
  - It reads `getViewer()` and requires `courses.edit`.
  - It loads the tutor's courses (`listCoursesByTutorId`) and, when
    editing, the assignment (`getSubmissionDetailById`, owner checked
    with `submissionBelongsToTutor`; anything else gives a 404).
  - It renders `AssignmentForm`
    (`src/features/submissions/components/assignment-form.tsx`).
- `AssignmentForm` keeps the legacy fields, validation, layout and draft
  keys, so drafts written by the old page still restore. Changes:
  - **Saving:** it uses `createSubmission` and `updateSubmission`.
    Afterwards it opens the assignment page instead of the list.
  - **Brief uploads** use `BlobKind.AssignmentBrief` at
    `assignmentBriefPath`. A new assignment uses a `draft-<uuid>` id, as
    A's design allows.
  - **Failed uploads:** a failed upload stops the save with a message.
    The old page dropped failed files silently.
  - **Attached files** show their file name, not "File N".
- **No calendar events.** The old page created a `CourseEvent` on create
  and another "(Updated)" one on every edit. The calendar already lists
  every active assignment from `Submission.dueDate`, so those were
  duplicates.
  - Existing legacy `SUBMISSION` events stay in the database; removing
    them is a row delete, which needs the owner's OK.
  - Design 07 assumed `createCourseEvent` would be called here. This is
    the deliberate exception.
- Unmounted the last legacy providers:
  - `LegacyProviders` is now only `MathProvider`.
  - `providers.tsx` is now only next-auth's `SessionProvider`.
  - `ProfileProvider` and `CoursesProvider` fetched on every page, so
    those requests are gone.
- Deleted `submissions/skeletons/submission-form-skeleton.tsx`, which
  had no other user.

**For A (Batch 4), confirmation:** no file outside `src/context/` imports
`@/context/*`, and `useProfile`, `useCourses`, `useSubmission`,
`useEvents` and `useSubmissionEntry` have no caller. After the owner
tests this on Preview, Batch 4 can delete:
- the contexts;
- their API routes;
- `src/lib/blob.ts`, if nothing else imports it.

Checked:
- `tsc` and eslint pass.
- On a temporary page using the real form with sample data:
  - Edit mode loads every field: the local due time, "Unlimited"
    attempts, file types, the attached file's name and draft mode.
  - Every label points at its control.
  - Submitting empty shows the three required-field errors.
  - Picked files list and remove correctly.
  - Auto-save writes `nexa:draft:assignment-new`, and after a reload
    "Restore" brings back the title and due date.
  - No console errors.

Not checked: saving and uploading. Those need a signed-in tutor and
write to the database and Blob store. Owner test on Preview (design 07):
1. Create an assignment with a brief file and a due date, and see it on
   the calendar.
2. Edit it: change the due date, remove a file and add one.
3. A student hands in and resubmits, and the tutor grades.
4. Old portal and review links still redirect.

Follow-up: the assignment description is still markdown. Moving it to
the rich editor needs a `descriptionJson` column, in its own PR.

## 2026-11-17 Draft key rename, `revamp/b-draft-key`
Closes A's rename item for `src/lib/use-local-draft.ts`.

Done:
- Local drafts now save under `nexa:draft:<key>`. This covers the test,
  grading, entry-grading and assignment forms.
- Old drafts are kept: the first time a form reads its draft, a
  `grit-lms:draft:<key>` value moves to the new key, and the old key is
  removed.
  - If both exist, the new one wins and the old one is dropped.
  - If storage is full or blocked, the old draft stays where it is,
    because the move only deletes after the write succeeds.
- Drop `LEGACY_PREFIX` a few months after this ships.

Checked:
- `tsc` and eslint pass.
- In the browser, on a temporary page using the real hook:
  1. A planted old-key draft was offered for restore and moved to the
     new key, and the old key was gone.
  2. Discarding removed it.
  3. With both keys present, the newer one was offered and the old one
     removed.

## 2026-11-17 Account banners in the shell; replies to A's backlog, `revamp/b-account-banners`

Done:
- `src/app/dashboard/layout.tsx` passes
  `banner={<AccountBanners viewer={viewer} />}` to `AppShell` (REVAMP_UI)
  when there is a viewer. The legacy shell has no banner slot and is
  unchanged.
- `/design-system/shell?banner=1` fills the slot with A's real
  `AccountBanners` for an unverified sample user.

Checked:
- `tsc` and eslint pass.
- In the shell preview, the email banner renders in
  `data-slot="account-banner"`, above the sticky `PageHeader`, as
  `role="status"`.
- Not checked signed in: it needs an unverified account, and in Phase 0
  that is the only banner that can show.

**Replies to A's backlog:**
- **Auto-submit:** agreed. Move the logic to
  `src/features/assessments/jobs.ts` and keep the route as a thin
  `defineJob` caller. B won't touch the route meanwhile.
- **Draft key `grit-lms:draft:`:** B renames it to `nexa:draft:` and
  reads the old key once as a fallback, then deletes it. Next PR.
- **Batch 3 brief uploads** (`BlobKind.AssignmentBrief`): next, as Batch
  3b, the RSC assignment editor.
- **Panels** (course Services/Fees, student Sign-in/Parents/Fees): B
  mounts each as a `RibbonNav` view when A ships the component.
- **Already done:**
  - the Batch 2 layout (`getViewer()`, #65);
  - `getViewer`/`viewer-core` imports;
  - the `providers.tsx` and `deleteEntry` questions (#59, #70);
  - the navigation contract (#57, #69);
  - the editor contract's node and mark list (#57).
  - For messages, use `richFieldFromInput()` (`src/lib/content/save.ts`)
    to save rich content.
- The navigation contract still says AccountBanners is "requested". B
  fixes that wording in its next contract PR.

## 2026-11-16 Lessons use the rich editor, `revamp/b-lesson-rich-content`
The first real field on the editor contract (contracts/editor.md).

**Database (owner approved, applied 2026-11-16).** The production
database had no migration history: `migrate status` showed `0_baseline`
and `1_prisma6_m2m_pk` as not applied. Before writing anything,
`migrate diff` from the live database to the schema showed exactly
`1_prisma6_m2m_pk` and the new column, nothing else. Then, following A's
runbook (`a/ops/prisma-baseline.md`):
- `migrate resolve --applied 0_baseline`
- `migrate deploy`, which applied `1_prisma6_m2m_pk` and
  `2_lesson_description_json`
- `migrate status` now says up to date, and `migrate diff` finds no
  difference.

**Preview database (applied 2026-11-17).** Preview runs on its own Neon
branch, where every table belongs to the `nexa_preview` role. That
branch already had `0_baseline` and `1_prisma6_m2m_pk`, so it only took
`2_lesson_description_json`. Until that ran, the tutor course pages on
Preview failed with P2022 (`Lesson.descriptionJson` missing).
- The first try, as `neondb_owner`, failed with "must be owner of table
  Lesson". Postgres rolled it back. I cleared the failed record with
  `migrate resolve --rolled-back`, then deployed as `nexa_preview`.
- Both databases now report up to date, and `migrate diff` finds no
  difference on either.

**Fix found in the owner's Preview test:** saving a lesson failed with
"The lesson content couldn't be read".
- ProseMirror builds node `attrs` with `Object.create(null)`. React's
  server-action encoder sends such objects as opaque temporary client
  references, so on the server `attrs.latex` threw and `validateDoc`
  returned null. Any node with attributes did this (maths, headings,
  tables, lists).
- `RichEditor`'s `onChange` now hands back a plain-JSON copy.
- Reproduced with a temporary page that sends the editor's envelope
  through a raw server action and a `next-safe-action` one: both refused
  it before the fix and accept it after.
- Server-only tests can't catch this, because the documents there never
  cross the action boundary.
- **For A:** if you hold Tiptap JSON anywhere else, copy it to plain JSON
  before passing it to an action.

**Second fix, from the owner's learner-side test:** maths showed as raw TeX
after switching lessons.
- The learner page swaps lessons in place with `?lesson=` links.
  `MathTypeset` (and the markdown fallback) typeset only on mount, so the
  next lesson's TeX was never typeset. Rich to rich even showed the
  previous lesson's formula.
- `RichContent` now keys its output on a fingerprint of the content, so
  new content remounts and typesets.
- Checked on a temporary page that swaps rich and markdown lessons the
  same way, under MathJax 3: every swap shows the right formula, with no
  console errors.
- Saving was confirmed working on Preview by the owner, on the branch
  alias. Earlier "still failing" reports came from the first deployment
  URL, which is pinned to the PR's first commit.

**For A:**
- The baseline in your runbook is done; production now takes
  `migrate deploy`.
- Nothing applies migrations to the Preview branch yet. Every PR with a
  migration needs `migrate deploy` run there by hand, as `nexa_preview`.
  It could become a step in the deploy workflow. `.env` has no `DIRECT_URL`, so I derived it in memory
from the pooled URL (dropping `-pooler`) and wrote nothing to disk.

Done:
- `Lesson.descriptionJson Json?`, migration `2_lesson_description_json`.
- `richFieldFromInput(value)` in `src/lib/content/save.ts`. It returns
  the validated envelope, the derived markdown and an `empty` flag, or
  null. It is rules 1 and 2 in one call; A can use it for messages.
- `createLesson` and `updateLesson` write both columns together:
  - From the envelope when sent: validated, markdown derived on the
    server, browser markdown ignored. An invalid document is refused, and
    an empty one clears both columns.
  - Markdown alone (no caller does this now) clears the JSON, so it can't
    go stale.
- `LessonForm` uses `RichEditor` in place of the markdown textarea.
  - It sends the envelope only after an edit, so lessons still in
    markdown stay unchanged until a tutor edits them (lazy conversion).
  - Edits survive switching to "Group" and back.
- The learner's `LessonContent` renders with `RichContent`, which falls
  back to the markdown column.

Checked:
- `tsc` and eslint pass.
- `check-rich-content` and `check-rich-render` pass.
- A scratch check of `richFieldFromInput`:
  - valid documents pass;
  - empty, unknown-node, bad-nesting, wrong-version and non-envelope
    input are refused or flagged;
  - TeX round-trips exactly.
- The local install was Prisma 5.22; `npm ci` brought it to the
  lockfile's 6.19.3.

Not checked: the lesson pages need a signed-in tutor, and saving writes
to production. Owner test on Preview:
1. Open a lesson that is still markdown. It should look the same in the
   editor and on the learner page.
2. Edit and save it. Add maths with `$`, a table and a heading. Check
   the learner page.
3. Create a lesson and a group.

## 2026-11-16 Legacy Batch 3a: retire portal, review and overview; `deleteEntry`, `revamp/b-legacy-batch3a`
Design 07 Batch 3 is split in two. This is the part that needs nothing
from A. The assignment editor (create/edit) is Batch 3b, after A's
`assignment-brief` Blob kind.

Done:
- `deleteEntry` server action in `src/features/submissions/actions.ts`.
  - It replaces `DELETE /api/submission-entry/[id]`.
  - Only the tutor who owns the assignment's course may delete, the same
    rule as the old route.
  - The grade and section grades cascade.
  - Uploaded files stay in Blob, as before. Deleting Blob items is a
    separate clean-up that needs the owner's approval.
  - No notification is sent, as before.
- `DeleteEntryButton`, with a confirm dialog, on the per-student grading
  page (`overview/[id]/[studentId]`). On success it returns to the
  assignment's list of hand-ins. This is where the delete control lives
  now; the old overview list is gone.
- Retired pages: `portal/[id]`, `review/[id]` and `overview/[id]` (the
  list) now `redirect()` to `/dashboard/submissions/[id]`, which serves
  both roles.
- Deleted the overview's client layout, four unused skeletons and the
  unused `models/actions-menu.tsx`.
- Unmounted `SubmissionEntryProvider`. `LegacyProviders` now holds only
  `SubmissionProvider` and `EventProvider`, both used only by the
  create/edit page.

**For A (Batch 4).** These have no caller from a page now:
- `SubmissionEntryContext`
- `/api/submission-entry` (POST)
- `/api/submission-entry/[id]` (route 9, PUT and DELETE)

A search outside `src/context/` and `src/app/api/` finds only comments.
`ProfileContext`, `CourseContext`, `SubmissionContext` and `EventContext`
are still used by the create/edit page until Batch 3b.

Checked: `tsc` and eslint pass.

Not checked: every changed page is behind dashboard sign-in, and testing
the delete needs a write to the dev database, which is production. Owner
test on Preview:
- As a tutor, open a student's hand-in from the assignment page. Click
  "Delete hand-in", cancel, then confirm. You should land back on the list
  without that student, and the student can hand in again.
- Old `/dashboard/submissions/portal/<id>`, `/review/<id>` and
  `/overview/<id>` links land on `/dashboard/submissions/<id>`.
- A student hands in and resubmits; the tutor grades.

Next: Batch 3b (the assignment editor as RSC) when the Blob kind lands.

Blocked on the other agent: the `assignment-brief` Blob kind (design 07
section 5), and `<AccountBanners viewer />`.

## 2026-11-16 Nav by persona and the workspace switcher, `revamp/b-nav-persona`
Done:
- `navSectionsFor(viewer)` replaces `navSectionsForRole(role)` in
  `src/components/shell/nav-config.ts`.
  - Sections are chosen by `viewer.persona`.
  - A link with `requires` shows only when the viewer holds that
    permission (`can()` semantics; a UI hint only).
  - Gated links: Courses (`courses.edit`), Gradebook and Analytics
    (`grades.view`), Users (`learners.invite` for staff, `admin.console`
    for admins), Grades (`grades.view`).
  - A section left with no links is dropped.
  - The function takes `Pick<Viewer, "persona" | "permissions">`, so it is
    pure and the check script runs it.
- `scripts/check-shell-nav.ts` builds each legacy role's viewer with
  `buildLegacyViewer`. It checks that each role keeps exactly the links
  it had before, and it now has 20 checks.
- The workspace switcher is in `AppShell`'s account menu.
  - `ShellUser` gains `workspaces` (`{ id, name, as }`) and `workspaceId`.
  - With more than one workspace, the menu lists them as radio items,
    each marked "Teaching" or "Learning". Picking one calls A's
    `switchWorkspace`, then refreshes the router; an error shows a toast.
  - With exactly one workspace, its name shows under the email.
  - In Phase 0 everyone has one workspace or none, so nobody sees the list
    yet.
- The legacy shell is unchanged; it keeps its own role-based nav.

Checked:
- `tsc`, eslint, and `check-shell-nav` (20/20) pass.
- On `/design-system/shell`, with two sample workspaces: the menu lists
  both. Picking the other calls `switchWorkspace`, which refuses without a
  session, and the error toast shows. No server errors.

Not checked: a real switch, because Phase 0 has one workspace.

Blocked on the other agent:
- The account banners. The `banner` slot is ready
  (`contracts/navigation.md`). A, please ship the banner content as a
  server component taking the viewer, e.g. `<AccountBanners viewer />`,
  covering impersonation, read-only billing and email verification. B then
  passes it into `AppShell` in the layout. In Phase 0 `impersonatedBy` is
  always null and `readOnly` always false, so nothing would show yet.
- The `assignment-brief` Blob kind for Batch 3.

Next: a contracts PR to bring navigation.md's "When `getViewer()` lands"
section up to date; then Batch 3 once the Blob kind lands.

## 2026-11-16 Legacy Batch 2: shell off ProfileContext, `revamp/b-legacy-batch2`
Done (design 07, Batch 2):
- `src/app/dashboard/layout.tsx` calls `getViewer()` once and builds a
  `ShellUser` (`name`, `email`, `imageUrl`, `role`). Both shells get it as a
  prop: the legacy `DashboardShell` → `Header` and `Nav`, and `AppShell`.
- `Header` and `Nav` no longer call `useProfile()`. They no longer show
  loading skeletons for the name either, because the server already knows
  it.
- `AppShell`'s account menu shows the avatar (`viewer.user.imageUrl`, via
  `next/image`), falling back to initials.
- `getOwnProfile()` turned out to be unnecessary: `getViewer()` already
  reads the avatar from the Tutor or Student row.

Notes:
- The nav still goes by the legacy `session.user.role`. Moving it to
  `viewer.persona`, plus the workspace switcher and the banners, is the
  next B PR (navigation.md, "When getViewer() lands").
- Names now come from `User.name` (the viewer), not `Tutor.fullName` or
  `Student.fullName`. They are normally the same.
- `ProfileProvider` stays in `providers.tsx`. Only the three Batch 3 pages
  read it now: the review page, the create/edit page and the portal.

Checked:
- `tsc` and eslint pass.
- `check-shell-nav` passes.
- `/design-system/shell` renders.

Not checked: the signed-in header, nav and account menu, because the dev
database is production. Owner test from design 07, for each role (tutor,
student, parent, admin), on Preview: the name, avatar and menu are right,
and sign-out works.

Next: nav by persona with the workspace switcher and banners, then Batch 3.

Blocked on the other agent: the `assignment-brief` Blob kind for Batch 3.

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
