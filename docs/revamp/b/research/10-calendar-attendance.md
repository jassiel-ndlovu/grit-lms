# Calendar, live sessions and attendance

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Keep the calendar grid we already own, and rebuild it on date-fns with shadcn parts. If we later need drag-and-drop week views, adopt FullCalendar v7 (MIT core, official shadcn theme, React 17-19). Do not buy a premium calendar.
- Store recurrence as an RFC 5545 RRULE string plus an exceptions table. Expand it with `rrule-temporal` (maintained) rather than `rrule` (last release Nov 2023). Store UTC and add a `timeZone` column that defaults to `Africa/Johannesburg`.
- Live sessions v1: the tutor pastes a Meet, Zoom or Teams link. We show it, add a "Join" button, and publish an ICS feed. Auto-created links mean an OAuth app review per provider. Teams also needs a work or school tenant. Leave them for v2.
- Attendance v1: a tutor quick-mark sheet (present, late, absent, excused) for each occurrence. Add an optional student check-in code. Parents see a read-only summary, plus a notification when their child is marked absent. Importing attendance from Zoom or Teams needs paid plans and admin scopes, so leave it out of v1.

## Today's calendar in this codebase

**Model.** `CourseEvent` ([prisma/schema.prisma](../../../../prisma/schema.prisma), lines 158-185) has these fields:
- `title`, `description`, `type`, `date`, `location?`, `duration?` (minutes), `link?` and `courseId`.
- `EventType` is `LECTURE | TEST | REMINDER | SUBMISSION | LIVE | EXAM | MEETING | HOLIDAY`.
- The recurrence columns are `repeatFrequency` (`NONE|DAILY|WEEKLY|MONTHLY|YEARLY`), `repeatInterval`, `repeatWeekdays Int[]` (0 = Sunday), `repeatUntil?` and `repeatCount?`.
- `date` is the first occurrence. There is no exception or override storage, no time-zone column, and no attendance model. A `PARENT` role exists in `enum Role`, but there is no Parent model or parent-student link in the schema.

**Recurrence engine.** [src/features/events/lib/recurrence.ts](../../../../src/features/events/lib/recurrence.ts) is a pure "RRULE-ish" expander, called through `occurrencesOf()`.
- Monthly and yearly series clamp to the end of short months.
- Each call stops after 5000 steps or 500 results.
- It works out times "in the server's local zone" (its own comment).

**Read path.** [src/app/dashboard/calendar/page.tsx](../../../../src/app/dashboard/calendar/page.tsx) is a Server Component.
- It builds one `CalendarItem[]` feed by role. The feed holds CourseEvent occurrences for a one-year window (ids look like `eventId#timestamp`), plus tests due and assignments due.
- The feed renders in either our own month grid, `CalendarView` ([src/features/events/components/calendar-view.tsx](../../../../src/features/events/components/calendar-view.tsx), a hand-rolled 42-cell grid that uses no library), or a day-grouped `ListView`. `?view=list` switches between them.
- Writes go through next-safe-action in [src/features/events/actions.ts](../../../../src/features/events/actions.ts). Change notifications come from [src/features/events/notify.ts](../../../../src/features/events/notify.ts).

**Legacy context.** [src/context/EventContext.tsx](../../../../src/context/EventContext.tsx) is an axios-based client context over `/api/events`.
- The new calendar page does not use it.
- It is still mounted in `dashboard-shell.tsx`.
- It is still called by the tutor submission create page, `src/app/dashboard/submissions/(tutor)/create/[[...id]]/page.tsx` lines 212 and 226, which auto-creates SUBMISSION events.
- `src/app/dashboard/calendar/student-calendar.tsx` and `tutor-calendar.tsx` use it, but nothing imports either file. They look like dead code.
- Migration: move the submission page to the `createCourseEvent` action, then delete the context, both dead calendar files and `/api/events`.

**Date library.** `package.json` lists no date library: no date-fns, dayjs or luxon. It does already include `@dnd-kit/core` and `@dnd-kit/sortable`.

