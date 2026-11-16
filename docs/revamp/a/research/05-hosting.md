# Hosting

**Answer first.** Stay on Vercel, upgrade to **Pro (R340 / $20 a month, one deploying seat, $20 usage credit included)** and move the functions from `iad1` (Washington) to **`cpt1` (Cape Town)**. Do this together with the database move in [06-database.md](06-database.md), not before it. Hobby is for personal or non-commercial use only, and it blocks the app's two crons, so Pro is required before Nexa takes money. At launch (~50 students) usage fits inside the $20 credit, so the bill is about **R340 a month**; at 1,000 active students it is about **R370-R430 a month** (one seat). Azure (Johannesburg) and AWS af-south-1 can host Next.js, but they cost more (AWS Fargate with a load balancer is about R950 a month before a CDN) and add DevOps work the team does not need yet.

Currency: amounts show ZAR first, converted at **R17.00/USD** (Wise mid-market 16.95 on 2026-11-16, rounded). All provider prices exclude VAT.

## 1. What the app needs from a host

| Need | Today | Source in repo |
|---|---|---|
| Framework | Next.js 15 (App Router), React 18, NextAuth v4, Prisma 5.22 | `package.json` |
| Function region | `iad1` for every function (seen with `vercel inspect` on the latest production deployment, 2026-11-16) | Vercel CLI, read-only |
| Crons | `/api/auto-submit` every 5 min, `/api/cron/notifications` hourly | `src/vercel.json` |
| File storage | Vercel Blob store `grit-lms-blob` in `cpt1`, 888.7 MB of 1 GB Hobby allowance | brief |
| Images | `next/image` loads from `*.public.blob.vercel-storage.com` | `next.config.ts` |
| Database | Neon Postgres 17, `aws-us-east-1` | Neon CLI, read-only |

**Finding: the crons probably never run.** `vercel.json` sits in `src/`, but the project's root directory is `.` (from `vercel project inspect`). Vercel reads `vercel.json` from the project root. Also, Hobby rejects any cron that runs more than once a day ([Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), checked 2026-11-16), yet recent deployments are "Ready". **Guess:** the file is ignored, so neither cron is scheduled. The owner should check the project's Cron Jobs tab. The fix (move the file to the root) only works on Pro.

## 2. Vercel Hobby versus Pro

