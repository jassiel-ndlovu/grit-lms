# Preview rechecks, flagged 2026-11-22

Screens that were checked locally only on the design-system pages, with
sample data and no sign-in. Each needs one pass on Preview with real
accounts. The owner signs in; Agent B drives and records. Accounts come
from A's `scripts/seed-preview.ts`.

Result key: ✅ works, ❌ bug (issue linked), ⚠️ works but rough, ⏭ not run.

## A. PR 207: page frame and the 21 Nov decisions

| # | Account | Check | Result |
| --- | --- | --- | --- |
| A.1 | `seed.ubuntu.owner` (REVAMP_UI on) | The Organisation / Tutor switch shows under the account menu. Switching changes the sidebar and the course list. A failed switch rolls back with a toast | ✅ |
| A.2 | `seed.ubuntu.owner` | Settings › Organisation: the teaching state is shown. "Switch teaching off" stays disabled until the exact name is typed. **Cancel there; don't switch off the shared seed** | ✅ (name match ignores case) |
| A.3 | a tutor of `seed.ubuntu` | Settings › Organisation shows the state, with no switch | ⚠️ tutor gets 404 by design |
| A.4 | `seed.lerato.owner` (cancelled) | Billing shows the restart panel, not the first-payment button. Note which of the four answers comes back. Don't pay | ⚠️ restart says CARD_REQUIRED though a card is shown (A) |
| A.5 | `seed.thuto.owner` (read-only) | New course, New event, New test, Import JSON, New assignment, Add student and Send invites are disabled, with a lock and the read-only reason. Reading pages still works | ⚠️ Home New menu fixed here; Students/Members/Join requests hidden in read-only (A) |
| A.6 | `seed.student.two` | `/dashboard/fees` shows "Your fees are handled by…" instead of a 404 | ✅ |
| A.7 | any (REVAMP_UI on) | Settings › Theme: Bright saves at once and survives a reload, in light and dark. Calm brings the old colours back | ✅ |
| A.8 | any | `/design-system/frame`, every `?type=`, at 1280 and 375 px: widths, sticky headers, and the ribbon hiding on scroll down | ⏭ |

## B. Join requests (#206)

Nothing in the seed is listed, so B.1 lists a course first. Turn listing off
again at the end (B.9).

| # | Account | Check | Result |
| --- | --- | --- | --- |
| B.1 | `seed.ubuntu.tutor1` | Course settings: the "Find courses" switch lists Maths Grade 10, with a toast | ✅ |
| B.2 | `seed.student.adult` | Sidebar has Find courses. The course shows with its school and tutor; search by course, school and tutor name finds it; nonsense shows the no-results scene | ⚠️ tutor-name search finds nothing; enrolled courses still offer Ask to join (A) |
| B.3 | `seed.student.adult` | Ask to join, with a message. The card says "Request sent"; Your requests shows Waiting with Cancel. Cancel, then ask again | ✅ |
| B.4 | `seed.parent.siblings` | Find courses offers each child, not the parent. Ask for one child; the card still offers the other | ✅ |
| B.5 | `seed.ubuntu.tutor1` | Sidebar People › Join requests. Both requests are listed oldest first; the parent's says "… asked for …" | ✅ |
| B.6 | `seed.ubuntu.tutor1` | Approve the adult (No, an adult): the student lands in the course. For a minor who asked alone, Approve stays disabled until consent is ticked | ✅ |
| B.7 | `seed.ubuntu.tutor1` | Decline the child's request with a reason. The Declined tab shows it; the parent sees Declined and the reason | ✅ |
| B.8 | `seed.ubuntu.owner` | The inbox covers the whole workspace, not just the owner's courses | ✅ |
| B.9 | `seed.thuto.owner` | Approve and Decline are disabled with the read-only reason | ⏭ 404 in read-only (A) |
| B.10 | `seed.ubuntu.tutor1` | Turn listing off again. Find courses no longer shows it | ✅ |
| B.11 | any | `/dashboard/browse-courses` redirects to Find courses | ⏭ |
| B.12 | A's emails | The "new request" and "approved / declined" emails link to the inbox and to Find courses (owner's inbox only, Resend dev sender) | ⏭ |

## C. Account, privacy and two-factor (#182, #185, #178, #174)

