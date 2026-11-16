# Nexa platform: Agent A write-up

**Answer first.** Nexa becomes a multi-tenant tutoring platform built around a **workspace**: an organisation with tutor teams, or a solo practice. Workspaces pay Nexa **R99, R139 or R179 per active student per course for each 30-day period**, starting with a 14-day trial. Parents and adult students pay their tutors through one Paystack checkout that splits each payment straight to the tutors' bank accounts, and Nexa keeps 2%. Until January 2027 everything runs on the current Vercel Hobby and Neon setup, then moves to Vercel Pro in Cape Town and AWS RDS in af-south-1, before the first paying customer in February 2027. This document gathers sessions A1 (research), A2 (system design) and A3 (UX) into one read, with the diagrams. The detail lives in the linked files.

Status: for owner approval, 2026-11-16. Building starts with Phase 0 once the owner approves this write-up and Agent B's.

| Read more | Where |
| --- | --- |
| Research and owner decisions | [research/SUMMARY.md](research/SUMMARY.md) |
| System design (7 docs) | [design/README.md](design/README.md) |
| UX flows (6 docs) | [ux/README.md](ux/README.md) |
| Contracts with Agent B | [viewer.md](../contracts/viewer.md), [services.md](../contracts/services.md), [billing.md](../contracts/billing.md) |

## 1. Decisions

| Area | Decision | Source |
| --- | --- | --- |
| Tenancy | Workspace (`ORGANISATION` or `SOLO`) is the tenant; roles come from memberships, learner rows and guardianships; `workspaceId` on every tenant row | design 01 |
| Roles | Organisation owner/admin, solo practice, tutor, student, parent or guardian (optional), Nexa admin | plan rev 2, design 01 |
| Prices | Core R99, Plus R139, Pro R179 per active student per course per 30 days, excl. VAT | owner, 16 Nov |
| Services | `math-input` and `graphing` on Plus; `secure-tests` and `ai-marking` on Pro; Pro includes 30 AI marks per student per period; automarker, judge mode and code plagiarism parked; day pass later | owner, contracts/services.md |
| Billing periods | Exactly 30 days from each payment; seats charged in advance; catch-up and usage on the next renewal; a raised tier holds for 30 days; a late payment starts a new 30-day period on the payment date | owner, design 03 |
| Trial | 14 days, no card, Pro services on, capped at 20 students and 100 AI marks; read-only on day 15 if unpaid | plan, design 03 |
| Parent payments | Paystack (sole proprietor, R1,000,000 lifetime limit); one checkout across several children and tutors; split at capture; 2% to Nexa; the tutor bears the card fee | owner, design 04 |
| Onboarding v1 | Tutors create their own students and attest to parental consent; guardian invites, consent capture and magic links come later | owner, design 02 |
| Identity | Better Auth in Phase 1, database sessions, TOTP for owners and Nexa admins | design 02 |
| AI | Bedrock (Claude Haiku, Sonnet for hard cases); personal information redacted before any call; the tutor approves every mark | owner, plan rev 3 |
| Retention | Workspace data deleted 2 months after the last payment; tax retention of invoices deferred | owner, design 03 |
| Hosting | Stage 1: Vercel Hobby, Neon us-east-1. Stage 2 (January 2027): Vercel Pro `cpt1`, RDS af-south-1 | owner, design 06 |
| Backups | Weekly encrypted dumps to the Tigris bucket `nexa-lms-backups` in Johannesburg | owner, design 06 |
| Domain and mail | `nexa-lms.co.za`; app mail from `notify.nexa-lms.co.za` via Resend; Zoho Mail Free | owner, research 07 |

## 2. System context

