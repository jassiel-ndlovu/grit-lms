# Database move runbook: Neon us-east-1 to AWS RDS af-south-1 (January 2027)

**What it is.** The step-by-step plan for moving production from Neon project `grit-lms-sb` (aws-us-east-1) to AWS RDS PostgreSQL 17 in af-south-1 (Cape Town), together with moving Vercel functions from `iad1` to `cpt1`. Method: `pg_dump`/`pg_restore` of about 35 MB in a maintenance window of **about 30 minutes**, with Neon kept untouched as the rollback for 14 days.

Why, the instance choice and prices: [research/06-database.md](../research/06-database.md) §5 and §6. Where it sits in Stage 2, env vars and monitoring: [design/06-deployment.md](../design/06-deployment.md) §4, §7, §8 and §9. This file does not repeat those; it is the checklist to run on the day.

**Every step that creates AWS resources, writes to either database, or changes Vercel needs the owner's go-ahead** ([AGENTS.md §4](../../AGENTS.md)). The owner decided the move on 16 November 2026 for January 2027, before the first payment in February 2027.

Roles in this runbook: **Owner** (Jassiel) holds the AWS, Neon and Vercel accounts and says go or no-go. **Operator** runs the commands (the owner, or an agent the owner watches).

## 0. Assumptions to recheck a week before

| Item | Expected | Check |
| --- | --- | --- |
| Vercel plan | Pro, so `cpt1` and custom environments are available | Vercel dashboard |
| Prisma | Upgraded (main session), schema split into `prisma/schema/*.prisma`, `directUrl = env("DIRECT_URL")`, a `0_baseline` migration resolved on production | `npx prisma migrate status` against a Neon branch of production |
| Database size | ~35 MB (grows slowly) | Neon console |
| Postgres version | 17 on both sides | Neon console; `aws rds describe-db-engine-versions --engine postgres --region af-south-1` |
| Extensions in use | Whatever `SELECT extname FROM pg_extension` lists on Neon | Each must be in RDS's supported list for PG 17 (plpgsql always is) |
| Jobs | Stage 1: GitHub Actions `scheduled-jobs.yml`; Stage 2: QStash schedules | Whichever is live on the day |
| Maintenance flag | `MAINTENANCE_MODE=1` read by middleware, blocks writes, shows a notice | Must exist and be tested on Preview before the window. If not built, use §3 step W2's database-level freeze only |
| Backups | The weekly Tigris backup ran in the last 7 days ([backup-runbook.md](backup-runbook.md)) | `tigris ls t3://nexa-lms-backups/db/` |

If any row is not as expected, move the window.

## 1. Two weeks before: build and rehearse (no downtime)

### 1.1 Create RDS (owner, about R374 a month)

Settings from research 06 §6 "Before the window":

- Engine PostgreSQL 17 (newest 17.x), template Production, **Single-AZ**, `db.t4g.micro`, gp3 20 GB, storage autoscaling up to 50 GB.
- Identifier `nexa-prod`, region **af-south-1** (enable the opt-in region on the account first if needed).
- Master user `nexa_admin`, password generated and kept in the owner's password manager only (not in Vercel).
- Public access **yes** (Vercel has no fixed outbound IPs without the paid add-on, research 06 §4 "Network security"); security group allows TCP 5432.
- Parameter group: a custom one for postgres17 with `rds.force_ssl = 1`.
- Encryption at rest on (default KMS key), automated backups **14 days**, deletion protection on, Performance Insights free tier on, minor version auto-upgrade on with a Sunday maintenance window outside the cutover date.

### 1.2 Roles and database

Connect as `nexa_admin` with `psql "host=<rds-endpoint> dbname=postgres user=nexa_admin sslmode=require"`:

```sql
CREATE DATABASE nexa;
CREATE ROLE nexa_migrator LOGIN PASSWORD '<random 1>';
CREATE ROLE nexa_app LOGIN PASSWORD '<random 2>' CONNECTION LIMIT 60;
CREATE ROLE nexa_backup LOGIN PASSWORD '<random 3>';
ALTER DATABASE nexa OWNER TO nexa_migrator;
\c nexa
ALTER SCHEMA public OWNER TO nexa_migrator;
GRANT USAGE ON SCHEMA public TO nexa_app, nexa_backup;
-- Grants on objects the migrator creates later, including during the restore:
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO nexa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO nexa_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_migrator IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO nexa_backup;
```

`nexa_app` has no DDL rights; only `nexa_migrator` owns the schema (design 06 §3.4).

### 1.3 Connection strings (prepare, do not apply)

| Name | Value |
| --- | --- |
| New `DATABASE_URL` | `postgresql://nexa_app:<pw>@<rds-endpoint>:5432/nexa?sslmode=require&connection_limit=5` |
| New `DIRECT_URL` | `postgresql://nexa_migrator:<pw>@<rds-endpoint>:5432/nexa?sslmode=require` |
| New `BACKUP_DATABASE_URL` (GitHub) | `postgresql://nexa_backup:<pw>@<rds-endpoint>:5432/nexa?sslmode=require` |
| Current Neon values | Copy `DATABASE_URL` and `DIRECT_URL` from Vercel Production into the password manager as "rollback" |

