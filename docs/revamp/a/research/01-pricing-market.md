# Pricing and market

**Answer first.** Raise the plan's tier placeholders to **Core R29, Plus R49, Pro R89** per active student per subject per month (excl. VAT). That is still only 2-6% of what a South African parent pays a tutor for one hour a week of one subject (R1,430/month at the R330/hour national average). Keep the plan's **trial** (14 days, no card, every Pro service on, capped), because the caps hold its worst-case API cost under about R40. Keep the plan's **API margin of 20%**, defined as gross margin (price = cost ÷ 0.8, which is a 25% markup). Keep the plan's **commission model: 2% to Nexa, card fees separate and borne by the tutor**. A 5% all-in model was tested; it earns Nexa less once Paystack's VAT-inclusive fee is counted. The five add-ons are priced from topic 4 and 5 unit costs in section 6.

Currency: USD is converted at **R17.00/USD** (Wise mid-market R16.95 on 2026-11-16, rounded). Nexa prices exclude VAT; Nexa adds 15% VAT only once registered (compulsory above R2.3 million of taxable supplies, see [09-compliance.md](09-compliance.md)).

## 1. Against the plan

The plan of record ("Pricing and payment gates (revision 2)") marks every rand amount as a placeholder. This table sets each placeholder against this research.

| Item | Plan placeholder | Recommendation | Why |
| --- | --- | --- | --- |
| Core, per active student per subject per month | R15 | **R29** | The plan's Core is larger than a basic LMS. It also includes invoicing and fee collection, the parent portal, messaging and digests, which tutor-admin tools sell on their own (Teach 'n Go R13-R19 per student, not per subject). R15 is 1.0% of the R1,430 anchor; R29 is 2.0%. Infra is not the constraint (topic 5: hosting under R0.50 per active student at 1,000 students), so this is a value price. |
| Plus | R30 | **R49** | Math input, graphing, question bank, live sessions, analytics, branding. 3.4% of R1,430. |
| Pro | R55 | **R89** | The Pro AI-marking allowance (30 answers per student per month, section 6) costs up to R10.71 per student on Sonnet-class models (topic 4). At R55 that is 19% of the price; at R89 it is 12%. Pro targets matric and coding, where rates are R379-R427/hour. |
| API margin | 20% | **20% gross margin (price = cost ÷ 0.8)** | Same number as my earlier "cost + 25%": a 20% gross margin is a 25% markup. Define it this way in `billing.md` so it matches topic 4's formula. It covers card fees (~3.4% incl. VAT), USD/ZAR movement and retries. |
| Parent commission | 2%, card fees separate | **Keep 2% + card fee borne by the tutor** | See section 7. My earlier 5% all-in left Nexa R46.47 per R2,860 payment after Paystack's VAT-inclusive fee, versus R57.20 under the plan's model. The tutor's take differs by 0.4 points. |
| Commission cap | none | **No cap at launch** | At 2%, the 150-student organisation pays R13,800 commission, below its R17,675 subscription. Revisit if a single invoice exceeds R10,000. |
| Trial | 14 days, no card, every Pro service on, caps 20 students / 200 code runs / 100 AI marks, emails day 10 and 13, read-only day 15 | **Align with the plan**, plus two clarifications | My earlier draft used Plus only, 30 student-subjects and an R100 credit. The plan's caps already bound the cost: 100 AI marks x R0.357 + 200 runs x R0.0187 = **R39.44** worst case (topic 4). Clarify that "20 students" means 20 distinct students across all courses. Add a 25-call cap on Wolfram step checks, since Wolfram has no commercial price yet. |
| Add-on prices | units only | Section 6 | Five prices from topic 4 and 5 unit costs, using the same ÷ 0.8 rule. |

## 2. What South African tutors charge parents

