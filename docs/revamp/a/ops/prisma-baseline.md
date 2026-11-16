# Runbook: put production on Prisma migrations

**Answer first.** The repo now has two migrations. `0_baseline` is the production schema exactly as it is today. `1_prisma6_m2m_pk` is the one change Prisma 6 needs: the `_CourseEnrollments` join table gets a primary key in place of its unique index. Production gets `0_baseline` **marked as applied** (no schema change), then `1_prisma6_m2m_pk` **applied** (two statements on one small table). After that, every schema change is a reviewed migration and `prisma db push` is retired. Every step against production needs the owner's go-ahead.

Status: ready to run, 2026-11-16. Design: [design/06-deployment.md](../design/06-deployment.md), "Baseline, safely".

## What was already checked (2026-11-16, no production writes)

| Check | How | Result |
| --- | --- | --- |
| The split schema equals the old single file | `prisma migrate diff --from-schema-datamodel <old file> --to-schema-datamodel prisma/schema --exit-code` | Identical |
| The repo schema equals the live database | Throwaway **schema-only** Neon branch `baseline-check` from `production` (no rows copied), then `migrate diff --from-url <branch> --to-schema-datamodel prisma/schema` | Identical except `_CourseEnrollments` (unique index on Prisma 5, primary key on Prisma 6). That difference is migration 1 |
| The migrations rebuild the schema from nothing | Empty database on the same branch, `prisma migrate deploy`, then diff against the repo | Identical. `prisma migrate status`: up to date |
| Clean-up | `neon branches delete baseline-check` | Deleted |

## Before you start

- A `DIRECT_URL` for production: Neon's **direct** (not `-pooler`) connection string for the `production` branch. Keep it in your local `.env`, never in the repo or chat. `DATABASE_URL` stays the pooled one.
- A fresh backup: the weekly dump to Tigris `nexa-lms-backups` (see the backup runbook), or `pg_dump -Fc` to your own machine.
- A quiet time. Migration 1 locks `_CourseEnrollments` for well under a second at today's size.

## Steps

All commands run from the repo root on `main` after this PR merges, with production's `DATABASE_URL` and `DIRECT_URL` in the shell.

1. **Check nothing drifted since 16 November.**
   ```bash
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema --script
   ```
   Expect exactly the two `_CourseEnrollments` statements. Anything else means someone changed the database since; stop and ask Agent A.
2. **See whether old migration rows exist.** In the Neon SQL editor on `production`:
   ```sql
   SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;
   ```
   If the table does not exist, skip to step 4.
3. **Clear the old rows** (they name the archived pre-2026-11 folders, which are no longer in `prisma/schema/migrations`). This deletes migration metadata only, no user data:
   ```sql
   DELETE FROM _prisma_migrations;
   ```
4. **Mark the baseline as applied** (writes one metadata row, runs no DDL):
   ```bash
   npx prisma migrate resolve --applied 0_baseline
   ```
5. **Apply the Prisma 6 change:**
   ```bash
   npx prisma migrate deploy
   ```
   Expect "1 migration applied: 1_prisma6_m2m_pk".
6. **Confirm:**
   ```bash
   npx prisma migrate status   # "Database schema is up to date!"
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema --exit-code   # exit 0
   ```
7. Sign in to the app and open a course's student list. Enrolments read and write through `_CourseEnrollments`.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Step 1 shows other differences | Stop. Do not resolve or deploy. Send the output to Agent A, which writes a reconciling migration |
| Step 5 fails on duplicate rows in `_CourseEnrollments` | The old unique index makes duplicates impossible, so this is not expected. Restore nothing; report the error. The index is still there, so nothing changed |
| Need to undo migration 1 | `ALTER TABLE "_CourseEnrollments" DROP CONSTRAINT "_CourseEnrollments_AB_pkey"; CREATE UNIQUE INDEX "_CourseEnrollments_AB_unique" ON "_CourseEnrollments"("A","B");`. Then delete the `1_prisma6_m2m_pk` row from `_prisma_migrations` |

## After this

- New schema changes: `npx prisma migrate dev --name <change>` against the Neon `dev` branch (never production), commit the migration with the schema change, and deploy with `prisma migrate deploy` (design 06 adds a manual GitHub workflow for production).
- **Migration names:** `<next number>_<what>`, for example `4_workspace_tables`. Prisma applies folders in alphabetical order, so keep one scheme: a timestamp name such as `20261117…` sorts before `2_…` and would run out of order on a fresh database. Rename the folder `migrate dev` creates before committing, and take the next number after the highest one on `main`. If two pull requests pick the same number, the second one renumbers before merging.
- **Done on production (2026-11-16/17):** B resolved `0_baseline` and applied `1_prisma6_m2m_pk` and `2_lesson_description_json` (PR #72). A applied `3_job_run` after a backup branch `backup-pre-migrate-20261117`.
- `prisma db push` is not used again on any shared database.
- Prisma prints a warning that `package.json#prisma` is deprecated in favour of `prisma.config.ts`. It works throughout Prisma 6. The move to a config file comes with Prisma 7, because a config file also stops Prisma loading `.env` on its own.
