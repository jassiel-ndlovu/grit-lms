# Database closer to South Africa

**Answer first.** Move production to **AWS RDS for PostgreSQL 17 in af-south-1 (Cape Town)**, Single-AZ `db.t4g.micro` with 20 GB gp3 storage, for about **$22 a month (R374)** including a public IPv4 address. Vercel's `cpt1` region *is* AWS af-south-1, so the functions and the database sit in the same AWS region; Azure (Johannesburg) would be a cross-cloud hop of about 20 ms per query. Keep **staging and dev on Neon** (free branches; latency does not matter there) and seed them with fake data, so no production rows leave South Africa. The move is a `pg_dump`/`pg_restore` of ~35 MB in a maintenance window of **about 30 minutes**, with Neon kept read-only as the rollback. Nothing in this plan may run against the Neon database until the owner says yes: it is the live production database.

Currency: amounts show ZAR first where useful, converted at **R17.00/USD** (Wise mid-market 16.95 on 2026-11-16, rounded). Hourly prices are multiplied by 730 hours for a month. All prices exclude VAT.

## 1. Today's setup

| Item | Value | Source |
|---|---|---|
| Neon project | `grit-lms-sb` (another project, `nexa-db`, is also in us-east-1) | Neon CLI `projects list`, read-only (checked 2026-11-16) |
| Region | `aws-us-east-1` (N. Virginia) | same |
| Postgres version | 17 | same |
| Restore window (history retention) | 21,600 s = **6 hours** | same |
| Logical size | ~35 MB | brief |
| Function region | `iad1` (all functions) | Vercel CLI `inspect` of latest production deployment (checked 2026-11-16) |
| ORM | Prisma 5.22, `prisma-client-js`, one `DATABASE_URL`, no `directUrl` | `package.json`, `prisma/schema.prisma` |