| Source | Rate (ZAR) | Unit | Notes |
| --- | --- | --- | --- |
| Daily Maverick / Teneo analysis of 750 adverts, Jan 2025-Jul 2026 | R330 | per hour, national average | Primary R258, Grade 12 R379, university R389 |
| Same | R427 (max R750) | per hour, matric maths | |
| Same | R370 / R343 / R334 / R255 | per hour | Johannesburg / Cape Town / Pretoria / small towns |
| Same | R2,300 | per month, group, 1 subject, 3 h/week | |
| Same | R3,660 | per month, median individual, 1 subject, 3 h/week | |
| Same | > R6,600 | per month, premium matric specialist | |
| Same | ~R500 charged vs R210 paid to the tutor | per lesson, agency | One tutor's estimate; the agency keeps ~58% |
| Teach Me 2 (agency, national) | R300-R500 | per hour | FAQ on its tutors page |
| CT Tutoring Center (Cape Town) | R200 / R1,000 for 6 / R2,000 for 13 | per 1 h session / package (30 days) | R154-R167/h on packages |
| Cape Town Tutors (via FundiConnect list, 2022) | R300-R400 | per hour | Old figure |
| Kumon South Africa | "from R18 a day" | per day | **Guess:** ~R540/month per subject; fees vary by centre and are not published |

