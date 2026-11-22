# Preview rechecks, flagged 2026-11-22

Screens that were checked locally only on the design-system pages, with
sample data and no sign-in. Each needs one pass on Preview with real
accounts. The owner signs in; Agent B drives and records. Accounts come
from A's `scripts/seed-preview.ts`.

Result key: ✅ works, ❌ bug (issue linked), ⚠️ works but rough, ⏭ not run.

## A. PR 207: page frame and the 21 Nov decisions

| # | Account | Check | Result |
| --- | --- | --- | --- |
| A.1 | `seed.ubuntu.owner` (REVAMP_UI on) | The Organisation / Tutor switch shows under the account menu. Switching changes the sidebar and the course list. A failed switch rolls back with a toast | ⏭ |
| A.2 | `seed.ubuntu.owner` | Settings › Organisation: the teaching state is shown. "Switch teaching off" stays disabled until the exact name is typed. **Cancel there; don't switch off the shared seed** | ⏭ |
| A.3 | a tutor of `seed.ubuntu` | Settings › Organisation shows the state, with no switch | ⏭ |
| A.4 | `seed.lerato.owner` (cancelled) | Billing shows the restart panel, not the first-payment button. Note which of the four answers comes back. Don't pay | ⏭ |
| A.5 | `seed.thuto.owner` (read-only) | New course, New event, New test, Import JSON, New assignment, Add student and Send invites are disabled, with a lock and the read-only reason. Reading pages still works | ⏭ |
| A.6 | `seed.student.two` | `/dashboard/fees` shows "Your fees are handled by…" instead of a 404 | ⏭ |
| A.7 | any (REVAMP_UI on) | Settings › Theme: Bright saves at once and survives a reload, in light and dark. Calm brings the old colours back | ⏭ |
| A.8 | any | `/design-system/frame`, every `?type=`, at 1280 and 375 px: widths, sticky headers, and the ribbon hiding on scroll down | ⏭ |

## B. Join requests (#206)

Nothing in the seed is listed, so B.1 lists a course first. Turn listing off
again at the end (B.9).

