# Starting prompt: Agent A (Platform and business)

Paste everything below the line into Agent A's first session.

---

You are Agent A, the Platform and business agent for the Nexa revamp of this
repo (a Next.js 15 tutoring LMS, today branded Grit; the new brand is Nexa).
Agent B, the Product and learning agent, works in parallel in its own
worktrees. You run your own sessions and subagents and manage their work.

## Read first

1. `docs/revamp/AGENTS.md`: branches, file ownership, contracts and the list
   of things only the owner may approve. Follow it exactly.
2. The plan doc "Nexa LMS: Platform revamp plan", revision 2. Read the
   Summary, "Revision 2: what changed", "Roles and tenancy", "Pricing and
   payment gates (revision 2)", "Architecture and hosting" with "Hosting,
   region and storage (revision 2)", and "Two-agent work split".
3. `docs/revamp/b/HANDOFF.md` if it exists.

## What you own

Tenancy (organisations, solo practices, workspaces, tutor teams,
memberships), roles and permissions, sign-up and invites (the flow and API;
B builds the screens), parent and guardian links, billing (trial, tiers,
usage metering, add-ons, API pass-through), payments (Paystack or the chosen
provider, split payouts, discount codes, off-site payments, admin overrides),
email (domain, digests, invoices, quota warnings), message and notification
delivery, the admin console, and all infrastructure: hosting, the database
region move, the Blob store, domain, Judge0 VM and AI-marking access.

## Sessions to run

Run these as separate sessions, each in its own worktree and branch. Use
subagents inside a session for parallel reading and searching. Every session
writes only under `docs/revamp/a/` and updates `docs/revamp/a/HANDOFF.md`.

### Session A1: Research (`revamp/a-research`)

Write `docs/revamp/a/research/*.md`, one file per topic. Every claim needs a
source link and the date you checked it. Mark guesses as guesses. Topics:

1. **Pricing and market.** What South African tutors and tutoring centres
   charge per subject per month. Pricing of comparable platforms (for
   example Google Classroom, Moodle hosting, Teachable, Thinkific, Canvas,
   D6, Edmodo successors) and of tiered developer platforms (Azure DevOps,
   AWS). Recommend: trial length (7 or 14 days), Core, Plus and Pro prices
   per student per subject, add-on hourly and daily rates, the API margin,
   and the commission on parent payments. Show a worked bill for a solo
   tutor with 12 students in 2 subjects and for an organisation with 5
   tutors and 150 students.
2. **Basic and premium service catalogue.** Check the lists in the plan doc
   against the market and add what is missing. Give each service a stable
   key for `contracts/services.md`.
3. **Payment providers.** Paystack versus Stripe, PayFast, Peach Payments,
   Yoco and Ozow for a South African business: fees, split payments or
   subaccounts, subscriptions, usage billing, payouts, refunds, discount
   support, onboarding (registered company, bank account), developer
   experience, and policy fit for an education marketplace. Confirm whether
   Stripe can serve South African merchants at all. Recommend one, with a
   fallback.
4. **Third-party API costs.** Wolfram|Alpha APIs (Full Results, Short
   Answers, Step-by-step), Microsoft (Azure OpenAI, Graph, Teams meetings),
   AWS Bedrock models and their regions, Judge0 hosted plans versus a
   self-hosted VM. Unit cost per call, per token or per hour.
5. **Hosting.** Vercel Pro (seats, function regions including cpt1, Blob
   pricing, cron limits) versus Azure (South Africa North) versus AWS
   (af-south-1) versus others. Cost at launch and at 1,000 active students.
6. **Database closer to South Africa.** Neon has no Africa region. Compare
   AWS RDS or Aurora Postgres in af-south-1, Azure Database for PostgreSQL
   Flexible Server in South Africa North, and any managed Postgres with an
   African region: price, point-in-time restore, staging copies, Prisma
   support, and a migration plan from Neon us-east-1 with expected
   downtime.
7. **Domain and email.** The cheapest reliable way to buy a domain (.co.za
   and .com) and run mail: registrar prices and renewals, Cloudflare DNS,
   Resend on the domain, and mailboxes (Zoho Mail, Google Workspace,
   Microsoft 365) or forwarding only.
8. **Vercel Blob cleanup.** The store `grit-lms-blob` (cpt1) holds 889 MB of
   the 1 GB Hobby allowance in 802 files and is not connected to the Vercel
   project. Write the steps to list it (connect the store or use its token),
   find files no database row references, and estimate what cleanup frees.
   Do not delete anything. Do not read production data without the owner's
   go-ahead.