**Latent time-zone bug (inferred from the code, not reproduced).**
- The event form builds the date in the browser with `new Date(\`${date}T${time}\`)` (event-form.tsx line 207), so the time is local SAST.
- The weekday chips are SAST weekdays.
- The server expands the series using `Date#getDay()`, which reads the server's zone. Guess: Vercel functions run in UTC (unverified).
- A weekly class at 00:00-01:59 SAST is still the previous day in UTC, so it would expand onto the wrong weekday.
- Today's evening tutoring slots (16:00-20:00) are not affected. The fix is to expand in a named zone (see Recurrence).

## Calendar UI libraries

| | FullCalendar v7 | Schedule-X v4 | React Big Calendar | MUI X Scheduler | @ilamy/calendar | Own grid (date-fns + shadcn) |
|---|---|---|---|---|---|---|
| Latest | [7.1.5 on npm `latest`](https://registry.npmjs.org/@fullcalendar/react) (6.1.22 = `legacy`) | [4.9.1](https://registry.npmjs.org/@schedule-x/calendar) | [1.20.0, 2026-06-01](https://raw.githubusercontent.com/jquense/react-big-calendar/master/CHANGELOG.md) | [v9 beta](https://mui.com/x/react-scheduler/) | [3.3.0](https://registry.npmjs.org/@ilamy/calendar/latest) | n/a |
| Licence (free part) | [MIT](https://registry.npmjs.org/@fullcalendar/react/7.1.5) | [MIT](https://registry.npmjs.org/@schedule-x/calendar/4.9.1) | [MIT](https://registry.npmjs.org/react-big-calendar/1.20.0) | [MIT Community](https://mui.com/x/react-scheduler/) | [MIT](https://registry.npmjs.org/@ilamy/calendar/latest) | ours |
| Paid part | [Premium from $480 for 1-10 devs](https://fullcalendar.io/pricing): timeline, resource views, print | [€479/yr or €999 lifetime + VAT, per project](https://schedule-x.dev/premium): drag-and-drop, resize, drag-to-create, event modal, resources | none | [Premium](https://mui.com/x/react-scheduler/): **recurrence**, exception dates, timeline | none | none |
| React 18 / 19 | [peer `^17 \|\| ^18 \|\| ^19`](https://registry.npmjs.org/@fullcalendar/react/7.1.5). Now written in React itself, with SSR and StrictMode ([upgrade notes](https://fullcalendar.io/docs/upgrading-from-v6)) | [React adapter peer ^16.7-^19](https://registry.npmjs.org/@schedule-x/react/latest), but the core is Preact ([peer preact + @preact/signals](https://registry.npmjs.org/@schedule-x/calendar/4.9.1)) | [peer ^16.14-^19](https://registry.npmjs.org/react-big-calendar/1.20.0) | (unverified) | [**React 19.2 only**, Tailwind 4.2](https://registry.npmjs.org/@ilamy/calendar/latest). Blocks us until the React 19 upgrade | any |
| Bundle (min+gz) | v6 core: [~48 KB](https://bundlephobia.com/api/size?package=@fullcalendar/core@6.1.19). v7 core is a [194 B shell](https://bundlephobia.com/api/size?package=@fullcalendar/core@7.1.5) and its real code sits in `@full-ui/headless-calendar` (size unverified) | [~39 KB core](https://bundlephobia.com/api/size?package=@schedule-x/calendar@4.9.1) + Preact + temporal-polyfill | [~53 KB](https://bundlephobia.com/api/size?package=react-big-calendar@1.20.0) + a localizer. [Pulls in moment, luxon, globalize and lodash as dependencies](https://registry.npmjs.org/react-big-calendar/1.20.0) | (unverified) | Its own size unverified. Pulls in [dayjs, rrule and about 10 Radix packages](https://registry.npmjs.org/@ilamy/calendar/latest) | Guess: under 10 KB of our own code + date-fns tree-shaken |
| Tailwind / shadcn | [Official shadcn theme via the `components.json` registry; Tailwind class props; no bundled CSS in v7](https://fullcalendar.io/docs/upgrading-from-v6) ([shadcn docs](https://v7.fullcalendar.io/shadcn)) | Own CSS themes (unverified for Tailwind) | [SASS/CSS file; the README warns overrides can break rendering](https://github.com/jquense/react-big-calendar) | MUI styling, a poor fit with shadcn | Built on shadcn and Radix | Native |
| Views | Month, week, day, list in the free tier ([pricing](https://fullcalendar.io/pricing) lists only timeline and resource views as premium) | [Month grid, week, day, month agenda](https://schedule-x.dev/docs/calendar) | Month, week, work week, day, agenda (unverified list) | [Day, week, more](https://mui.com/x/react-scheduler/) | Month, week, day (unverified) | Whatever we build. Month and list exist today |
| Drag-and-drop | Free (unverified that it stays free in v7. Guess: yes, it was free in v6) | [Premium since v4](https://schedule-x.dev/blog/schedule-x-v4) | [Free addon](https://github.com/jquense/react-big-calendar) | [Free](https://mui.com/x/react-scheduler/) | Free (dnd-kit) | We'd use our existing @dnd-kit |
| Accessibility | [All views pass Axe in v7](https://fullcalendar.io/docs/upgrading-from-v6) | No notes found | No notes in README | (unverified) | (unverified) | Up to us. Radix helps |
| Recurrence | [rrule plugin](https://fullcalendar.io/docs/rrule-plugin) (uses rrule.js, `exdate`) | [Partial iCal plugin](https://schedule-x.dev/docs/calendar/plugins/recurrence) | None (expand it yourself) | Premium only | Uses rrule | Expand on the server (we do now) |

Notes:
- **Schedule-X** looks good, but the free tier is now display-only. Its v4 announcement says the free/premium line is "displaying" versus "interacting" ([blog](https://schedule-x.dev/blog/schedule-x-v4)). It also brings Preact into a React app.
- **MUI X Scheduler** puts recurrence behind Premium. That rules it out for a tutoring product, because recurrence is the main thing we need.
- **React Big Calendar** is mature. Its dependency tree (moment, luxon, globalize and two lodash builds) does not fit a Tailwind/shadcn app.
- **@ilamy/calendar** is the closest stylistic match. It needs React 19.2 and is young (unverified adoption).
- **Mobile.** Most of our users are on phones. Week and day time grids are hard to use on a 375px screen whatever the library. Our own list or agenda view is the best mobile view. Guess: month on desktop, list by default on mobile.

**What we need.** Students and parents only read the calendar. Tutors create events in a form. Drag-to-reschedule is a nice-to-have, not core. Month, list and maybe week views cover it. A library mainly buys drag-and-drop and a time grid.

## Recurrence

**Standard.** [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) defines what we need:
- RRULE (FREQ, INTERVAL, BYDAY, UNTIL, COUNT).
- EXDATE to skip occurrences (§3.8.5.1).
- RECURRENCE-ID to override one instance (§3.8.4.4).
- `RANGE=THISANDFUTURE` for "this and following" (§3.2.13).
Every calendar app and every ICS export speaks this format.

**Libraries.**

| Library | Status | Notes |
|---|---|---|
| `rrule` (rrule.js) | [2.8.1, published 2023-11-10](https://registry.npmjs.org/rrule), [BSD-3-Clause](https://registry.npmjs.org/rrule/2.8.1). [About 187 open issues and 33 PRs](https://github.com/jkbrzt/rrule). [Snyk: no commits in 6 months](https://snyk.io/advisor/npm-package/rrule) | De facto standard. It works with JS `Date` and the README warns about local-time offsets. [~13.5 KB gz](https://bundlephobia.com/api/size?package=rrule@2.8.1). Treat it as unmaintained. |
| `rrule-temporal` | [2.2.9, MIT, depends only on `temporal-spec`](https://registry.npmjs.org/rrule-temporal/latest). [2 open issues](https://github.com/ggaabe/rrule-temporal) | Built on Temporal and returns `ZonedDateTime`. Supports TZID, EXDATE/RDATE and `toText` in several languages. [Its README says it was written because rrule.js is unmaintained](https://app.unpkg.com/rrule-temporal@1.4.1/files/README.md). It needs a Temporal polyfill, which [FullCalendar v7 already requires](https://registry.npmjs.org/@fullcalendar/react/7.1.5). |
| `@rrulenet/recurrence` | [On JSR](https://jsr.io/@rrulenet/recurrence), 0.x | Too young. |
| rSchedule | (unverified status; not checked in depth) | Older, adapter-based. Not recommended without a fresh check. |
| Keep our own expander | Ours | Already tested and pure. It lacks EXDATE, overrides, zones and BYMONTHDAY. |

**Keep our columns or store an RRULE string?**
- **Store an RRULE string** (for example `FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20270630T215959Z`) plus `dtstart` and `timeZone`.
  - The form still shows friendly controls. It just serialises them to RRULE.
  - Pros: one standard format, lossless ICS export, `toText` for "Every Tue and Thu until 30 Jun", and room to grow (BYSETPOS, "last Friday").
  - Con: data migration. It is mechanical: `repeatFrequency/Interval/Weekdays/Until/Count` map one-to-one to `FREQ/INTERVAL/BYDAY/UNTIL/COUNT`.
- **Keep our columns.** Zero migration. We would still have to write RRULE out for ICS, and add exceptions ourselves anyway.
- **Pick: RRULE string.** The schema is changing for exceptions and attendance anyway, and ICS export needs RRULE text. Schema changes go through `db push`, so the owner must approve the change to the remote Neon DB.

**Exceptions and editing.** These are the patterns Google and Outlook use, mapped to our tables:
- `CourseEvent` holds the series (rrule, dtstart, timeZone, duration).
- `CourseEventException(eventId, originalStart, kind: CANCELLED | MOVED, newStart?, newDuration?, title?, link?, location?)` is the same idea as EXDATE plus RECURRENCE-ID.
- **Edit "this occurrence only"** writes one exception row.
- **Edit "this and following"** splits the series in two:
  - End the old series with `UNTIL` set just before the chosen occurrence.
  - Create a new series from that occurrence.
  - This is simpler than `RANGE=THISANDFUTURE`, which [RFC 5545 allows](https://www.rfc-editor.org/rfc/rfc5545) but which many clients handle badly (unverified).
- **Edit "all"** updates the series. Exceptions keep their `originalStart`. Drop any exceptions that no longer land on an occurrence.
- **Attendance and live links attach to an occurrence key** `(eventId, originalStart)`, not to a row. So we never need to create rows for every occurrence, and the occurrence ids in today's `${e.id}#${date.getTime()}` already match this key.

**Time zones.**
- South Africa is UTC+2 with no DST, so `Africa/Johannesburg` is stable. Still store instants in UTC (`timestamptz`) and store an IANA `timeZone` on the series.
- Expand the RRULE in that zone, not in the server's zone. This fixes the latent weekday bug above, and covers tutors or students abroad, for example students studying in the UK, which does have DST.
- Show times in the viewer's zone. Show a zone label only when it differs from the event's zone.

## Live session links

| Option | What it takes | Account limits | Fit for v1 |
|---|---|---|---|
| **Tutor pastes a link** | Nothing new: `CourseEvent.link` exists. Add URL validation, a provider icon (from the hostname), and a "Join" button that turns on about 10 minutes before the start. | Free plans have caps: Meet free group calls of 3+ people are reported capped at 60 min ([tldv](https://tldv.io/blog/google-meet-time-limit/), third-party, unverified on Google). Zoom Basic is reported at 40 min ([tldv](https://tldv.io/blog/zoom-pricing/), third-party). | **Yes** |
| **Google Meet auto-create** | Calendar API `events.insert` with `conferenceData.createRequest` and `conferenceDataVersion=1`. Creation is async (pending, then success) ([guide](https://developers.google.com/workspace/calendar/api/guides/create-events)). Needs per-tutor Google OAuth with an events scope ([scopes](https://developers.google.com/workspace/calendar/api/auth)). Sensitive or restricted scopes need brand verification, a demo video and a justification ([Google](https://support.google.com/cloud/answer/13464321)). Guess: Calendar event scopes are "sensitive", not "restricted" (unverified). | Reported to work for consumer Gmail via the Calendar API, but not via the Meet REST `spaces.create` ([third-party](https://brandonwie-dev.pages.dev/posts/google-meet-link-creation), unverified). Check `allowedConferenceSolutionTypes` on the calendar ([guide](https://developers.google.com/workspace/calendar/api/guides/create-events)). | v2 |
| **Microsoft Teams auto-create** | Graph `POST /me/onlineMeetings` with delegated `OnlineMeetings.ReadWrite`. **Personal Microsoft accounts are not supported.** App-only access needs a tenant admin to create an application access policy ([Graph docs](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings)). Needs an Entra app registration. | Work or school tenant only. Guess: few of our independent SA tutors have one. | No |
| **Zoom auto-create** | Meeting API (`POST /users/{userId}/meetings`, [API reference](https://developers.zoom.us/docs/api/meetings/)). Server-to-Server OAuth is for your own account, and review is optional there ([docs](https://developers.zoom.us/docs/internal-apps/create/)). Apps used by external Zoom accounts must pass Marketplace review: an operations review plus a security audit ([distribute](https://developers.zoom.us/docs/distribute/)). | Each tutor connects their own Zoom. Free hosts are capped (above). | v2 at the earliest |

**ICS feed export and subscription.** This gives the most value for the least work.
- Add a per-user secret URL, `/api/calendar/<token>.ics`. A token in the path, not a session, is needed because calendar clients cannot log in.
- Generate the file with [`ical-generator` (MIT, 11.1.3, no runtime deps)](https://registry.npmjs.org/ical-generator/latest). Emit the RRULE, EXDATE and overridden instances (RECURRENCE-ID), plus test and assignment due dates.
- Offer `webcal://` and "Add to Google Calendar" links ([pattern](https://til.simonwillison.net/ics/google-calendar-ics-subscribe-link)).
- Caveat: Google refreshes subscribed feeds slowly. Third parties report 8-24 hours, and the `REFRESH-INTERVAL` hint is ignored by Google ([addcal](https://addcal.co/blog/what-is-webcal-subscription-calendar-urls), [usecarly](https://usecarly.com/blog/google-calendar-ics-refresh-rate/); not official). So last-minute changes still need an in-app or email notification, which `notify.ts` already sends.
- Parents get their own feed that merges their linked children. That needs the parent-student link that does not exist yet.
- Token security: allow rotating or revoking the token. Feeds for minors should show only course and session titles, not other students. Agent A owns the POPIA review.
- A one-off ".ics download" button per event is trivial to add as well.

## Attendance

**Data pattern.** Guess at the schema, consistent with the occurrence-key approach above:

```
SessionAttendance
  id, eventId, occurrenceStart (timestamptz)   -- occurrence key
  studentId
  status   PRESENT | LATE | ABSENT | EXCUSED
  minutesLate Int?    note String?
  source   TUTOR | SELF_CHECKIN | IMPORT
  markedById, markedAt, updatedAt
  @@unique([eventId, occurrenceStart, studentId])
```

- No row means "not marked". Do not create ABSENT rows up front.
- Excused absences are set by the tutor, or later approved from a parent's request.
- Rates are `(PRESENT+LATE)/(marked)`, shown per student per course.
- Only events of type LIVE, LECTURE or MEETING take attendance. A per-event `takesAttendance` flag is a reasonable default (Guess).

**Tutor quick-mark UX.** Open the session (the occurrence) to see the roster.
- Everyone starts unmarked, with a "Mark all present" button.
- Tapping a row cycles P, L, A, E. In Technical mode, keys 1-4 do the same.
- An optional note is a popover.
- Autosave each change through a safe-action.
- Lock the sheet after N days, with a reason required to edit. This fits the Technical mode's 28px rows.

**Student self check-in.**
- During the session window (start minus 10 minutes to end), the tutor reveals a short code (6 characters, rotating every 60 s), shown large or as a QR code.
- Students enter it at `/dashboard/calendar/<occurrence>` and land as PRESENT, or LATE after a set threshold.
- The tutor's sheet still wins over self check-in.
- This is cheap, works for any video provider, and needs no OAuth. Codes can be shared over WhatsApp, so treat check-in as a hint. Rotation limits the damage.

**Auto-import from providers.** None of these suits v1.
- **Zoom:** past-meeting and report participant endpoints need a Pro-or-higher host and admin-level scopes. Single-person meetings return nothing ([third-party mirror of Zoom docs](https://developers.qodex.ai/zoom-public/zoom-meeting-api/report-meetings-meetingid-participants/get-meeting-participant-reports), unverified on zoom.us).
- **Teams:** attendance reports need `OnlineMeetingArtifact.Read.All`. Work or school accounts only, personal accounts not supported ([Graph](https://learn.microsoft.com/en-us/graph/api/meetingattendancereport-list)).
- **Google Meet:** the REST API lists participants and sessions of a conference record for the space owner or participants ([Meet API](https://developers.google.com/workspace/meet/api/guides/participants)). Which editions support it is unverified.
- **Matching is the hard part.** Provider display names and emails rarely match LMS students, especially minors on a parent's device. Guess: worth doing only after auto-created links exist, since we then own the meeting ID.

**Parent visibility and notifications.**
- Parents get a read-only per-child view: upcoming sessions, and attendance history with the rate.
- Send a notification when a child is marked ABSENT, or LATE past a threshold. Use the existing Notification model and the user's frequency preference (`NotificationFrequency`).
- Add an optional weekly digest.
- Parents can "request excuse" with a reason, and the tutor approves it.
- All of this needs the parent-student link model first. It is a dependency, not part of this feature.
- Email via Resend: in dev, only the owner address receives mail (see project memory). Sending costs are input for Agent A.

**Tier.** The plan puts "live sessions with attendance" in **Plus**. Suggested split:
- Free tier: calendar, pasted links and ICS.
- Plus: attendance sheet, self check-in, parent attendance alerts and attendance analytics.

## Recommendation

**Library.** Keep and extend our own grid (`calendar-view.tsx`).
- Add date-fns (or Temporal via the polyfill) and shadcn parts.
- Add a list/agenda view (the mobile default), a month view (desktop) and a simple week list.
- Reasons: our needs are read-mostly, the current code already works and matches Simple and Technical modes, there are no licence costs, and it adds no Preact, moment or lodash.
- **Fallback:** FullCalendar v7 (MIT standard). It has an official shadcn theme, React 17-19 peers, passes Axe, and has free month/week/day/list views. Adopt it if tutors ask for drag-to-reschedule on a time grid. Avoid Schedule-X (display-only free tier), MUI X Scheduler (recurrence is paid) and React Big Calendar (dependency weight).

**Recurrence.**
- Move to an `rrule` string column plus `timeZone` (default `Africa/Johannesburg`) plus a `CourseEventException` table.
- Expand on the server with `rrule-temporal` in the event's zone.
- Edits: "this only" writes an exception. "This and following" splits the series.
- **Fallback:** keep today's columns and expander, add a `timeZone` column and an exceptions table, fix the expansion to use that zone, and serialise to RRULE only for ICS.

**v1 scope.**
1. Pasted meeting link with a "Join" button and provider icon.
2. Per-user ICS subscription feed plus a per-event .ics download.
3. Attendance sheet (P/L/A/E) per occurrence.
4. Optional rotating check-in code.
5. Parent absence alert and history (after the parent link exists).
6. Retire `EventContext` and `/api/events`.

Out of v1: auto-created Meet, Zoom or Teams links, and provider attendance import.

## Open questions for the owner

1. Approve schema changes via `db push` to the remote Neon DB: an `rrule`/`timeZone` migration, `CourseEventException`, and `SessionAttendance`. Should the data migration convert the existing recurrence columns in place?
2. Which video tool do our tutors actually use (Meet, Zoom, WhatsApp video)? That decides which provider, if any, gets auto-create in v2.
3. Should students be able to self check in, or is attendance tutor-only? Is a shared code acceptable for minors?
4. Should parents be alerted on every absence immediately, or in a daily or weekly digest by default?
5. Who owns the parent-student link model? Parent features here depend on it.
6. Should ICS feeds for minors include full event descriptions, or titles only? (POPIA input for Agent A.)
7. Are drag-to-reschedule and a time-grid week view needed in v1? If yes, switch the recommendation to FullCalendar v7.

## Sources

- https://registry.npmjs.org/@fullcalendar/react (checked 2026-11-16)
- https://registry.npmjs.org/@fullcalendar/react/7.1.5 (checked 2026-11-16)
- https://fullcalendar.io/pricing (checked 2026-11-16)
- https://fullcalendar.io/docs/upgrading-from-v6 (checked 2026-11-16)
- https://v7.fullcalendar.io/shadcn (checked 2026-11-16)
- https://fullcalendar.io/docs/rrule-plugin (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@fullcalendar/core@6.1.19 (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@fullcalendar/core@7.1.5 (checked 2026-11-16)
- https://schedule-x.dev/premium (checked 2026-11-16)
- https://schedule-x.dev/blog/schedule-x-v4 (checked 2026-11-16)
- https://schedule-x.dev/docs/calendar (checked 2026-11-16)
- https://schedule-x.dev/docs/calendar/plugins/recurrence (checked 2026-11-16)
- https://registry.npmjs.org/@schedule-x/calendar (checked 2026-11-16)
- https://registry.npmjs.org/@schedule-x/calendar/4.9.1 (checked 2026-11-16)
- https://registry.npmjs.org/@schedule-x/react/latest (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@schedule-x/calendar@4.9.1 (checked 2026-11-16)
- https://registry.npmjs.org/react-big-calendar/1.20.0 (checked 2026-11-16)
- https://raw.githubusercontent.com/jquense/react-big-calendar/master/CHANGELOG.md (checked 2026-11-16)
- https://github.com/jquense/react-big-calendar (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=react-big-calendar@1.20.0 (checked 2026-11-16)
- https://mui.com/x/react-scheduler/ (checked 2026-11-16)
- https://registry.npmjs.org/@ilamy/calendar/latest (checked 2026-11-16)
- https://www.rfc-editor.org/rfc/rfc5545 (checked 2026-11-16)
- https://registry.npmjs.org/rrule (checked 2026-11-16)
- https://registry.npmjs.org/rrule/2.8.1 (checked 2026-11-16)
- https://github.com/jkbrzt/rrule (checked 2026-11-16)
- https://snyk.io/advisor/npm-package/rrule (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=rrule@2.8.1 (checked 2026-11-16)
- https://registry.npmjs.org/rrule-temporal/latest (checked 2026-11-16)
- https://github.com/ggaabe/rrule-temporal (checked 2026-11-16)
- https://app.unpkg.com/rrule-temporal@1.4.1/files/README.md (checked 2026-11-16)
- https://jsr.io/@rrulenet/recurrence (checked 2026-11-16)
- https://developers.google.com/workspace/calendar/api/guides/create-events (checked 2026-11-16)
- https://developers.google.com/workspace/calendar/api/auth (checked 2026-11-16)
- https://support.google.com/cloud/answer/13464321 (checked 2026-11-16)
- https://brandonwie-dev.pages.dev/posts/google-meet-link-creation (checked 2026-11-16)
- https://developers.google.com/workspace/meet/api/guides/participants (checked 2026-11-16)
- https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings (checked 2026-11-16)
- https://learn.microsoft.com/en-us/graph/api/meetingattendancereport-list (checked 2026-11-16)
- https://developers.zoom.us/docs/api/meetings/ (checked 2026-11-16)
- https://developers.zoom.us/docs/internal-apps/create/ (checked 2026-11-16)
- https://developers.zoom.us/docs/distribute/ (checked 2026-11-16)
- https://developers.qodex.ai/zoom-public/zoom-meeting-api/report-meetings-meetingid-participants/get-meeting-participant-reports (checked 2026-11-16)
- https://tldv.io/blog/google-meet-time-limit/ (checked 2026-11-16)
- https://tldv.io/blog/zoom-pricing/ (checked 2026-11-16)
- https://registry.npmjs.org/ical-generator/latest (checked 2026-11-16)
- https://til.simonwillison.net/ics/google-calendar-ics-subscribe-link (checked 2026-11-16)
- https://addcal.co/blog/what-is-webcal-subscription-calendar-urls (checked 2026-11-16)
- https://usecarly.com/blog/google-calendar-ics-refresh-rate/ (checked 2026-11-16)