Deleting and changing an email sign the account out everywhere, so never
use a shared seed account for C.4 to C.9. Sign up a throwaway account with
an `@example.test` address (it counts as verified off production) and use
that. Email links only reach the owner's inbox (Resend dev sender), so for
C.5 and C.8 the owner opens the email and passes the link on.

| # | Account | Check | Result |
| --- | --- | --- | --- |
| C.1 | any | Settings has an Account card. Settings › Account is framed (Reading width) and shows Email address, Your data and Delete your account | ✅ |
| C.2 | any | Your data › Download my data saves `nexa-data-<date>.json`. A second click the same day says when the next download is possible, instead of an error page | ⏭ |
| C.3 | `seed.ubuntu.owner` | Delete your account says to hand over the workspace first (sole owner), with no delete button | ✅ |
| C.4 | throwaway | Change email: a wrong password says "That password isn't right"; the right one shows "Check your new inbox" with the address and "works for 1 hour" | ✅ |
| C.5 | throwaway | The confirm link opens `/account/confirm-email`, which changes nothing until "Confirm my new address" is pressed. Then "Email address changed" and Sign in; the old session is gone. Opening the link again says it doesn't work | ⏭ mail not delivered to @example.test |
| C.6 | throwaway | The undo email's link (`/account/revert-email`): "This wasn't me: undo it" puts the old address back and offers a password reset | ⏭ mail not delivered |
| C.7 | an owner with two-factor on, signed in over 15 minutes ago | Change email shows A's message about signing in again with the authenticator code. **Expected to show "Something went wrong" until A makes it a `UserError` (#185)** | ⚠️ hint shows; still Something went wrong (#185) |
| C.8 | throwaway | Delete: the button stays disabled until DELETE is typed in capitals. Confirming lands on "Your account will be deleted on <date>"; signing in is refused. The emailed link (`/account/cancel-deletion`) → Keep my account → sign in works again | ✅ (cancel link not delivered) |
| C.9 | `seed.ubuntu.tutor1` | A seeded student's profile › Account: Export data downloads; Delete account (parent's request) needs DELETE, then shows Deletion pending (chip in the header, badge in the Students list) and Cancel deletion. **Cancel it straight away** | ✅ |
| C.10 | `seed.ubuntu.tutor1` | `seed.adult`'s profile: no new-code button and no delete, with "manages their own account" | ✅ after clearing migration 23's managed flag on the seed |
| C.11 | a fresh owner (password) | `/two-factor-setup`: password, then a QR code beside the setup key. Scanning it with an authenticator app adds Nexa; its code turns two-factor on. "Remind me tomorrow" still works | ✅ |
| C.12 | a Google-only owner, if Google sign-in is configured on Preview | `/two-factor-setup` has no password field ("You sign in with Google…"); Start setup goes straight to the QR code | ⏭ |
| C.13 | any | Students, Add student, Members invites and a student's Sign-in and Parents tabs: an error A writes for users (for example a taken username) shows as written, not "Something went wrong" | ✅ |

## D. Calendar and attendance (#149)