### 1.4 The region commit

Branch `revamp/a-region-cpt1` with a root `vercel.json` holding `"regions": ["cpt1"]` (keep any existing keys). Open the pull request; do not merge. It is merged in the window, step W7.

### 1.5 Rehearsal (do it twice; time every step)

Uses a Neon **branch** of production, never production itself (research 06 open question 3: the owner approves this read).

1. Neon: create branch `move-rehearsal` from `production` with data. Use its **direct** URL as `SRC_URL`.
2. RDS: `CREATE DATABASE nexa_rehearsal OWNER nexa_migrator;` and set the same default privileges there.
3. Run W4 to W6 below against `SRC_URL` and `nexa_rehearsal`, from a machine with pg_dump 17 (ideally an EC2 or CloudShell session in af-south-1 to match the window; a laptop in South Africa is fine at 35 MB).
4. Point a **Preview** deployment of the `revamp/a-region-cpt1` branch at `nexa_rehearsal` (Preview-scoped env vars on that branch only) and run the smoke test (W8) there. Check `prisma migrate status` reports no pending migrations.
5. Write down the minutes per step. If W4 to W6 together take more than 12 minutes, find out why before booking the window.
6. Drop `nexa_rehearsal` and delete the `move-rehearsal` branch.

### 1.6 Tell people

- Pick the window with the owner: the least-used hour (research 06 question 2). Suggested: a weekday 05:00 to 05:45 SAST, or Sunday evening after 21:00. No test or assignment due within 2 hours either side (check `Test.dueDate` and `Submission.deadline` on the rehearsal branch).
- Email tutors 7 days and 1 day before (owner only while the Resend dev sender is in use), and show an in-app banner from 48 hours before.

## 2. Go or no-go (T-60 minutes)

All must be yes, or postpone:

- [ ] Rehearsal passed within the last 14 days, and the schema has not changed since (no migration merged after it)
- [ ] A fresh encrypted backup has just been taken: `bash scripts/db-backup.sh --overwrite` (writes `db/<today>.dump.age`, replacing a copy from earlier today if there is one)
- [ ] Neon and AWS status pages green
- [ ] No test attempt due or in progress for the next hour (query on a fresh branch, or ask tutors)
- [ ] Rollback values (§1.3) are in the password manager; the region PR is green
- [ ] Owner is present for the whole window

## 3. The window (target 30 minutes)

Run from one terminal with these set (values from the password manager; never pasted into chat or the repo):

```bash
export SRC_URL='<Neon production DIRECT url>'      # host without -pooler
export DST_URL='<DIRECT_URL for nexa_migrator on RDS>'
export DST_ADMIN_URL='<nexa_admin on RDS, database nexa>'
```

`neondb` below is Neon's default database name; use the name in `SRC_URL` if it differs.

Write the cutover start time here: `________ UTC`.

