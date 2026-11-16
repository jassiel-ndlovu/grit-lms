# Preview environment: fake-data database and separate Blob store

**Answer first.** As of 2026-11-16, Vercel Preview deployments use the Neon branch `preview`, which holds fake data only, and the Blob store `nexa-preview-blob`. Production's `DATABASE_URL` and Blob variables did not change. Preview and Development no longer hold any credential for production's database or files (section 3).

Phase 0 item from [design/06-deployment.md](../design/06-deployment.md) §3.1 to §3.3 and §7. Checked 2026-11-16.

## 1. What was set up

| Thing | Value | Notes |
| --- | --- | --- |
| Neon project | `grit-lms-sb` (`wandering-leaf-52822886`), aws-us-east-1, PG 17 | Unchanged |
| Production branch | `production`, endpoint `ep-aged-scene-a4fhpg0t` | Not written to. Size before and after: 35,201,024 bytes |
| Preview branch | `preview` (`br-hidden-poetry-a4aut3d9`), endpoint `ep-wandering-sea-a4bvyaiw` | Created from `production` with `--schema-only`. Neon reports `init_source: parent-schema`, so no production rows were copied. The project's current Neon plan allowed it |
| Preview role | `nexa_preview`, created on the `preview` branch only | Owns every table on the branch. See "Why a separate role" |
| Schema | `prisma migrate deploy` (`0_baseline`, `1_prisma6_m2m_pk`), run as `nexa_preview` against the preview endpoint | Rebuilt after PR #60 (Prisma 6, schema split). `migrate status` is up to date, and `migrate diff` against `prisma/schema` exits 0. The first build used `db push` from the Prisma 5 schema |
| Seed | `scripts/seed-fake.ts` | 9 users (1 tutor, 8 students), 2 courses, 6 lessons, 2 tests, 8 test submissions, 4 assignment entries |
| Vercel `DATABASE_URL` | Preview: `nexa_preview` on the **pooled** preview host, Secret, all branches. Production: the old record, unchanged (created 199 days ago) | It used to be one record covering Preview and Production. The Preview target was removed from it with `vercel env remove DATABASE_URL --environment preview`, then a new Preview-only record was added |

### Why a separate role

A schema-only child branch inherits the parent's roles **and their passwords**. On 2026-11-16, `neondb_owner` on `preview` had the same password as on `production` (compared by hash; the value was never printed). If Vercel Preview used `neondb_owner`, a leaked preview URL would also open production. So the app's Preview URL uses `nexa_preview`, a role that exists only on the `preview` branch.

To give that role the tables, the empty `public` schema on `preview` was dropped and recreated by `neondb_owner` on the preview endpoint, after a check that it held no `User` rows (later, no non-`@example.test` users). `nexa_preview` was granted the schema and then created the tables, first with `db push` and now with `migrate deploy`.

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

**After a migration lands on `main`**, apply it to the preview branch. `prisma db push` is retired (see [prisma-baseline.md](prisma-baseline.md)).

```bash
DATABASE_URL="<pooled nexa_preview URL>" DIRECT_URL="<direct nexa_preview URL, from step 1 without --pooled>" npx prisma migrate deploy
```

Check that the host on the "Datasource" line is `ep-wandering-sea-a4bvyaiw`. Later, a `vercel-build` step will do this for every preview (design 06 §3.4). That step needs `DIRECT_URL` set for Preview on Vercel, which it is not yet. The app itself does not need `DIRECT_URL`: the Prisma 6 client was checked with `DATABASE_URL` alone.

**If the branch gets into a bad state**, delete it and repeat section 1. Never recreate it without `--schema-only`.

## 3. Blob store for Preview and Development

Approved by the owner on 2026-11-16 (design 06 §3.3, option A). Before this, Preview wrote uploads to `grit-lms-blob` (production, 888.7 MB of 1 GB) with a token that could also delete production files. Development also had production's `VERCEL_BLOB_*` variables, which were added when `grit-lms-blob` was connected to the project.

| Store | Id | Region | Access | Connected to |
| --- | --- | --- | --- | --- |
| `grit-lms-blob` | `store_sFzz4mGMYKoxYMSL` | cpt1 | public | Production only |
| `nexa-preview-blob` | `store_AqkR80w3vgz0PTMf` | cpt1 | public (the app uploads with `access: "public"`) | Preview and Development |

What was done:

1. Removed Preview and Development from production's Blob variables with `vercel env remove <name> --environment <env>`, which removes one target and leaves the rest of the record: `BLOB_READ_WRITE_TOKEN` (Preview; it never had Development), `VERCEL_BLOB_READ_WRITE_TOKEN`, `VERCEL_BLOB_STORE_ID` and `VERCEL_BLOB_WEBHOOK_PUBLIC_KEY`. All four now apply to Production only, and their values are unchanged.
2. Created the new store and connected it in one step: `vercel blob create-store nexa-preview-blob --access public --region cpt1 --yes --environment preview --environment development`. This added a `BLOB_READ_WRITE_TOKEN` (Config type) for Preview and Development.
3. Checked that the Preview token carries the preview store's id, without printing the token.

| Variable | Development | Preview | Production |
| --- | --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | `nexa-preview-blob` | `nexa-preview-blob` | `grit-lms-blob` (record unchanged, 199 days old) |
| `VERCEL_BLOB_*` (3) | none | none | `grit-lms-blob` |

Limits: account-wide Hobby Blob limits may apply across both stores (**Guess**), so preview uploads may still count toward the same 1 GB.

Still to do:

- Cap preview uploads at 5 MB in `issueUploadToken` when `VERCEL_ENV !== "production"` (design 06 §3.3). This is a code change for a later PR.
- `vercel env pull` on a laptop now gives the preview store's token, so local work no longer writes to production. Old local `.env` files may still hold production's token; delete them.
- Emptying the preview store monthly (`scripts/blob-wipe-preview.ts`, design 06 §3.3) still needs an owner decision on a standing yes (design 06 open question 1).
