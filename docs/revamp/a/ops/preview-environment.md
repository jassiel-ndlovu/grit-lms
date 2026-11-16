# Preview environment: fake-data database

**Answer first.** As of 2026-11-16, Vercel Preview deployments use the Neon branch `preview`, which holds fake data only. Production's `DATABASE_URL` did not change. Preview **still uses production's Blob token**. The fix is a separate store `nexa-preview-blob`, which needs the owner's go-ahead (section 4).

Phase 0 item from [design/06-deployment.md](../design/06-deployment.md) §3.1 to §3.3 and §7. Checked 2026-11-16.

## 1. What was set up

| Thing | Value | Notes |
| --- | --- | --- |
| Neon project | `grit-lms-sb` (`wandering-leaf-52822886`), aws-us-east-1, PG 17 | Unchanged |
| Production branch | `production`, endpoint `ep-aged-scene-a4fhpg0t` | Not written to. Size before and after: 35,201,024 bytes |
| Preview branch | `preview` (`br-hidden-poetry-a4aut3d9`), endpoint `ep-wandering-sea-a4bvyaiw` | Created from `production` with `--schema-only`. Neon reports `init_source: parent-schema`, so no production rows were copied. The project's current Neon plan allowed it |
| Preview role | `nexa_preview`, created on the `preview` branch only | Owns every table on the branch. See "Why a separate role" |
| Schema | `prisma db push` from today's `prisma/schema.prisma` (Prisma 5), run as `nexa_preview` against the preview endpoint | |
| Seed | `scripts/seed-fake.ts` | 9 users (1 tutor, 8 students), 2 courses, 6 lessons, 2 tests, 8 test submissions, 4 assignment entries |
| Vercel `DATABASE_URL` | Preview: `nexa_preview` on the **pooled** preview host, Secret, all branches. Production: the old record, unchanged (created 199 days ago) | It used to be one record covering Preview and Production. The Preview target was removed from it with `vercel env remove DATABASE_URL --environment preview`, then a new Preview-only record was added |

### Why a separate role

A schema-only child branch inherits the parent's roles **and their passwords**. On 2026-11-16, `neondb_owner` on `preview` had the same password as on `production` (compared by hash; the value was never printed). If Vercel Preview used `neondb_owner`, a leaked preview URL would also open production. So the app's Preview URL uses `nexa_preview`, a role that exists only on the `preview` branch.

To give that role the tables, the empty `public` schema on `preview` was dropped and recreated by `neondb_owner` on the preview endpoint, after a check that it held no `User` rows. `nexa_preview` was granted the schema and then created the tables with `db push`.

`neondb_owner` on the preview branch still has production's password. That only matters to someone who already has that password. Resetting it on the branch (`neon roles reset-password neondb_owner --branch preview`) is safe in principle, since roles are per branch, but it was not done. A mistake there would take production down, so it should be a deliberate owner step.

### Who can sign in on a preview

Every seeded account uses one password, from `SEED_USER_PASSWORD`. It is never in the repo. For this first seed it is kept outside the repo on the agent's machine; the owner should move it into a password manager, or reseed with a new password.

| Role | Email |
| --- | --- |
| Tutor | `test.tutor@example.test` |
| Students | `test.student1@example.test` to `test.student8@example.test` |

All accounts are marked email-verified. Mail to `@example.test` can never be delivered (RFC 2606), and the Resend dev sender only reaches the owner anyway.

## 2. How to reseed

From a checkout with dependencies installed:

```bash
# 1. Get the preview URL for the preview role (prints a secret: run it yourself, don't paste the output anywhere)
neon cs preview --project-id wandering-leaf-52822886 --role-name nexa_preview --database-name neondb
```

```bash
# 2. Wipe the fake rows and seed again
DATABASE_URL="<url from step 1>" SEED_USER_PASSWORD="<choose one>" npx tsx scripts/seed-fake.ts --reset
```

The script refuses to run when:

- `VERCEL_ENV` is `production`;
- the host is production's endpoint (`ep-aged-scene-a4fhpg0t`), even with `SEED_FAKE_ALLOW=1`;
- the host is not the preview endpoint and `SEED_FAKE_ALLOW=1` is not set (use the flag for a local Postgres or a future `dev` branch);
- the database has any user whose email does not end in `@example.test`;
- fake users already exist and `--reset` was not given.

`npx tsx scripts/check-seed-fake-guard.ts` checks the host guard without touching a database.

**After a schema change** that lands on `main`, push it to the preview branch the same way: `DATABASE_URL=<direct, non-pooled nexa_preview URL> npx prisma db push`. Check that the host printed on the "Datasource" line is `ep-wandering-sea-a4bvyaiw` before you confirm. Once design 06 §3.4 moves us to `prisma migrate`, a `vercel-build` step will do this automatically for previews.

**If the branch gets into a bad state**, delete it and repeat section 1. Never recreate it without `--schema-only`.

## 3. Things noticed, not changed

- Since a few hours before this session (2026-11-16), the project also has `VERCEL_BLOB_READ_WRITE_TOKEN`, `VERCEL_BLOB_STORE_ID` and `VERCEL_BLOB_WEBHOOK_PUBLIC_KEY` (Config type) on **Development, Preview and Production**. They were added when `grit-lms-blob` was connected to the project. The app code does not read them by name; `@vercel/blob` reads `BLOB_READ_WRITE_TOKEN`. Whether the SDK version we use also falls back to `VERCEL_BLOB_READ_WRITE_TOKEN` is **Unverified**. Either way, Preview and Development can reach the production store today.
- `package-lock.json` is out of sync with `package.json` (`picomatch`), so `npm ci` fails. This session used `npm install --no-save --package-lock=false`. The Prisma 6 upgrade session owns `package.json` and should regenerate the lockfile.

## 4. Open question for the owner: the Blob store

Preview deployments still write uploads to `grit-lms-blob` (production, 888.7 MB of 1 GB) with a token that can also **delete** production files.

**Recommendation:** design 06 §3.3, option A.

1. Create a Blob store `nexa-preview-blob` (free on Hobby). Account-wide Hobby limits may apply across both stores (**Guess**), so preview uploads would still count toward the same 1 GB.
2. Connect it to **Preview and Development only**.
3. Remove Preview and Development from production's Blob variables, so only Production keeps them: `BLOB_READ_WRITE_TOKEN` (`vercel env remove BLOB_READ_WRITE_TOKEN --environment preview --project grit-lms`) and the three `VERCEL_BLOB_*` variables.
4. Cap preview uploads at 5 MB in `issueUploadToken` (design 06 §3.3).

Agent A will not create the store or change the Blob variables until the owner says yes.
