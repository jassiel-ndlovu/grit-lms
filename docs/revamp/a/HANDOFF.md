# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 A3 UI/UX flows, `revamp/a-ux`

Done:
- Seven files in `docs/revamp/a/ux/`: `README.md` (shell slots, on-screen words, screen states, every action the screens need), `01-signup-onboarding.md`, `02-org-team-settings.md`, `03-billing.md`, `04-payments-portal.md`, `05-discount-codes.md`, `06-admin-console.md`. Each screen has its purpose, route, entry points, a text wireframe, its states and its actions. There is one UI with no modes.
- Applied the owner decisions relayed from A2: 30-day periods anchored to the payment date ("renews on", no proration); a course that moves up bills at the higher plan for the next 30 days; Pro's AI allowance is pooled per course and there is no credit pack; no day pass in v1; v1 students are created by the tutor (sign-in code or first password) and parents are linked by the tutor, while magic links, student invites and claim codes with consent are marked "Later"; data is deleted two months after the last payment, and the read-only and cancellation screens show the date.
- Action names follow A2's design/03 section 11 and design/04 section 8. Names not in those drafts are marked "proposed" (table in `ux/README.md`).

Next:
- A2: update design/03 and contracts/billing.md to use period fields (`renewsOn`, `periodStart`, `nextPaymentDeltaCents`, payments rather than months for discounts), drop `buyDayPass`, and add the proposed actions or rename them. Every UX file ends with "Open points for A2".
- A4 write-up: draw on these flows.

Blocked on the other agent:
- For B: `contracts/navigation.md`. These flows assume a parent header (with a status chip slot), a slim ribbon and one account banner slot above the page body. They will be renamed to B's slot names once the contract exists.
- For B: A supplies the panel content for pages B owns: course "Services" and "Fees" settings, and the student profile "Sign-in", "Parents" and "Fees" tabs.

Questions for the owner:
- None open. The owner answered on 16 Nov, and the docs now reflect the answers:
  - A course that moves up mid-period is charged at the new rates; Nexa admins resolve the shortfall (03, 06).
  - Renewal is 30 days after the most recent payment (03).
  - There is no consent capture in v1, because tutors onboard students and handle it themselves (01).
  - Payments and payout changes are held during impersonation, on suspicious activity and for unverified accounts, with emails to the tutor, the organisation and Nexa admins (04 section 8, 06).

## 2026-11-16 Owner decisions on research, `revamp/a-owner-decisions`

Done:
- Recorded the owner's answers in `research/SUMMARY.md` ("Owner decisions"): tiers Core R99, Plus R139, Pro R179 per student per course; Vercel Hobby and Neon until 2027; Paystack as an education marketplace; parent payments aggregated per parent; PII redacted before any LLM call; Blob audit and a Preview Neon branch approved; Wolfram quote drafted. Owner confirmed Core < Plus < Pro and put `graphing` and `math-input` on Plus.
- Ran the scheduled-jobs workflow by hand with the owner's permission: both routes returned 200 (auto-submit checked 0, notifications ok), so `CRON_SECRET` matches on GitHub and Vercel.
- The owner connected `grit-lms-blob` to the project (vars prefixed `VERCEL_BLOB_`). The app still reads `BLOB_READ_WRITE_TOKEN`.

Next:
- A2 system design, starting with `contracts/viewer.md` (no `mode` field) and `contracts/services.md` (`graphing` and `math-input` on Plus, no `automarker` in v1).
- Preview on a fake-data Neon branch; the read-only Blob audit (store now connected).

Blocked on the other agent:
- For B: AI marking must send only redacted text (no names or IDs). The redaction step sits in A's design; B's marking queue calls it.
- For B: the owner moved `graphing` and `math-input` to **Plus** (revision 3 had all graphing on Pro).

Questions for the owner:
- None. Answered: Paystack as a sole proprietor, domain `nexa-lms.co.za`, first payment February 2027 (so Vercel Pro and RDS go live by January 2027).

## 2026-11-16 Cron fix, `revamp/a-cron-scheduler`

Done:
- Vercel never ran the app's crons: `src/vercel.json` was not at the project root, and Hobby rejects crons more frequent than daily. Replaced it with a GitHub Actions schedule (`.github/workflows/scheduled-jobs.yml`): auto-submit every 5 minutes, notification jobs hourly.

Next:
- On Vercel Pro, move these to Vercel Cron or the queue (research 05 recommends QStash), then delete the workflow.

Blocked on the other agent:
- Nothing.

Questions for the owner:
- Set the shared `CRON_SECRET` in GitHub and Vercel (the agent was not allowed to). The PR has the commands.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
