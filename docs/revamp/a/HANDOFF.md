# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 Phase 0: Preview on fake data, `revamp/a-preview-env`

Done:
- Neon branch `preview` created from `production` as **schema-only** (`init_source: parent-schema`, no rows copied). Production was not written to; its size is unchanged.
- The branch inherited `neondb_owner` with production's password, so Preview uses a new role, `nexa_preview`, that exists only on the `preview` branch.
- `scripts/seed-fake.ts` (with `scripts/check-seed-fake-guard.ts`): 1 tutor, 8 "Test Student N" users, 2 courses, lessons, tests and submissions, all `@example.test`. It refuses production's host always, and any other host unless it is the preview endpoint or `SEED_FAKE_ALLOW=1`.
- `prisma db push` and the seed ran against the preview branch only.
- Vercel: `DATABASE_URL` for Preview now points at the pooled preview branch. Production's record is unchanged.
- `ops/preview-environment.md`: setup, reseeding, and the Blob question.

Next:
- Once the owner says yes: create Blob store `nexa-preview-blob` for Preview and Development, and take production's Blob variables off Preview and Development.
- After the Prisma 6 and schema-split PR merges, push the new schema to the preview branch (see the ops doc).

Blocked on the other agent:
- None.

Questions for the owner:
- May Agent A create `nexa-preview-blob` and remove production's Blob token from Preview and Development? (ops doc section 4)
- Store the seeded users' password in your password manager, or reseed with your own. Optionally reset `neondb_owner`'s password on the `preview` branch.
- `package-lock.json` is out of sync (`npm ci` fails). This is for the session that owns `package.json`.

## 2026-11-16 Phase 0: Grit to Nexa rename, `revamp/a-rename-nexa`

Done:
- Searched `src/`, `scripts/`, `prisma/`, `.github/`, the root config and `README.md` for "grit" (any case). Almost all of the rename had already landed: `src/lib/branding.ts` says Nexa, `package.json` is `nexa-lms`, and the email templates and sender read `APP_NAME` from branding. What was left:

  | Hit | Owner | Action |
  | --- | --- | --- |
  | `.github/workflows/scheduled-jobs.yml`: `https://grit-lms.vercel.app` | Infrastructure | Kept. It is the Vercel project URL. |
  | `README.md`: `cd grit-lms` | Infrastructure | Kept. The GitHub repo keeps its name; added a note. |
  | `.claude/launch.json`: dev server named `grit-lms` | Tooling | Kept. Sessions start the preview by this name. |
  | `src/lib/use-local-draft.ts:28`: `grit-lms:draft:` | B (unlisted path, used only by B's forms) | Listed for B below. |

- `src/lib/email/config.ts`: the sender is still Resend's dev sender (`Nexa LMS <onboarding@resend.dev>`) unless `EMAIL_FROM` is set. The comment and `README.md` now name the planned sender, `Nexa LMS <noreply@notify.nexa-lms.co.za>`, to set once `nexa-lms.co.za` is bought and verified in Resend. README also documents `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_REPLY_TO`.
- `scripts/check-branding.ts`: fails if "Grit" appears in an A-owned file (the paths in AGENTS.md section 2), apart from an allow-list of infrastructure names (the Vercel URL, the GitHub repo URL and clone folder). Run `npx tsx scripts/check-branding.ts`.
- Not renamed, by design: the Vercel project, the Blob store, the Neon project, the GitHub repo and every URL.

Next:
- When the domain is verified: set `EMAIL_FROM` in Vercel (owner approval; it is an env var on a paid resource) and point `NEXT_PUBLIC_APP_URL` at the new domain.

Blocked on the other agent:
- For B: no visible UI text says Grit any more; B's pages and components already read from `src/lib/branding.ts`. The one B-side hit is the localStorage key prefix `grit-lms:draft:` in `src/lib/use-local-draft.ts` (used by `draft-controls.tsx`, the test, grading and assignment forms). Users never see it. Renaming it drops any unsaved drafts in users' browsers, so either keep it, or rename it to `nexa:draft:` and read the old key once as a fallback. A's check script does not cover this file.
- For B: `src/app/layout.tsx` metadata already uses branding constants; nothing to change there.

Questions for the owner:
- Buy and verify `nexa-lms.co.za` (paid resource), then add `notify.nexa-lms.co.za` in Resend. Until then mail only reaches your inbox.
- Ask before merging this PR.

## 2026-11-16 A4 Write-up, `revamp/a-writeup`

Done:
- `docs/revamp/a/WRITEUP.md`: one document combining A1 to A3, with 14 Mermaid diagrams (system context, both deployment stages, use cases, the tenancy, billing and payments data model, four sequences, sign-up, the renewal run, dunning, the POPIA data flow, and Phase 0). All 14 render with Mermaid 11.4.1.

Next:
- Owner approval of this write-up and B's. Then Phase 0: schema split and baseline, `getViewer()`, legacy replacement batches, Preview on a fake-data branch, the Grit-to-Nexa rename, runbooks.

Blocked on the other agent:
- None new. The open B items are listed in WRITEUP section 11.

Questions for the owner:
- Approve the write-up, or ask for changes.

## 2026-11-16 Contract follow-up, `revamp/a-billing-contract`

Done:
- `contracts/billing.md` and the 30-day `services.md` update reach `main` (they were pushed after PR #43 merged).
- Restored the A1 and A2 entries below, which a merge had dropped from this file.

Next:
- A4 write-up with diagrams (`docs/revamp/a/WRITEUP.md`).

Blocked on the other agent:
- Answer to B on self-hosting MathJax 4: **not in v1.** Keep the pinned jsDelivr URL. Self-hosting copies about 50 MB into every deployment and buys little until we add a strict Content-Security-Policy. Revisit in Stage 2 (January 2027, design 06), when CSP and the move to `cpt1` happen together. If B needs it sooner, raise it in `b/HANDOFF.md` and A will add the build step.

Questions for the owner:
- None.

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

## 2026-11-16 A2 System design, `revamp/a-system-design`

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

## 2026-11-16 A1 Research, `revamp/a-research`

Done:
- Nine research files in `docs/revamp/a/research/` (01 to 09) and `SUMMARY.md`. Every price has a source link and a checked date. Guesses are marked.
- Recommendations: Vercel Pro with functions in `cpt1`; AWS RDS Postgres in af-south-1; Paystack, with Payfast as the fallback; tiers Core R29, Plus R49, Pro R89; the plan's 14-day trial, 20% API margin and 2% commission.
- Found in production (nothing changed): no Vercel crons are registered, because `src/vercel.json` is not at the project root; Preview shares production's `DATABASE_URL` and Blob token; Blob is at 888.7 MB of 1 GB on Hobby.

Next:
- A2 System design and A3 UX, starting with drafts of `contracts/services.md` (keys from research 02), `contracts/viewer.md` and `contracts/billing.md`.

Blocked on the other agent:
- Nothing yet. For B: the draft service keys are in `research/02-service-catalogue.md` (28 from the plan plus 7 candidates). The Plus/Pro split there drives which UI shows behind `hasService`. B's research on math input, graphing and AI marking may change these keys. Write back in `b/HANDOFF.md`.
- For B: AI marking has no Claude or GPT model inside South Africa (global routing only; research 04). This affects B's AI-marking design.

Questions for the owner:
- See the list in `research/SUMMARY.md`. The most urgent: fix the crons now or wait (it needs Vercel Pro); approve Vercel Pro and RDS af-south-1; is Nexa a registered (Pty) Ltd; prices R29/R49/R89 or the plan's R15/R30/R55.

<!--

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