Checked locally on a temporary page with sample data at 1280 and 375 px
(every view, the session form, the edit scopes, the entry dialog, attendance
marking, check-in and the parent's view). Not yet with real accounts. The
seed's "Weekly class" is a one-off LECTURE two days out, so D.2 makes a
repeating session first. Delete it at the end (D.13).

| # | Account | Check | Result |
| --- | --- | --- | --- |
| D.1 | `seed.ubuntu.tutor1` | Calendar opens on Month. The ribbon switches Month, Week, Day and Agenda, and ‹ Today › step by month, week, day and 30 days. At 375 px the month shows dots and a day opens Day; the week stacks its days; nothing scrolls sideways | ✅ |
| D.2 | `seed.ubuntu.tutor1` | New session: weekly on two weekdays, 16:00, with "New Google Meet" opening Meet in a new tab and its link pasted back. "Times are in …" names the tutor's zone. It shows on both weekdays at 16:00 | ✅ |
| D.3 | `seed.ubuntu.tutor1` | Open one date › Edit › This session: move it an hour. Only that date moves and says "Changed" | ✅ |
| D.4 | `seed.ubuntu.tutor1` | Another date › Edit › This and following: change the title. Earlier dates keep the old title | ✅ |
| D.5 | `seed.ubuntu.tutor1` | Edit › All sessions: change the repeat days. The whole series follows | ✅ |
| D.6 | `seed.ubuntu.tutor1` | Cancel this session: crossed out with "Cancelled"; Restore brings it back | ✅ |
| D.7 | `seed.ubuntu.tutor1` | Take attendance on today's or a past date: P, L, A, E save at once (reload keeps them); a note saves; "Mark the rest present" fills only unmarked rows. Marking a child Absent says parents were emailed (owner's inbox only) | ✅ |
| D.8 | `seed.ubuntu.tutor1` + a seeded student | Open check-in: a 6-character code with a countdown. The student's Check in (header, or the session's dialog while it's on) accepts it in lower case with spaces; a wrong code says so. The tutor's sheet shows "checked in" after a reload. More than 10 minutes after the start it's Late | ✅ |
| D.9 | a seeded student | Their sessions and tests and assignments due show; Join is live from 15 minutes before; "Add to my calendar" downloads an .ics | ✅ |
| D.10 | `seed.parent.siblings` | Sidebar has Calendar. One child at a time, with a chip per child; each child sees only their courses. The child's page has Attendance with the rate and recent marks, and a link to their calendar | ✅ |
| D.11 | any | Subscribe › Get my link: copy works; Add to Google Calendar opens Google with the feed; Make a new link stops the old one working in the calendar app | ✅ |
| D.12 | `seed.thuto.owner` (read-only) | New session, Edit, Cancel, Delete, the attendance buttons and Open check-in are disabled with the read-only reason. Viewing still works | ⚠️ New session locked; no sessions to try more |
| D.13 | `seed.ubuntu.tutor1` | Delete series on the D.2 session: confirm, and every date goes | ✅ |
| D.14 | `seed.ubuntu.owner` | Organisation mode shows every course's sessions in the workspace; Tutor mode only their own | ✅ |

## E. AI-assisted marking (#150)

Checked locally on temporary pages with fake suggestions at 1280 and 375 px
(the switch and its consent dialog, the upgrade line, Mark with AI with a
chosen subset and with A's "isn't set up yet" error, the review cards, bulk
accept, the rubric, and read-only). No AI call was made. Until the owner
sets `ANTHROPIC_API_KEY` on Preview, "Mark with AI" can only show A's
"isn't set up yet" error, so E.4 to E.9 need the key, or rows written by
A's `scripts/check-ai-marking.ts` with its fake marker. The seed tests have
no written questions: E.1 adds one.

| # | Account | Check | Result |
| --- | --- | --- | --- |
| E.1 | `seed.ubuntu.tutor1` | Add a short-answer and an essay question, each with a memo, to a seeded test, and hand it in as two seeded students | ✅ seeded by script |
| E.2 | `seed.ubuntu.tutor1` | Test › Questions: "AI-suggested marks" under the auto-marks toggle. Turning it on asks for parents' consent; Turn on stays disabled until it's ticked; after it, a reload keeps it on. Turning it off needs no dialog | ✅ |
| E.3 | a tutor on a Core or Plus course (billing on) | The switch is replaced by "Part of the Pro plan for this course" and "See plans and services", which opens the course's Services page | ⏭ |
| E.4 | `seed.ubuntu.tutor1` | Submissions: the AI box shows progress. Mark with AI › untick one question › Mark: "N answers queued; M skipped". The bar fills while it marks (the page refreshes itself every 5 s) and rows say "N AI marks to review" | ✅ |
| E.5 | `seed.ubuntu.tutor1` | A student's page: header shows the student, status and live score; the ribbon has ‹ Previous · n of N · Next ›, Rubric and AI suggestions with a count. Previous and Next follow the submissions list | ✅ |
| E.6 | `seed.ubuntu.tutor1` | Each written answer shows the AI's mark, reasoning per criterion, quoted evidence highlighted in the answer, confidence, flags and "Re-marked by the larger model" where it applies. No score is filled in until Accept or Edit | ✅ |
| E.7 | `seed.ubuntu.tutor1` | Accept fills the score and draft feedback ("Confirmed by you (AI mark)"); Edit fills and focuses the score; Reject clears it; Undo works. AI suggestions › Accept all takes only unflagged, not-low ones unless the box is ticked | ✅ |
| E.8 | `seed.ubuntu.tutor1` | Save grade, reload: decided suggestions show "Confirmed by you" or "rejected" with no buttons; the student sees only the saved mark, with no AI label | ❌→fixed here: rejected AI feedback reached the student |
| E.9 | `seed.ubuntu.tutor1` | A failed or skipped answer says why and "Mark it yourself" | ✅ |
| E.10 | `seed.thuto.owner` (read-only) | The switch, Mark with AI, Accept, Edit, Reject, Accept all and Save grade are disabled with the read-only reason | ⏭ no tests in the read-only seed |
| E.11 | any tutor, at 375 px | Grading page: header keeps the score; the ribbon hides on scroll down and returns on scroll up; nothing scrolls sideways | ❌→fixed here: long email overflowed at 375 |

