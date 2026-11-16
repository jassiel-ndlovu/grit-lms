# Backup runbook: weekly encrypted database dump

**What it is.** Once a week, `scripts/db-backup.sh` takes a `pg_dump -Fc` of the production database from its **direct** (non-pooled) URL in a read-only session, pipes it straight into `age` encrypted to the owner's public key, and uploads the result to the private Tigris bucket `nexa-lms-backups` (Johannesburg, `jnb`) as `db/YYYY-MM-DD.dump.age`, with a `.sha256` file beside it. A bucket lifecycle rule deletes objects under `db/` after **30 days**, so about four weekly copies exist at any time. The plaintext dump never touches disk.

This is the extra copy from [design/06-deployment.md §6](../design/06-deployment.md). Neon's 6-hour restore window stays the first line of recovery; this is for anything older, or for Neon itself failing. Owner decisions (16 November 2026): weekly, daily later if demand grows; data is deleted two months after a workspace's last payment (§6.1 there).

**Every run reads production. The first run of each kind (by hand, then the workflow) needs the owner's go-ahead** ([AGENTS.md §4](../../AGENTS.md)).

## 1. One-time setup (owner)

### 1.1 The age key pair

On the owner's own machine, never on a server:

```bash
age-keygen -o nexa-backup.key
```

- The command prints the **public key** (`age1…`). That goes to GitHub as `vars.AGE_RECIPIENT` and into your local shell for manual runs. It is not a secret.
- `nexa-backup.key` holds the **private key** (`AGE-SECRET-KEY-1…`). Store it in your password manager and keep one offline copy (USB stick in a drawer). Delete the file from the laptop afterwards. **If this key is lost, every backup is useless. If it leaks, every backup in the bucket is readable.**
- To add a second holder later (for example a co-founder), put both public keys, one per line, in a file and use `AGE_RECIPIENTS_FILE` instead of `AGE_RECIPIENT`. Either private key can then decrypt.

Install `age`: Windows `winget install FiloSottile.age`, macOS `brew install age`, Ubuntu `sudo apt install age`.

### 1.2 Tigris access key and the 30-day expiry

1. In the Tigris console, create an access key with **Editor** access to `nexa-lms-backups` only (no other buckets, no admin). Name it `nexa-db-backup`.
2. Confirm the bucket is private: `tigris buckets get nexa-lms-backups` should show private access.
3. Add the 30-day expiry rule (one time, a bucket write):

   ```bash
   tigris buckets lifecycle create nexa-lms-backups --prefix db/ --expire-days 30
   ```

   Check it with `tigris buckets lifecycle list nexa-lms-backups`.

Optional: `tigris buckets set nexa-lms-backups --soft-delete true --retention-days 7` keeps deleted objects recoverable for a week, so a stolen key cannot wipe the backups at once. It costs storage for a week of extra copies (a few MB).

### 1.3 A read-only database role (recommended)

The backup only needs to read. On Neon `production`, in the SQL editor (a write to the production database: owner only):

```sql
CREATE ROLE nexa_backup LOGIN PASSWORD '<long random>';
GRANT pg_read_all_data TO nexa_backup;
```

If Neon refuses the `pg_read_all_data` grant (**Unverified** on Neon), use `GRANT USAGE ON SCHEMA public TO nexa_backup; GRANT SELECT ON ALL TABLES IN SCHEMA public TO nexa_backup; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO nexa_backup;` and repeat the two `ALL TABLES/SEQUENCES` grants after each migration that adds a table.

Use the **direct** connection string for this role (the host without `-pooler`). The script refuses a pooled host. Without this role, use the owner role's direct URL; the script still opens the session with `default_transaction_read_only=on`.

### 1.4 Tools for manual runs

`pg_dump` **17 or newer** (Windows: the PostgreSQL 17 installer with "Command Line Tools" only; macOS `brew install libpq`), `age`, the Tigris CLI (`npm i -g @tigrisdata/cli`), and Git Bash on Windows to run the script.

## 2. Running it by hand

From the repo root, in Git Bash. Put the values in your shell, not in a file inside the repo:

```bash
export BACKUP_DATABASE_URL='<direct URL>'
export AGE_RECIPIENT='age1...'
export TIGRIS_STORAGE_ACCESS_KEY_ID='<key id>'
export TIGRIS_STORAGE_SECRET_ACCESS_KEY='<secret>'
```

Dry run first. It checks that each variable is set (it never prints values), that the tools are installed, that the URL is not pooled, and that the key is a public key. It contacts nothing. It exits 3 if anything is missing.

```bash
bash scripts/db-backup.sh --dry-run
```

Then the real run (owner approval):

```bash
bash scripts/db-backup.sh
```