```mermaid
flowchart LR
  subgraph People
    ORG["Organisation owner<br/>or admin"]
    TUT["Tutor<br/>(solo or in a team)"]
    STU["Student"]
    PAR["Parent or guardian<br/>(optional)"]
    ADM["Nexa admin"]
  end

  NEXA["Nexa<br/>Next.js app on Vercel"]

  subgraph Data["Nexa's stores"]
    DB[("Postgres<br/>Neon now, RDS later")]
    BLOB[("Vercel Blob<br/>cpt1")]
    BAK[("Tigris backups<br/>jnb")]
  end

  subgraph External["External services"]
    PS["Paystack<br/>cards, EFT, splits"]
    RS["Resend<br/>email"]
    BR["AWS Bedrock<br/>AI marking"]
    WA["Wolfram|Alpha<br/>quote pending"]
    J0["Judge0<br/>parked"]
    GH["GitHub Actions<br/>scheduled jobs"]
    SN["Sentry"]
  end

  ORG -->|"workspace, teams, billing"| NEXA
  TUT -->|"courses, tests, marking, fees"| NEXA
  STU -->|"lessons, tests, assignments"| NEXA
  PAR -->|"progress, invoices, pay"| NEXA
  ADM -->|"console, overrides"| NEXA

  NEXA --> DB
  NEXA --> BLOB
  DB -. "weekly dump" .-> BAK
  NEXA <-->|"checkout, charges, webhooks"| PS
  NEXA -->|"transactional mail, digests"| RS
  NEXA -->|"redacted answers"| BR
  NEXA -.-> WA
  NEXA -.-> J0
  GH -->|"CRON_SECRET"| NEXA
  NEXA --> SN
  PS -->|"payouts"| TUTBANK["Tutors' bank accounts"]
```

Dashed lines are not in v1: Wolfram waits on a quote, and Judge0 is parked with the coding automarker.

## 3. Deployment

### Stage 1: now to January 2027

```mermaid
flowchart LR
  U["Users in South Africa"] --> PoP["Vercel edge"]
  PoP --> FN["Vercel Functions<br/>Hobby, iad1"]
  FN --> DB[("Neon us-east-1<br/>production branch")]
  FN --> BLOB[("Blob grit-lms-blob<br/>cpt1")]
  FN --> RS["Resend"]
  FN --> SN["Sentry free"]
  GHA["GitHub Actions<br/>scheduled-jobs.yml"] -- "Bearer CRON_SECRET" --> FN
  DB -. "weekly pg_dump, encrypted" .-> TG[("Tigris nexa-lms-backups<br/>jnb")]
  subgraph NP["Non-production"]
    PV["Preview deployments"] --> PDB[("Neon branch: preview<br/>fake data")]
    PV --> PB[("Blob nexa-preview-blob")]
    DEV["Local dev"] --> DDB[("Neon branch: dev")]
  end
```

### Stage 2: January 2027, before the first payment

```mermaid
flowchart LR
  U["Users in South Africa"] --> PoP["Vercel edge"]
  PoP --> FN["Vercel Functions<br/>Pro, cpt1"]
  FN --> RDS[("AWS RDS Postgres 17<br/>af-south-1, 14-day PITR")]
  FN --> BLOB[("Blob<br/>cpt1")]
  FN <--> PS["Paystack live"]
  PS -- "webhooks" --> FN
  QS["QStash"] -- "signed job calls" --> FN
  FN --> RS["Resend"]
  FN --> SN["Sentry"]
  RDS -. "weekly dump" .-> TG[("Tigris backups<br/>jnb, later S3 af-south-1")]
  subgraph NP["Non-production, Neon with fake data"]
    ST["Staging"] --> SDB[("Neon: staging")]
    PV["Preview"] --> PDB[("Neon: preview")]
    ST <--> PST["Paystack test keys"]
  end
```

Functions and the database sit in the same AWS region in Stage 2: Vercel `cpt1` runs in af-south-1. That removes the 226 ms round trip to Virginia that every query pays today. The move is a `pg_dump` and restore of about 35 MB in a window of about 30 minutes, with Neon kept read-only for 14 days as the rollback ([research 06](research/06-database.md), [design 06](design/06-deployment.md)).

## 4. Use cases in A's areas

Mermaid has no use-case diagram, so this is a flowchart: people on the left, what they do on the right.

```mermaid
flowchart LR
  ORG["Organisation<br/>owner or admin"]
  TUT["Tutor"]
  PAR["Parent or guardian"]
  STU["Adult student"]
  ADM["Nexa admin"]

  ORG --- U1(["Sign up and onboard"])
  ORG --- U2(["Invite tutors, manage teams and roles"])
  ORG --- U3(["Choose services and tiers per course"])
  ORG --- U4(["Pay Nexa, see invoices and usage"])
  ORG --- U5(["Set branding"])

  TUT --- U1
  TUT --- U6(["Create and enrol students"])
  TUT --- U7(["Set fee schedules, issue invoices"])
  TUT --- U8(["Connect payouts"])
  TUT --- U9(["Mark an invoice paid off-site"])
  TUT --- U10(["Send course announcements"])

  PAR --- U11(["See each child's progress"])
  PAR --- U12(["Pay invoices for several children at once"])
  STU --- U12
  STU --- U13(["See own fees, if the tutor allows"])

  ADM --- U14(["Extend trial, comp, change tier"])
  ADM --- U15(["Refund, credit note, mark paid off-site"])
  ADM --- U16(["Impersonate a user, audited"])
  ADM --- U17(["Create discount codes"])
```