**Neon has no African region.** Its AWS regions are us-east-1, us-east-2, us-west-2, eu-central-1, eu-west-2, ap-southeast-1, ap-southeast-2 and sa-east-1; Azure regions are deprecated for new projects ([Neon regions](https://neon.com/docs/introduction/regions), checked 2026-11-16).

### Latency, today and after the move

| Path | Round trip (ms, p50) | Source |
|---|---|---|
| AWS af-south-1 to us-east-1 | 226 | [CloudPing API, 1-year p50](https://www.cloudping.co/api/latencies?percentile=p_50&timeframe=1Y) (checked 2026-11-16) |
| AWS af-south-1 to eu-west-2 (London) | 148 | same |
| Azure South Africa West (Cape Town) to East US | 203 | [Azure latency stats](https://learn.microsoft.com/en-us/azure/networking/azure-network-latency) (checked 2026-11-16) |
| Azure South Africa North (Johannesburg) to South Africa West (Cape Town) | 20 | same |
| Vercel `cpt1` to RDS af-south-1 (same AWS region) | ~1 | **Guess** |
| Vercel `cpt1` to Azure South Africa North | ~20-25 | **Guess** (Cape Town to Johannesburg, using Azure's 20 ms as a floor) |

Today the function (iad1) and Neon (us-east-1) are in the same region, so queries are fast. The cost is the user's trip: every dynamic request from South Africa pays at least one ~226 ms round trip to Virginia. Moving only the functions to `cpt1` would make it worse: a page with 5 sequential queries would add ~1.1 s. Move both, together.

There is also a legal reason: [09-compliance.md](09-compliance.md) flags that storing children's data in the US may need prior authorisation under POPIA section 57.

## 2. Options with an African region

| Provider | African region | Fits? | Source |
|---|---|---|---|
| AWS RDS for PostgreSQL | af-south-1 Cape Town; PG 17.7-17.11 offered; `db.t4g.micro` to `2xlarge` orderable | Yes | AWS CLI `describe-db-engine-versions`, `describe-orderable-db-instance-options` (checked 2026-11-16) |
| AWS Aurora PostgreSQL (incl. Serverless v2) | af-south-1; PG 17.4-17.11; `db.serverless` orderable | Yes, but dearer | same |
| Azure Database for PostgreSQL Flexible Server | South Africa North (Johannesburg); PG 11-18; Burstable B1ms/B2s/B2ms | Yes | `az postgres flexible-server list-skus` (checked 2026-11-16) |
| Google Cloud SQL for PostgreSQL | `africa-south1` Johannesburg | Yes; price **Unverified** (pricing page did not render) | [Cloud SQL locations](https://docs.cloud.google.com/sql/docs/postgres/locations) (checked 2026-11-16) |
| Aiven for PostgreSQL | `aws-af-south-1`, `azure-south-africa-north`, `google-africa-south1` | Possible; Hobbyist from $12/month, but Free and Developer plans cannot choose a region; regional price **Unverified** | [Aiven clouds](https://aiven.io/docs/platform/reference/list_of_clouds), [Aiven pricing](https://aiven.io/pricing?product=pg) (checked 2026-11-16) |
| Neon | None | No | [Neon regions](https://neon.com/docs/introduction/regions) (checked 2026-11-16) |
| Supabase | None | No | [Supabase regions](https://supabase.com/docs/guides/platform/regions) (checked 2026-11-16) |
| DigitalOcean Managed PostgreSQL | None (no African datacenter) | No | [DO regional availability](https://docs.digitalocean.com/platform/regional-availability/) (checked 2026-11-16) |
| Crunchy Bridge | None listed | No | [Crunchy Bridge plans](https://docs.crunchybridge.com/concepts/plans-pricing) (checked 2026-11-16) |
| Fly.io Managed Postgres | Not in `jnb` | No | [Fly regions](https://docs.fly.io/reference/regions) (checked 2026-11-16) |

## 3. Prices (smallest sensible setups)

All AWS prices are from the AWS Price List API (`aws pricing get-products`, region af-south-1, checked 2026-11-16). Azure prices are from the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (southafricanorth, checked 2026-11-16).

### Compute

| Instance | $/hour | $/month | ZAR/month |
|---|---|---|---|
| RDS PG `db.t4g.micro` Single-AZ (2 vCPU burstable, 1 GiB) | 0.021 | 15.33 | R261 |
| RDS PG `db.t4g.micro` Multi-AZ | 0.041 | 29.93 | R509 |
| RDS PG `db.t4g.small` Single-AZ (2 GiB) | 0.041 | 29.93 | R509 |
| RDS PG `db.t4g.medium` Single-AZ (4 GiB) | 0.082 | 59.86 | R1,018 |
| Aurora PG `db.t4g.medium` (Standard storage) | 0.094 | 68.62 | R1,167 |
| Aurora PG Serverless v2 (per ACU-hour) | 0.16 | 58.40 at 0.5 ACU all month | R993 |
| Aurora PG Serverless v2 I/O-Optimized (per ACU-hour) | 0.21 | 76.65 at 0.5 ACU | R1,303 |
| Azure Flexible Server Burstable B1ms | 0.0215 | 15.70 | R267 |
| Azure Flexible Server Burstable B2s | 0.086 | 62.78 | R1,067 |
| Azure Flexible Server General Purpose D2ds_v5 (2 vCore) | 0.235 | 171.55 | R2,916 |

vCPU and memory for `t4g` classes are from AWS's instance class table: **Unverified** in this session (from memory).

### Storage, backup, extras

| Item | Price | Notes |
|---|---|---|
| RDS gp3 storage, Single-AZ | $0.151/GB-month | 20 GB minimum: 20 GB = $3.02 (R51). Range 20 GiB-64 TiB per [RDS PG pricing](https://aws.amazon.com/rds/postgresql/pricing/) (checked 2026-11-16) |
| RDS gp3 storage, Multi-AZ | $0.302/GB-month | 20 GB = $6.04 |
| RDS backup storage beyond the free allocation | $0.113/GB-month | Free allocation equal to provisioned storage: **Unverified** (AWS pages fetched did not state it) |
| RDS CPU credits (if a `t4g` runs above baseline in unlimited mode) | $0.075 per vCPU-hour | Price List API |
| Aurora storage (Standard) | $0.131/GB-month, plus $0.26 per 1M I/O | Price List API |
| Aurora backup beyond free | $0.025/GB-month | Price List API |
| RDS Proxy | $0.02 per vCPU-hour of the DB | For a 2-vCPU `t4g.micro`: $29.20/month (R496), more than the DB. Billing rules: [RDS Proxy pricing](https://aws.amazon.com/rds/proxy/pricing/) (checked 2026-11-16) |
| Public IPv4 address (needed if Vercel connects over the internet) | $0.005/hour = $3.65/month | AmazonVPC Price List API |
| Azure Flexible Server storage | $0.151/GB-month | Minimum size 32 GiB: **Unverified**; 32 GB = $4.83 |
| Azure backup beyond free | $0.113/GB-month (LRS) | Free up to 100% of provisioned storage ([Azure backup docs](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore), checked 2026-11-16) |

### Monthly totals

| Setup | $/month | ZAR/month |
|---|---|---|
| **RDS `t4g.micro` Single-AZ + 20 GB gp3 + public IPv4** | **22.00** | **R374** |
| RDS `t4g.small` Single-AZ + 20 GB + IPv4 | 36.60 | R622 |
| RDS `t4g.micro` Multi-AZ + 20 GB + IPv4 | 39.62 | R674 |
| Azure B1ms + 32 GB (no built-in PgBouncer on Burstable) | 20.53 | R349 |
| Azure B2s + 32 GB | 67.61 | R1,149 |
| Aurora Serverless v2, 0.5 ACU floor, ~1 GB | ~59 | ~R1,003 |
| Neon today | Free plan (**Guess** from the 6-hour retention) | R0 |

Aurora Serverless v2 can scale to 0 ACUs, but only after at least 300 s with no connections, and resume takes about 15 s ([Aurora auto-pause](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html), checked 2026-11-16). The 5-minute auto-submit job and normal traffic keep it awake, and an RDS Proxy also blocks pausing (same source). So the 0.5 ACU floor is the real price.

## 4. Feature comparison

| | RDS PostgreSQL | Aurora PostgreSQL | Azure Flexible Server | Neon (today) |
|---|---|---|---|---|
| Point-in-time restore window | 0-35 days (console default 7, CLI/API default 1) ([RDS retention](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html)) | **Unverified** in this session (same 1-35 day model expected) | 7 (default) to 35 days; RPO up to 5 min ([Azure backup](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)) | 6 hours on the current plan (CLI) |
| PITR target | New instance | New cluster | Always a new server | Branch |
| Staging and dev copies | Restore a snapshot or PITR to a new instance (full instance price while it runs) | Copy-on-write clones, up to 15 per source, same region only ([Aurora cloning](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Managing.Clone.html)) | PITR to a new server, listed by Microsoft as a way to "clone your server for test" | Free instant branches |
| Built-in pooling | None; RDS Proxy is extra ($29/month on a micro) | RDS Proxy | Built-in PgBouncer 1.26.1 on port 6432, **but not on Burstable** ([Azure PgBouncer](https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer)) | Built-in pooler |
| Same region as Vercel `cpt1` | Yes (af-south-1) | Yes | No (Johannesburg, other cloud) | No |
| Prisma | Works (plain Postgres) | Works (Postgres-compatible) | Works (plain Postgres) | Works today |

All rows: checked 2026-11-16.

### Prisma 5 and Prisma 6

- The live app runs Prisma 5.22 against Neon Postgres 17 today, which shows Prisma 5 works with PG 17 in practice. Prisma's current docs only cover ORM 7/8, so an official PG 17 statement for 5 or 6 could not be found (**Unverified**). [Supported versions](https://www.prisma.io/docs/orm/supported-versions) (checked 2026-11-16) gives PG 15 as the floor for ORM 8.
- The plan targets Prisma 6 with a multi-file schema. Multi-file schema (`prismaSchemaFolder`) became generally available in **Prisma 6.7.0** ([release notes](https://github.com/prisma/prisma/releases/tag/6.7.0), checked 2026-11-16). So the target needs 6.7 or later.
- With a transaction-mode pooler (PgBouncer), Prisma needs `max_prepared_statements` above 0 on PgBouncer 1.21+, and migrations must use a direct (non-pooled) connection ([Prisma PgBouncer docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer), checked 2026-11-16). On RDS without a proxy, use one direct URL.

### Connections from serverless functions

- Vercel Fluid compute reuses an instance for many requests, so one Prisma pool serves many requests ([Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing), checked 2026-11-16).
- Set a small pool per instance, for example `connection_limit=5` in `DATABASE_URL`. **Guess:** a `t4g.micro` allows roughly 80-110 connections by default; enough for launch.
- Add RDS Proxy (or move to `t4g.small`) when the `DatabaseConnections` metric passes about 60% of `max_connections`.

### Network security

Vercel has no fixed outbound IPs without the Static IPs add-on ($100/month per project, [Pro plan](https://vercel.com/docs/plans/pro-plan), checked 2026-11-16). So the RDS instance must be publicly reachable with its security group open on 5432. Mitigations: `rds.force_ssl=1`, a long random password stored only in Vercel env vars, a separate low-privilege app role (no superuser), and no default `postgres` login from the app. **Guess:** acceptable for launch; revisit Static IPs when revenue covers R1,700/month.

## 5. Recommendation

| Environment | Where | Why |
|---|---|---|
| Production | RDS PostgreSQL 17, af-south-1, `db.t4g.micro` Single-AZ, 20 GB gp3, 14-day PITR, deletion protection on | Same AWS region as Vercel `cpt1`; cheapest; data stays in South Africa |
| Staging | Neon branch (free), seeded with fake data | Free and instant; no production data copied out |
| Dev / preview | Neon branches per developer or per PR | Same |
| Upgrade path | `t4g.small` when CPU credits run low; Multi-AZ when an hour of downtime would cost a customer | +R248 and +R300 a month respectively |

Why not Azure: B1ms is R25 a month cheaper but lives in Johannesburg on another cloud (~20 ms per query from `cpt1`) and has no PgBouncer on Burstable. Why not Aurora: about 2.7x the price for features a 35 MB database does not need yet.

## 6. Migration plan: Neon us-east-1 to RDS af-south-1

**The Neon database is shared with production. Nothing below runs against it without the owner's written go-ahead, including the read-only dump.**

Method: `pg_dump` and `pg_restore`. At ~35 MB the dump and restore take seconds to a few minutes. Logical replication would cut downtime to near zero, but it requires turning on logical replication in Neon (a project setting that restarts compute; **Unverified** in this session) and adds work that a 35 MB database does not justify.

### Before the window (no downtime)

1. Owner approves: the AWS spend (~R374/month), the window time, and the dump.
2. Create the RDS instance (owner creates it, or approves an agent doing so): PG 17 (the newest 17.x offered), `db.t4g.micro`, gp3 20 GB, encryption on, backup retention 14 days, deletion protection on, `rds.force_ssl=1`, public access with a security group on 5432.
3. Create an app role and database on RDS. Grant only what the app needs.
4. Rehearse on a copy: restore a Neon **branch** (not the main branch) dump into RDS. Run `prisma migrate status` and the test suite against it from a Vercel preview deployment pinned to `cpt1`. Time each step.
5. Pre-set Vercel env vars for Production: `DATABASE_URL_NEXT` with the RDS URL (`sslmode=require&connection_limit=5`). Prepare a commit that adds `"regions": ["cpt1"]` to the root `vercel.json`.
6. Tell users about the window (email via Resend, banner in the app).

### The window (target 30 minutes, low-traffic hour)

| Step | Action | Time (**Guess**) |
|---|---|---|
| 1 | Turn on maintenance mode (a flag that makes the app read-only or shows a notice). Pause the crons/queue. | 2 min |
| 2 | Wait for in-flight requests and test attempts to finish. | 3 min |
| 3 | `pg_dump -Fc --no-owner --no-privileges` from Neon's **direct** (non-pooled) endpoint, using a pg_dump 17 client. | 1 min |
| 4 | `pg_restore --no-owner --role=<app role> -d <rds>` | 2 min |
| 5 | Verify: row counts per table match; `_prisma_migrations` rows match; sequences are set; spot-check a few records. | 5 min |
| 6 | Swap `DATABASE_URL` to the RDS value; deploy the `cpt1` region commit. | 5 min |
| 7 | Smoke test: log in as a test tutor and a test student, open a course, start and submit a test, upload a file. | 5 min |
| 8 | Turn off maintenance mode; resume crons/queue. | 2 min |

**Expected downtime: about 25-30 minutes of read-only or maintenance mode.** Most of it is verification, not data transfer.

### Rollback

- Keep Neon untouched and read-only for 14 days after cutover. Do not delete the project.
- If anything fails before step 8: set `DATABASE_URL` back to Neon, revert the region commit (functions back to `iad1`), redeploy. No data loss, because nothing was written to RDS yet.
- If a problem appears after go-live: writes since cutover exist only on RDS. Either fix forward, or take a second short window, dump the changed tables from RDS and load them into Neon before switching back. Keep a note of the cutover timestamp to find those rows.
- Rollback must move functions and database together, for the same latency reason as the move.

### After

- Set CloudWatch alarms: CPU > 70%, free storage < 5 GB, CPU credit balance low, connections > 60.
- Take a manual snapshot before the first schema migration on RDS.
- After 14 quiet days, and with the owner's approval, downgrade or delete the Neon production branch. Keep Neon for staging.
- Update [09-compliance.md](09-compliance.md) operator list: AWS (af-south-1) holds production data.

## Against the plan

1. **Separate prod and staging "in or near Cape Town".** This file keeps staging on Neon (US) with fake data instead of a second Cape Town database. A second RDS instance doubles the cost (+R374/month) for no user benefit. If the owner wants staging to use real data, it must be in South Africa, and then a second RDS instance (or an Aurora clone) is the price.
2. **Neon Launch tier in the launch budget.** Not needed once production is on RDS; Neon free covers staging branches.
3. **Prisma 6 target.** Fine, but it must be 6.7 or later for the multi-file schema. Prisma's docs now describe ORM 7 and 8; the team should decide whether to jump straight to a newer major (outside this file's scope).

## Open questions for the owner

1. Do you approve RDS in af-south-1 at about R374 a month, created under your AWS account?
2. Do you accept a 30-minute maintenance window? Which day and hour has the least use?
3. May an agent take a read-only dump of a Neon **branch** to rehearse, and later of production during the window?
4. Is staging on Neon with fake data acceptable, or does staging need real data (and so a second South African database)?
5. Do you want Multi-AZ (+R300/month) from day one, or Single-AZ until paying customers depend on uptime?

## Sources

- https://neon.com/docs/introduction/regions (checked 2026-11-16)
- Neon CLI read-only: `neon projects list` (checked 2026-11-16)
- https://www.cloudping.co/api/latencies?percentile=p_50&timeframe=1Y (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/networking/azure-network-latency (checked 2026-11-16)
- AWS Price List API (`aws pricing get-products`, AmazonRDS and AmazonVPC, af-south-1) (checked 2026-11-16)
- AWS CLI read-only: `rds describe-db-engine-versions`, `rds describe-orderable-db-instance-options`, region af-south-1 (checked 2026-11-16)
- https://aws.amazon.com/rds/postgresql/pricing/ (checked 2026-11-16)
- https://aws.amazon.com/rds/proxy/pricing/ (checked 2026-11-16)
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html (checked 2026-11-16)
- https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html (checked 2026-11-16)
- https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Managing.Clone.html (checked 2026-11-16)
- https://prices.azure.com/api/retail/prices (Azure Database for PostgreSQL, southafricanorth) (checked 2026-11-16)
- Azure CLI read-only: `az postgres flexible-server list-skus --location southafricanorth` (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer (checked 2026-11-16)
- https://docs.cloud.google.com/sql/docs/postgres/locations (checked 2026-11-16)
- https://aiven.io/docs/platform/reference/list_of_clouds (checked 2026-11-16)
- https://aiven.io/pricing?product=pg (checked 2026-11-16)
- https://supabase.com/docs/guides/platform/regions (checked 2026-11-16)
- https://docs.digitalocean.com/platform/regional-availability/ (checked 2026-11-16)
- https://docs.crunchybridge.com/concepts/plans-pricing (checked 2026-11-16)
- https://docs.fly.io/reference/regions (checked 2026-11-16)
- https://www.prisma.io/docs/orm/supported-versions (checked 2026-11-16)
- https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer (checked 2026-11-16)
- https://github.com/prisma/prisma/releases/tag/6.7.0 (checked 2026-11-16)
- https://vercel.com/docs/functions/usage-and-pricing (checked 2026-11-16)
- https://vercel.com/docs/plans/pro-plan (checked 2026-11-16)
