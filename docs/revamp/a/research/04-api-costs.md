# Third-party API costs (Wolfram, Microsoft, AWS Bedrock, Judge0)

**Answer first.** AI marking is cheap enough to bundle into tiers: one essay costs about R0.24 with a top mid-size model (Claude Sonnet 5.5 or gpt-6.1-sol) and about R0.01 with a small model (Claude Haiku 5.5 or gpt-6-luna). Neither AWS Cape Town (af-south-1) nor Azure South Africa North runs these models in-country. Both only offer "Global" routing, so student text is processed outside South Africa. That needs a POPIA check, not a price check. Live lessons through Azure Communication Services cost R8.16 per 1:1 hour (R18.36 with video recording). Teams meetings created through Microsoft Graph have no per-minute charge, but each tutor needs a Teams licence. Wolfram publishes no commercial per-call price. The free tier is non-commercial only, so Nexa must get a quote before it sells step-by-step maths. For code running, start on hosted Judge0 (€27/month, about R505). Move to a self-hosted VM (about R790/month in Cape Town) only when volume passes about 60,000 runs a month.

Currency: USD is converted at **R17.00/USD** (Wise mid-market 16.95 on 2026-11-16, rounded). EUR is converted at **R18.70/EUR** (Wise mid-market 18.67, [wise.com](https://wise.com/gb/currency-converter/eur-to-zar-rate), checked 2026-11-16, rounded). None of the prices below include VAT or payment fees.

## 1. Wolfram|Alpha APIs

| API | What it returns | Free tier | Paid price | Source |
|---|---|---|---|---|
| Full Results API | Full result pods, with podstates (step-by-step uses a podstate) | 2,000 non-commercial calls/month, shared across APIs | Not published ("Standard" pricing is behind a contact form) | [API page](https://products.wolframalpha.com/api) (checked 2026-11-16) |
| Simple API | Image of a result page | Same | Not published | [API page](https://products.wolframalpha.com/api) (checked 2026-11-16) |
| Short Answers API | One short text answer | Same | Not published | [API page](https://products.wolframalpha.com/api) (checked 2026-11-16) |
| LLM API | Text/JSON built for LLM tool use | "free non-commercial development account" | "flexible commercial licensing with low monthly plans" (no figures) | [LLM API docs](https://products.wolframalpha.com/llm-api/documentation) (checked 2026-11-16) |
| Step-by-step ("Show Steps") | Worked solution steps | Not stated | Not published | [Show Steps doc URL](https://products.wolframalpha.com/show-steps-api/documentation) now serves the Full Results API docs (checked 2026-11-16) |

What the official pages say:

- The free tier is "up to 2,000 non-commercial API calls per month". Nexa is commercial, so this tier is only for development. ([API page](https://products.wolframalpha.com/api), checked 2026-11-16)
- Production use falls under "Standard" pricing or a "Custom" plan (startups, high volume, on-premise). Both go through a sales contact. ([API page](https://products.wolframalpha.com/api), checked 2026-11-16)
- Wolfram|Alpha API calls do not use Wolfram Cloud Credits. A subscription includes a set number of calls, and extra calls are sold separately at an unpublished price. ([Cloud credits](https://www.wolfram.com/cloud-credits/), checked 2026-11-16)
- The Wolfram|One Personal plan includes "6,000 Wolfram|Alpha API calls per month". Its licence is "exclusively for nonprofessional, personal use", so Nexa cannot use it. ([Wolfram|One personal](https://www.wolfram.com/wolfram-one/pricing/personal/), checked 2026-11-16)
- I could not find step-by-step pricing on any official page. **Unverified:** step-by-step may need a commercial agreement beyond the standard plan.

API terms that affect Nexa ([API Terms of Use](https://products.wolframalpha.com/api/termsofuse), checked 2026-11-16):

| Term | Effect on Nexa |
|---|---|
| Caching of Wolfram|Alpha content is prohibited unless a written agreement allows it | We cannot store a worked solution once and show it to many students. Each view may count as a call. Negotiate caching. |
| No "sell, lease, lend, convey, redistribute or sublicense" without written permission | A pass-through add-on ("Wolfram steps, R x per query") needs Wolfram's written approval |
| Attribution: a link to the specific Wolfram|Alpha result page | The UI must show a "Powered by Wolfram|Alpha" link per result |
| Results are "not a certified or definitive source" (a disclaimer is required) | Add this to our terms |
| No use of the services to train or fine-tune AI models | Do not log Wolfram output into any training set |

**Guess:** for planning, use **US$0.03 (R0.51) per step-by-step call** until Wolfram sends a quote. This number has no source. Replace it with the quote.

## 2. Microsoft

### 2.1 Azure OpenAI in South Africa North

Deployment types in `southafricanorth` ([region availability](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability), checked 2026-11-16):

| Deployment type | Chat models in South Africa North | Where prompts are processed |
|---|---|---|
| Global Standard | gpt-4.1 / -mini / -nano, gpt-4o, gpt-4o-mini, gpt-5 family, gpt-5.4 / -mini / -nano, gpt-5.5, gpt-5.6, gpt-6 family, gpt-6.1-sol / -terra, o3, o4-mini | Any Azure region worldwide |
| Data Zone Standard | "Not available" for Middle East & Africa | n/a |
| Standard (regional) | Chat models: none. Only text-embedding-3-large and ada-002 | In region |

So a GPT chat call from South Africa North is processed globally. The only in-country option is embeddings.

Global Standard prices for South Africa North, from the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (filter `armRegionName eq 'southafricanorth'`, checked 2026-11-16):

| Model | Input US$ / 1M tokens | Output US$ / 1M tokens | Input R / 1M | Output R / 1M |
|---|---|---|---|---|
| gpt-6.1-sol (short context) | 2.00 | 10.00 | 34.00 | 170.00 |
| gpt-6.1-terra (short context) | 1.00 | 5.00 | 17.00 | 85.00 |
| gpt-6-luna (short context) | 0.10 | 0.50 | 1.70 | 8.50 |
| gpt-5.5 (short context) | 5.00 | 30.00 | 85.00 | 510.00 |
| gpt-5.4 | 2.50 | 15.00 | 42.50 | 255.00 |
| gpt-5.4-mini | 0.75 | 4.50 | 12.75 | 76.50 |
| gpt-5.4-nano | 0.20 | 1.25 | 3.40 | 21.25 |
| gpt-5-mini | 0.25 | 2.00 | 4.25 | 34.00 |
| gpt-4.1 | 2.00 | 8.00 | 34.00 | 136.00 |
| gpt-4.1-mini | 0.40 | 1.60 | 6.80 | 27.20 |
| gpt-4.1-nano | 0.10 | 0.40 | 1.70 | 6.80 |
| gpt-4o (2024-11-20) | 2.50 | 10.00 | 42.50 | 170.00 |
| gpt-4o-mini | 0.15 | 0.60 | 2.55 | 10.20 |

Notes:
- Cached input is usually 10% of the input price, for example gpt-4.1-mini cached input is US$0.10/1M and gpt-5.4-mini is US$0.075/1M ([Retail Prices API](https://prices.azure.com/api/retail/prices), checked 2026-11-16). A fixed rubric and system prompt can be cached.
- The API also lists "regional" meters for gpt-4o in South Africa North (US$3.025 / US$12.10 per 1M for 2024-11-20). The region availability page does not list regional gpt-4o deployment there. **Unverified:** whether a regional gpt-4o deployment can actually be created in South Africa North.
- Reasoning models (gpt-5.x, o-series) bill hidden reasoning tokens as output. Set a low reasoning effort for marking, or the output cost can grow 2-5x. **Guess:** the 2-5x range is from experience, not a source.

### 2.2 Microsoft Graph

- Since 25 August 2025 the Teams APIs are no longer metered. The only metered Graph API left is SharePoint/OneDrive `assignSensitivityLabel` at US$0.00185 per call. ([Metered APIs](https://learn.microsoft.com/en-us/graph/metered-api-list), checked 2026-11-16)
- Nexa's uses (calendar, onlineMeetings, mail) are therefore **free per call**. Normal Graph throttling limits still apply.

### 2.3 Online lessons: Teams via Graph versus Azure Communication Services (ACS)

| Option | Per-minute cost | Fixed cost | Source |
|---|---|---|---|
| Teams meeting created via Graph `onlineMeetings` | US$0 (Teams APIs not metered) | Organiser needs a Teams licence in a Microsoft 365 work tenant. App-only creation needs an admin "application access policy" per user | [Metered APIs](https://learn.microsoft.com/en-us/graph/metered-api-list), [Create onlineMeeting](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings) (checked 2026-11-16) |
| ACS voice/video/screen share (group or 1:1) | US$0.004 per participant per minute | None | [ACS pricing](https://learn.microsoft.com/en-us/azure/communication-services/concepts/pricing) (checked 2026-11-16) |
| ACS call recording, mixed audio+video | US$0.01 per minute | None | same |
| ACS call recording, mixed audio | US$0.002 per minute | None | same |
| ACS chat | US$0.0008 per message | None | same |
| ACS user joining a Teams meeting | ACS user billed at ACS rates. Teams users "free" | Teams licence for the Teams side | [ACS pricing page](https://azure.microsoft.com/en-us/pricing/details/communication-services/) (checked 2026-11-16) |

- ACS does not charge for data egress, and calls are billed to the millisecond ([ACS pricing](https://learn.microsoft.com/en-us/azure/communication-services/concepts/pricing), checked 2026-11-16).
- The Microsoft Learn page says its figures are "for illustrative purposes and may not reflect the latest Azure pricing". The Azure pricing page did not show figures to our fetcher, and the Retail Prices API returned no ACS meters. **Unverified:** that US$0.004 is still current. Check it in the Azure pricing calculator before launch.
- **Unverified:** the ZAR price of a Teams Essentials or Microsoft 365 Business Basic seat. The Microsoft store pages timed out on 2026-11-16.

## 3. AWS Bedrock

### 3.1 What runs in af-south-1 (Cape Town)

Bedrock is reachable from af-south-1, but **only through Global cross-Region inference** for Anthropic models. In-Region and Geo routing are marked not supported for Claude Haiku 5.5, Opus 5.5, Opus 5, Sonnet 5, Fable 5.x and Mythos 5.x ([Regional availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html), checked 2026-11-16). That page is very long, and I read only the af-south-1 rows I could reach.

The AWS Price List API (`aws pricing get-products --service-code AmazonBedrockFoundationModels` / `AmazonBedrock`, region filter `af-south-1`, run 2026-11-16) confirms this. Every Claude meter in af-south-1 is a `_global` meter. Models with af-south-1 meters:

| Family | Models with af-south-1 prices | Routing |
|---|---|---|
| Anthropic | Haiku 4.5, Haiku 5.5, Sonnet 4.5, 4.6, 5, 5.5, Opus 4.5 to 5.5, Fable 5 to 5.2, Mythos 5.1 and 5.2 | Global only |
| Amazon Nova | Nova 2.0 Omni only | Global (`cross-region-global`) |
| Meta Llama | None | Not offered from af-south-1 |
| Others | OpenAI GPT-5.6 / 6 / 6.1 family, xAI Grok 4.6 / 4.7, Kimi K3, TwelveLabs Pegasus | Mostly global or "mantle" |

There is no Africa "Geo" profile. With Global inference, a request from Cape Town can be served in any commercial region. Price-wise this is good: global is about 10% cheaper than in-Region in us-east-1 and eu-west-1 (Sonnet 5.5: US$2.00 global versus US$2.20 in-Region input). Data-residency-wise it means student work leaves South Africa.

### 3.2 Prices per 1M tokens

Claude in af-south-1 (Global), from the Price List API (checked 2026-11-16):

| Model | Input US$ / 1M | Output US$ / 1M | Cache read US$ / 1M | Input R / 1M | Output R / 1M |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 0.10 | 0.50 | 0.01 | 1.70 | 8.50 |
| Claude Sonnet 5.5 | 2.00 | 10.00 | 0.10 | 34.00 | 170.00 |
| Claude Opus 5.5 | 4.00 | 20.00 | 0.20 | 68.00 | 340.00 |
| Claude Sonnet 4.6 | 3.00 | 15.00 | 0.30 | 51.00 | 255.00 |
| Claude Haiku 4.5 | 1.00 | 5.00 | 0.10 | 17.00 | 85.00 |

- Haiku 5.5 also has a long-context rate of US$0.50 / US$2.50 per 1M. Batch inference is 50% off where listed (for example Sonnet 4.6 batch is US$1.50 / US$7.50).
- In us-east-1 and eu-west-1, in-Region (not global) Claude 5.5 costs 10% more: Haiku 5.5 is US$0.11 / US$0.55 and Sonnet 5.5 is US$2.20 / US$11.00 (Price List API, checked 2026-11-16).

Nova and Llama (not in af-south-1; us-east-1 prices from the Price List API, `AmazonBedrock`, checked 2026-11-16):

| Model | Region / routing | Input US$ / 1M | Output US$ / 1M |
|---|---|---|---|
| Nova Micro | us-east-1 in-Region | 0.035 | 0.14 |
| Nova Lite | us-east-1 in-Region | 0.06 | 0.24 |
| Nova Pro | us-east-1 in-Region | 0.80 | 3.20 |
| Nova 2.0 Lite | us-east-1 global | 0.30 | 2.50 |
| Nova 2.0 Omni (text) | af-south-1 global | 0.30 | 2.80 |
| Llama 4 Scout 17B | us-east-1 | 0.17 | 0.66 |
| Llama 4 Maverick 17B | us-east-1 | 0.24 | 0.97 |
| Llama 3.3 70B | us-east-1 | 0.72 | 0.72 |

### 3.3 Azure OpenAI versus Bedrock

| Need | Best value | Why |
|---|---|---|
| Cheap marking of short answers | Claude Haiku 5.5 (Bedrock) or gpt-6-luna (Azure), both US$0.10 / US$0.50 | Same price. Pick by quality on our own rubric tests. |
| Essay marking with feedback | Claude Sonnet 5.5 (Bedrock) or gpt-6.1-sol (Azure), both US$2 / US$10 | Same price. Pick by quality. |
| In-country processing | Neither | Both are global-only from South Africa |

## 4. Judge0 (running student code)

### 4.1 Hosted

Plans on [judge0.com](https://judge0.com/) (checked 2026-11-16). The "Sign up" buttons go to RapidAPI.

| Plan | €/month | R/month | Submissions/day | Overage | Effective € per run at full use |
|---|---|---|---|---|---|
| Pro | 27 | 505 | 2,000 | €0.001 | 0.00045 |
| Ultra | 54 | 1,010 | 5,000 | €0.001 | 0.00036 |
| Mega | 107 | 2,001 | 10,000 | €0.001 | 0.00036 |

- The judge0.com page also has Self-hosted, Shared Cloud, Dedicated Cloud, Volume-based and Pay-per-use tabs without figures. The page does not mention "Sulu". **Unverified:** the Sulu plan and the RapidAPI free "Basic" quota. RapidAPI pages did not load.
- Judge0 counts **one submission per program run**. A coding question with 5 test cases is 5 submissions unless the tests run inside one program.
- **Unverified:** hosting region. If it is outside Africa, add about 150-300 ms latency per run (**Guess**).

### 4.2 Self-hosted

Requirements ([Judge0 CHANGELOG, v1.13.1](https://github.com/judge0/judge0/blob/master/CHANGELOG.md), checked 2026-11-16):
- Linux only. Ubuntu 22.04 recommended.
- Docker and Docker Compose.
- GRUB change `systemd.unified_cgroup_hierarchy=0`, which means cgroup v1. Use a full VM, not containers-as-a-service (ECS Fargate, Azure Container Apps), because those do not let us change the kernel boot settings.
- No CPU/RAM figures are published. 2 vCPU / 4 GB is our **Guess** for low volume.
- **Guess:** use x86 only (not Graviton/Arm). The official compiler image is built for amd64.

Monthly cost, 730 hours, on-demand Linux:

| Item | AWS af-south-1 | Azure South Africa North |
|---|---|---|
| VM (2 vCPU / 4 GB) | t3.medium US$0.0542/h = US$39.57 | B2s US$0.0542/h = US$39.57 (B2ls v2 US$0.0543/h) |
| Disk | gp3 30 GB x US$0.1047 = US$3.14 | E4 Standard SSD 32 GB = US$3.50 |
| Public IPv4 | US$0.005/h = US$3.65 | Standard static IP US$0.005/h = US$3.65 |
| **Total US$/month** | **46.36** | **46.72** |
| **Total R/month** | **788** | **794** |

Sources: AWS Price List API (`AmazonEC2`, `AmazonVPC`, af-south-1) and the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (`southafricanorth`), both checked 2026-11-16.

The plan's self-host target is about 4 vCPU. 4 vCPU options, 730 hours, on-demand Linux, with the same disk and IP as above (AWS +US$6.79, Azure +US$7.15):

| Option | vCPU / RAM | US$/hour (VM) | US$/month total | R/month total |
|---|---|---|---|---|
| AWS af-south-1 c6i.xlarge (compute-optimised, not burstable) | 4 / 8 GiB | 0.228 | 173.23 | 2,945 |
| AWS af-south-1 t3.xlarge (burstable) | 4 / 16 GiB | 0.217 | 165.20 | 2,808 |
| Azure SA North F4s v2 (compute-optimised, not burstable) | 4 / 8 GB | 0.228 | 173.59 | 2,951 |
| Azure SA North B4ls v2 (burstable) | 4 / 8 GB | 0.192 | 147.31 | 2,504 |
| Azure SA North D4as v5 | 4 / 16 GB | 0.229 | 174.32 | 2,963 |

Sources: AWS Price List API (`AmazonEC2`, af-south-1) and the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (`southafricanorth`), both checked 2026-11-16. For exam bursts, pick c6i.xlarge or F4s v2, because burstable VMs throttle once their CPU credits run out.

Throughput (**Guess**): the plan's per-test limit is 2 s CPU. In the worst case, where every test uses its full 2 s, 4 vCPU runs about 2 tests per second, or 7,200 per hour. Typical tests finish in under 0.2 s, so real capacity is closer to 10x that.

- t3 and B-series are burstable. Under constant heavy load, t3 "unlimited" mode can add CPU-credit charges. **Unverified:** the credit price in af-south-1.
- A 1-year reservation or savings plan would cut the VM line by about 30-40% (**Guess**, not priced here).
- Break-even against hosted Pro overage (€0.001 = R0.0187 per run): R788 / R0.0187 = about **42,000 runs/month**. Hosted Pro already includes 60,000 runs/month for R505. So self-hosting pays off only above about 60,000 runs/month, or when we need data to stay in South Africa.

## 5. Per-unit cost for Nexa uses

Token assumptions (**Guess**, based on typical lengths; measure them in the pilot):

| Use | Input tokens | Output tokens | Made of |
|---|---|---|---|
| Essay (~800 words) | 3,000 | 800 | System prompt + rubric 1,500, question + memo 400, essay about 1,100. Output: marks per criterion + feedback |
| Short answer | 1,000 | 200 | Prompt + memo 800, answer 200. Output: mark + one-line reason |

Raw model cost per item (prices from sections 2.1 and 3.2):

| Model | Essay US$ | Essay R | Short answer US$ | Short answer R |
|---|---|---|---|---|
| Claude Haiku 5.5 (Bedrock global) | 0.00070 | 0.0119 | 0.00020 | 0.0034 |
| gpt-6-luna (Azure global) | 0.00070 | 0.0119 | 0.00020 | 0.0034 |
| gpt-4o-mini (Azure global) | 0.00093 | 0.0158 | 0.00027 | 0.0046 |
| Llama 4 Maverick (Bedrock us-east-1) | 0.00150 | 0.0254 | 0.00043 | 0.0074 |
| gpt-4.1-mini (Azure global) | 0.00248 | 0.0422 | 0.00072 | 0.0122 |
| Nova 2.0 Lite (Bedrock global) | 0.00290 | 0.0493 | 0.00080 | 0.0136 |
| gpt-5.4-mini (Azure global) | 0.00585 | 0.0994 | 0.00165 | 0.0280 |
| gpt-4.1 (Azure global) | 0.01240 | 0.2108 | 0.00360 | 0.0612 |
| Claude Sonnet 5.5 / gpt-6.1-sol | 0.01400 | 0.2380 | 0.00400 | 0.0680 |
| Claude Opus 5.5 (Bedrock global) | 0.02800 | 0.4760 | 0.00800 | 0.1360 |

Other units:

| Use | Calculation | Cost R |
|---|---|---|
| One Wolfram step-by-step query | **Guess** US$0.03 x 1.2 (re-asks) | 0.61 |
| One code submission, 5 test cases, hosted Judge0 overage | 5 x €0.001 x 18.70 | 0.094 |
| One code submission, 5 test cases, self-hosted, 20,000 runs/month | R788 / 20,000 x 5 | 0.197 |
| One hour 1:1 lesson, ACS, no recording | 2 x 60 min x US$0.004 x 17 | 8.16 |
| One hour 1:1 lesson, ACS + mixed video recording | (0.48 + 60 x 0.01) x 17 | 18.36 |
| One hour 1:1 lesson, Teams via Graph | US$0 per minute (licence is a fixed cost per tutor) | 0.00 marginal |

## 6. Cost per unit to suggested price with margin

Formula: **price = cost / (1 - margin)**, where margin is gross margin on the selling price. "Cost" here is the planning cost: the raw cost x 1.5 for AI marking (retries, a second moderation pass) and x 1.2 for Wolfram. Prices exclude VAT and payment fees. Change `margin` to taste.

| Unit | Cost R | Price R at 20% | Price R at 30% | Price R at 50% |
|---|---|---|---|---|
| AI-mark one essay, Sonnet 5.5 / gpt-6.1-sol | 0.357 | 0.45 | 0.51 | 0.71 |
| AI-mark one essay, Haiku 5.5 / gpt-6-luna | 0.018 | 0.022 | 0.026 | 0.036 |
| AI-mark one short answer, Sonnet 5.5 | 0.102 | 0.13 | 0.15 | 0.20 |
| AI-mark one short answer, Haiku 5.5 | 0.005 | 0.006 | 0.007 | 0.010 |
| One Wolfram step-by-step query (**Guess** cost) | 0.612 | 0.77 | 0.87 | 1.22 |
| One code submission (5 runs), hosted Judge0 | 0.094 | 0.12 | 0.13 | 0.19 |
| One code submission (5 runs), self-hosted, 20k runs/month | 0.197 | 0.25 | 0.28 | 0.39 |
| One hour 1:1 lesson, ACS, no recording | 8.16 | 10.20 | 11.66 | 16.32 |
| One hour 1:1 lesson, ACS + recording | 18.36 | 22.95 | 26.23 | 36.72 |

What this means for tiers (**Guess**, for the pricing owner): one student who sends 20 essays and 200 short answers a month on Sonnet-class marking costs about R7 + R20 = R27 at planning cost. On Haiku-class marking it is under R1.50. AI marking fits inside a per-student fee. Wolfram and live video are better sold as metered add-ons.

Note: the plan's "cost plus a margin (placeholder 20%)" reads as a markup, so price = cost x 1.2. The table above uses gross margin, where 20% gives cost x 1.25. At 20%, a markup gives a gross margin of 16.7%. Pick one definition and use it everywhere.

## 7. Plan add-ons: unit costs

| Add-on (plan unit) | What it costs Nexa | Cost R per unit | Price R at 20% markup (plan) |
|---|---|---|---|
| Extra code-runner capacity, per hour | One extra 4 vCPU Judge0 worker on demand: c6i.xlarge US$0.228 + IP US$0.005 + disk about US$0.004 per hour (Azure F4s v2 is the same) | 4.03 | 4.84 |
| Hosted live-session room, per hour | ACS US$0.004 per participant-minute = R4.08 per participant-hour | 1:1: 8.16. 1 tutor + 5: 24.48. 1 tutor + 10: 44.88. Add 10.20 for video recording | 9.79 / 29.38 / 53.86 |
| AI marking credits, per 100 answers | 100 x the planning cost from section 6 | Short answers, Haiku 5.5: 0.51. Short answers, Sonnet 5.5: 10.20. Essays, Haiku 5.5: 1.79. Essays, Sonnet 5.5: 35.70 | 0.61 / 12.24 / 2.15 / 42.84 |

- **Code runner:** the hourly VM price excludes boot and setup time, roughly 5-10 minutes per start (**Guess**). Bill a 1-hour minimum. Alternative: hosted Judge0 overage at €0.001 per test run (R0.0187) needs no VM at all.
- **Live room:** price it per participant-hour (R4.08 cost), not as a flat room fee. A flat fee would lose money on large groups.
- **AI credits:** sell separate "short answer" and "essay" packs, or price the essay pack. One flat "per 100 answers" price at Sonnet-class cost ranges from R10 to R36.

## 8. Plan trial caps: cost per trial workspace

The plan's trial caps (placeholder) are 20 students, 200 code runs and 100 AI marks.

| Item | Low case | Cost R | High case | Cost R |
|---|---|---|---|---|
| 200 code runs | 1 Judge0 run each, hosted overage | 3.74 | 5 test runs each (1,000 runs), hosted overage | 18.70 |
| 100 AI marks | Short answers, Haiku 5.5 | 0.51 | Essays, Sonnet 5.5 | 35.70 |
| **Total per trial** | | **4.25** | | **54.40** |

Inside the hosted Judge0 Pro daily quota (2,000 runs a day), the code-run cost is R0 marginal. The table excludes fixed costs: the Judge0 plan or VM, hosting, and email. Even at 100 trials a month, the high case is about R5,440.

## 9. Against the plan

1. **"A tier price never absorbs metered API cost" versus bundling AI marking.**
   - The plan's rule protects margin: a heavy user cannot make a course loss-making.
   - My finding: Haiku-class marking costs under R1.50 per student per month (section 6). Its pass-through lines would be a few cents, which adds metering work and invoice noise for almost no revenue.
   - The plan already implies an allowance ("AI marking credits ... above the Pro allowance"), so a tier already absorbs some AI cost.
   - Trade-off: bundle a fair-use allowance of small-model marking into the tier (simple, cheap, small risk). Keep pass-through for Sonnet-class essay marking, Wolfram, live video and code-runner bursts, where cost per unit is real and usage varies a lot.
2. **20% margin.**
   - 20% is fine as a markup on metered usage.
   - It does not cover fixed costs that do not scale per call: a self-hosted Judge0 VM (R2,945/month for 4 vCPU), any Wolfram commercial minimum (**Unverified**), and Teams licences.
   - Recover fixed costs through tier prices or a minimum monthly add-on charge, not through the 20%.
3. **Self-host Judge0 on 4 vCPU "once runs are steady".**
   - A 4 vCPU VM costs about R2,945/month in Cape Town.
   - Hosted Judge0 Mega is €107 (R2,001) for 10,000 runs a day, about 300,000 a month.
   - Self-hosting only wins on cost above about 300,000 runs a month, or when data must stay in South Africa (hosted region **Unverified**).
   - Use a 2 vCPU VM (R788) for steady load, and add 4 vCPU workers per hour for exam windows (R4.03/hour).
4. **Data residency (unchanged, and the biggest risk).**
   - The plan lists Azure OpenAI and Bedrock as AI providers.
   - From South Africa, both run chat models only through global routing. Student answers leave the country.
   - This needs a POPIA decision and consent wording before AI marking ships.

## Open questions for the owner

1. Is it acceptable under POPIA (and with school or parent consent) to send student work to global AI routing outside South Africa? No Claude or GPT chat model runs in-country on AWS or Azure today.
2. Can we ask Wolfram for a commercial quote covering step-by-step, caching rights and pass-through billing? Without it, the Wolfram add-on is blocked.
3. Is AI marking quality, not price, the deciding factor? If so, we should run a 50-essay blind test of Haiku 5.5 versus Sonnet 5.5 against tutor marks.
4. Will tutors already have Microsoft 365 / Teams licences (then use Graph meetings), or should Nexa embed ACS video and pay per minute?
5. Should lessons be recorded by default? Recording more than doubles the per-hour cost (R8.16 to R18.36).
6. Is hosted Judge0 (EU-based, **Unverified**) acceptable for latency and data, or do coding courses need a Cape Town VM from day one?

## Sources

- Wolfram|Alpha API products: https://products.wolframalpha.com/api (checked 2026-11-16)
- Wolfram|Alpha LLM API docs: https://products.wolframalpha.com/llm-api/documentation (checked 2026-11-16)
- Wolfram|Alpha Show Steps docs (serves Full Results docs): https://products.wolframalpha.com/show-steps-api/documentation (checked 2026-11-16)
- Wolfram|Alpha API Terms of Use: https://products.wolframalpha.com/api/termsofuse (checked 2026-11-16)
- Wolfram Cloud Credits: https://www.wolfram.com/cloud-credits/ (checked 2026-11-16)
- Wolfram|One personal plan: https://www.wolfram.com/wolfram-one/pricing/personal/ (checked 2026-11-16)
- Azure Retail Prices API (Azure OpenAI, VMs, disks, IPs; `southafricanorth`): https://prices.azure.com/api/retail/prices (checked 2026-11-16)
- Foundry Models sold by Azure: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure (checked 2026-11-16)
- Foundry region availability: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability (checked 2026-11-16)
- Microsoft Graph metered APIs: https://learn.microsoft.com/en-us/graph/metered-api-list (checked 2026-11-16)
- Graph Create onlineMeeting: https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings (checked 2026-11-16)
- ACS pricing scenarios: https://learn.microsoft.com/en-us/azure/communication-services/concepts/pricing (checked 2026-11-16)
- ACS pricing page: https://azure.microsoft.com/en-us/pricing/details/communication-services/ (checked 2026-11-16)
- Bedrock regional availability: https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html (checked 2026-11-16)
- AWS Price List API, read-only `aws pricing get-products --region us-east-1` for AmazonBedrock, AmazonBedrockFoundationModels, AmazonEC2, AmazonVPC (af-south-1, us-east-1, eu-west-1) (checked 2026-11-16)
- Judge0 plans: https://judge0.com/ (checked 2026-11-16)
- Judge0 deployment requirements: https://github.com/judge0/judge0/blob/master/CHANGELOG.md (checked 2026-11-16)
- Wise EUR/ZAR: https://wise.com/gb/currency-converter/eur-to-zar-rate (checked 2026-11-16)
