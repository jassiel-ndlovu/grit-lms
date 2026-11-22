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