| Step | Time (guess, replace with rehearsal times) | Action | Check before going on |
| --- | --- | --- | --- |
| W1 | 0:00 to 0:02 | Turn on maintenance: set `MAINTENANCE_MODE=1` in Vercel Production and redeploy (or promote the prepared deployment). Pause scheduled jobs: disable `scheduled-jobs.yml` (`gh workflow disable scheduled-jobs.yml`) or pause QStash schedules | Site shows the notice; a write (for example saving a profile) is refused |
| W2 | 0:02 to 0:05 | Wait for in-flight requests. Then freeze Neon at the database level so nothing can write, even a forgotten client: `ALTER DATABASE neondb SET default_transaction_read_only = on;` then end other sessions: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'neondb' AND pid <> pg_backend_pid();` | `SELECT count(*) FROM pg_stat_activity WHERE datname='neondb' AND state='active'` returns 1 (you) |
| W3 | 0:05 to 0:06 | Record source counts (below, "Counts query") into `src-counts.txt` | File has one line per table |
| W4 | 0:06 to 0:08 | Dump: `pg_dump --format=custom --no-owner --no-privileges --dbname="$SRC_URL" --file=nexa-move.dump` | Exit code 0; file size roughly as in rehearsal |
| W5 | 0:08 to 0:11 | Restore: `pg_restore --no-owner --no-privileges --role=nexa_migrator --exit-on-error --dbname="$DST_URL" nexa-move.dump` | Exit code 0 |
| W6 | 0:11 to 0:16 | Verify on RDS: counts query into `dst-counts.txt`, then `diff src-counts.txt dst-counts.txt` (must be empty); `SELECT migration_name FROM _prisma_migrations ORDER BY 1` matches the repo; sequences check (below) returns no rows; `prisma migrate status` with `DIRECT_URL=$DST_URL` says up to date; grants check (below) | All four clean |
| W7 | 0:16 to 0:21 | In Vercel Production set `DATABASE_URL` and `DIRECT_URL` to the RDS values (keep `MAINTENANCE_MODE=1`). Merge the `cpt1` region PR; this deploys production in `cpt1` | Deployment ready; `vercel inspect <url>` shows region `cpt1` |
| W8 | 0:21 to 0:26 | Smoke test on the new deployment (the owner signs in past the maintenance notice, or test against the deployment URL with maintenance off for owner only if the middleware allows): `/api/health` ok; tutor sign-in; student sign-in; open a course and a lesson; start and submit a test; upload a small file; check the new rows on RDS | Every item works; Sentry shows no new errors |
| W9 | 0:26 to 0:30 | Lift maintenance (`MAINTENANCE_MODE` removed, redeploy). Resume jobs (`gh workflow enable scheduled-jobs.yml`, or resume QStash) and run auto-submit once by hand | First real user request succeeds; the job returns ok |

Write the go-live time here: `________ UTC`. This is the **cutover timestamp** for rollback after go-live.

Delete `nexa-move.dump` from the machine when the window closes (it is an unencrypted copy of production).

### Counts query (W3 and W6)

Exact row counts for every table, one line each, sorted, identical text on both sides:

```sql
\pset tuples_only on
\pset format unaligned
SELECT format('SELECT %L || '' '' || count(*) FROM public.%I', table_name, table_name)
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name
\gexec
```

Run as `psql "$SRC_URL" -f counts.sql > src-counts.txt` and the same with `$DST_URL`.

### Sequences check (W6)

`pg_dump` carries `setval` for each sequence; this confirms no sequence is behind its table. Prisma's `autoincrement()` columns are the only users; with `cuid()` IDs there may be none.

```sql
SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
FROM pg_class s
JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
JOIN pg_class t ON t.oid = d.refobjid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
WHERE s.relkind = 'S';
```

For each row, `SELECT last_value FROM <seq>` must be at least `SELECT max(<col>) FROM <tbl>`.

### Grants check (W6)

```sql
SELECT count(*) FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND NOT has_table_privilege('nexa_app', format('public.%I', t.table_name), 'INSERT');
```

Must be 0. If not, the default privileges were set after the restore; fix with `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexa_app; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO nexa_app;` as `nexa_migrator`.

## 4. Rollback

Functions and database always move together: never run `cpt1` functions against Neon us-east-1 or `iad1` functions against RDS (research 06 §6 "Rollback").

| When it fails | Do this | Data loss |
| --- | --- | --- |
| W1 to W6 (before env vars change) | Stop. On Neon: `ALTER DATABASE neondb SET default_transaction_read_only = off;` Lift maintenance, resume jobs. Drop and recreate the `nexa` database on RDS before the next try | None: RDS never served traffic |
| W7 to W8 (new deployment fails the smoke test) | Put the rollback `DATABASE_URL` and `DIRECT_URL` back in Vercel Production, revert the region commit on `main` (or promote the last `iad1` production deployment with "Instant Rollback"), then unfreeze Neon as above, lift maintenance, resume jobs | None, as long as maintenance was on: the only writes to RDS were smoke-test rows |
| After W9 (a problem found later) | Prefer fixing forward on RDS. If a rollback is unavoidable: open a second window; maintenance on; dump the rows written on RDS since the cutover timestamp (tables with `createdAt`/`updatedAt` later than it) and load them into Neon after unfreezing it; then switch env vars and region back as in the row above | None if the copy-back is complete; check with the counts query |

Decision rule in the window: if any check in W6 or W8 fails and the cause is not obvious within **5 minutes**, roll back and rebook. A clean rollback costs one email; a half-working cutover costs data.

## 5. After the window

Same day:

- [ ] Monitor Sentry and `/api/health` for two hours
- [ ] CloudWatch alarms to an SNS email topic: CPU > 70%, free storage < 5 GB, CPU credit balance low, connections > 60 (design 06 §9)
- [ ] AWS Budgets alert at $30 a month
- [ ] Manual RDS snapshot `nexa-prod-after-move`
- [ ] GitHub environment `production`: change `BACKUP_DATABASE_URL` to the RDS `nexa_backup` URL; run the backup workflow once (dry run, then real)
- [ ] Email users that the window is over

Within a week:

- [ ] First restore drill on RDS: point-in-time restore to `nexa-restore-drill`, check counts, delete it; log it in `restore-log.md`
- [ ] Update [research/09-compliance.md](../research/09-compliance.md): AWS af-south-1 holds production data; Neon holds none after §5's last step
- [ ] HANDOFF entry with timings, so the next move is better estimated

After 14 quiet days, with the owner's approval:

- [ ] Neon production: take one last encrypted dump to Tigris (it then expires with the 30-day rule), then delete the Neon `production` branch's data or the project. Neon stays for `preview`, `dev` and `staging` branches with fake data (design 06 §2)

## 6. Open items

1. The maintenance flag (`MAINTENANCE_MODE` in middleware) does not exist yet. It is A's work, due before the rehearsal. Without it, W2's database freeze alone makes the app fail on writes with errors instead of a notice.
2. Window day and hour: owner to choose (research 06 question 2).
3. Multi-AZ from day one or later (research 06 question 5): this runbook assumes Single-AZ.
4. Whether RDS Proxy is needed: watch the `DatabaseConnections` metric for the first two weeks (research 06 §4).
