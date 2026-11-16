# Agent A system design (A2)

**Answer first.** Nexa becomes multi-tenant around a **workspace** (organisation or solo practice), with roles held through memberships, learner rows and guardianships. Workspaces pay Nexa per active student per course in **30-day periods** anchored to the payment date. Parents and adult students pay tutors through Paystack split checkout, and Nexa keeps 2%. v1 stays on Vercel Hobby and Neon until January 2027, then moves to Vercel Pro in Cape Town and AWS RDS in af-south-1 before the first payment in February 2027. The legacy `/api` routes and React contexts are replaced in six batches, and the first batch is a security fix.

Status: draft, 2026-11-16. Owner decisions in [../research/SUMMARY.md](../research/SUMMARY.md) and in the A2 session apply.

| File | Decides |
| --- | --- |
| [01-tenancy-roles.md](01-tenancy-roles.md) | Workspace, Team, Membership, Learner, Enrollment, Guardianship, AuditLog; roles; permissions matrix; tenancy enforcement; migration of today's data into one comped organisation |
| [02-identity.md](02-identity.md) | Move to Better Auth in Phase 1; database sessions; TOTP for owners and admins; tutors create students directly in v1 (guardian invites, consent capture and magic links later); retention 2 months after last payment |
| [03-billing.md](03-billing.md) | Tiers R99 / R139 / R179; 30-day periods, seats in advance, catch-up and usage in arrears; 30-day tier hold; Pro includes 30 AI marks per student per period; trial; daily job; dunning; discounts; admin overrides |
| [04-payments.md](04-payments.md) | `PaymentProvider` interface with Paystack; first payment ends the trial; parent checkout across several children and tutors with multi-split; webhooks; off-site payments; refunds |
| [05-messaging-email.md](05-messaging-email.md) | Announcements and threads; delivery through `Notification`; Resend on `notify.nexa-lms.co.za` with an email queue and daily budget; templates; preferences |
| [06-deployment.md](06-deployment.md) | Stage 1 (Hobby, Neon production plus `preview` and `dev` branches, separate preview Blob store, GitHub Actions jobs); Stage 2 (Vercel Pro `cpt1`, RDS af-south-1, staging, QStash); backups; env vars; monitoring |
| [07-legacy-replacement.md](07-legacy-replacement.md) | All 37 `/api` routes and 15 contexts mapped to server actions or queries, in six batches |

Contracts drafted from these designs: [viewer.md](../../contracts/viewer.md), [services.md](../../contracts/services.md), [billing.md](../../contracts/billing.md).

## Security finding (ships before the redesign)

`GET /api/activity` and `GET /api/notifications` check only that the caller is signed in. They return rows for any `userId`, `studentId` or `courseIds` in the query string, so a signed-in student can read another user's notifications and activity log. Checked by reading both handlers on 2026-11-16. The fix scopes both queries to the caller's own id and to courses they teach or are enrolled in. Returning 410 would break the root providers that call them on every page, so 07's Batch 0 should scope the queries, not remove the routes.

## Owner questions

| # | Question | From |
| --- | --- | --- |
| 1 | Renewal date: exactly 30 days (paid 3 Feb, renews 5 Mar), or the day before the same date next month (2 Mar, as in the owner's example)? | 03 |
| 2 | Does a late payment start the new period on the payment date, or keep the original anchor? | 03 |
| 3 | May the security fix above ship now, ahead of the redesign? | 07 |
| 4 | May the preview Blob store be emptied monthly under a standing approval? | 06 |
| 5 | Stage 1 backups: a nightly encrypted dump to an S3 bucket in af-south-1 (a few rand a month, a new paid resource), or weekly manual dumps until RDS? | 06 |
| 6 | Which free uptime checker: Better Stack or UptimeRobot? | 06 |
| 7 | Owner 2FA: enforce at sign-up, or after a 14-day grace? | 02 |
| 8 | Resend Pro (R340 a month): at launch, or when the free 100-a-day limit is first reached? | 05 |

**For a lawyer or accountant:** whether a tutor's attestation covers parental consent under POPIA s35 in v1; how long invoices and payment records must be kept (5 years assumed).

**For Paystack sales:** multi-split to many subaccounts on one South African account, `charge_authorization` for renewals, chargeback fees, the minimum charge, and whether account checks need an ID number.

**For Agent B:** `contracts/editor.md` (email rendering waits on it); `deleteEntry` on the assignments overview; who edits `src/app/providers.tsx`.
