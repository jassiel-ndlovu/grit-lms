# Contract: imports and exports

Owner: Agent A. Reader: Agent B. Status: **Draft 1.1, 2026-11-23** (#216, phase 1). B asks for changes in an issue labelled `needs-a`.

**Answer first.** One engine runs every import:
1. upload a CSV;
2. preview every row with its problems;
3. fix or remove rows;
4. confirm;
5. watch progress;
6. undo within 24 hours.

Three importers exist: **students** (with parents), **staff** (invitations) and **calendar** (an .ics file). B's screens are the same for every import type. B adds QTI and Common Cartridge by writing an `Importer` (see the last section). Exports use the import template's columns, so a file can go out and come back.

## Server code

| What | Where |
| --- | --- |
| Actions for B's screens | `@/features/imports/actions` |
| Types (`ImportView`, `ImportRow`, `Issue`, `Importer`, `SignInCard`) | `@/features/imports/types` (client-safe) |
| CSV reader and writer | `@/features/imports/csv` (client-safe; `check-imports-csv.ts` covers it) |
| Engine and registry | `@/features/imports/engine`, `@/features/imports/registry` (server only) |
| Students export | `GET /api/exports/students` (a download) |

## Actions

All take and return plain objects through next-safe-action. Errors arrive in `serverError`, written for the person.

| Action | Who | Input | Returns |
| --- | --- | --- | --- |
| `listImportTypes` | signed in | `{}` | `[{ kind, title, headers }]`: only the types the viewer may run |
| `getImportTemplate` | per type | `{ kind }` | `{ fileName, csv }`: a header row and two example rows; offer it as a download. `null` for calendar (any .ics export works) |
| `startImport` | per type; not read-only | `{ kind, fileName, text, defaults? }` (the file's text, up to 1 MB and 2,000 rows; `defaults` for calendar: `{ course: "<course name>", type? }`) | `ImportView` in PREVIEW |
| `editImportRows` | per type | `{ jobId, edits?: [{ n, data: { field: value } }], remove?: [n] }` | `ImportView`; every row is checked again |
| `confirmImport` | per type | `{ jobId, options?: { consentAttested? }, skipErrors? }` | `ImportView` in APPLYING; applying continues in the background |
| `getImport` | per type | `{ jobId }` | `ImportView`. Poll every 2 seconds while APPLYING or UNDOING; polling also keeps a stalled job moving |
| `listImports` | signed in | `{}` | recent jobs without rows: `{ id, kind, title, fileName, status, rowCount, cursor, createdAt, finishedAt, undoUntil }` |
| `cancelImport` | per type | `{ jobId }` | `ImportView` in CANCELLED (PREVIEW only) |
| `undoImport` | per type | `{ jobId }` | `ImportView` in UNDOING (DONE, within `undoUntil`) |
| `getSignInCards` | per type | `{ jobId }` | `SignInCard[]` `{ kind: "student" \| "parent", name, username, code, expiresAt, forStudent? }`; empty once the codes expire. Audited |

**Who, per type:**
- **students:** `learners.invite`. A tutor (or an owner in tutor mode) imports only into courses they teach or own, and each row must name at least one.
- **staff:** `members.invite` for the whole workspace. Only owners invite admins.
- **calendar:** `courses.edit`; a tutor only into courses they teach or own.
- **A tutor** sees and acts on only the imports they started.

## `ImportView`

- `status`: `PREVIEW`, `APPLYING`, `DONE`, `FAILED`, `UNDOING`, `UNDONE` or `CANCELLED`.
- `rows`: every row, `{ n, data, action, issues, outcome?, result? }`.
  - `n` is the file's line number (the header is line 1).
  - `data` holds the cells as strings, keyed by field (the template's columns: `full_name`, `email`, `courses`…). Edit by field name.
  - `action`: `create`, `update` or `skip`. `issues`: `{ field?, level: "error" | "warning", message }`.
  - After applying: `outcome` (`done`, `skipped`, `failed`) and `result` (for example "Created thandi.m; parent account made", or why it failed).
- `counts`: `{ create, update, skip, errors, warnings, done, skipped, failed }`.
- `progress`: `{ cursor, total }`. Rows applied so far; while undoing, the cursor counts down.
- `needs`: options confirm must carry, with the sentence to show next to a tick box. Today only `consentAttested`, when a new student is under 18.
- `hasSignInCards`, `undoUntil`, `error` (FAILED only).

## Screens B builds (suggested)

1. **Choose and upload:** the import types, "Download a template", then a file picker that reads the file as text in the browser (`file.text()`) and calls `startImport`.
2. **Preview:** a table of rows. Errors are marked by cell, warnings shown softly. Cells can be edited and rows removed, then `editImportRows`. Show counts at the top.
3. **Confirm:** the `needs` tick boxes. If errors remain, offer "Skip the rows with errors" (`skipErrors: true`).
4. **Progress:** a bar from `progress`, polling `getImport`, then the outcome per row.
5. **Sign-in cards:** a print-friendly page from `getSignInCards`: name, username, code and expiry per card, several to an A4 page. Codes are secret: never put them in a URL or keep them in the browser.
6. **Undo:** while `undoUntil` is ahead. Rows that can't be undone say why: a student who has already signed in is kept.
7. **History:** `listImports`.

## Students import

- **Columns:** Full name (required), Email, Username, Minor (yes or no; empty means yes), Courses, Parent name, Parent email, Relationship.
  - Other header names work too, for example "Learner", "Class" or "Guardian email".
  - Courses are matched by name; separate them with `;` or `|`.
  - Semicolon-separated files (South African Excel) work as they are.
- **What each row does:**
  - **New student:** an account with a username and a 14-day sign-in code, enrolled on the courses, with the parent linked by email or made with a code.
  - **A student the workspace already manages** (same email): added to the listed courses, and the parent linked.
  - **Someone with their own Nexa account:** skipped, with "ask them to request to join". Imports never take over an account.
  - **Staff email:** an error.
- **Consent:** confirm needs `consentAttested` when any new student is a minor, as on the Add student form.
- **Student limits:** the trial's 20-student limit applies per row. Rows over it fail with the usual message.
- **Undo** removes students and new parents who haven't signed in yet, and course places the import added. Everyone else stays, and their row says why.

## Staff import

- **Columns:** Email (required), Full name, Role (tutor or admin; empty means tutor), Courses.
- **Each row** sends the usual 7-day invitation. Current members are skipped.
- **Undo** revokes invitations not yet accepted.

## Calendar import

- **The file:** an `.ics` export from Google Calendar, Outlook or Apple Calendar, or a school's term calendar. Read it as text in the browser and send it with `defaults: { course: "<name>" }`. The person picks the course before uploading, and can change it per row in the preview.
- **What's read:**
  - title, description, location and link;
  - the start, in the event's own time zone (stored as UTC in `data.start`, with `data.time_zone`);
  - the length, from DTEND or DURATION;
  - all-day events, which come in as `HOLIDAY`;
  - a repeat rule (daily, weekly on chosen days, monthly or yearly, with an end date or a count);
  - skipped dates, which come in as cancelled occurrences.
- **Warnings and skips:**
  - Repeat details that can't be kept (for example "the 3rd of each month") give a warning.
  - Changed single occurrences give a file warning.
  - An event already on that course (same title and start) is skipped, so importing the same file twice adds nothing.
- **Row fields you can edit:** `course`, `title`, `type` (lecture, test, reminder, submission, live, exam, meeting, holiday), `start`, `duration_minutes`, `repeat`, `location`, `link` and `description`. Show `start` in the workspace's time zone.
- **Undo** deletes the events unless attendance was taken.
- **Calendar links** (subscribing to a live URL) come later.

## Exports

- **`GET /api/exports/students`** downloads a CSV in the students template's columns:
  - every active student (for a tutor, those on their courses);
  - their first parent;
  - their open courses.
- It's audited. Link to it from the Students page.

## Adding an importer (B's QTI and Common Cartridge)

1. Implement `Importer<D>` from `@/features/imports/types`:
   - `kind` and `title`;
   - `template`;
   - `read(table, extra)` turns a parsed CSV into rows of string fields (`extra` has the workspace's `timeZone` and the screen's `defaults`); a non-CSV importer implements `readText(text, extra)` instead, like the calendar one;
   - `check(ctx, rows)` returns `{ action, issues }` per row;
   - `needs?`;
   - `apply(ctx, row, options)` commits one row, returning `{ outcome, result, undo? }`;
   - `undo(ctx, undo)`.
2. Register it in `src/features/imports/registry.ts` (one line; ask A in the PR) and add its permission to `PERMISSION` in `actions.ts`.
3. **Non-CSV files** (a QTI zip, a Common Cartridge package) need a file upload instead of `text`. Tell A when you get there: the engine will take a Blob upload and give `read` the file's bytes.

Rules for importers:
- **Rows commit one at a time.** A thrown `UserError` fails that row with its message; anything else fails the row as "Something went wrong with this row".
- **`apply` must be safe to repeat** for the same data: update rather than duplicate.
- **`undo` must refuse** what people have already used.

## Limits and housekeeping

- **Files:** 1 MB and 2,000 rows per file.
- **Applying** runs about 40 seconds per turn: on confirm, on each `getImport` poll, and in the hourly job if nobody is watching.
- **Sign-in codes** are kept sealed on the job until they expire (14 days). Jobs are deleted after 30 days.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-23 | Draft 1.1: calendar importer (.ics); `startImport` takes `defaults`; `readText` for non-CSV importers |
| 2026-11-22 | Draft 1: engine, students and staff importers, sign-in cards, students export |