In v1, parents are linked by the tutor. Parents claiming children with a code and giving in-app consent come later ([design 02](design/02-identity.md)).

## 5. Data model: tenancy, billing and payments

Key relations only. Every field is in [design 01](design/01-tenancy-roles.md), [03](design/03-billing.md) and [04](design/04-payments.md).

```mermaid
erDiagram
  User ||--o{ Membership : "staff in"
  User ||--o{ Learner : "learns in"
  User ||--o{ Guardianship : "guards"
  Workspace ||--o{ Membership : has
  Workspace ||--o{ Team : has
  Workspace ||--o{ Learner : has
  Workspace ||--o{ Course : owns
  Course ||--o{ Enrollment : has
  Learner ||--o{ Enrollment : "enrolled via"
  Course ||--o{ CourseService : "switches on"
  Service ||--o{ CourseService : "is"
  Tier ||--o{ Service : "places"
  Course ||--o{ CourseTierHold : "held at"
  Workspace ||--|| Subscription : "pays with"
  Workspace ||--o{ BillingPeriod : "30-day periods"
  Workspace ||--o{ PlatformInvoice : "billed by Nexa"
  PlatformInvoice ||--o{ PlatformInvoiceLine : has
  BillingPeriod ||--o{ SeatCharge : records
  Workspace ||--o{ UsageRecord : meters
  Workspace ||--o{ PayoutAccount : "paid out to"
  Course ||--o{ FeeSchedule : prices
  Learner ||--o{ Invoice : "billed for"
  PayoutAccount ||--o{ Invoice : "collects"
  Invoice ||--o{ InvoiceLine : has
  Payment ||--o{ PaymentAllocation : "splits into"
  Invoice ||--o{ PaymentAllocation : "settled by"
  Payment ||--o{ Refund : has
  Invoice |o--o{ OffsitePayment : "paid off-site"
  DiscountCode ||--o{ Redemption : "redeemed as"
  Workspace ||--o{ AuditLog : records
```

`PlatformInvoice` is what a workspace owes Nexa (Gate 1). `Invoice` is what a parent or adult student owes a tutor (Gate 2). Money is stored in integer cents.

## 6. Sequences

### 6.1 Trial to paid

```mermaid
sequenceDiagram
  autonumber
  actor O as Owner
  participant N as Nexa billing
  participant P as Paystack
  participant W as Webhook route
  O->>N: confirmTrialTiers, then startFirstPayment
  N->>N: PlatformInvoice (24 seats x R139 = R3,336), Payment PENDING
  N->>P: initializeCheckout (card)
  P-->>O: checkout page, 3-D Secure
  P-->>O: redirect to /billing/return
  O->>N: getBillingPaymentStatus (polls)
  P->>W: charge.success (signed)
  W->>P: verifyTransaction
  W->>N: invoice PAID, card saved, period 3 Feb to 4 Mar, state ACTIVE
  N-->>O: "Paid. Renews on 5 March."
  Note over N,P: On renewal: charge the saved card for the renewal invoice, no split
```

### 6.2 Parent checkout across two tutors

```mermaid
sequenceDiagram
  autonumber
  actor G as Parent
  participant N as Nexa payments
  participant P as Paystack
  participant X as Tutor X bank
  participant Y as Tutor Y bank
  G->>N: startCheckout(invoice A for child 1 with tutor X, invoice B for child 2 with tutor Y)
  N->>N: check access, lock both invoices, compute shares
  N->>P: initializeCheckout(total, splits X and Y)
  P-->>G: checkout page
  G->>P: pays by card
  P->>N: charge.success webhook (verified)
  N->>N: invoices A and B PAID, receipts emailed
  P->>X: X's share, about 2 working days
  P->>Y: Y's share
  Note over P: Nexa keeps 2%, and the tutors share the card fee
```

