# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

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
