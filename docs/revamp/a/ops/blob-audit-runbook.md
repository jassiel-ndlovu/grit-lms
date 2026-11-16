# Blob audit runbook

**What it is.** `scripts/blob-audit.ts` lists every file in the Vercel Blob store `grit-lms-blob` and every blob URL the database refers to, and writes a report of files nothing refers to, with sizes. **It never deletes, uploads or opens a file**, and it reads the database inside a `READ ONLY` transaction. Deletion is a separate, later step that the owner approves file by file (§5).

Why now: the store is at 888.7 MB of Hobby's 1 GB, and going over **blocks Blob for 30 days**. Design and reasoning: [research/08-blob-cleanup.md](../research/08-blob-cleanup.md) (sections c to e). The owner has approved the audit reading URL columns (16 November 2026). Running it is still an owner step, because it reads production data.

## 1. What it costs

| Resource | Use per run | Hobby allowance |
| --- | --- | --- |
| Blob advanced operations (`list`) | 1 per 1,000 files, so **1** for today's ~802 files | 2,000 a month |
| Blob simple operations, transfer | 0 (no file is opened) | 10,000, 10 GB |
| Database | One read-only transaction; one `SELECT` per text, `text[]` or JSON column, returning only rows that mention `blob.vercel-storage.com` | n/a |

The script stops after 5 `list` calls (`--max-list-calls`) so a wrong token or a much bigger store cannot eat the month's operations. **Do not browse the store in the Vercel dashboard while doing this**: dashboard browsing also spends advanced operations.

## 2. Setup (owner, one time)

1. **Token.** The store is connected to project `grit-lms` with the env prefix `VERCEL_BLOB_`. The script reads `VERCEL_BLOB_READ_WRITE_TOKEN` only, from your shell or from `.env` in the repo root (git-ignored; `.env*` is in `.gitignore`). Either `vercel env pull .env` (Development values) or copy the token from the store's settings page into `.env`:

   ```
   VERCEL_BLOB_READ_WRITE_TOKEN=...
   ```

   This token can also delete files. Keep it in `.env` on your own machines only. The script never prints it.

2. **A copy of the database to read.** Preferred: a Neon branch made from `production` now, so the audit never touches the live branch and sees one consistent moment.
   - Neon console, project `grit-lms-sb`, Branches, New branch, parent `production`, name `blob-audit-YYYYMMDD`, **with data** (the audit needs the URL columns; the branch stays inside Neon us-east-1 like production). Or with the CLI: `neonctl branches create --project-id <id> --name blob-audit-20261116 --parent production`.
   - Copy the branch's connection string (pooled or direct both work) into `.env` as `AUDIT_DATABASE_URL`.
   - Running directly against production also works and is still read-only, but the branch is safer and costs nothing.

3. **Driver.** `npm install` in the repo (the script falls back to the generated Prisma client). If the Prisma upgrade has moved to driver adapters, `pg` is already installed and the script uses it. If neither works, `npm i --no-save pg`.

4. **Other databases.** Any database that ever used this store (a preview or dev database, a teammate's local copy) may hold URLs too. A file referenced only there would look orphaned. Put each URL in `.env` under its own name and pass `--extra-db-env NAME` for each. Research 08 question 4 asks which exist; if unsure, say so in the approval and keep band C out of the first deletion.

## 3. Running it

Dry run first. It uses built-in fake data and contacts nothing, and shows what the report looks like:

```bash
npx tsx scripts/blob-audit.ts --dry-run
```

Then the real audit:

```bash
npx tsx scripts/blob-audit.ts
```

With an extra database, or a different grace period (default 14 days: newer files are never candidates, since a tutor may have uploaded into an unsaved draft):

```bash
npx tsx scripts/blob-audit.ts --extra-db-env PREVIEW_DATABASE_URL --grace-days 30
```

Order inside the script: database scan first (so a database error spends no `list` operation), then the store listing, then the report. It stops without a report if the store lists 0 files (wrong token).

## 4. Reading the report

Output goes to `.blob-audit/<timestamp>/` (git-ignored):

| File | Contents | Share? |
| --- | --- | --- |
| `summary.md` | Counts and MB by status, by band and by upload kind; broken references; other stores; typed columns missing from the schema | **Yes**: counts only, no names |
| `blobs.csv` | Every file: pathname, size, date, status, band, which `Table.column` refers to it | No: pathnames hold user IDs and original file names |
| `orphans.json` | Orphan candidates: URL, pathname, size, date, band. The input for deletion | No |
| `broken-references.csv` | URLs the database points at that are missing from the store | No |

Statuses: `REFERENCED` (keep), `TOO_NEW` (inside the grace period, keep), `ORPHAN_CANDIDATE`. Bands for candidates (research 08 §d): **A** covers, lesson attachments and submissions, whose columns are typed URL columns, so "unreferenced" is reliable; **B** `tests/` and `users/` files (question images removed from markdown, replaced answers, `tests/draft/`); **C** files at the store root from the legacy upload route or with an unknown prefix, to look at by hand.

Things to look at in `summary.md`:

- **Typed URL columns not found**: the schema changed since research 08. Fine if a column was renamed (the full-text scan still covers it), but say so in HANDOFF.
- **References to a different Blob store**: another store has been used. Find out which before deleting anything.
- **Broken references**: rows pointing at missing files. A bug list for the owning agent, not a cleanup item.
- If candidates add up to little, the fix is a size cap or Vercel Pro, not deletion (research 08 question 7).

After reading it, delete the Neon branch `blob-audit-YYYYMMDD` (it holds a full copy of production data).

## 5. How deletion gets approved (later, not in this PR)

Nothing is deleted by the audit, and nothing may be deleted without the owner's yes to an exact list ([AGENTS.md §4](../../AGENTS.md)).

1. **Ask.** The agent (or the owner) sends `summary.md` and asks to delete one band, normally **band A first**. The full list stays on the owner's machine; the owner can open `orphans.json` and filter by band.
2. **Approve in writing.** The owner replies with the band and the audit folder name, for example "Delete band A from `.blob-audit/2026-11-20T…`". The approved file is that folder's `orphans.json`, filtered to the band, saved as `approved-band-A.json` next to it.
3. **Back up the files.** Download every approved file (public URLs; at most ~800 simple operations and under 0.9 GB of transfer) to an encrypted folder off the repo, or encrypt them with the same `age` key as the database backups and put them in Tigris under `blob-backup/YYYY-MM-DD/` (outside the 30-day `db/` expiry rule). Keep for at least 90 days. These are students' files: personal data under POPIA.
4. **Re-check just before deleting.** A file can become referenced after the audit. The delete script (`scripts/blob-delete.ts`, to be written in its own PR) re-runs the reference scan against the **live** database, for the approved URLs only, and drops any that are now referenced.
5. **Delete by exact URL.** `scripts/blob-delete.ts approved-band-A.json` prints what it would delete and the total MB; only `--confirm` deletes, in batches of 100 with `del([...])` and a pause between batches. Deletes are free on Hobby. Never delete by prefix.
6. **Record it.** Add counts and MB freed to HANDOFF, and run the audit again a day later to confirm the totals.

Then repeat for band B, and look at band C by hand. Stopping the leak (delete-on-replace for question images, test answers, submission and memo files; retiring the legacy `/api/upload` route) is separate work in the replacement batches (research 08 §e).