### 6.3 Webhook handling

```mermaid
sequenceDiagram
  autonumber
  participant P as Paystack
  participant R as Webhook route
  participant DB as Database
  P->>R: POST event with signature
  R->>R: verify HMAC-SHA512
  alt bad signature
    R-->>P: 401, nothing stored
  end
  R->>DB: insert PaymentEvent (unique dedupe key)
  alt already processed
    R-->>P: 200, duplicate ignored
  end
  R->>P: verifyTransaction(reference)
  R->>DB: one transaction: payment, invoices, subscription, audit log
  R->>DB: PaymentEvent PROCESSED
  R-->>P: 200
  Note over R,DB: On error: mark FAILED and return 500 so Paystack retries, and reconciliation retries too
```

### 6.4 Off-site payment marked by an admin

```mermaid
sequenceDiagram
  autonumber
  actor A as Nexa admin
  participant C as Admin console
  participant N as adminMarkPaidOffsite
  participant DB as Database
  participant E as Email
  A->>C: open the workspace's overdue invoice
  A->>C: "Mark paid off-site": EFT, amount, date, reference, note
  C->>N: adminMarkPaidOffsite(...)
  N->>DB: OffsitePayment, invoice PAID, AuditLog entry
  N->>DB: no other overdue invoice: state ACTIVE, dunning stops
  N->>E: receipt to the owner
  N-->>C: invoice PAID
```

## 7. Activities

### 7.1 Sign-up and onboarding (v1)

```mermaid
flowchart TD
  A["/auth/sign-up"] --> B{"Solo or organisation?"}
  B --> C["Name, email, password, terms"]
  C --> D["Verify email link sent"]
  D --> S1["Step 1: business name, time zone"]
  S1 --> W[("Workspace in TRIAL, 14 days<br/>owner membership")]
  W --> S2["Step 2: subjects"]
  S2 --> S3["Step 3: first course"]
  S3 --> S4["Step 4: create students<br/>(tutor attests parental consent)"]
  S4 --> S5{"Step 5: connect payouts?"}
  S5 -- "now" --> P["Paystack subaccount"]
  S5 -- "later" --> T["Dashboard task"]
  P --> Z["Set up 2FA"]
  T --> Z
  Z --> DONE["Dashboard"]
```

### 7.2 Renewal run (daily job)

```mermaid
flowchart TD
  J["Daily billing job<br/>(GitHub Actions now, QStash later)"] --> M["Meter yesterday's usage<br/>(idempotent UsageRecord per day)"]
  M --> Q{"Any workspace with<br/>renewsAt due today?"}
  Q -- "no" --> FIN["Done"]
  Q -- "yes" --> B["Build renewal invoice"]
  B --> L1["Advance seats for the next 30 days<br/>at each course's billed tier"]
  B --> L2["Catch-up: students added and tiers raised<br/>during the closing period"]
  B --> L3["Usage: AI marks over the allowance<br/>and pass-through, cost / 0.8"]
  B --> L4["Discounts and credit notes"]
  L1 & L2 & L3 & L4 --> CH["Charge the saved card"]
  CH -- "success" --> NP["New 30-day period from today"]
  CH -- "fails" --> DUN["Dunning, 7.3"]
```

### 7.3 Dunning

```mermaid
flowchart TD
  A["Renewal charge fails"] --> D0["Day 0: PAST_DUE, email with Pay now link"]
  D0 --> R3["Day 3: retry"]
  R3 -- "paid" --> OK["ACTIVE, new 30-day period from payment date"]
  R3 -- "fails" --> R7["Day 7: retry, final notice"]
  R7 -- "paid" --> OK
  R7 -- "fails" --> D14{"Paid by day 14?"}
  D14 -- "yes" --> OK
  D14 -- "no" --> RO["READ_ONLY for staff<br/>(learners never blocked)"]
  RO -- "pays, or admin marks off-site" --> OK
  RO -- "no payment" --> DEL["Data deleted 2 months<br/>after the last payment"]
```

## 8. Personal data flow (POPIA)

