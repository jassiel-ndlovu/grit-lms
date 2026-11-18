# Runbook: run the scheduled jobs on QStash

**Answer first.** GitHub Actions fires the "every 5 minutes" schedule only every 2 to 5 hours, so `/api/health` reports the jobs as stale. Upstash QStash calls the same `/api/cron/*` routes on time, signed. The owner decided on 2026-11-19 to adopt it now rather than at Stage 2. The free tier covers it: about 313 calls a day (auto-submit 288, notifications 24, housekeeping 1) against 1,000. The GitHub workflow stays as a backup; every job is idempotent, so a double run is harmless.

Code: `src/lib/jobs/verify.ts` accepts `Upstash-Signature` (checked against the route's exact public URL) as well as Bearer `CRON_SECRET`. `scripts/qstash-sync-schedules.ts` creates the schedules from `src/lib/jobs/registry.ts`.

## 1. Account (owner)

1. Sign up at [console.upstash.com](https://console.upstash.com) and open **QStash**.
2. Pick the **EU (Frankfurt)** region if offered: nearest to South Africa of the QStash regions (research 05).
3. From the QStash page, note four values (keep them in a password manager, never in the repo or chat): `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.

## 2. Vercel, Production only (owner)

Put the four values in `.env.local` at the repo root (git-ignored), named exactly `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. Then, in Git Bash from the repo root, load them into this terminal only (nothing is printed):

```bash
set -a; source .env.local; set +a
```

```bash
vercel env add QSTASH_CURRENT_SIGNING_KEY --environment production --project grit-lms --value "$QSTASH_CURRENT_SIGNING_KEY" --sensitive --yes
```

```bash
vercel env add QSTASH_NEXT_SIGNING_KEY --environment production --project grit-lms --value "$QSTASH_NEXT_SIGNING_KEY" --sensitive --yes
```

```bash
vercel env add APP_URL --environment production --project grit-lms --value "https://grit-lms.vercel.app" --no-sensitive --yes
```

`APP_URL` pins the origin the signatures are checked against; without it the app falls back to Vercel's production domain. When `nexa-lms.co.za` goes live, change `APP_URL` and re-run step 3.

Then deploy production with this code: merge this PR, or **Redeploy** in the Vercel dashboard if it is already merged, so the new variables load. **Do step 3 only after that deploy**, or QStash calls code that cannot verify its signature yet and every call fails.

## 3. Create the schedules

In the same terminal (the variables from step 2 are still loaded), from the repo root on `main` after this PR is merged:

```bash
npx tsx scripts/qstash-sync-schedules.ts            # dry run: lists what it would create
```

```bash
npx tsx scripts/qstash-sync-schedules.ts --apply
```

It creates `nexa-auto-submit`, `nexa-notifications` and `nexa-housekeeping` (POST, 3 retries). Re-running updates them in place. Close the terminal afterwards so the keys leave memory.

## 4. Check

- Within 5 minutes, `https://grit-lms.vercel.app/api/health` shows `auto-submit` as `ok` with `lastOkMinutesAgo` under 5.
- The QStash console's **Logs** show 200 responses.
- A 401 in the logs means the signing keys or `APP_URL` on Vercel do not match: check step 2, redeploy.

## Later

- After a week of clean QStash runs, drop the `5-55/5` schedule from `.github/workflows/scheduled-jobs.yml` and keep GitHub as an hourly backup.
- Rotating keys: QStash's "roll keys" moves next to current. Update both Vercel variables, redeploy.
