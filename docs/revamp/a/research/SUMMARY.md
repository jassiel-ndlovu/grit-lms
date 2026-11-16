# Agent A research: summary

**Answer first.** The owner's decisions of 16 November (next section) override the recommendations below where they differ. Tiers are **Core R99, Plus R139, Pro R179** per active student per course per month. Stay on Vercel Hobby and Neon us-east-1 until tutors and students are on board in 2027, then move to Vercel Pro in `cpt1` and AWS RDS in af-south-1 together. Use Paystack, with Payfast as the fallback. Keep the plan's 14-day trial, 20% API margin and 2% parent commission. Three problems found in production are listed below; the cron problem is fixed (PR #37).

## Owner decisions (16 November 2026)

| Topic | Decision | What follows |
| --- | --- | --- |
| Tier prices | **Core R99, Plus R139, Pro R179** per student per course per month (research said R29 / R49 / R89) | Order confirmed by the owner: Core < Plus < Pro. These prices are 6.9%, 9.7% and 12.5% of the R1,430 a parent pays for one subject at one hour a week (research 01). A solo tutor with 12 students in 2 subjects on Plus pays R3,336 a month, against R1,853 for Teach 'n Go Pro (100 students, no LMS). That is the market risk to watch in the trial |
| Hosting and database | Vercel Pro and RDS af-south-1 **in 2027**, once tutors and students are on board. Stay on Hobby and Neon until then | Vercel Hobby is for non-commercial use only (research 05), so upgrade before Nexa takes its first payment. Children's data stays in the US until then: keep the POPIA notice and consent wording honest about that (research 09) |
| Business entity | Not registered. Revenue is far below R80,000 a month | **Correction:** Paystack's Starter limit is **R80,000 in total, for the life of the account**, not per month (research 03). Register on Paystack as a sole proprietor (R1,000,000 lifetime limit, needs proof of address) or register a company before parent payments go live |
| Parent payments | No combined subscription. A parent can claim several children and pay for them from one account. Payments are aggregated, and each child keeps their own account. Nexa is an education marketplace. Chargeback fees are negligible for now | One checkout per parent can cover several invoices. Paystack's multi-split pays each tutor's subaccount in one transaction (research 03). Tutor subscriptions (Gate 1) need no split |
| AI and POPIA | Personal information is redacted before any text goes to an LLM. The model marks or edits tests and never sees who wrote them | POPIA does not apply to information de-identified so that it cannot be re-identified (s6(1)(b)). Design the redaction step in A2 and B2: names, IDs and free-text personal details stripped, mapping kept only in Nexa's database |
| Blob audit | Allowed to read the URL columns. Connect the store to the project | The owner connects `grit-lms-blob` to `grit-lms` in the dashboard for the **Development** environment only, because Preview and Production already have a token. Then run the read-only audit (research 08) |
| Preview database | Preview uses a Neon branch with fake data | A schema-only Neon branch, seeded with fake data, becomes Preview's `DATABASE_URL`. Preview also shares production's Blob token; a separate store is a later step |
| Wolfram | Get a quote | Draft request below. Agent B recommends a local maths engine instead (B research 02), so the quote is for comparison |
| Domain and mail | **`.co.za`** at xneelo, about 3 mailboxes (the owner first suggested `.online`) | **Decided after this research:** `.online` is $1.96 in the first year but **$28.84 (R490) a year** after that at Porkbun, while `.co.za` is R110 a year at xneelo, including renewals ([Porkbun](https://porkbun.com/products/domains), checked 2026-11-16). Three mailboxes fit Zoho Mail Free (up to 5 users), so mail costs R0 |
| Earlier (plan revision 3), revised | No UI modes; coding automarker and Judge0 parked; Bedrock for AI marking. **`graphing` and `math-input` are both on Plus** (the owner revised revision 3, which had put all graphing on Pro) | `viewer.md` drops `mode`. `services.md` puts `graphing` and `math-input` on Plus and has no `automarker` in v1. Judge0 leaves the launch budget |

### Wolfram quote request (draft, for the owner to send)

> We are building an online tutoring platform for South African schools and tutors. We would like a commercial quote for the Wolfram|Alpha Full Results API with step-by-step solutions (Show Steps), used to check students' maths working. Expected volume at launch: under 5,000 calls a month, growing to about 50,000. Please include: price per call or per tier, whether results may be cached, whether we may bill the cost on to our customers, attribution and branding rules, and any limits for use by students under 18.

Send it through Wolfram's [custom solutions contact form](https://www.wolframalpha.com/contact-us/custom), linked from the [API page](https://products.wolframalpha.com/api/) (checked 2026-11-16), with the business's details. The volumes are **guesses**; adjust them if needed.

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

**Until 2027 (owner decision):** Vercel Hobby, Neon Free and no Judge0 (parked) leave only the domain, about **R9 a month** for `.co.za` alone. The table above is the cost once tutors pay.

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

The owner answered every question on 16 November:

| Question | Answer | What follows |
| --- | --- | --- |
| Paystack account type | **Sole proprietor** | Lifetime collection limit R1,000,000; needs proof of address under 6 months (research 03). For a sole proprietor the Information Officer is the owner by default (POPIA s1, "head of a private body"); register on the Information Regulator portal (research 09) |
| Domain | **nexa-lms.co.za** at xneelo | The owner checks availability and buys it. App mail from a `notify.nexa-lms.co.za` subdomain through Resend; DNS on Cloudflare (research 07) |
| First payment | **February 2027** | Vercel Pro (functions in `cpt1`) and RDS in af-south-1 must be live before then. Plan the database move for January 2027 |

No questions are open from this research.
