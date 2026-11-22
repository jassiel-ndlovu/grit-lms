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
