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
- Seven design docs and an index in `docs/revamp/a/design/`: tenancy and roles, identity, billing, payments, messaging and email, deployment, legacy replacement.
- Contracts `viewer.md`, `services.md` and `billing.md` drafted in PR #43.
- Owner decisions applied: 30-day billing periods from each payment; a raised tier holds for 30 days; Pro includes 30 AI marks per student per period; day pass later; tutors create students directly in v1 (guardian invites and consent capture later); data deleted 2 months after the last payment.
- Found a live data leak: `GET /api/activity` and `GET /api/notifications` return any user's rows. Fix proposed as Batch 0 in design 07.

Next:
- Owner review of the designs; A4 write-up with diagrams; Batch 0 security fix if approved.

Blocked on the other agent:
- For B: build against PR #43. `getViewer()` has no `mode`. Course settings use `getCourseServices`, `previewServiceChange` and `setCourseServices` from `billing.md`. Show `period.renewsAt`, never "this month".
- For B: email rendering waits on `contracts/editor.md` (node and mark list).
- For B: confirm whether `deleteEntry` stays on the assignments overview, and who edits `src/app/providers.tsx` (design 07).

Questions for the owner:
- See `design/README.md`, "Owner questions" (renewal date rule, late payments, the security fix, backups, uptime checker, 2FA timing, Resend Pro).

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