| # | Account | Check | Result |
| --- | --- | --- | --- |
| B.1 | `seed.ubuntu.tutor1` | Course settings: the "Find courses" switch lists Maths Grade 10, with a toast | ⏭ |
| B.2 | `seed.student.adult` | Sidebar has Find courses. The course shows with its school and tutor; search by course, school and tutor name finds it; nonsense shows the no-results scene | ⏭ |
| B.3 | `seed.student.adult` | Ask to join, with a message. The card says "Request sent"; Your requests shows Waiting with Cancel. Cancel, then ask again | ⏭ |
| B.4 | `seed.parent.siblings` | Find courses offers each child, not the parent. Ask for one child; the card still offers the other | ⏭ |
| B.5 | `seed.ubuntu.tutor1` | Sidebar People › Join requests. Both requests are listed oldest first; the parent's says "… asked for …" | ⏭ |
| B.6 | `seed.ubuntu.tutor1` | Approve the adult (No, an adult): the student lands in the course. For a minor who asked alone, Approve stays disabled until consent is ticked | ⏭ |
| B.7 | `seed.ubuntu.tutor1` | Decline the child's request with a reason. The Declined tab shows it; the parent sees Declined and the reason | ⏭ |
| B.8 | `seed.ubuntu.owner` | The inbox covers the whole workspace, not just the owner's courses | ⏭ |
| B.9 | `seed.thuto.owner` | Approve and Decline are disabled with the read-only reason | ⏭ |
| B.10 | `seed.ubuntu.tutor1` | Turn listing off again. Find courses no longer shows it | ⏭ |
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
| C.1 | any | Settings has an Account card. Settings › Account is framed (Reading width) and shows Email address, Your data and Delete your account | ⏭ |
| C.2 | any | Your data › Download my data saves `nexa-data-<date>.json`. A second click the same day says when the next download is possible, instead of an error page | ⏭ |
| C.3 | `seed.ubuntu.owner` | Delete your account says to hand over the workspace first (sole owner), with no delete button | ⏭ |
| C.4 | throwaway | Change email: a wrong password says "That password isn't right"; the right one shows "Check your new inbox" with the address and "works for 1 hour" | ⏭ |
| C.5 | throwaway | The confirm link opens `/account/confirm-email`, which changes nothing until "Confirm my new address" is pressed. Then "Email address changed" and Sign in; the old session is gone. Opening the link again says it doesn't work | ⏭ |
| C.6 | throwaway | The undo email's link (`/account/revert-email`): "This wasn't me: undo it" puts the old address back and offers a password reset | ⏭ |
| C.7 | an owner with two-factor on, signed in over 15 minutes ago | Change email shows A's message about signing in again with the authenticator code. **Expected to show "Something went wrong" until A makes it a `UserError` (#185)** | ⏭ |
| C.8 | throwaway | Delete: the button stays disabled until DELETE is typed in capitals. Confirming lands on "Your account will be deleted on <date>"; signing in is refused. The emailed link (`/account/cancel-deletion`) → Keep my account → sign in works again | ⏭ |
| C.9 | `seed.ubuntu.tutor1` | A seeded student's profile › Account: Export data downloads; Delete account (parent's request) needs DELETE, then shows Deletion pending (chip in the header, badge in the Students list) and Cancel deletion. **Cancel it straight away** | ⏭ |
| C.10 | `seed.ubuntu.tutor1` | `seed.adult`'s profile: no new-code button and no delete, with "manages their own account" | ⏭ |
| C.11 | a fresh owner (password) | `/two-factor-setup`: password, then a QR code beside the setup key. Scanning it with an authenticator app adds Nexa; its code turns two-factor on. "Remind me tomorrow" still works | ⏭ |
| C.12 | a Google-only owner, if Google sign-in is configured on Preview | `/two-factor-setup` has no password field ("You sign in with Google…"); Start setup goes straight to the QR code | ⏭ |
| C.13 | any | Students, Add student, Members invites and a student's Sign-in and Parents tabs: an error A writes for users (for example a taken username) shows as written, not "Something went wrong" | ⏭ |

## D. Calendar and attendance (#149)