## F. Every dashboard page on the frame (#205, steps 2 to 5)

Checked locally on a temporary page (the real `TutorHome`, `CourseOverview`,
`CourseFrame`, `BillingFrame`, a list and a focus-mode runner with sample
data in `AppShell`) at 375, 768 and 1280 px. Widths: home, list and record
1120; editor full; runner and settings 720. Padding 16 / 24 / 32, gap 32,
one h1 per page, nothing scrolling sideways. Scroll test: at 375 the header
stays under the shell bar and the ribbon hides on scroll down and returns on
scroll up; at 768 and 1280 both stay pinned. Runner strip 28 px at the top.
Not checked with real accounts or data. Run with REVAMP_UI on, then spot-check
F.1, F.4 and F.9 with it off (the legacy shell).

| # | Account | Check | Result |
| --- | --- | --- | --- |
| F.1 | `seed.ubuntu.tutor1` | Home: one 48 px header (breadcrumb, New, help); "Good morning" is the page title, not in the header. Courses, Tests, Assignments, Students, Gradebook, Analytics, Notifications: the same header, title in the page, list width (gradebook for a course goes full width) | ✅ |
| F.2 | `seed.ubuntu.tutor1` | A course: header has Edit lessons; ribbon Overview / Lessons / Settings. Lessons: the tree stays beside the editor on scroll (1280), text at reading width. Settings and Services: 720 wide | ✅ |
| F.3 | `seed.ubuntu.tutor1` | Test designer, New test, New assignment and Edit assignment: full width, save bar lines up with the page padding, title in the page | ❌→fixed here: save bar covered the sidebar |
| F.4 | `seed.student.two` | Home: title and stat tiles in the page, no brand banner. My courses › a course: cover image beside the title (768 and up), Continue with… in the header, Overview / Lessons ribbon. A lesson: Previous / Next / Mark complete in the header, outline sticky at 1280 | ✅ |
| F.5 | `seed.student.two` | Tests, Assignments, Grades, a grade: illustration beside the title from 768, hidden at 375. A test's pre-test and review pages: 720 wide, status chip in the header | ⚠️ pre-test date in UTC, no status chip |
| F.6 | `seed.student.two` | Start a test: the runner's strip is about 28 px; the question bar sticks under it on scroll; no sidebar. **Don't submit a seeded test** unless it's one you added | ✅ |
| F.7 | `seed.parent.siblings` | Home and a child's page: title, stat tiles, no banner; record width | ✅ |
| F.8 | `seed.ubuntu.owner` | Settings, Members, Payouts, Billing, Fees (payer view), Profile, Help: 720 wide; Fees (staff), Discounts: list width | ✅ |
| F.9 | a platform admin (owner) | Admin › Billing › an invoice and a workspace: B's frame (breadcrumb Admin › Billing ›…, title in the page). The admin home is A's and is unchanged | ✅ |
| F.10 | any, at 375 px | Notifications and a course: the ribbon hides on scroll down and returns on scroll up; the header stays; nothing scrolls sideways. Pages with no data ("No student profile…") show a framed message, not a bare line | ✅ (bare message boxed here) |

## G. Filled nav icons, three more themes, the signature strip (22 Nov)