```mermaid
flowchart LR
  subgraph Sources
    TUT["Tutor enters students:<br/>name, optional email,<br/>consent attestation"]
    STU["Students: answers,<br/>uploads, grades"]
    PAR["Parents: name, email,<br/>card (on Paystack only)"]
  end

  subgraph Nexa["Nexa"]
    APP["App<br/>Vercel"]
    RED["Redaction step<br/>names and IDs removed"]
  end

  subgraph Stores
    DB[("Postgres<br/>Neon US now, RDS Cape Town 2027")]
    BL[("Blob<br/>Cape Town")]
    BK[("Backups, encrypted<br/>Tigris Johannesburg")]
  end

  subgraph Processors
    PS["Paystack<br/>payer and payout data"]
    RS["Resend<br/>email, logs in US"]
    BR["Bedrock<br/>redacted text only"]
    SN["Sentry<br/>errors, no PII by config"]
  end

  TUT --> APP
  STU --> APP
  PAR --> APP
  APP --> DB
  APP --> BL
  DB --> BK
  APP --> RED --> BR
  APP --> PS
  APP --> RS
  APP --> SN
  DB --> DEL["Deleted 2 months<br/>after last payment"]
```

| Risk | Handling |
| --- | --- |
| Children's data held in the US until the database move | Move to af-south-1 in January 2027. Say so honestly in the privacy notice until then. A lawyer to confirm whether POPIA s57 prior authorisation applies ([research 09](research/09-compliance.md)) |
| Parental consent in v1 | The tutor attests to it when creating a student and is responsible under the tutor terms (lawyer to confirm the wording) |
| AI marking outside South Africa | Only redacted text is sent. De-identified information falls outside POPIA (s6(1)(b)) |
| Card data | Never touches Nexa. Paystack's hosted checkout handles it (PCI scope stays with Paystack) |
| Email logs | Resend keeps logs in the US. Subject lines carry no student details |

## 9. Costs

| Period | Monthly cost | What |
| --- | --- | --- |
| Now to January 2027 | about R9 | `.co.za` domain only. Hobby, Neon Free, Tigris free allowance, Resend Free |
| From January 2027 | about R740 | Vercel Pro R340 and RDS R374, plus the domain |

A solo tutor with 12 students in 2 courses on Plus pays 24 × R139 = **R3,336** per 30 days, which covers the platform's running cost on its own ([design 03](design/03-billing.md)).

## 10. Phase 0 for Agent A

Phase 0 starts once this write-up and B's are approved. Each item is its own branch and pull request.

```mermaid
flowchart LR
  P1["Split prisma/schema into files;<br/>baseline migrations"] --> P2["src/lib/viewer.ts<br/>(getViewer)"]
  P2 --> P3["Server actions replacing<br/>legacy routes, in batches"]
  P1 --> P4["Preview on a fake-data<br/>Neon branch"]
  P5["Rename Grit to Nexa<br/>in metadata and emails"]
  P6["Runbooks: database move,<br/>Blob clean-up, weekly backup"]
```

1. Split `prisma/schema.prisma` into the multi-file layout (Prisma 6.7 or later) and baseline migrations. Nothing runs against the shared database without the owner's approval.
2. Ship `getViewer()` to [viewer.md](../contracts/viewer.md).
3. Server actions and queries that replace the legacy routes, batch by batch ([design 07](design/07-legacy-replacement.md)). Batch 0, the feed leak, is already fixed (PR #52).
4. Point Preview at a schema-only Neon branch seeded with fake data, with its own Blob store.
5. Rename Grit to Nexa in metadata, emails and config.
6. Runbooks for the database move, the Blob audit and clean-up, and the weekly backup to Tigris. Ask the owner before running any of them.

## 11. Open items

| Item | Who |
| --- | --- |
| Paystack sales: multi-split on one account, renewal charges, chargeback fees, minimum charge, ID number for account checks | Owner |
| Wolfram quote (draft in research/SUMMARY.md) | Owner sends |
| Lawyer: tutor consent attestation (POPIA s35); US hosting before the move (s57) | Owner |
| Accountant: retention of invoices (deferred) | Owner, later |
| Preview Blob store: standing approval to empty it monthly | Owner |
| Uptime checker choice; 2FA timing for owners; when to buy Resend Pro | Owner |
| `deleteEntry` on the assignments overview; who edits `providers.tsx` | Agent B |
| Rendering Tiptap JSON in emails, per `editor.md` | A, now unblocked by B's contract |
