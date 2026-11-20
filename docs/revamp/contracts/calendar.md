# Contract: calendar and attendance

Owner: A. Status: Draft 1 (2026-11-20). Asked for in B's #149; design from B research 10, using its fallback for recurrence.

**Answer first.**
- **Recurrence:** today's columns stay (`repeatFrequency`, `repeatInterval`, `repeatWeekdays`, `repeatUntil`, `repeatCount`). New:
  - `CourseEvent.timeZone`, default `Africa/Johannesburg`, so a series repeats at the same local time;
  - "this one only" changes and cancellations live in `CourseEventException`;
  - RRULE is written only for calendar feeds.
- **Attendance:** recorded per learner per occurrence (`SessionAttendance`). Tutors mark it on a sheet, or learners check in with a short code that rotates.
- **Feeds:** each user gets a private ICS subscription, and each event can be downloaded on its own.

Code: `src/features/calendar/` (`calendar-math.ts` is pure, `calendar.ts` is server, `actions.ts`). Routes: `src/app/api/calendar/**`. Migration `18_calendar_attendance`.

## Occurrences

Every occurrence has an `occurrenceStart`: its **original** start, as an ISO string. It's the key for exceptions, attendance and check-in. Keep it even when an exception moves the occurrence.

| Name | Kind | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `listCalendarOccurrences` | action | anyone signed in | `{ from, to, courseId? }` (at most 120 days) | `Array<{ eventId, occurrenceStart, start, end, title, description, type, location, link, cancelled, changed, recurring, courseId, courseName }>`, sorted by `start`. Covers taught courses (owners and admins: the whole workspace), enrolled courses and children's courses |
| `editCourseEventOccurrence` | action | `courses.edit` on the course | `{ eventId, occurrenceStart, scope: "THIS" \| "FOLLOWING" \| "ALL", changes: { title?, description?, start?, duration?, location?, link?, cancelled? } }` | `{ eventId, scope }` |

- **`THIS`** writes an exception. Use `changes.cancelled: true` to cancel one occurrence.
- **`FOLLOWING`** ends the series one minute before the occurrence and starts a new series there with the changes. The new `eventId` is returned. Later exceptions and attendance move to it when the start time is unchanged.
- **`ALL`** changes the whole series. A `start` shifts every occurrence by the same amount.
- **Creating events** stays B's `createEvent`. Please set `timeZone` from the tutor's time zone when you add the field to the form.

## Attendance

| Name | Kind | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `getAttendanceSheet` | action | `courses.edit` | `{ eventId, occurrenceStart }` | `{ eventId, occurrenceStart, title, courseId, checkInOpenUntil, learners: Array<{ learnerId, name, status, method, note, markedAt }> }`: the learners enrolled at that time |
| `markAttendance` | action | `courses.edit` | `{ eventId, occurrenceStart, marks: Array<{ learnerId, status: "PRESENT" \| "LATE" \| "ABSENT" \| "EXCUSED", note? }> }` | `{ marked, guardiansEmailed }` |
| `openCheckIn` | action | `courses.edit` | `{ eventId, occurrenceStart, minutes? }` (1 to 120, default 15) | `{ code, expiresAt }`. The code is shown once. Calling again rotates it |
| `checkIn` | action | a learner | `{ code }` (case and spaces don't matter) | `{ ok: true, title, status }` or `{ ok: false }` |
| `getAttendanceHistory` | action | the learner, or a guardian with `childUserId` | `{ childUserId? }` | `Array<{ learnerId, eventId, title, courseId, courseName, occurrenceStart, status, note }>`, the last 180 days |

- **Check-in status:** PRESENT, or LATE when more than 10 minutes after the start. A tutor's mark is never overwritten, except ABSENT.
- **Parent absence emails (decision taken here):** each guardian gets one email per absence, queued when a learner is first marked ABSENT. It's sent once per occurrence and goes through the email queue. The owner can switch this to a digest later.

## Calendar feeds

| Name | Kind | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `getCalendarFeedUrl` | action | anyone signed in | none | `{ url, webcal }`. Each call replaces the previous link |
| `GET /api/calendar/feed/[token].ics` | route | holder of the link | none | `text/calendar`: the user's courses, from 60 days back |
| `GET /api/calendar/events/[id]/ics` | route | signed in, with access to the course | none | one event (with its series) as an `.ics` download |

**POPIA (decision taken here):** feeds for minors and for guardians carry only the title, course, time and location: no descriptions or meeting links. Staff and adult students get full detail. The "Join" link stays inside Nexa for minors.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-20 | Draft 1 |