Checked locally on a temporary page with sample data at 1280 and 375 px
(every view, the session form, the edit scopes, the entry dialog, attendance
marking, check-in and the parent's view). Not yet with real accounts. The
seed's "Weekly class" is a one-off LECTURE two days out, so D.2 makes a
repeating session first. Delete it at the end (D.13).

| # | Account | Check | Result |
| --- | --- | --- | --- |
| D.1 | `seed.ubuntu.tutor1` | Calendar opens on Month. The ribbon switches Month, Week, Day and Agenda, and ‹ Today › step by month, week, day and 30 days. At 375 px the month shows dots and a day opens Day; the week stacks its days; nothing scrolls sideways | ⏭ |
| D.2 | `seed.ubuntu.tutor1` | New session: weekly on two weekdays, 16:00, with "New Google Meet" opening Meet in a new tab and its link pasted back. "Times are in …" names the tutor's zone. It shows on both weekdays at 16:00 | ⏭ |
| D.3 | `seed.ubuntu.tutor1` | Open one date › Edit › This session: move it an hour. Only that date moves and says "Changed" | ⏭ |
| D.4 | `seed.ubuntu.tutor1` | Another date › Edit › This and following: change the title. Earlier dates keep the old title | ⏭ |
| D.5 | `seed.ubuntu.tutor1` | Edit › All sessions: change the repeat days. The whole series follows | ⏭ |
| D.6 | `seed.ubuntu.tutor1` | Cancel this session: crossed out with "Cancelled"; Restore brings it back | ⏭ |
| D.7 | `seed.ubuntu.tutor1` | Take attendance on today's or a past date: P, L, A, E save at once (reload keeps them); a note saves; "Mark the rest present" fills only unmarked rows. Marking a child Absent says parents were emailed (owner's inbox only) | ⏭ |
| D.8 | `seed.ubuntu.tutor1` + a seeded student | Open check-in: a 6-character code with a countdown. The student's Check in (header, or the session's dialog while it's on) accepts it in lower case with spaces; a wrong code says so. The tutor's sheet shows "checked in" after a reload. More than 10 minutes after the start it's Late | ⏭ |
| D.9 | a seeded student | Their sessions and tests and assignments due show; Join is live from 15 minutes before; "Add to my calendar" downloads an .ics | ⏭ |
| D.10 | `seed.parent.siblings` | Sidebar has Calendar. One child at a time, with a chip per child; each child sees only their courses. The child's page has Attendance with the rate and recent marks, and a link to their calendar | ⏭ |
| D.11 | any | Subscribe › Get my link: copy works; Add to Google Calendar opens Google with the feed; Make a new link stops the old one working in the calendar app | ⏭ |
| D.12 | `seed.thuto.owner` (read-only) | New session, Edit, Cancel, Delete, the attendance buttons and Open check-in are disabled with the read-only reason. Viewing still works | ⏭ |
| D.13 | `seed.ubuntu.tutor1` | Delete series on the D.2 session: confirm, and every date goes | ⏭ |
| D.14 | `seed.ubuntu.owner` | Organisation mode shows every course's sessions in the workspace; Tutor mode only their own | ⏭ |

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
| E.1 | `seed.ubuntu.tutor1` | Add a short-answer and an essay question, each with a memo, to a seeded test, and hand it in as two seeded students | ⏭ |
| E.2 | `seed.ubuntu.tutor1` | Test › Questions: "AI-suggested marks" under the auto-marks toggle. Turning it on asks for parents' consent; Turn on stays disabled until it's ticked; after it, a reload keeps it on. Turning it off needs no dialog | ⏭ |
| E.3 | a tutor on a Core or Plus course (billing on) | The switch is replaced by "Part of the Pro plan for this course" and "See plans and services", which opens the course's Services page | ⏭ |
| E.4 | `seed.ubuntu.tutor1` | Submissions: the AI box shows progress. Mark with AI › untick one question › Mark: "N answers queued; M skipped". The bar fills while it marks (the page refreshes itself every 5 s) and rows say "N AI marks to review" | ⏭ |
| E.5 | `seed.ubuntu.tutor1` | A student's page: header shows the student, status and live score; the ribbon has ‹ Previous · n of N · Next ›, Rubric and AI suggestions with a count. Previous and Next follow the submissions list | ⏭ |
| E.6 | `seed.ubuntu.tutor1` | Each written answer shows the AI's mark, reasoning per criterion, quoted evidence highlighted in the answer, confidence, flags and "Re-marked by the larger model" where it applies. No score is filled in until Accept or Edit | ⏭ |
| E.7 | `seed.ubuntu.tutor1` | Accept fills the score and draft feedback ("Confirmed by you (AI mark)"); Edit fills and focuses the score; Reject clears it; Undo works. AI suggestions › Accept all takes only unflagged, not-low ones unless the box is ticked | ⏭ |
| E.8 | `seed.ubuntu.tutor1` | Save grade, reload: decided suggestions show "Confirmed by you" or "rejected" with no buttons; the student sees only the saved mark, with no AI label | ⏭ |
| E.9 | `seed.ubuntu.tutor1` | A failed or skipped answer says why and "Mark it yourself" | ⏭ |
| E.10 | `seed.thuto.owner` (read-only) | The switch, Mark with AI, Accept, Edit, Reject, Accept all and Save grade are disabled with the read-only reason | ⏭ |
| E.11 | any tutor, at 375 px | Grading page: header keeps the score; the ribbon hides on scroll down and returns on scroll up; nothing scrolls sideways | ⏭ |