Sources: [Daily Maverick, 25 Sep 2026](https://www.dailymaverick.co.za/article/2026-09-25-r6600-a-month-to-catch-up-inside-sas-costly-private-tutoring-market/), [Teach Me 2](https://www.teachme2.co.za/tutors-south-africa), [CT Tutoring Center](https://sites.google.com/cttutoringcenter.com/2026/services/extra-lessons), [FundiConnect](https://fundiconnect.co.za/tutoring-companies-south-africa), [Kumon SA](https://www.kumon.co.za/) and [helpdesk](https://www.kumon.co.za/helpdesk) (all checked 2026-11-16).

**Unverified:** I found no published prices for Master Maths (403), Tutor Doctor SA, Superprof SA (403) or Tuta-Me (TLS error).

| Pattern | Monthly fee per subject (ZAR) | How derived |
| --- | --- | --- |
| 1 h/week, national average | R1,430 | R330 x 52 / 12 |
| 3 h/week, group | R2,300 | Daily Maverick |
| 3 h/week, median individual | R3,660 | Daily Maverick |

R1,430 is the anchor for a solo tutor and R2,300 for an organisation running groups.

## 3. What comparable platforms charge

| Platform | Plan | Price (USD) | Price (ZAR) | Unit | Gated to paid | Trial |
| --- | --- | --- | --- | --- | --- | --- |
| Google Workspace for Education | Fundamentals | Free | R0 | qualifying institutions | 5 originality reports per class; Meet 100 people | n/a |
| Google Workspace for Education | Education Plus / Teaching and Learning / AI Pro | Contact sales | - | per licence per year | Unlimited originality reports, Meet 1,000, Gemini | **Unverified** price |
| MoodleCloud | Starter / Mini / Small / Medium / Standard | $160 / $260 / $480 / $1,160 / $2,040 | R2,720 / R4,420 / R8,160 / R19,720 / R34,680 | per year (billed in AUD) | 50 / 100 / 200 / 500 / 750 users; 1 / 2.5 / 5 / 20 / 50 GB | 28 days |
| Teachable | Starter / Builder / Growth | $39 / $89 / $189 per month | R663 / R1,513 / R3,213 | per school per month | Starter pays 7.5% per sale; certificates, branding removal on Growth | 7 days (a pop-up said 30) |
| Thinkific | Start / Grow / Expand | $109 / $219 / $499 per month | R1,853 / R3,723 / R8,483 | per site per month | API, bulk enrolment, reporting on Grow; Exams and advanced reporting on Plus only | 30 days |
| Canvas | Institutional | Per-FTE quote | - | per learner | Free-for-Teacher reportedly offline in 2026 | **Unverified** |
| d6 (SA school platform) | Fease finance module | - | R1,620 / R2,700 / R4,320 | per school per month | - | **Unverified** (help page 403; search result only) |
| Edmodo | - | - | - | - | Shut down 22 Sep 2022 | - |
| Seesaw | LMS / Instruction & Insights / AI | Contact sales | - | school licence | AI tools and content library on higher tiers | - |
| ClassDojo | Plus (families pay) | Not listed | - | per family | Enhanced messaging, progress reports, calendar sync | 7 days |
| TutorBird | Single plan | $16.95 + $4.95 per extra tutor | R288 + R84 | per month | Portal, invoicing and payments included | 30 days, no card |
| Teach 'n Go | Standard / Pro, up to 100 students | $79 / $109 | R1,343 / R1,853 | per month | Pro adds card billing and unlimited AI | 14 days, no card |
| Teach 'n Go | Standard / Pro, up to 200 students | $99 / $139 | R1,683 / R2,363 | per month | same | same |

Sources: [Google compare editions](https://edu.google.com/workspace-for-education/editions/compare-editions/), [MoodleCloud plans](https://www.moodlecloud.com/standard-plans/), [Teachable](https://teachable.com/pricing), [Thinkific](https://www.thinkific.com/pricing/), [Seesaw](https://seesaw.com/pricing), [ClassDojo Plus](https://classdojo.com/plus), [TutorBird](https://www.tutorbird.com/pricing/), [Teach 'n Go](https://www.teachngo.com/pricing), [EdSurge on Edmodo](https://edsurge.com/news/2022-08-16-popular-k-12-tool-edmodo-shuts-down) (all checked 2026-11-16). Canvas: [Formswrite](https://formswrite.com/blog/canvas-lms-pricing-plans-and-costs-explained) is one third-party source, not opened (**Unverified**). d6: [help article](https://help.d6.co.za/portal/en/kb/articles/fease-package-comparison) returned 403 (**Unverified**).

| Platform | Effective ZAR per student per month | Assumption |
| --- | --- | --- |
| Teach 'n Go Standard, 100 students | R13.43 | $79 / 100 |
| Teach 'n Go Pro, 100 students | R18.53 | $109 / 100 |
| MoodleCloud Starter, 50 users | R4.53 | $160 / 12 / 50 |
| Thinkific Start, 50 students | R37.06 | $109 / 50 |
| Teachable Builder, 50 students | R30.26 | $89 / 50 |

Nexa sits above admin-only tools and below creator platforms used at small scale, because it bundles LMS, assessments, marking and fee collection.

## 4. Tiered developer platforms as a model

| Platform | Tier | Price (USD) | Price (ZAR) | Lesson for Nexa |
| --- | --- | --- | --- | --- |
| Azure DevOps | Stakeholder | Free | R0 | Parents are free seats |
| Azure DevOps | Basic | First 5 users free, then $6/user/month | R102 | Per-seat base tier |
| Azure DevOps | Basic + Test Plans | $52/user/month | R884 | A premium tier sold per seat, ~8.7x base (Nexa Pro is ~3x Core) |
| Azure Pipelines | Extra parallel job | $40 hosted / $15 self-hosted per month | R680 / R255 | Extra code-runner capacity as an add-on |
| AWS | Free plan | $100 credit, up to $200; ends after 6 months or when credit runs out | R1,700-R3,400 | Trial with hard usage caps, then pay-as-you-go |

Sources: [Azure DevOps pricing](https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/), [AWS Free Tier](https://aws.amazon.com/free/) (checked 2026-11-16).

## 5. Trial length

| Evidence | Finding | Source |
| --- | --- | --- |
| Field experiment, users randomised to 7/14/30 days | 7 days was the best uniform policy, +5.59% subscriptions | [arXiv 2006.13420](https://arxiv.org/abs/2006.13420) (checked 2026-11-16) |
| MadKudu data via Tunguz, 9 companies | Longer trials did not convert better; most reached 50% of conversions by day 14 | [tomtunguz.com](https://www.tomtunguz.com/how-long-free-trial/) (checked 2026-11-16) |
| Customer.io guide | 14 days is the most common mid-market length; time-to-value matters more than length | [customer.io](https://customer.io/learn/product-led-growth/free-trial-length) (checked 2026-11-16) |
| Competitors | Teachable 7, ClassDojo Plus 7, Teach 'n Go 14, MoodleCloud 28, TutorBird 30, Thinkific 30 days | Section 3 sources |

**Recommendation: the plan's 14 days.** A tutor's value cycle is weekly: set a test, students write, the tutor marks, the parent sees results. Seven days gives one cycle; fourteen gives two. Run the plan's 7-versus-14 test once 200+ trials a month make it measurable (**Guess** at the sample size).

| Trial setting | Plan | Recommendation |
| --- | --- | --- |
| Length | 14 days | 14 days |
| Card | None | None |
| Services | Every Pro service | Every Pro service |
| Student cap | 20 | 20 distinct students across all courses |
| Code runs | 200 | 200 (worst-case cost R3.74 on hosted Judge0 overage) |
| AI marks | 100 | 100 (worst-case cost R35.70 on Sonnet-class essays) |
| Wolfram step checks | - | 25 (**Guess** cost R15.30 at R0.612 each) |
| Emails | Day 10 and 13 | Same |
| Day 15 | Read-only for tutors; learners keep read access | Same |

## 6. Recommended prices

### Tiers

| Tier | ZAR per active student per subject per month (excl. VAT) | What puts a course on it |
| --- | --- | --- |
| Core | R29 | Basic services only |
| Plus | R49 | At least one Plus service on |
| Pro | R89 | At least one Pro service on; includes 30 AI-marked answers per active student per month, pooled per course (**Guess**) |

As a share of the parent's fee for one subject:

| Parent fee per subject per month | Plan R15 | Plan R30 | Plan R55 | Core R29 | Plus R49 | Pro R89 |
| --- | --- | --- | --- | --- | --- | --- |
| R1,430 (1 h/week) | 1.0% | 2.1% | 3.8% | 2.0% | 3.4% | 6.2% |
| R2,300 (group) | 0.7% | 1.3% | 2.4% | 1.3% | 2.1% | 3.9% |
| R3,660 (individual, 3 h/week) | 0.4% | 0.8% | 1.5% | 0.8% | 1.3% | 2.4% |

### Add-ons (the plan's five units)

Rule: price = unit cost ÷ 0.8, rounded up. Unit costs come from [04-api-costs.md](04-api-costs.md) and [05-hosting.md](05-hosting.md).

| Add-on | Unit | Unit cost (ZAR) | Price (ZAR, excl. VAT) | Basis |
| --- | --- | --- | --- | --- |
| Exam or competition day pass | per course per day | ~R5-R10 of usage (**Guess**) | **R99**, up to 30 active students; R3 per extra student | **Guess:** a value price. Includes 5 AI marks and 20 code runs per student for the day; more is billed as credits. About 10 day passes equal one month of Plus→Pro for 25-30 students, which pushes regular users to upgrade. |
| Extra code-runner capacity | per runner-hour, minimum 2 hours | R1.08 (2 vCPU / 4 GB VM in af-south-1: R0.92/h compute + R0.085/h IP + R0.07/h disk) | **R29** | Topic 4 VM price. The ÷ 0.8 rule gives R1.35; the rest is a **Guess** for boot-ahead time and someone watching the exam window. |
| Hosted live-session room | per participant-hour | R4.08 (ACS $0.004 per participant-minute) | **R5.50**, minimum R11 per session; recording +R13 per hour | Topic 4 ACS rates (**Unverified** there that $0.004 is current). Recording cost R10.20/h ÷ 0.8 = R12.75. A 1:1 hour costs R11; a 10-person hour R55. |
| AI marking credits | per 100 answers | R35.70 (100 essays on Sonnet-class, planning cost) | **R45** | Topic 4: R0.357 per essay incl. retries; ÷ 0.8 = R44.63. Short answers count as answers too, so this overprices short answers (cost R10.20 per 100). |
| Extra storage | per GB per month | R5.20 (Blob in cpt1: R0.46 storage + R4.74 for 3 downloads per GB, **Guess**) | **R7** | Topic 5 cpt1 Blob prices. Allowance before this applies: 1 GB per workspace + 100 MB per active student (**Guess**). |

### Third-party API pass-through

Price = cost ÷ 0.8 on its own invoice line (the plan's 20% margin). For reference, OpenRouter charges a 5.5% fee on credit purchases and no markup on tokens ([openrouter.ai/pricing](https://openrouter.ai/pricing), checked 2026-11-16). Nexa needs more margin: it carries card fees (3.335% + R1.15 incl. VAT, topic 3), USD/ZAR movement and retries.

## 7. Parent payments: two commission models

Paystack's card fee is **2.9% + R1 excluding VAT** ([03-payment-providers.md](03-payment-providers.md), from [Paystack pricing](https://support.paystack.com/en/articles/2130306), checked 2026-11-16). Nexa is not VAT-registered yet, so it cannot reclaim the VAT and the real cost is **3.335% + R1.15**. EFT is 2% + VAT (2.3%). Paystack lets the split choose who bears the fee.

| Model | Nexa takes | Who pays the card fee | On a R2,860 card payment: tutor gets | Nexa keeps | Tutor's share |
| --- | --- | --- | --- | --- | --- |
| **P (plan): 2% + card fee separate** | 2% = R57.20 | Tutor (Paystack bearer = subaccount) | 2,860 - 57.20 - 96.53 = **R2,706.27** | **R57.20** | 94.6% |
| A (earlier draft): 5% all-in | 5% = R143.00 | Nexa, out of its 5% | 2,860 - 143.00 = **R2,717.00** | 143.00 - 96.53 = **R46.47** | 95.0% |

**Recommendation: model P.** The tutor's take is within 0.4 points either way. Under model A, Nexa's margin falls on small payments (the R1.15 fixed fee) and international cards (3.1% + R1), and goes negative on payments below about R70. Model P gives Nexa a clean 2%. Fees are shown to the tutor as a separate line, and EFT payments are cheaper for the tutor. Off-site payments (cash or direct EFT marked by hand) carry 0%.

Market check: an SA agency keeps ~58% (Daily Maverick); Preply takes 18-33% and 100% of the trial lesson ([Preply help](https://help.preply.com/en/articles/4171383-preply-commission-model), checked 2026-11-16); Teachable Starter takes 7.5% plus processing ([Teachable](https://teachable.com/pricing)); Thinkific Payments takes 2.9% ([Thinkific](https://www.thinkific.com/pricing/)) (both checked 2026-11-16). Nexa does not find the students, so a software rate (2%) fits, not a marketplace rate.

**Commission cap.** No cap at launch. At 2% the organisation below pays R13,800 commission, which is less than its subscription. A per-invoice cap (for example R200) would only matter for invoices over R10,000.

## 8. Worked monthly bills

Formula (plan): **bill = Σ over courses (active students x the course's tier price) + add-ons + API pass-through - discounts, + 15% VAT once registered.** An active student is enrolled in the course at any point in the month. Card fee on the bill Nexa collects: 3.335% + R1.15.

### (a) Solo tutor: 12 students, 2 subjects

Assumptions: Maths (12 students) and Physical Sciences (12) both on Plus (math input, graphing). One exam day pass on Maths. R40 of Wolfram cost. No discount. Each parent pays R1,430 per subject (R2,860 per child) by card through Nexa, once a month.

| Bill line | Qty | Unit (ZAR) | Amount (ZAR) |
| --- | --- | --- | --- |
| Maths, Plus | 12 active students | 49 | 588.00 |
| Physical Sciences, Plus | 12 active students | 49 | 588.00 |
| Exam day pass, Maths | 1 course-day | 99 | 99.00 |
| API pass-through (Wolfram) | R40 cost | ÷ 0.8 | 50.00 |
| Discounts | - | - | 0.00 |
| **Bill, excl. VAT** | | | **1,325.00** |
| VAT 15% (only once Nexa is registered) | | | 198.75 |
| Bill incl. VAT | | | 1,523.75 |

At plan placeholders the tier lines would be 24 x R30 = R720 instead of R1,176.

| Money flow (model P) | Amount (ZAR) |
| --- | --- |
| Parents pay (12 x R2,860) | 34,320.00 |
| Card fees, borne by the tutor (12 x R96.53) | 1,158.36 |
| Nexa commission 2% (12 x R57.20) | 686.40 |
| Tutor receives (12 x R2,706.27) | 32,475.24 |
| Tutor pays the Nexa bill (excl. VAT) | -1,325.00 |
| **Tutor keeps** | **31,150.24 (90.8% of R34,320)** |

| What Nexa nets | Amount (ZAR) |
| --- | --- |
| Subscription and usage revenue | 1,325.00 |
| less Wolfram cost | -40.00 |
| less usage inside the day pass (**Guess**) | -5.00 |
| less card fee on the bill (3.335% x 1,325 + 1.15) | -45.34 |
| **Net from subscription and usage** | **1,234.66** |
| **Net from commission** (card fees are the tutor's) | **686.40** |
| **Nexa total** | **1,921.06** |

Under model A, the tutor would keep R31,279.00 (91.1%). Nexa would net R557.64 from commission (12 x R46.47), so R1,792.30 in total.

Tier lines as a share of the tutor's gross: 1,176 / 34,320 = **3.4%** (3.9% for the whole bill).

### (b) Organisation: 5 tutors, 150 students

Assumptions: each student takes 2 subjects, so there are 300 active student-subjects. Maths and IT are on Pro (120), English and Accounting on Plus (120) and Life Orientation on Core (60). A launch code gives 10% off tier lines (an example discount). Parents pay R2,300 per subject (group rate), so R4,600 per child, by card once a month.

| Bill line | Qty | Unit (ZAR) | Amount (ZAR) |
| --- | --- | --- | --- |
| Pro courses | 120 active student-subjects | 89 | 10,680.00 |
| Plus courses | 120 | 49 | 5,880.00 |
| Core courses | 60 | 29 | 1,740.00 |
| Exam day passes (two Plus courses) | 2 course-days | 99 | 198.00 |
| AI marking credits over the Pro allowance | 3 x 100 answers | 45 | 135.00 |
| Extra code-runner capacity (exam window) | 3 runner-hours | 29 | 87.00 |
| Extra storage | 5 GB | 7 | 35.00 |
| API pass-through (AI, Wolfram) | R600 cost | ÷ 0.8 | 750.00 |
| Discount, 10% off tier lines | | | -1,830.00 |
| **Bill, excl. VAT** | | | **17,675.00** (R3,535 per tutor) |
| VAT 15% (once registered) | | | 2,651.25 |
| Bill incl. VAT | | | 20,326.25 |

At plan placeholders the tier lines would be 120 x 55 + 120 x 30 + 60 x 15 = R11,100 instead of R18,300.

| Money flow (model P) | Amount (ZAR) |
| --- | --- |
| Parents pay (150 x R4,600) | 690,000.00 |
| Card fees, borne by the organisation (150 x R154.56) | 23,184.00 |
| Nexa commission 2% (150 x R92.00) | 13,800.00 |
| Organisation receives (150 x R4,353.44) | 653,016.00 |
| Organisation pays the Nexa bill (excl. VAT) | -17,675.00 |
| **Organisation keeps** | **635,341.00 (92.1% of R690,000)** |

| What Nexa nets | Amount (ZAR) |
| --- | --- |
| Subscription and usage revenue | 17,675.00 |
| less API cost | -600.00 |
| less add-on costs (AI credits R107.10, runner R3.24, day-pass usage R20 **Guess**, storage R26) | -156.34 |
| less card fee on the bill (3.335% x 17,675 + 1.15) | -590.61 |
| **Net from subscription and usage** | **16,328.05** |
| **Net from commission** | **13,800.00** |
| **Nexa total** | **30,128.05** |

Under model A the organisation would keep R637,825.00 (92.4%). Nexa would net R11,316.00 from commission, so R27,644.05 in total.

Tier lines as a share of the organisation's gross: 18,300 / 690,000 = **2.7%** (2.4% after the discount).

### Sanity check

| Measure | Solo | Organisation |
| --- | --- | --- |
| Tier lines as % of fees charged to parents | 3.4% | 2.7% |
| Tutor or organisation keeps (model P) | 90.8% | 92.1% |
| Nexa's total take as % of parent fees | 5.6% | 4.4% |
| An agency keeps | ~58% | ~58% |
| Nearest admin tool (Teach 'n Go Pro) | R1,853 (100-student tier) | R2,363 (200-student tier; no LMS or marking) |

## Open questions for the owner

1. Tier prices: accept R29 / R49 / R89, or launch at the plan's R15 / R30 / R55 as penetration pricing? At R55, Pro is viable only if the AI allowance uses Haiku-class models.
2. Pro AI allowance: 30 answers per active student per month, pooled per course. Is that right?
3. Should the day pass be a flat R99 per course, or scale with class size from the first student?
4. Should card fees on parent payments be borne by the tutor (model P) in every case, or should a workspace be able to pass them on to parents as a surcharge? Surcharging may breach card-scheme rules (**Unverified**; topic 3 to check).
5. Add an annual prepay discount (2 months free, as Teach 'n Go does)?
6. Allow a forever-free tier, for example 5 Core student-subjects (Azure DevOps "first 5 free")?

## Sources

- https://www.dailymaverick.co.za/article/2026-09-25-r6600-a-month-to-catch-up-inside-sas-costly-private-tutoring-market/ (checked 2026-11-16)
- https://www.teachme2.co.za/tutors-south-africa (checked 2026-11-16)
- https://sites.google.com/cttutoringcenter.com/2026/services/extra-lessons (checked 2026-11-16)
- https://fundiconnect.co.za/tutoring-companies-south-africa (checked 2026-11-16)
- https://www.kumon.co.za/ and https://www.kumon.co.za/helpdesk (checked 2026-11-16)
- https://edu.google.com/workspace-for-education/editions/compare-editions/ (checked 2026-11-16)
- https://www.moodlecloud.com/standard-plans/ (checked 2026-11-16)
- https://teachable.com/pricing (checked 2026-11-16)
- https://www.thinkific.com/pricing/ (checked 2026-11-16)
- https://formswrite.com/blog/canvas-lms-pricing-plans-and-costs-explained (not opened; Unverified)
- https://help.d6.co.za/portal/en/kb/articles/fease-package-comparison (403; Unverified)
- https://edsurge.com/news/2022-08-16-popular-k-12-tool-edmodo-shuts-down (checked 2026-11-16)
- https://seesaw.com/pricing (checked 2026-11-16)
- https://classdojo.com/plus (checked 2026-11-16)
- https://www.tutorbird.com/pricing/ (checked 2026-11-16)
- https://www.teachngo.com/pricing (checked 2026-11-16)
- https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/ (checked 2026-11-16)
- https://aws.amazon.com/free/ (checked 2026-11-16)
- https://arxiv.org/abs/2006.13420 (checked 2026-11-16)
- https://www.tomtunguz.com/how-long-free-trial/ (checked 2026-11-16)
- https://customer.io/learn/product-led-growth/free-trial-length (checked 2026-11-16)
- https://openrouter.ai/pricing (checked 2026-11-16)
- https://help.preply.com/en/articles/4171383-preply-commission-model (checked 2026-11-16)
- https://support.paystack.com/en/articles/2130306 (via 03-payment-providers.md, checked 2026-11-16)
- https://vercel.com/docs/vercel-blob/usage-and-pricing (checked 2026-11-16); cpt1 Blob rates via 05-hosting.md
- Unit costs: 04-api-costs.md and 05-hosting.md in this folder (checked 2026-11-16)