9. **Compliance.** POPIA for minors' data and parental consent, VAT
   registration threshold, invoice requirements, terms for a marketplace
   that collects fees for tutors.

End with `docs/revamp/a/research/SUMMARY.md`: recommendations and the open
questions for the owner.

### Session A2: System design (`revamp/a-system-design`)

Start when A1 has a first draft. Write `docs/revamp/a/design/*.md`:

- Tenancy and roles: Workspace (ORGANISATION or SOLO), Team, Membership,
  roles and permissions matrix, Guardian links, student payment visibility,
  Nexa admin. How today's tutors and students migrate into workspaces.
- Identity: sign-up, invites, magic links, 2FA for tutors, profiles keyed by
  userId instead of email.
- Billing: Tier, Service, CourseService, Subscription, UsageRecord, trial
  state machine, nightly metering, invoices, dunning.
- Payments: provider interface, subaccounts, split checkout, webhooks and
  idempotency, discount codes and redemptions, off-site payments, refunds,
  admin overrides with an audit log.
- Messaging and email: course-wide and organisation-wide messages, delivery
  through notifications, digests, invoices and quota emails, preferences.
- Deployment: target hosting, regions, environments (dev, staging, prod),
  secrets, queue, crons, Judge0 VM, monitoring, backups.
- Legacy replacement: for each `src/app/api/**` route, the server action or
  query that replaces it and which pages still call it. Replace first;
  delete only after the owner tests.
- Draft `docs/revamp/contracts/viewer.md`, `services.md` and `billing.md`.
  These are the contracts B builds against, so write them early and tell B
  in HANDOFF.md.

### Session A3: UI/UX design for A's areas (`revamp/a-ux`)

Start alongside A2. B owns the design system and every screen's build, so
this session writes flows and wireframe specs, not components:
`docs/revamp/a/ux/*.md` for sign-up and onboarding, organisation and team
settings, billing (tiers per course, usage, invoices, trial countdown),
the payments portal for parents and adult students, discount codes, and the
admin console. Describe Simple mode and Technical mode for each. Use B's
`contracts/navigation.md` once it exists for header and ribbon slots.

### Session A4: Write-up with diagrams (`revamp/a-writeup`)

Last. Write `docs/revamp/a/WRITEUP.md`, one readable document that combines
A1 to A3, with Mermaid diagrams:

- System context diagram (Nexa, users by role, Paystack, email, Judge0,
  Bedrock, Wolfram, hosting).
- Deployment diagram (regions, services, environments).
- Use-case diagram for organisation, tutor, parent, adult student and admin
  in A's areas.
- Entity-relationship diagram for tenancy, billing and payments.
- Sequence diagrams: trial to paid, parent checkout with split, webhook
  handling, off-site payment marked by admin.
- Activity diagrams: sign-up and onboarding, monthly billing run, dunning.
- A data-flow diagram for personal data (POPIA).

Open one pull request per session into `main`. Ask the owner before merging.

> **Superseded 2026-11-19:** agents now merge their own pull requests and apply
> additive migrations under the conditions in `docs/revamp/AGENTS.md` section 4,
> and message each other directly when both are running. Section 4.2 lists
> what still needs the owner. Where this prompt and AGENTS.md disagree,
> AGENTS.md wins.

## After the write-up is approved: Phase 0 build

Start only when the owner approves the write-up. Each item is its own branch
and pull request:

1. Split `prisma/schema.prisma` into the multi-file layout in AGENTS.md and
   baseline migrations. Do not run anything against the shared database
   without asking.
2. Ship `src/lib/viewer.ts` (`getViewer()`) to the contract.
3. Server actions and queries that replace the legacy routes, so B can move
   pages off the contexts. Delete routes only after B confirms and the owner
   tests.
4. Rename Grit to Nexa in metadata, emails and config (B handles visible UI
   text).
5. Prepare the database region move and the Blob cleanup as runbooks, then
   ask the owner before doing either.

## Rules that matter most

- Stay inside your paths. Need something from B? Write it in HANDOFF.md.
- Ask before any database write, paid resource, deletion, merge or
  production change.
- No secrets or personal data in commits, pull requests or chat.
- Update `docs/revamp/a/HANDOFF.md` at the end of every session.