| Item | Hobby | Pro | Source |
|---|---|---|---|
| Price | Free | $20/month platform fee (R340), includes 1 deploying seat and $20 usage credit | [Pro plan](https://vercel.com/docs/plans/pro-plan) (checked 2026-11-16) |
| Extra deploying seat | Not possible | $20/month each (R340); Viewer seats free | [Pro plan](https://vercel.com/docs/plans/pro-plan) (checked 2026-11-16) |
| Commercial use | Not allowed: "personal or non-commercial use" only | Allowed | [Vercel Terms](https://vercel.com/legal/terms) (checked 2026-11-16) |
| Over the limit | Project is paused (503) until 30 days pass | Billed on demand; spend alerts at $200 by default | [Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing), [Pro plan](https://vercel.com/docs/plans/pro-plan) (checked 2026-11-16) |
| Function regions | Single region | Up to 5 regions | [Function regions](https://vercel.com/docs/functions/configuring-functions/region) (checked 2026-11-16) |
| Function max duration | 300 s | 300 s default, up to 800 s | [Hobby plan](https://vercel.com/docs/plans/hobby) (checked 2026-11-16) |
| Cron jobs per project | 100 | 100 | [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) (checked 2026-11-16) |
| Cron minimum interval | Once per day; more often fails the deploy | Once per minute | same |
| Cron timing precision | Within the hour (±59 min) | Per minute | same |
| Runtime logs kept | 1 hour | 1 day | [Hobby plan](https://vercel.com/docs/plans/hobby) (checked 2026-11-16) |
| Blob storage | 1 GB, then Blob stops for 30 days | Pay per GB | [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) (checked 2026-11-16) |

Notes:
- Vercel marks Cron Jobs as a legacy feature that will move to "Schedules" ([Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), checked 2026-11-16). The two crons will need a migration later.
- The pricing page says Pro includes 10M CDN requests; the Pro plan docs say the Flat Rate CDN tier includes 1M CDN requests and 1 TB transfer ([pricing](https://vercel.com/pricing), [Pro plan](https://vercel.com/docs/plans/pro-plan), checked 2026-11-16). The estimates below use the lower 1M figure.

### Hobby included usage (for comparison)

| Resource | Hobby included per month | Source |
|---|---|---|
| Fast Data Transfer | 100 GB | [Hobby plan](https://vercel.com/docs/plans/hobby) (checked 2026-11-16) |
| CDN requests | 1,000,000 | same |
| Active CPU | 4 CPU-hours | same |
| Provisioned memory | 360 GB-hours | same |
| Function invocations | 1,000,000 | same |

## 3. Vercel function regions and prices (Pro, Fluid compute)

`cpt1` is Vercel's Cape Town region and maps to AWS `af-south-1` ([Vercel regions](https://vercel.com/docs/regions), checked 2026-11-16). Vercel's own docs say functions should run in the same region as the database. New projects default to `iad1`.

| Region | Active CPU ($/hour) | Provisioned memory ($/GB-hour) | Source |
|---|---|---|---|
| `cpt1` Cape Town | 0.200 (R3.40) | 0.0166 (R0.28) | [Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing) (checked 2026-11-16) |
| `iad1` Washington | 0.128 (R2.18) | 0.0106 (R0.18) | same |
| `lhr1` London | 0.177 | 0.0146 | same |

- Invocations: $0.60 per million (R10.20) on Pro ([Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing), checked 2026-11-16).
- CPU is billed only while code runs; memory is billed for the whole instance lifetime, including waits on the database (same source). Slow cross-ocean database calls therefore cost memory-hours, not just time.

### Other `cpt1` prices (Pro)

| Resource | `cpt1` price | Source |
|---|---|---|
| Fast Data Transfer | $0.28/GB (R4.76) after the 1 TB Flat Rate CDN tier | [cpt1 pricing](https://vercel.com/docs/pricing/regional-pricing/cpt1) (checked 2026-11-16) |
| CDN requests | $2.80 per 1M (R47.60) | same |
| Fast Origin Transfer | $0.43/GB (R7.31) | same |
| Image Optimization transformations | $0.0735 per 1K | same |
| Blob storage | $0.027 per GB-month (R0.46) | same |
| Blob simple operations (reads that miss cache) | $0.40 per 1M | same |
| Blob advanced operations (uploads, lists, copies) | $6.00 per 1M (R102) | same |
| Blob data transfer | $0.093/GB (R1.58) | same |
| Static IPs add-on (if the DB needs an allow-list) | $100/month per project (R1,700) plus Private Data Transfer $0.19/GB | [Pro plan](https://vercel.com/docs/plans/pro-plan), [cpt1 pricing](https://vercel.com/docs/pricing/regional-pricing/cpt1) (checked 2026-11-16) |

Blob notes: deletes are free; dashboard browsing counts as advanced operations; uploads through the app's own function (server uploads) also pay Fast Data Transfer ([Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), checked 2026-11-16). The app has `/api/upload`; client uploads would be cheaper.

## 4. Latency: where compute runs versus where the data is

| Path | Round trip (ms, p50) | Source |
|---|---|---|
| AWS af-south-1 (Cape Town) to us-east-1 (Virginia) | 226 | [CloudPing API, 1-year p50](https://www.cloudping.co/api/latencies?percentile=p_50&timeframe=1Y) (checked 2026-11-16) |
| AWS af-south-1 to eu-west-2 (London) | 148 | same |
| Azure South Africa West (Cape Town) to East US | 203 | [Azure latency stats](https://learn.microsoft.com/en-us/azure/networking/azure-network-latency) (checked 2026-11-16) |
| Azure South Africa North (Johannesburg) to East US | 220 | same |
| Azure South Africa North to South Africa West | 20 | same |
| Same AWS region (function to DB) | about 1 | **Guess** (typical intra-region) |

What this means today:
- A South African user reaches a Vercel PoP in South Africa, then the request crosses to `iad1` over Vercel's private network. TLS is handled in the region, not at the PoP ([Vercel regions](https://vercel.com/docs/regions), checked 2026-11-16). Each dynamic request pays at least one ~226 ms round trip; a new connection pays more.
- Today the function and Neon are both in us-east-1, so each database query is fast. **Do not move functions to `cpt1` while the database stays in us-east-1.** A page that makes 5 sequential Prisma queries would add about 5 x 226 ms = 1.1 s.
- With functions in `cpt1` and the database in af-south-1, the user-to-function trip drops to tens of milliseconds and queries stay local. **Guess:** about 200-600 ms saved per dynamic page for South African users.

## 5. Alternatives

### Azure (South Africa North, Johannesburg)

| Option | Price (Linux, South Africa North) | Fit | Source |
|---|---|---|---|
| App Service B1 | $0.0243/hour = $17.74/month (R302) | Runs `next start` on one small VM; no scale to zero | [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (checked 2026-11-16) |
| App Service P0v3 | $0.0965/hour = $70.45/month (R1,198) | Production tier with more memory | same |
| Container Apps (consumption) | vCPU active $0.000024/s, idle $0.000003/s; memory $0.000003/GiB-s; requests $0.40 per 1M | Scale to zero possible; cold starts | same |
| Container Apps free grant | 180,000 vCPU-s, 360,000 GiB-s, 2M requests per subscription per month | | [Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/) (checked 2026-11-16) |
| Static Web Apps | No South Africa North meter returned by the prices API | **Unverified:** Next.js server features on SWA are limited; not a fit for this app | [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (checked 2026-11-16) |

Azure needs its own crons (Container Apps jobs or Functions timers), its own Blob storage, its own CI and CDN. **Guess:** 2-4 days of setup.

### AWS af-south-1 (Cape Town)

| Option | Available in af-south-1? | Price | Source |
|---|---|---|---|
| Amplify Hosting | **No** (not in the endpoint list) | n/a | [Amplify endpoints](https://docs.aws.amazon.com/general/latest/gr/amplify.html) (checked 2026-11-16) |
| App Runner | **No** | n/a | [App Runner endpoints](https://docs.aws.amazon.com/general/latest/gr/apprunner.html) (checked 2026-11-16) |
| Lightsail | **No** | n/a | [Lightsail regions](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html) (checked 2026-11-16) |
| ECS Fargate (ARM) | Yes | $0.04372 per vCPU-hour, $0.0048 per GB-hour | AWS Pricing API `AmazonECS` (checked 2026-11-16) |
| Application Load Balancer | Yes | $0.03/hour plus $0.0095 per LCU-hour | AWS Pricing API `AWSELB` (checked 2026-11-16) |
| Public IPv4 address | Yes | $0.005/hour each | AWS Pricing API `AmazonVPC` (checked 2026-11-16) |
| Lambda (via OpenNext/SST) | Yes | $0.0000221 per GB-s (x86, tier 1), $0.27 per 1M requests | AWS Pricing API `AWSLambda` (checked 2026-11-16) |
| Data out to internet | Yes | $0.154/GB first tier | AWS Pricing API `AWSDataTransfer` (checked 2026-11-16) |

Smallest always-on Fargate setup: 0.5 vCPU + 1 GB ARM task ($19.46) + ALB ($21.90 + about 1 LCU $6.94) + 2 public IPs ($7.30) = **about $55.60/month (R945)**, before CloudFront, S3, logs and a second task for redundancy.

### Others

| Platform | Closest region to South Africa | Notes | Source |
|---|---|---|---|
| Cloudflare Workers | PoPs in Cape Town, Durban, Johannesburg (33 African cities) | Workers Paid $5/month (R85), 10M requests and 30M CPU-ms included, then $0.30 per 1M requests and $0.02 per 1M CPU-ms. Next.js runs through `vinext` or OpenNext, not native Next.js. **Unverified:** whether NextAuth v4 and Prisma 5 work unchanged. | [Cloudflare network](https://www.cloudflare.com/network/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) (checked 2026-11-16) |
| Fly.io | `jnb` Johannesburg | shared-cpu-1x 1 GB from $6.70/month in `iad` (R114); prices vary by region; `jnb` price not shown (**Unverified**). Africa egress $0.12/GB. No Fly Managed Postgres in `jnb`. | [Fly regions](https://docs.fly.io/reference/regions), [Fly pricing](https://docs.fly.io/about/pricing) (checked 2026-11-16) |
| Render | None in Africa (Oregon, Ohio, Virginia, Frankfurt, Singapore) | | [Render regions](https://render.com/docs/regions) (checked 2026-11-16) |
| Railway | None in Africa (California, Virginia, Amsterdam, Singapore) | | [Railway regions](https://docs.railway.com/reference/deployment-regions) (checked 2026-11-16) |

## 6. Cost estimates

### Traffic assumptions (all **Guess**, to be replaced with real Vercel usage after a month on Pro)

| Assumption | Launch (50 students, 5 tutors) | 1,000 active students, 60 tutors |
|---|---|---|
| Function invocations per student per month | 600 (15 sessions x 40) | 600 |
| Function invocations per tutor per month | 2,000 | 2,000 |
| Cron invocations per month | 9,360 (8,640 + 720) | 9,360 |
| Total invocations per month | ~50,000 | ~730,000 |
| Active CPU per invocation | 60 ms | 60 ms |
| Instance memory and wall time | 2 GB, 400 ms, no concurrency saving (pessimistic) | same |
| Active CPU hours | 0.83 | 12.2 |
| Provisioned memory GB-hours | 11 | 162 |
| Page bandwidth (Fast Data Transfer) | 2 GB | 31 GB |
| CDN requests | 0.2M | 3M |
| Blob stored | 1 GB | 20 GB |
| Blob transfer | 5 GB | 100 GB |
| Blob uploads (advanced ops) | 1,000 | 30,000 |

### Vercel Pro, functions in `cpt1`

| Line | Launch ($) | 1,000 students ($) |
|---|---|---|
| Platform fee (1 seat, includes $20 credit) | 20.00 | 20.00 |
| Active CPU at $0.20/h | 0.17 | 2.44 |
| Memory at $0.0166/GB-h | 0.18 | 2.69 |
| Invocations at $0.60/M | 0.03 | 0.44 |
| CDN requests over 1M at $2.80/M | 0.00 | 5.60 |
| Fast Data Transfer (inside 1 TB tier) | 0.00 | 0.00 |
| Blob storage at $0.027/GB | 0.03 | 0.54 |
| Blob transfer at $0.093/GB | 0.47 | 9.30 |
| Blob operations | 0.01 | 0.58 |
| Usage subtotal | 0.89 | 21.59 |
| **Bill (fee + usage above the $20 credit)** | **20.00 (R340)** | **21.59 (R367)** |
| With a second deploying seat | 40.00 (R680) | 41.59 (R707) |

Add a 20% margin for error at 1,000 students: **about R370-R430 a month** with one seat. Image Optimization is not counted (cover images and avatars); **Guess:** under $3/month.

### Side by side (hosting only, no database, monthly)

| Option | Launch | 1,000 students | Ops effort |
|---|---|---|---|
| Vercel Pro, `cpt1` | R340 | R367-R430 | Low (today's workflow) |
| Vercel Hobby (today) | R0 | Not allowed (commercial use; limits) | n/a |
| Azure App Service B1 then P0v3 | R302 + Blob + CDN | R1,198 + Blob + CDN | Medium |
| Azure Container Apps | ~R0-R50 (inside free grant, **Guess**) | ~R220 (1 warm replica, **Guess**) + Blob + CDN | Medium |
| AWS Fargate + ALB | ~R945 | ~R1,100+ (**Guess**) | High |
| Cloudflare Workers | R85 | R85-R150 (**Guess**) | Medium, with framework risk |

## 7. Job queue and monitoring (from the plan)

The plan replaces the two crons with a job queue and adds Sentry. Neither queue has an African region, which is fine: jobs are not on the user's click path.

| Service | Free tier | Paid entry | Regions | Source |
|---|---|---|---|---|
| Upstash QStash | 1,000 messages/day, 10 active schedules | Pay as you go: $1 per 100K messages (R17), 1,000 schedules, 50 GB bandwidth free then $0.05/GB | eu-central-1 (Frankfurt, SDK default) and us-east-1 | [QStash pricing](https://upstash.com/pricing/qstash), [QStash regions](https://upstash.com/docs/qstash/howto/multi-region) (checked 2026-11-16) |
| Inngest | 50k executions/month (each run and each step counts), 5 concurrent steps; pauses at the quota | Pro from $99/month (R1,683), 1M executions | Not stated on the pricing page (**Unverified**) | [Inngest pricing](https://www.inngest.com/pricing) (checked 2026-11-16) |
| Sentry | Developer: $0, 5k errors, 1 user | Team: $29/month (R493) monthly or $26/month (R442) annual, 50k errors, unlimited users | Data residency "included"; regions not named on the page (**Unverified**) | [Sentry pricing](https://sentry.io/pricing/) (checked 2026-11-16) |

Sizing:
- The auto-submit sweep every 5 minutes is 8,640 runs a month (288 a day). On QStash that is one schedule and fits the free 1,000 messages a day at launch. At 1,000 students with emails, invoice runs and grading callbacks, **Guess:** 100K-300K messages a month, so **$1-$3 (R17-R51)**.
- On Inngest the same sweep alone uses 8,640 of the 50k free executions, and every step counts. **Guess:** Nexa passes 50k executions soon after launch, and the next step is $99 a month.
- Recommendation: **QStash** (cheaper step-up; plain HTTP calls into the existing Next.js routes). Use Inngest only if the team wants its step functions badly enough to pay $99.
- Sentry: start on Developer ($0, one user). Move to Team (R442-R493) when a second person needs alerts.

## 8. Recommendation

1. Upgrade the Vercel team to Pro before any paying customer. Keep one deploying seat.
2. Until the queue lands, move `vercel.json` from `src/` to the repo root so the crons register on Pro. Confirm in the dashboard. Then replace them with QStash schedules (section 7).
3. Set a spend alert at $40 (R680) in Spend Management.
4. Move functions to `cpt1` **in the same change** that points `DATABASE_URL` at the new af-south-1 database (see [06-database.md](06-database.md)). Set `"regions": ["cpt1"]` in `vercel.json`.
5. Keep Vercel Blob in `cpt1`. Clean it up (topic 8) before growth; at $0.027/GB storage is cheap, transfer is the real cost.
6. Revisit Azure or AWS only if Vercel cost passes about R2,000 a month or a customer needs a contract Vercel cannot give.

## Against the plan

Where this file differs from the plan's "Architecture and hosting" section:

1. **Cost line.** The plan says "Vercel Pro ($20 per seat)". Pro is a $20 platform fee that includes one seat and $20 of usage credit; extra deploying seats are $20 each, Viewers are free ([Pro plan](https://vercel.com/docs/plans/pro-plan), checked 2026-11-16). So the plan's figure is right for seats, but launch usage adds nothing on top: one deployer pays R340 in total.
2. **Order of the move.** The plan pins functions "next to the database". Agreed, and it must be one change: moving functions to `cpt1` while the database is still in us-east-1 makes every query cross the ocean (section 4).
3. **Crons are not working today.** The plan lists "2 Vercel crons" as today's state. **Guess:** they are not scheduled at all (section 1), so the queue is a fix, not just an upgrade.
4. **Queue choice.** The plan leaves Inngest or QStash open. This file picks QStash on cost (section 7).
5. **Neon Launch tier in the launch budget.** The plan's cost line still names Neon. If the database moves to af-south-1 (see [06-database.md](06-database.md)), the Neon line goes away for production; Neon may stay on the free plan for staging and dev branches.

## Open questions for the owner

1. Do you agree to Vercel Pro at R340 a month (plus R340 per extra person who deploys)?
2. Can you confirm in the Vercel dashboard whether the two crons are listed? If not, auto-submit has never run on schedule.
3. Who else needs deploy rights? Viewers are free.
4. Is there any reason (a customer contract, a tender, data residency wording) that needs hosting on Azure or AWS directly?
5. May we read a month of real usage from the Vercel Usage page after the switch, to replace the guesses above?

## Sources

- https://vercel.com/pricing (checked 2026-11-16)
- https://vercel.com/docs/plans/pro-plan (checked 2026-11-16)
- https://vercel.com/docs/plans/hobby (checked 2026-11-16)
- https://vercel.com/legal/terms (checked 2026-11-16)
- https://vercel.com/docs/functions/usage-and-pricing (checked 2026-11-16)
- https://vercel.com/docs/pricing/regional-pricing/cpt1 (checked 2026-11-16)
- https://vercel.com/docs/vercel-blob/usage-and-pricing (checked 2026-11-16)
- https://vercel.com/docs/cron-jobs/usage-and-pricing (checked 2026-11-16)
- https://vercel.com/docs/regions (checked 2026-11-16)
- https://vercel.com/docs/functions/configuring-functions/region (checked 2026-11-16)
- https://vercel.com/docs/limits/fair-use-guidelines (checked 2026-11-16)
- https://www.cloudping.co/api/latencies?percentile=p_50&timeframe=1Y (checked 2026-11-16)
- https://learn.microsoft.com/en-us/azure/networking/azure-network-latency (checked 2026-11-16)
- https://prices.azure.com/api/retail/prices (queried for southafricanorth App Service, Container Apps, Static Web Apps; checked 2026-11-16)
- https://azure.microsoft.com/en-us/pricing/details/container-apps/ (checked 2026-11-16)
- https://docs.aws.amazon.com/general/latest/gr/amplify.html (checked 2026-11-16)
- https://docs.aws.amazon.com/general/latest/gr/apprunner.html (checked 2026-11-16)
- https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html (checked 2026-11-16)
- AWS Price List API (`aws pricing get-products`, region af-south-1: AmazonECS, AWSELB, AmazonVPC, AWSLambda, AWSDataTransfer) (checked 2026-11-16)
- https://www.cloudflare.com/network/ (checked 2026-11-16)
- https://developers.cloudflare.com/workers/platform/pricing/ (checked 2026-11-16)
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ (checked 2026-11-16)
- https://docs.fly.io/reference/regions (checked 2026-11-16)
- https://docs.fly.io/about/pricing (checked 2026-11-16)
- https://render.com/docs/regions (checked 2026-11-16)
- https://upstash.com/pricing/qstash (checked 2026-11-16)
- https://upstash.com/docs/qstash/howto/multi-region (checked 2026-11-16)
- https://www.inngest.com/pricing (checked 2026-11-16)
- https://sentry.io/pricing/ (checked 2026-11-16)
- https://docs.railway.com/reference/deployment-regions (checked 2026-11-16)
- Vercel CLI read-only: `vercel project inspect`, `vercel ls`, `vercel inspect` (checked 2026-11-16)
