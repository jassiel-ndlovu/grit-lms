# Switching billing on in production

Agent A, 2026-11-22. Needs the owner's go-ahead at each marked step.

**Answer first:** switching billing on today would start 14-day trials for new tutors, and they would have no way to pay when the trials end. Production has no Paystack key, and the owner's plan takes the first payment in February 2027, after the January move. So billing goes on with the live Paystack keys in January, not now. Until then, nothing needs to change in production.

## What `BILLING=1` switches on

| Area | With billing on |
| --- | --- |
| Onboarding | A tutor with no workspace is sent to `/dashboard/onboarding`, which creates a workspace and (optionally) starts the 14-day trial |
| Daily billing job | Trial emails (days 10 and 13), trials ending, comps ending, renewals, dunning, read-only after 14 unpaid days, retention warnings and deletes, student-limit warnings |
| Daily fees job | Monthly fee invoices to parents, reminders, recovery invoices |
| Premium features | Checked per course (`hasService`). A course with no service rows loses AI marking, maths input and graphing. With billing off, everything is on |
| Student limits | The trial's 20-student hard stop applies |
| Pages | Billing, payouts, fees, discount codes, course services and checkout appear |

## What production has today (2026-11-22)

- **One workspace:** the legacy Nexa organisation, COMPED, with no subscription row. The daily job can't end its comp or bill it.
- **Accounts:** 1 tutor, 7 students and 1 admin. No fee schedules, invoices or payout accounts.
- **Missing variables:**
  - `BILLING`;
  - `PAYSTACK_SECRET_KEY`;
  - `PAYMENT_ENC_KEY` (encrypts saved card codes).
  - Preview also has `EMAIL_ALLOWLIST`, which production must not have.
- **`RETENTION_DELETES` is set.** Its value is hidden. With billing on, it lets the daily job delete a cancelled workspace's data after the retention period. None exists today.
- **`REVAMP_UI` is not set,** so production still shows the old dashboard shell. B's new screens (onboarding included) are built for the new shell. That's a separate switch (B's, with the owner).

## Steps, in order

1. **Before January (A):** switch the legacy workspace's 6 courses to Pro, so its tutor keeps AI marking and maths when billing goes on. It's comped, so nothing is charged. This is a production data write: **needs the owner's yes**.
2. **Before January (A):** create `PAYMENT_ENC_KEY` for production (a new 32-byte key, never the Preview one). Add it in Vercel without printing it.
3. **January (owner):**
   - Paystack live keys after the business verification;
   - the move to Vercel Pro and the database move (Stage 2);
   - then `PAYSTACK_SECRET_KEY` (live) in production. Never put a test key in production: real tutors could "pay" with test cards.
4. **January (owner and B):** switch `REVAMP_UI` on, so the onboarding, billing and fees screens show.
5. **Go-live day (A, after the owner's yes):**
   - set `BILLING=1` in production and redeploy;
   - confirm `RETENTION_DELETES` is what the owner wants;
   - run the daily jobs once by hand and read the results;
   - make one small live payment with the owner's own card, then refund it;
   - watch Sentry and the email queue for a day.
6. **Rollback:** remove `BILLING` and redeploy. Pages hide and the jobs stop at once. Nothing already billed is undone.

## Open question for the owner

Should tutors be able to sign up and set up before payments go live? This would be an early access period (for example, every new workspace free until 1 February 2027, then the normal trial or payment). It needs a small change: a "launch comp" date that onboarding applies instead of the trial. Without it, the onboarding flow waits for January.
