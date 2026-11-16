# Vercel Blob cleanup

**Answer first.** The store `grit-lms-blob` (id `store_sFzz4mGMYKoxYMSL`, cpt1) holds 888.7 MB in 802 files against a Hobby allowance of 1 GB, and on Hobby going over the limit **blocks Blob access for 30 days** rather than billing. That makes cleanup urgent before any new upload feature ships. The plan is a read-only audit script (`scripts/blob-audit.ts`, design below) that lists every blob with one paginated `list()` call, collects every blob URL the database references (12 typed columns plus a regex scan of every text and JSON column), and writes a report of unreferenced files with sizes. Nothing is deleted by the audit. Deletion is a separate, later step that needs the owner's approval of the exact list and a downloaded backup first. **Running the audit reads production data, so it needs the owner's go-ahead.**

Currency: USD is converted at **R17.00/USD** (Wise mid-market 16.95 on 2026-11-16, rounded). Store facts (size, file count, region, not linked) come from the task brief, not from a listing; this research did not list the store, read any file, or query the database.

## Current Hobby limits (verified)

| Resource | Hobby included | What happens over the limit | Source |
|---|---|---|---|
| Blob storage size | 1 GB per month, measured as the **monthly average** (GB-month) | No charge; "you will not be able to access Vercel Blob if limits are exceeded", and you wait 30 days | [vercel.com/docs/vercel-blob/usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) (checked 2026-11-16) |
| Simple operations (cache-miss reads, metadata reads) | First 10,000 | Same | Same (checked 2026-11-16) |
| Advanced operations (upload, copy, **list**, set TTL, create store) | First 2,000 | Same | Same (checked 2026-11-16) |
| Blob data transfer | First 10 GB | Same | Same (checked 2026-11-16) |
| Delete operations | Free | - | Same (checked 2026-11-16) |
| Rate limits | 1,200 simple/min, 900 advanced/min; a batch `del([...])` counts one operation per blob | Requests throttled | Same (checked 2026-11-16) |
| Dashboard browsing | "Each time you interact with the Vercel dashboard to browse your blob store ... count as Advanced Operations" | Uses the 2,000 | Same (checked 2026-11-16) |

Headroom today: 1,000 MB minus 888.7 MB is about **111 MB** (11%). **Guess:** one tutor uploading a few lesson PDFs or a student uploading phone videos could use that in a week, since lesson uploads and submissions allow up to 200 MB per file (`src/lib/blob/paths.ts`).