It refuses to overwrite an object that already exists for today; use `--date` or `--overwrite`. At about 35 MB of data the whole run takes under a minute.

Check the result:

```bash
tigris ls t3://nexa-lms-backups/db/
```

## 3. The GitHub workflow

`.github/workflows/db-backup.yml` runs the same script on `ubuntu-24.04`. It has **only a manual trigger** (`workflow_dispatch`) and defaults to a dry run. No schedule is set.

### 3.1 Secrets the owner adds

Settings, Environments, create `production`, add yourself as a required reviewer (so every run waits for your click), then:

| Name | Kind | Value |
| --- | --- | --- |
| `BACKUP_DATABASE_URL` | Environment secret | Direct URL of `nexa_backup` (§1.3) |
| `TIGRIS_STORAGE_ACCESS_KEY_ID` | Environment secret | Key id from §1.2 |
| `TIGRIS_STORAGE_SECRET_ACCESS_KEY` | Environment secret | Secret from §1.2 |
| `AGE_RECIPIENT` | Environment **variable** | The `age1…` public key |

The same `production` environment is planned for `db-migrate.yml` (design 06 §3.4), so set it up once.

### 3.2 Running it

Actions, "Database backup", Run workflow. Leave "Dry run" ticked the first time; it should end with `Problems found: 0`. Then run again with it unticked.

### 3.3 Turning on the weekly schedule (later, owner decision)

After one manual run and one successful restore drill (§5), add to the `on:` block:

```yaml
  schedule:
    - cron: "0 1 * * 0"   # Sundays 01:00 UTC (03:00 SAST), a quiet hour
```

A scheduled run cannot pass the `dry_run` input, so the script runs for real. GitHub pauses schedules on a public repo after 60 days without commits; the 30-day expiry would then leave no copy within a month, so check the bucket monthly. For daily backups later, change the cron to `0 1 * * *`; the 30-day rule then keeps about 30 copies (about 30 × 10 MB, a few cents a month).

## 4. Restore

Restore **into a new, empty database**, never over production. Production is only replaced in a disaster, with the owner deciding.

1. Make a target: a new Neon branch with no data (or a scratch local Postgres 17). Get its direct URL as `RESTORE_URL`.
2. Download and check:

   ```bash
   mkdir -p ~/nexa-restore && cd ~/nexa-restore
   tigris cp t3://nexa-lms-backups/db/2026-11-22.dump.age .
   tigris cp t3://nexa-lms-backups/db/2026-11-22.dump.age.sha256 .
   sha256sum -c 2026-11-22.dump.age.sha256
   ```

3. Decrypt and restore in one pipe, so plaintext stays off disk (`pg_restore` reads a custom-format dump from stdin):

   ```bash
   age -d -i /path/to/nexa-backup.key 2026-11-22.dump.age \
     | pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_URL"
   ```

   To see what is inside without restoring: `age -d -i key 2026-11-22.dump.age | pg_restore --list | head`.

4. Check: row counts per table and the newest `createdAt` against expectations (`scripts/check-restore.ts`, planned in design 06 §6, or by hand with `SELECT count(*)` on the main tables). `SELECT migration_name FROM _prisma_migrations` should match the repo once the migrate baseline exists.
5. **Re-apply retention before the copy is used for anything real.** A backup may hold workspaces that were deleted after it was taken. Run the retention job in dry-run mode against the restored database, and delete what it lists, before pointing any app at it (design 06 §6.1).
6. Delete the downloaded `.dump.age` and the restore branch when finished, and write the drill in `docs/revamp/a/ops/restore-log.md` (date, which backup, minutes taken).

Disaster case (production is gone): restore into a new Neon branch or the RDS instance as above, check it, then point `DATABASE_URL` and `DIRECT_URL` at it in Vercel Production and redeploy. Data written after the backup date is lost unless Neon's own restore window still covers it, so try Neon's point-in-time restore first.

## 5. Restore drill

Before turning on the schedule, and then every three months: restore the newest backup into a throwaway branch (§4), check counts, delete the branch, log it. A backup that has never been restored is a guess.

## 6. After the move to RDS (January 2027)

RDS keeps 14 days of point-in-time recovery by itself. The weekly dump continues, now pointed at the RDS read-only role (`BACKUP_DATABASE_URL` changes; nothing else does), and drops to monthly once the owner decides PITR is enough (design 06 §6). Move the bucket to S3 af-south-1 only as part of the wider AWS move.

## 7. What never happens

- Unencrypted dumps in the bucket, a GitHub artifact, a log, the repo, chat or email.
- The private key on any server, in GitHub, or in Vercel.
- Backups edited to remove deleted workspaces. They age out after 30 days instead; restores re-run retention (§4.5).
