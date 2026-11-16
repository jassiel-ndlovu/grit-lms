# Agent A research: summary

**Answer first.** Stay on Vercel but upgrade to Pro, and move the functions and the database to Cape Town together: Vercel `cpt1` plus AWS RDS Postgres in af-south-1. Use Paystack for payments, with Payfast as the fallback. Price tiers at **Core R29, Plus R49, Pro R89** per active student per subject per month. Keep the plan's 14-day trial, its 20% API margin and its 2% parent commission. At launch the platform costs about **R750 a month** to run. Three problems in production today need the owner's attention before the revamp starts (below).

Checked 2026-11-16. USD converted at R17.00 (Wise mid-market R16.95 that day, rounded). Every figure has its source in the topic file. Items marked **Guess** or **Unverified** there are not facts yet.

## Found in production today

These were found while researching. None has been changed.

| Finding | Evidence (read-only) | Impact | Fix |
| --- | --- | --- | --- |
| **No crons run.** `src/vercel.json` defines auto-submit (every 5 min) and notifications (hourly), but the project root is `.`, so Vercel never reads that file. | `vercel crons ls`: "No cron jobs found for grit-lms". `vercel project inspect`: Root Directory `.` | Tests are never auto-submitted after the due date (PR #34's fix depends on this cron), and scheduled notifications never send | Needs Vercel Pro, because Hobby allows only daily crons. Then move the file to the repo root, or use the queue (QStash). See 05 |
| **Preview deployments share production's database and Blob store.** | `vercel env ls`: `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are set for both Preview and Production | Any preview build can write live student data | Point Preview at a Neon branch with fake data. See 06 |
| **The Blob store is 89% full on Hobby.** | `vercel blob list-stores`: 888.7 MB, 802 files. `grit-lms-blob` is the team's only store, so production almost certainly uploads to it | On Hobby, going over the limit **blocks Blob access for 30 days**. Listing the store uses advanced operations, capped at 2,000 a month | Audit first, then delete orphans with the owner's approval, or move to Pro. See 08 |

## Recommendations

| # | Topic | Recommendation | Key numbers | File |
| --- | --- | --- | --- | --- |
| 1 | Pricing | Core **R29**, Plus **R49**, Pro **R89** (plan: R15/R30/R55). Keep the plan's 14-day trial, 20% API margin (price = cost ÷ 0.8) and 2% commission, with the card fee paid by the tutor | Tutors charge about R330/hour, or R1,430 per subject per month. Plus is 3.4% of that. Solo tutor (12 students, 2 subjects): bill R1,325, the tutor keeps 90.8%, Nexa nets R1,921. Organisation (150 students): bill R17,675, keeps 92.1%, Nexa nets R30,128 | [01](01-pricing-market.md) |
| 2 | Service catalogue | 28 stable keys covering the plan's 11 basic services, 12 premium services and 5 add-ons, plus 7 candidates the plan is missing (`math-solve`, `originality-check`, `bulk-import`, ...) | About half of the basic services exist today. None of the premium services does | [02](02-service-catalogue.md) |
| 3 | Payments | **Paystack**, with Payfast as the fallback. Stripe cannot onboard South African businesses | Paystack: cards 2.9% + R1, EFT 2% (both + VAT), payout after 2 working days, R3 per transfer. An unregistered "Starter" business can collect only R80,000 in total | [03](03-payment-providers.md) |
| 4 | API costs | Bundle small-model AI marking in Pro and pass everything else through. Start on hosted Judge0 | Essay marking costs R0.24 (Sonnet-class) or R0.012 (Haiku-class). Judge0 hosted €27/month. A self-hosted 4 vCPU VM costs about R2,950/month. No Claude or GPT chat model runs inside South Africa (global routing only) | [04](04-api-costs.md) |
| 5 | Hosting | **Vercel Pro**, functions in `cpt1`, moved together with the database. Use QStash for the queue and Sentry Developer for monitoring | R340/month at launch, about R370 to R430 at 1,000 students (one seat) | [05](05-hosting.md) |
| 6 | Database | **AWS RDS Postgres 17, af-south-1**, `db.t4g.micro`, Single-AZ. Staging and dev stay on Neon branches with fake data | About R374/month. Cape Town to us-east-1 is about 226 ms per round trip today. Migration: ~35 MB `pg_dump`/`pg_restore`, about 30 minutes of downtime, with Neon kept read-only for 14 days as the rollback | [06](06-database.md) |
| 7 | Domain and email | `.co.za` at **xneelo**, DNS on **Cloudflare**, **Resend** on a `notify.` subdomain (eu-west-1), **Zoho Mail** Free or Lite | R110 a year for `.co.za`, plus about R178 for an optional `.com`. Resend Free covers 3,000 emails a month | [07](07-domain-email.md) |
| 8 | Blob cleanup | A read-only audit script (`scripts/blob-audit.ts`) matches every blob against 12 URL columns plus a regex scan of every text and JSON column. Delete only after approval and a backup | Today the code deletes only replaced covers and lesson attachments. Question images, answers, submissions and memos are never removed | [08](08-blob-cleanup.md) |
| 9 | Compliance | Record a guardian's consent before processing any under-18's data. Register the Information Officer. Bring data into South Africa, or get a legal opinion | VAT registration is compulsory above **R2.3 million** and voluntary above **R120,000** (applied by SARS from 1 April 2026). Children's data sent to a country without adequate protection may need the Regulator's prior authorisation (s57) | [09](09-compliance.md) |

## Monthly running cost at launch

| Item | ZAR per month | Note |
| --- | --- | --- |
| Vercel Pro (1 seat) | 340 | Includes $20 of usage |
| AWS RDS Postgres, af-south-1 | 374 | Single-AZ. Multi-AZ adds about R300 |
| Judge0 hosted (Pro) | ~505 | Only once coding courses launch. Self-host only at high volume |
| Domain (.co.za + .com) | ~24 | R288 a year |
| Resend, Zoho, Cloudflare, Sentry, QStash | 0 | Free tiers at launch volumes |
| **Total without the code runner** | **~R740** | |
| **Total with hosted Judge0** | **~R1,245** | |

A solo tutor on Plus with 12 students in 2 subjects covers the base cost.

## Where research differs from the plan

| Plan (rev 2) | Research | Why |
| --- | --- | --- |
| Tiers R15 / R30 / R55 | **R29 / R49 / R89** | Core already includes invoicing, the parent portal and messaging. The Pro AI allowance costs up to R10.71 per student. All three are still 2% to 6% of what a parent pays a tutor |
| API margin 20% | Same, defined as gross margin (price = cost ÷ 0.8) | Topics 1 and 4 used different bases. Put this definition in `billing.md` |
| "A tier price never absorbs metered API cost" | Bundle a small-model AI-marking allowance in Pro (30 answers per student per month) | Haiku-class marking costs about R0.01 an answer. Metering it adds friction for almost no cost |
| Judge0: hosted first, then self-host on ~4 vCPU | Agrees, but hosted stays cheaper below about 300,000 runs a month | A 4 vCPU VM costs about R2,950 a month either on AWS or Azure |
| Paystack fallback is Payfast | Agrees. Each tutor would then need a Payfast account | Payfast splits only to other Payfast accounts |
| Queue: Inngest or QStash | QStash | Cheapest at launch. **Note:** it runs only in Frankfurt and Virginia |
| Database host not chosen | RDS af-south-1 | Same AWS region as Vercel `cpt1`. Azure Johannesburg adds about 20 ms per query across clouds |

## Open questions for the owner

Most urgent first. Each topic file lists more.

1. **Crons:** do we fix the crons now (Vercel Pro) or wait for the revamp? Until then, tests are never auto-submitted after the due date.
2. **Approvals for paid resources:** Vercel Pro (R340/month) and RDS in af-south-1 (R374/month) under your AWS account. Which day and hour suit a 30-minute maintenance window?
3. **Business entity:** is Nexa a registered (Pty) Ltd? Paystack needs one to collect more than R80,000. Who is the Information Officer?
4. **Prices:** R29 / R49 / R89, or launch at the plan's R15 / R30 / R55 as introductory pricing?
5. **Paystack sales:** can one South African account combine subscriptions, subaccounts and splits? Is an education marketplace acceptable? What are the chargeback fees?
6. **POPIA and AI:** may student work go to AI models routed outside South Africa? No Claude or GPT model runs in-country today. Should a lawyer review US hosting and s57 before launch?
7. **Blob audit:** may it read the URL columns? Preferably from a Neon branch of production that you create. Do we connect the store to the project, or use a local token?
8. **Preview environment:** may Preview move to a Neon branch with fake data, so previews stop writing to production?
9. **Wolfram:** may we ask Wolfram for a commercial quote? Its free tier bans commercial use, so the `math-solve` add-on is blocked until then.
10. **Domain:** which exact name, `.com` as well, and how many mailboxes?