Checked locally on `/design-system/frame` (`?theme=ocean|sunset|contrast|bright`,
`&dark=1`) and a temporary page with every nav icon, a header with and
without a ribbon and the picker, in all five themes, light and dark, at 375
and 1280 px. Contrast is in `scripts/check-themes.ts` (every pair, every
theme, both modes). Not checked with real accounts, in the legacy shell, or
on a real device. Run with REVAMP_UI on, except G.6.

| # | Account | Check | Result |
| --- | --- | --- | --- |
| G.1 | `seed.ubuntu.tutor1` | Sidebar: every icon has a tinted fill and a darker outline (light) or a deeper fill and a lighter outline (dark). The current page's row has the fill and its icon is the boldest. Analytics is a pie | ⏭ |
| G.2 | `seed.student.two` | Settings › Colour theme: five cards (Calm, Bright, Ocean, Sunset, High contrast) with previews. Ocean, Sunset and High contrast apply at once and say "saved on this device for now"; Calm and Bright say "Saved to your account" | ⏭ |
| G.3 | `seed.student.two` | Pick Ocean, reload, open another dashboard page: still Ocean, no flash of Calm on load. Pick Bright, then sign in on another browser: Bright. Pick Sunset: the other browser shows Calm (device-only until A's enum has it) | ⏭ |
| G.4 | `seed.student.two` | Each theme with dark mode on in Settings: readable text, visible inputs and focus rings, error and success messages readable | ⏭ |
| G.5 | `seed.ubuntu.tutor1`, at 1280 and 375 px | A page without a ribbon (Settings): a 3 px colour strip under the header, sticky with it, in the theme's colours. A course (with ribbon): the strip is under the ribbon only. At 375, scroll down: the ribbon slides away and the strip shows under the header; nothing jumps | ⏭ |
| G.6 | `seed.student.two` with REVAMP_UI off | Legacy sidebar: icons filled the same way; active row keeps the terracotta tab | ⏭ |
| G.7 | `seed.student.two` | Start a test: the runner header has a faint 1 px strip. **Don't submit a seeded test** | ⏭ |

## H. Rubrics and reading settings (#216, 22 Nov)

Checked locally on temporary pages (test designer question, grading form,
Settings › Reading card) and `/design-system/shell`, at 375 and 1280 px,
light and dark. Not checked with real accounts. Run with REVAMP_UI on unless
the row says otherwise. Use a test you made; **don't change or submit a
seeded test**.

| # | Account | Check | Result |
| --- | --- | --- | --- |
| H.1 | `seed.ubuntu.tutor1` | New test › an essay question › Add a rubric: one "Content" criterion worth the question's points. Add a criterion and set marks: Points follows the total and can't be typed. Remove the rubric: Points can be typed again. A multiple-choice question has no rubric button | ⏭ |
| H.2 | `seed.ubuntu.tutor1` | Leave a criterion unnamed and save: a toast names the question; nothing saves. Name it, save, reopen the test: the rubric, notes and half-marks setting are kept | ⏭ |
| H.3 | `seed.ubuntu.tutor1` | Export that test as JSON: the question has `rubric`. Import the file as a new test: same rubric, same points | ⏭ |
| H.4 | `seed.ubuntu.tutor1` | Have a test student submit it, then grade: "Marks by criterion" above Score. With half marks on, 1,5 and 2 give Score 3.5. Score can still be typed directly. A rubric with one criterion shows no criterion box | ⏭ |
| H.5 | `seed.ubuntu.tutor1` | AI marking on that question (if the workspace has it): the suggestion lists the same criteria | ⏭ |
| H.6 | `seed.student.two` | Settings › Reading: Large and Larger make all text bigger at once. The easier-to-read font switches to Lexend with wider spacing. Reload and open another page: both stay, with no flash of the default size. Try it with REVAMP_UI off too | ⏭ |
| H.7 | `seed.student.two`, at 375 px | Larger with the font on: Home, a lesson and a test's pre-test page don't scroll sideways; the sidebar and header still fit | ⏭ |
| H.8 | any | On a dashboard page, press Tab once: "Skip to content" appears top left. Enter: focus moves to the page, past the sidebar. Same in the legacy shell (REVAMP_UI off) | ⏭ |
| H.9 | `seed.student.two` | Dark mode on, Ocean theme, then reload: the page loads dark and in Ocean straight away, with no light flash (the boot script fix) | ⏭ |