For comparison, on Vercel Pro the cpt1 rates are US$0.027 per GB-month storage, US$6.00 per 1M advanced ops, US$0.40 per 1M simple ops and US$0.093 per GB transfer ([vercel.com/docs/pricing/regional-pricing/cpt1](https://vercel.com/docs/pricing/regional-pricing/cpt1), checked 2026-11-16). So 1 GB costs about R0.46 a month on Pro: cleanup matters for the Hobby cliff, not for money.

## (a) How uploads are created today

There are two upload paths in the code.

| Path | Code | How | Pathname pattern | Who can upload |
|---|---|---|---|---|
| New: client upload with a signed token | `src/lib/blob/client.ts` calls `upload()` with `handleUploadUrl: "/api/blob/upload-token"`; `src/app/api/blob/upload-token/route.ts` checks the session and role; `src/lib/blob/server.ts` `issueUploadToken` validates the path against the kind | Browser PUTs straight to Blob; `addRandomSuffix: true`; `access: "public"` | One of the 7 schemes in `src/lib/blob/paths.ts` (below), plus a random suffix | Depends on kind |
| Legacy: server upload | `src/lib/blob.ts` `uploadFile(file, folder?)` posts to `src/app/api/upload/route.ts`, which calls `put()` | Server function receives the file (4.5 MB body limit) | `<folder>/<original name>` or, when no folder is passed, **`<original name>` at the store root**, plus a random suffix | Any signed-in user |

The legacy callers all pass no folder, so their files sit at the root of the store with the original (unsanitised) file name:

| Legacy caller | What it uploads | Where the URL is saved |
|---|---|---|
| `src/app/dashboard/submissions/(tutor)/create/[[...id]]/page.tsx` | Assignment brief files | `Submission.descriptionFiles` |
| `src/app/dashboard/submissions/portal/[id]/page.tsx` | Student assignment files | `SubmissionEntry.fileUrl` (**Guess** from the page; not traced to the action) |
| `src/app/dashboard/tests/components/question-input.tsx` | Student file answers (old test UI) | `TestSubmission.answers` JSON |

Path schemes for the new uploader (`src/lib/blob/paths.ts`) and their callers:

| Kind | Pathname | Caller | Where the URL is saved |
|---|---|---|---|
| `course-cover` | `courses/<courseId>/cover/<name>` | `src/features/courses/components/cover-uploader.tsx` | `Course.imageUrl` |
| `lesson-attachment` | `courses/<courseId>/lessons/<lessonId>/attachments/<name>` | `src/features/lessons/components/attachment-manager.tsx` | `Attachment.url` |
| `lesson-upload` | `courses/<courseId>/lessons/<lessonId>/uploaded/<name>` | **No caller found** | - |
| `submission` | `submissions/<submissionId>/<name>`; tutor memos as `submissions/<submissionId>/memo-<timestamp>-<name>` | `src/features/submissions/components/submission-form.tsx`, `memo-files-editor.tsx`, `entry-grading-form.tsx` | `SubmissionEntry.fileUrl`, `Submission.memoFileUrls`, and a `memoFileUrl` inside the JSON string in `QuestionGrade.feedback` |
| `test-question-image` | `tests/<testId>/questions/<questionId>/<name>` | `src/features/assessments/components/test-question-editor.tsx` (inserts `![name](url)` or `[name](url)` into the question text) | `TestQuestion.question` (markdown) |
| same kind, test memo files | `tests/<testId>/questions/memo/<name>` | `src/features/assessments/components/test-memo-files.tsx` | `Test.memoFileUrls` |
| same kind, model-answer files | `tests/memo/questions/<questionKey>/<name>` | `test-question-editor.tsx` (model answer for a FILE_UPLOAD question) | `TestQuestion.answer` JSON |
| `test-answer` | `tests/<testId>/answers/<questionId>/<name>` | `src/features/assessments/components/question-renderer.tsx` | `TestSubmission.answers` JSON |
| `user-avatar` | `users/<userId>/avatar/<name>` | **No caller found** (the token route allows it) | `Tutor.profileImageUrl` or `Student.imageUrl` (**Guess**) |

Two facts that shape the audit:

1. **Path IDs are not reliable.** A new test uses the literal `draft` as its test ID (`test-form.tsx`: `testId={defaultValues?.id ?? "draft"}`), and new questions use a client-side ID, not the database ID. So `tests/draft/...` files may be in use, and a path's ID cannot be used to decide whether the owner still exists. **Only the URL references in the database count.**
2. **Clean-up on replace or delete is partial.** `src/features/courses/actions.ts` deletes the old cover when it changes and when a course is deleted. `src/features/lessons/actions.ts` deletes removed attachments and all attachments of a deleted lesson. Nothing deletes old question images, removed test answers, removed submission files, memo files, or anything uploaded through the legacy route. The legacy `DELETE /api/upload` is retired (`src/app/api/upload/route.ts`). Deleting a course with lessons does not delete those lessons' attachments in the shown code (**Guess**: the course delete fails on the foreign key first, so this may never happen).

## Every place in the database that can hold a blob URL

From `prisma/schema.prisma`. Table names are Prisma model names (no `@@map`, so Postgres tables are the same names, quoted, for example `"Course"`).

### Typed URL columns (exact match)

| Table | Column | Postgres type | Shape |
|---|---|---|---|
| `Course` | `imageUrl` | `text` (required) | one URL |
| `Tutor` | `profileImageUrl` | `text` | one URL or null |
| `Student` | `imageUrl` | `text` | one URL or null |
| `Attachment` | `url` | `text` | one URL |
| `Lesson` | `videoUrl` | `text[]` | URLs (mostly YouTube; **Guess:** some older ones may be blobs) |
| `Submission` | `descriptionFiles` | `text[]` | URLs |
| `Submission` | `memoFileUrls` | `text[]` | URLs |
| `SubmissionEntry` | `fileUrl` | `text[]` | URLs |
| `Test` | `memoFileUrls` | `text[]` | URLs |
| `UploadedFile` | `fileUrl` | `text` | one URL |
| `Resource` | `url` | `text` | one URL |
| `CourseEvent` | `link` | `text` | one URL or null (usually a meeting link) |

### Text and JSON columns that may embed URLs (regex scan)

| Table | Column | Type | Why it may hold a blob URL |
|---|---|---|---|
| `TestQuestion` | `question` | `text` | Markdown with `![name](url)` from the question editor |
| `TestQuestion` | `answer` | `jsonb` | Model-answer files (`fileUrl`) |
| `TestQuestion` | `options`, `reorderItems` | `text[]` | Markdown options may contain images |
| `TestQuestion` | `matchPairs` | `jsonb` | Markdown pairs may contain images |
| `TestSubmission` | `answers` | `jsonb` | Student file answers (`fileUrl`) |
| `TestSubmission` | `feedback` | `text` | Tutor markdown |
| `QuestionGrade` | `feedback` | `text` | JSON string with `memoFileUrl`, or markdown |
| `SubmissionEntry` | `feedback` | `text` | Tutor markdown |
| `Grade` | `finalComments` | `text` | Tutor markdown |
| `Lesson` | `description` | `text` | Lesson markdown |
| `Course` | `description` | `text` | Markdown |
| `Test` | `description`, `preTestInstructions` | `text` | Markdown |
| `Submission` | `description` | `text` | Markdown |
| `CourseEvent` | `description` | `text` | Markdown |
| `Resource` | `description` | `text` | Text |
| `Notification` | `message`, `link` | `text` | **Guess:** unlikely, scanned for safety |
| `ActivityLog` | `meta` | `jsonb` | **Guess:** unlikely, scanned for safety |

Rule for the script: do not trust this list alone. Also scan **every** `text`, `text[]` and `jsonb` column found in `information_schema.columns` for the `public` schema, so a column added later (or missed here) is still covered. The typed list is used to label where each reference came from.

## (b) How to list the store

The store is not linked to the project. Two ways to get access. Both are read-only if you only run `list`.

| Option | Steps | Notes |
|---|---|---|
| 1. Connect the store to the project (dashboard) | Vercel dashboard, Storage, `grit-lms-blob`, Connect Project, choose `grit-lms`, choose environments (Development only is enough for the audit). Then `vercel env pull .env.local` in the repo. | Connecting adds Blob env vars to the project; changing which store production uses is a production change. **Owner approval needed.** In a linked project the CLI uses OIDC (`VERCEL_OIDC_TOKEN` plus `BLOB_STORE_ID`) by default ([vercel.com/docs/cli/blob](https://vercel.com/docs/cli/blob), checked 2026-11-16). |
| 2. Use the store's read-write token, no connection | Owner copies the store's read-write token from the store's settings page into a local, git-ignored file as `BLOB_READ_WRITE_TOKEN`. Run `vercel blob list --rw-token "$BLOB_READ_WRITE_TOKEN" --limit 1000 --json`, or the SDK script below. | `--rw-token` is the documented fallback "for unlinked projects, environments outside of Vercel, or local development" (same page, checked 2026-11-16). The token can also delete, so treat it as a secret and never commit or paste it. |

CLI paging: `--limit` defaults to 10 and the maximum is 1000; `--next <cursor>` gets the next page; `--prefix` filters; `--json` prints JSON (same page, checked 2026-11-16). With 802 files, **one** `list` call at `--limit 1000` returns everything.

SDK: `list({ limit, cursor, prefix, mode, token })` returns `{ blobs: [{ url, downloadUrl, pathname, size, uploadedAt, etag }], cursor, hasMore }`. `limit` defaults to 1000; loop while `hasMore` ([vercel.com/docs/vercel-blob/using-blob-sdk](https://vercel.com/docs/vercel-blob/using-blob-sdk), checked 2026-11-16). An explicit `token` always beats OIDC and `BLOB_READ_WRITE_TOKEN` (same page).

Operation cost: each `list` call is one advanced operation of the 2,000 a month. One full listing costs 1 to 2 operations. Browsing the store in the dashboard also costs advanced operations, so **do not page through 802 files in the dashboard**.

To find out which store production writes to without reading values: `vercel env ls` shows variable **names** per environment only. If `BLOB_READ_WRITE_TOKEN` exists on the project but the store is "not connected", someone pasted a token by hand. The owner should confirm it belongs to `grit-lms-blob`. **Unverified** which store production uses today.

## (c) Audit script design: `scripts/blob-audit.ts`

Not written yet; this is the design for session A2 or Phase 0. Run with `npx tsx scripts/blob-audit.ts`, matching the existing `scripts/check-*.ts` files.

Inputs (all from env, none committed):

- `BLOB_READ_WRITE_TOKEN`: the store token (option 2 above), or OIDC vars after `vercel env pull` (option 1).
- `AUDIT_DATABASE_URL`: a read-only connection string. Prefer a **Neon branch** made from production at audit time, so the audit never touches the live branch and the snapshot is consistent. Creating the branch is an owner step.
- `--extra-db <url>` (repeatable): any other database that may hold URLs to the same store (preview, development, a teammate's local DB). Blobs referenced there are kept too.
- `--grace-days 14`: blobs newer than this are never candidates (a tutor may have an unsaved draft with an uploaded file).
- `--out .blob-audit/` (git-ignored): report folder.

Pseudocode:

```
// 1. List the store (1-2 advanced ops)
blobs = []
cursor = undefined
do {
  page = list({ limit: 1000, cursor, token })
  blobs.push(...page.blobs)        // url, pathname, size, uploadedAt
  cursor = page.cursor
} while (page.hasMore)
assert blobs.length is about 802 and sum(size) is about 888.7 MB, else stop and report

// 2. Collect references from each database (read-only, one transaction)
SET TRANSACTION READ ONLY
refs = Map<normalisedPath, Set<"Table.column">>

// 2a. typed columns: select only the column, never whole rows
for (table, column, isArray) of TYPED_COLUMNS:
  SELECT DISTINCT unnest(column) / column FROM table WHERE column IS NOT NULL
  for each value: if isBlobUrl(value): add(normalise(value), table.column)

// 2b. every text, text[] and jsonb column in schema "public"
for (table, column) of information_schema.columns where data_type in (text, ARRAY, jsonb):
  SELECT column::text FROM table WHERE column::text LIKE '%blob.vercel-storage.com%'
  for each match of BLOB_URL_REGEX in that text: add(normalise(match), table.column)

// 3. Classify
for blob of blobs:
  key = normalise(blob.url)
  if refs has key                       -> REFERENCED
  else if blob.uploadedAt > now - grace -> TOO_NEW (keep)
  else                                  -> ORPHAN_CANDIDATE
also: refs whose key is not in blobs     -> BROKEN_REFERENCE (DB points at a missing file)

// 4. Write report (no file contents, no row contents)
.blob-audit/<date>/blobs.csv        pathname, size, uploadedAt, status, referencedBy
.blob-audit/<date>/orphans.json     [{ url, pathname, size, uploadedAt, prefix, guessReason }]
.blob-audit/<date>/summary.md       counts and MB per status and per prefix; broken references count
```

Helpers:

- `BLOB_URL_REGEX`: `https://[a-z0-9]+\.public\.blob\.vercel-storage\.com/[^\s"'()<>\]]+`. Before use, check the host part against the `url` of one listed blob (**Guess:** the subdomain is the store ID in lower case without `store_`).
- `normalise(url)`: parse the URL, drop the query string (`downloadUrl` adds `?download=1`), percent-decode the path, return the host plus path. Compare on that, not on the raw string. The legacy route kept original file names with spaces and other characters, so decoding matters.
- `isBlobUrl(value)`: host ends with `.public.blob.vercel-storage.com`. Ignore other hosts (YouTube in `videoUrl`, meeting links in `CourseEvent.link`).
- If the regex finds a blob URL that belongs to a **different** store host, count it separately and report it: it means another store is in use.

What the script must not do: call `del()`, `put()`, `copy()` or `head()` per blob; print the token; print or save row contents. Only URL strings and the table and column names that hold them go into the report.

Check for the pull request: `scripts/check-blob-audit.ts` runs `normalise` and the regex on fixed sample strings (markdown image, JSON answer, `downloadUrl`, encoded space, YouTube link) and asserts the expected matches. It needs no network.

## (d) Estimating freed space

The audit's `summary.md` gives the real number: the sum of `size` over `ORPHAN_CANDIDATE`. Before that exists, these are guesses only.

Report the result in three bands, so the owner can approve the safe band first:

| Band | Rule | Likely contents (all **Guess**) |
|---|---|---|
| A. Safe | Orphan, older than the grace period, under a prefix whose DB column is a typed URL column (`courses/*/cover/`, `courses/*/lessons/*/attachments/`, `submissions/`) | Covers replaced before the clean-up code existed; files of lessons deleted before attachment clean-up was added |
| B. Probably safe | Orphan, under `tests/` or `users/` | Question images uploaded and then removed from the markdown; student test answers replaced before submit (`question-renderer.tsx` appends to a list; removing one does not delete the blob); tutor test drafts that were never saved (`tests/draft/...`); old avatars |
| C. Review by hand | Orphan, at the store root (legacy route) or with an unknown prefix | Files from the legacy assignment editor and portal, and from the old test UI; files uploaded while developing locally against the production store |

Expected order of size: **Guess:** student submissions and lesson files dominate the 888.7 MB because they allow 200 MB per file; covers, question images and avatars are small (10 MB, 25 MB and 2 MB caps). So the freed space depends mostly on whether old submissions or old test answers are orphaned. If most of the 802 files are referenced, cleanup may free little and the real fix is a size policy or moving off Hobby (see topic 5, hosting).

Also report `BROKEN_REFERENCE` count: rows pointing at missing files. Those are a bug list, not a cleanup item.

## (e) Safety

| Rule | How |
|---|---|
| Owner go-ahead before reading production data | The audit reads URL columns from production (or a branch of it). Ask first, with this document. AGENTS.md section 4 also requires approval for any Blob deletion. |
| Read-only by construction | Read-only DB transaction on a Neon branch; the audit script imports `list` only, not `del`. |
| Dry run is the default | The audit only writes a report. A separate later script (`scripts/blob-delete.ts`) takes an approved `orphans.json` and does nothing without `--confirm`. Without it, it prints what it would delete and the total MB. |
| Owner approves the exact list | Send the owner `summary.md` plus the band A list (pathname and size). Delete only the band the owner approved, by exact URL from the approved file, never by prefix. |
| Backup first | Before deleting, download each approved blob to an owner-held folder outside the repo (public URLs, so a plain HTTP GET). Cost: at most 802 simple ops of 10,000 and at most 0.9 GB of 10 GB transfer on Hobby. Keep the backup for at least 90 days. It contains student work, so it is personal data under POPIA: keep it encrypted and off shared drives. |
| Re-check before delete | Right before deleting, re-run the reference scan against the **live** database for just the approved URLs. Drop any URL that became referenced since the audit. |
| Respect limits | Delete in batches of 100 URLs with `del([...])` and pause between batches; Hobby allows 900 advanced ops a minute and a batch counts per blob. Deletes are free. CDN copies can take up to a minute to disappear ([vercel.com/docs/vercel-blob/using-blob-sdk](https://vercel.com/docs/vercel-blob/using-blob-sdk), checked 2026-11-16). |
| No personal data in git | `.blob-audit/` is git-ignored. Pathnames include user IDs and original file names, so reports never go in a pull request, issue or chat. Share counts and MB only. |
| Stop the leak too | After cleanup, add delete-on-replace for question images, test answers, submission files and memo files, and retire the legacy `/api/upload` route (already marked `TODO[chapter-3-cleanup]`). Otherwise the store refills. This is design work for session A2. |

## Raise the quota or move: cost compared

On Hobby the quota cannot be raised; the only way past 1 GB is Vercel Pro (plan fee covered in topic 05, hosting). The table compares storage and download (egress) prices only.

| Option | Storage (USD per GB-month) | Egress (USD per GB) | Free amount | Region near SA | Source |
|---|---|---|---|---|---|
| Vercel Blob on Pro, cpt1 | 0.027 | 0.093 Blob Data Transfer, plus 0.43 Fast Origin Transfer on cache misses only | Paid from Pro's monthly credit first | Cape Town (cpt1) | [vercel.com/docs/pricing/regional-pricing/cpt1](https://vercel.com/docs/pricing/regional-pricing/cpt1), [usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) (checked 2026-11-16) |
| Cloudflare R2 Standard | 0.015 | **Free** | 10 GB-month, 1M Class A and 10M Class B ops a month | No Africa location hint (wnam, enam, weur, eeur, apac, oc) | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/), [data-location](https://developers.cloudflare.com/r2/reference/data-location/) (checked 2026-11-16) |
| AWS S3 Standard, af-south-1 | 0.0274 (first tier) | 0.154 (first tier) | **Unverified:** AWS's account-wide 100 GB a month free egress was not checked | Cape Town | `aws pricing get-products` for AmazonS3 and AWSDataTransfer, regionCode af-south-1 (checked 2026-11-16) |
| Azure Blob Hot LRS, South Africa North | 0.0219 | First 100 GB a month free, then 0.181 (Microsoft network routing) | 100 GB egress a month | Johannesburg | [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (serviceName Storage and Bandwidth, southafricanorth, checked 2026-11-16) |

Worked example: 10 GB stored, 50 GB downloaded a month (**Guess** at a 150-student launch), operations ignored (small at this size).

| Option | Storage | Egress | Total USD/month | Total ZAR/month |
|---|---|---|---|---|
| Vercel Blob Pro cpt1 | 0.27 | 4.65, plus 6.45 if 30% are cache misses | 4.92 to 11.37 | R84 to R193 |
| Cloudflare R2 | 0 (inside 10 GB free) | 0 | 0 | R0 |
| S3 af-south-1 | 0.27 | 7.70 | 7.97 | R136 |
| Azure Blob SA North | 0.22 | 0 (inside 100 GB free) | 0.22 | R4 |

What the numbers mean:

- At launch volumes every option costs less than R200 a month. The cost difference does not justify a move on its own.
- Moving has a real one-off cost: the upload code is built on `@vercel/blob` client tokens (`src/lib/blob/*`, `src/app/api/blob/upload-token`), so a move means a presigned-URL rewrite, copying every file, and rewriting every URL in the 12 typed columns and the markdown and JSON columns listed above. The audit's reference map is exactly the input that rewrite needs.
- If Nexa moves to Vercel Pro anyway (plan's running-cost line), staying on Vercel Blob in cpt1 is simplest. Revisit when egress passes about 100 GB a month, where Azure's free 100 GB or R2's free egress start to matter.
- If the whole app moves to Azure South Africa North (topic 05), Azure Blob becomes the natural store and the cheapest on egress up to 100 GB.

## Against the plan

The plan (Hosting, region and storage, revision 2) says for Files: "First list and clean orphaned files; then raise the quota or move", and the cleanup paragraph says: connect the store or use its token, list, compare with database URLs, delete only after the owner confirms.

| Plan says | This research finds | Change suggested |
|---|---|---|
| Connect the store **or** use its token | Both work. Connecting changes the production project's env vars. | Use the token for the audit; decide about connecting as part of the hosting decision. |
| Compare against the URLs the database references | Path IDs cannot be trusted (`tests/draft/...`, client-side question IDs), and URLs also live inside markdown and JSON, not only URL columns. Other databases (preview, local) may reference the same store. | Scan every text and JSON column, include every database that used the store, and add a 14-day grace period for new files. |
| Delete orphans after the owner confirms the list | Agrees. The plan has no backup or re-check step. | Add: download a backup first, re-check references just before deleting, delete by exact URL in bands (safe band first). |
| "Raise the quota or move" | Hobby has no paid quota; raising means Vercel Pro. On Pro, storage is about R0.46 per GB-month, so the urgency is the Hobby 30-day lockout, not cost. | Treat cleanup as the immediate fix, and the Pro decision (topic 05) as the real quota fix. Do not move to R2, S3 or Azure for storage price alone. |
| Cleanup is a one-off | The code leaks: nothing deletes replaced question images, test answers, submission files, memo files or legacy uploads. | Add delete-on-replace and retire `/api/upload` in Phase 0, or the store refills. Coding-task source files (plan, code runner section) will add to the growth. |
| Add-on "Extra storage per GB per month" | Cost basis on Vercel Pro cpt1 is about R0.46 per GB-month stored plus about R1.58 per GB downloaded. **Guess:** a price near R5 per GB-month covers storage and roughly two downloads of each file a month. | Feed this cost basis to topic 01 (pricing). |

## Open questions for the owner

1. May the audit read URL columns from production? Preferably via a new Neon branch of production that you create, read-only.
2. Which option for access: connect `grit-lms-blob` to the `grit-lms` project (Development environment only), or give a read-write token in a local file?
3. Which store does production upload to today? Checked 2026-11-16 with `vercel env ls --project grit-lms` (names only, no values): `BLOB_READ_WRITE_TOKEN` is set for Preview and Production, and `grit-lms-blob` is the only Blob store in the team (`vercel blob list-stores`). So production almost certainly uploads to this store through a manually added token, which is why it shows as "not connected". Confirm this by connecting the store in the dashboard. Note that Preview shares this token, so preview deployments write to the production store too.
4. Are there other databases (preview, development, local) that were ever used with this store? Their references must be kept too.
5. Did anyone upload test files to this store from a local machine? Those would show up as orphans at the root or under `tests/draft/`.
6. Where should the pre-delete backup live, and for how long?
7. If the audit shows little is orphaned, do you prefer a per-file size cap (for example 25 MB for submissions) or moving to Vercel Pro (topic 5)?

## Sources

- https://vercel.com/docs/vercel-blob/usage-and-pricing (checked 2026-11-16)
- https://vercel.com/docs/pricing/regional-pricing/cpt1 (checked 2026-11-16)
- https://vercel.com/docs/vercel-blob/using-blob-sdk (checked 2026-11-16)
- https://vercel.com/docs/cli/blob (checked 2026-11-16)
- https://developers.cloudflare.com/r2/pricing/ (checked 2026-11-16)
- https://developers.cloudflare.com/r2/reference/data-location/ (checked 2026-11-16)
- https://prices.azure.com/api/retail/prices (Storage and Bandwidth, southafricanorth; checked 2026-11-16)
- AWS Price List API via `aws pricing get-products --region us-east-1` (AmazonS3 and AWSDataTransfer, af-south-1; checked 2026-11-16)
- Repository files read on 2026-11-16: `src/lib/blob.ts`, `src/lib/blob/{client,server,paths,index}.ts`, `src/app/api/blob/upload-token/route.ts`, `src/app/api/upload/route.ts`, `prisma/schema.prisma`, `src/features/courses/actions.ts`, `src/features/lessons/actions.ts`, `src/features/assessments/components/{test-form,test-question-editor,test-memo-files,question-renderer}.tsx`, `src/features/submissions/components/{submission-form,memo-files-editor,entry-grading-form}.tsx`, `src/app/dashboard/submissions/(tutor)/create/[[...id]]/page.tsx`, `src/app/dashboard/submissions/portal/[id]/page.tsx`, `src/app/dashboard/tests/components/question-input.tsx`
