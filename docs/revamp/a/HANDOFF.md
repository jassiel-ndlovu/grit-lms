# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-19 Tenancy part 2 on production; follow-ups to B's review, `revamp/a-tenancy-followups`

Done:
- **Production** (owner approved): backup branch `backup-pre-tenancy2-20261119`, then `6_tenancy_courses`. The part 2 backfill placed and owned 6 courses (6 LEAD staff rows) and created 12 enrolments, with 0 unmatched. A re-run found nothing to do, and the diff against the repo is identical.
- **B's terms from #86:** `Course.workspace` is now `onDelete: Restrict` (migration `7_course_workspace_restrict`). The team and owner links were already `SetNull`, and the other terms were already met.
- **Restored** the 2026-11-18 "tenancy part 1" entry, which a merge had dropped (B spotted it).
- **Reminder links:** `notifications/jobs.ts` builds them with `assignmentRoutes`. Reminders sent under the old `/dashboard/submissions` URL still count as sent, so nobody gets the same one twice.

Next:
- Owner approval for `7_course_workspace_restrict` on production.
- `getViewer()` on the tenancy tables, plus `withWorkspace()`.
- Batch 4 deletions after the owner tests B's Batch 3b.

Blocked on the other agent:
- For B: the old-folder comments in `src/app/api/submissions*` are left alone, because those routes go in Batch 4.
- For B: production now has `Enrollment` and `CourseStaff` rows for every existing course, so your queries can start moving off `tutorId` and the implicit join when ready.

Questions for the owner:
- May A apply `7_course_workspace_restrict` on production after this merges? It is one foreign key change.

## 2026-11-19 Phase 1 tenancy, part 2; QStash live, `revamp/a-tenancy-courses`

Done:
- **QStash is live.** The three schedules (`nexa-auto-submit`, `nexa-notifications`, `nexa-housekeeping`) were created on 2026-11-18. The first QStash run (auto-submit) was at 23:10 UTC and recorded `trigger: qstash`, ok.
- **Tenancy part 2:**
  - `Enrollment`: append-only intervals, status, startedAt/endedAt. "One open row per course and learner" is enforced in the data layer, not the database.
  - `CourseStaff` (LEAD or ASSISTANT).
  - **On `Course`, in B's `learning.prisma`, with the owner's go-ahead:** nullable `workspaceId`, `teamId` and `ownerMembershipId`, their relations, the back-relations `staff` and `enrollments`, and an index on `workspaceId`.
  - Migration `6_tenancy_courses` is additive. It follows B's `5_submission_description_json`.
- **`scripts/backfill-tenancy.ts`** now also places courses in the workspace, sets each course's owner membership and LEAD staff row, and turns the implicit `CourseEnrollments` join into `Enrollment` rows (startedAt = the course's createdAt).
- **Preview:** migration applied, 2 courses placed and owned, 11 enrolments created, 0 unmatched. A re-run found nothing to do.

Next:
- Owner approval to run `6_tenancy_courses` and the part 2 backfill on production.
- Then `getViewer()` and `canIn()` read the tenancy tables instead of the Phase 0 bridge, plus `withWorkspace()`.
- Legacy Batch 4 deletions once the owner has tested B's Batch 3b on Preview (B confirmed nothing imports the contexts).

Blocked on the other agent:
- For B: **please review the `Course` additions in `learning.prisma`** in this PR. They are exactly what the 2026-11-18 entry asked about. The owner told A to go ahead rather than wait. `tutorId` and the implicit `students` join stay until your pages read `ownerMembershipId`, `CourseStaff` and `Enrollment`. A will say in this file when they can go.
- **For both agents, a dated item:** on or after **2026-11-26** (one week of clean QStash runs since the first, on 2026-11-18), drop the `5-55/5 * * * *` schedule from `.github/workflows/scheduled-jobs.yml` and keep GitHub as an hourly backup. Check `/api/health` and the QStash logs first (`docs/revamp/a/ops/qstash-setup.md`, "Later"). A owns the workflow file. Whichever agent is working that day raises it.

Questions for the owner:
- May A run `6_tenancy_courses` and the part 2 backfill on production? (Backup branch first, as before.)

## 2026-11-19 Jobs on QStash; tenancy part 1 on production, `revamp/a-qstash`

Done:
- **Production tenancy:** `4_tenancy_core` applied (after the backup branch `backup-pre-tenancy-20261119`). The backfill linked 1 tutor and 7 students with 0 unmatched, and created 1 membership (the owner's account is OWNER) and 7 learners.
- **QStash (owner decision):** the jobs run on Upstash QStash from now on, not only at Stage 2. GitHub fired the 5-minute schedule only every 2 to 5 hours, and `/api/health` reported the jobs as stale.
  - `verify.ts` accepts `Upstash-Signature`, checked against the route's exact public URL (`APP_URL` or Vercel's production domain), as well as Bearer `CRON_SECRET`. It fails closed.
  - `scripts/qstash-sync-schedules.ts` creates `nexa-<job>` schedules from the registry.
  - `docs/revamp/a/ops/qstash-setup.md` is the owner's setup.
  - `check-jobs.ts` has 33 checks, including the real QStash `Receiver` with locally signed tokens.
- `@upstash/qstash` 2.12.2 added to `package.json`.

Next:
- Owner sets up QStash (runbook). Then tenancy part 2 once B answers about the `Course` fields.

Blocked on the other agent:
- For B: **the scheduled jobs now run on QStash** (owner decision, 2026-11-19), so auto-submit runs every 5 minutes for real. Before, GitHub ran it every few hours. Your `runAutoSubmit` in `src/features/assessments/jobs.ts` is unchanged and still idempotent. Keep it that way: QStash delivers at least once and GitHub stays as a backup, so it can run twice. New jobs go in `src/lib/jobs/registry.ts` (ask A), with their logic in your feature folder, as for auto-submit.
- For B: tenancy part 1 is live on production and preview (`Workspace` `ws_nexa_legacy`, `Membership`, `Learner`). Nothing reads these tables yet. The question about the `Course` fields for part 2 still stands (entry of 2026-11-18).

Questions for the owner:
- Set up QStash: `docs/revamp/a/ops/qstash-setup.md` (account, two signing keys and `APP_URL` on Vercel Production, then the sync script).

## 2026-11-18 Phase 1 tenancy, part 1, `revamp/a-tenancy-core`

Done:
- `tenancy.prisma`: `Workspace`, `Team`, `Membership`, `TeamMember`, `Learner` (with the v1 tutor consent attestation), `Guardianship` and `AuditLog`, plus their enums. `core.prisma`: `User.platformRole`, and `Tutor.userId`/`Student.userId` (unique, nullable until backfilled). Migration `4_tenancy_core` is additive only.
- `scripts/backfill-tenancy.ts`: idempotent, dry-run by default, counts only. It refuses production without `--allow-production`. It creates `ws_nexa_legacy` (comped organisation "Nexa"), links profiles by email, and makes tutors members (OWNER via `--owner-email`, otherwise ADMIN), students learners and admins `NEXA_ADMIN`.
- On the preview branch: the migration is applied, the backfill linked 1 tutor and 8 students (0 unmatched), and a re-run found nothing to do.

Next:
- Part 2: `Enrollment` and `CourseStaff`, `Course.workspaceId`/`teamId`/`ownerMembershipId`, and the enrolment backfill. Then `getViewer()` reads the tables instead of the Phase 0 bridge, and `withWorkspace()`.

Blocked on the other agent:
- For B: part 2 needs these on `Course` in `learning.prisma` (your file): `workspaceId String?` (made required after the backfill), `teamId String?`, `ownerMembershipId String?`, their relations, and the back-relations `staff CourseStaff[]` and `enrollments Enrollment[]`. The implicit `CourseEnrollments` join stays until your pages read `Enrollment`. May A add exactly these in its part 2 PR for you to review, or would you rather add them? Answer in `b/HANDOFF.md`.

Questions for the owner:
- Production, when ready: `migrate deploy` (applies `4_tenancy_core`), then the backfill dry run, then `--apply --allow-production --owner-email=<your email>`.

## 2026-11-18 Auto-submit move and Preview migrations, `revamp/a-jobs-preview-migrate`

Done:
- The auto-submit logic moved, unchanged, to `src/features/assessments/jobs.ts` (`runAutoSubmit`), as B agreed. `/api/cron/auto-submit` is a thin `defineJob` caller.
- `vercel-build` (`scripts/vercel-build.mjs`): Preview builds run `prisma migrate deploy` against the Neon `preview` branch before `next build`. Production builds never migrate. The build stops if Preview's `DIRECT_URL` points anywhere but the preview endpoint, and it skips with a warning if the variable is unset. `scripts/check-vercel-build.mjs` (6 checks).

Next:
- Phase 1 tenancy schema and migration (design 01).

Blocked on the other agent:
- For B: `runAutoSubmit` is yours now in `src/features/assessments/jobs.ts`. The route stays A's.
- For B: migrations reach the preview branch on every Preview build once the owner sets `DIRECT_URL`. No hand step is needed.

Questions for the owner:
- Set `DIRECT_URL` for Vercel's Preview environment (the agent was not allowed to). The PR has the command.

## 2026-11-17 Legacy Batch 5: scheduled jobs and health, `revamp/a-jobs`

Done:
- `src/lib/jobs/`: `registry.ts` (job, path, schedule, staleness), `verify.ts` (`verifyJobRequest`: Bearer `CRON_SECRET`, constant-time, fails closed in production), `define.ts` (`defineJob(name, run)` returns `GET` and `POST` and records a `JobRun`, best effort). A claims `src/lib/jobs/**` as infrastructure (it is not in the AGENTS.md map).
- `JobRun` model in `core.prisma`, with migration `3_job_run` (first named `20261117000000_job_run`, renamed to follow the `N_name` scheme before it reached production), generated offline.
- Routes: `/api/cron/auto-submit` (the logic moved unchanged from `/api/auto-submit`, which is now an alias), `/api/cron/notifications` (now on `defineJob`) and the new `/api/cron/housekeeping` (prunes `JobRun` after 30 days).
- `/api/health`: public, flags and ages only. 503 when the database is down or a job is stale; "unknown" before the first run or before the migration.
- The workflow calls `/api/cron/auto-submit` and runs housekeeping daily at 00:30 UTC. `scripts/check-jobs.ts` keeps the workflow and registry in step (21 checks).

Next:
- QStash signature support in `verify.ts` with Stage 2. Delete the `/api/auto-submit` alias after one release. The retention job joins with Phase 2 billing.

Blocked on the other agent:
- For B: the auto-submit logic is in `src/app/api/cron/auto-submit/route.ts` for now. Design 07 moves it to `src/features/assessments/jobs.ts` with your agreement: say so in `b/HANDOFF.md` and A will move it.

Questions for the owner:
- Apply the `JobRun` migration to production with `prisma migrate deploy` (after the baseline runbook). Until then jobs still run, `JobRun` simply records nothing, and `/api/health` reports jobs as "unknown".

## 2026-11-17 Account banners, `revamp/a-account-banners`

Done:
- `<AccountBanners viewer />` (`src/features/workspaces/components/account-banners.tsx`, a server component) for AppShell's `banner` slot, as B asked. The rules live in `src/features/workspaces/account-banners.ts` (`accountBannersFor(viewer, now)`, which is pure). The wording follows ux/03 and ux/06:
  - **Impersonation:** first, danger, with a link back to `/admin`. `endImpersonation()` arrives with the admin console.
  - **Billing:** staff only. Trial (last 5 days), past due, read-only and cancelled each have a version for billing people (owner or admin) and one for other staff. Learners and guardians never see billing banners. Amounts and renewal dates join the messages with the Phase 2 billing queries.
  - **Email verification:** a "Resend link" button that calls the existing `requestEmailVerification` (throttled).
- Removed `getOwnProfile()`: B found `getViewer()` already carries the avatar.
- `scripts/check-account-banners.ts` (17 checks).

Next:
- Phase 1 tenancy schema and migration (design 01).

Blocked on the other agent:
- For B: in the dashboard layout pass `banner={<AccountBanners viewer={viewer} />}` to `AppShell`. In Phase 0 only the email banner can appear (for unverified users), because billing is comped and nobody impersonates.

Questions for the owner:
- None.

## 2026-11-16 Phase 0: supplies for legacy Batches 2 and 3, `revamp/a-batch23-supplies`

Done:
- `getOwnProfile(viewer)` in `src/features/users/queries.ts` returns `{ name, email, avatarUrl, persona, roleLabel }` from the viewer, with no extra query. It replaces `ProfileContext` and `/api/profile` for the shell.
- Blob kind `assignment-brief` (`BlobKind.AssignmentBrief`, `assignmentBriefPath(submissionId, name)` = `submissions/<id>/brief/<name>`). Tutor only; same document types as lesson attachments; 100 MB. For a saved assignment, the token route checks that the tutor teaches its course. A draft id passes, and unused drafts fall under the 14-day grace rule.
- `scripts/check-batch23-supplies.ts` (11 checks).

Next:
- Batch 4 deletions once B finishes Batches 2 and 3 and the owner tests them.

Blocked on the other agent:
- For B, Batch 2: in `src/app/dashboard/layout.tsx` call `requireViewer()`, then `getOwnProfile(viewer)`, and pass the fields to `DashboardShell`, `Header` and `Nav`.
- For B, Batch 3: upload briefs with `uploadFile({ kind: BlobKind.AssignmentBrief, pathname: assignmentBriefPath(id, file.name), file })`.

Questions for the owner:
- None.

## 2026-11-16 Phase 0: getViewer(), `revamp/a-viewer`

Done:
- `src/lib/viewer.ts` (server): `getViewer()`, `requireViewer()`, `canIn()`, `ViewerError`. `src/lib/viewer-core.ts` (client-safe): the types, `can()`, `needsScope()`, the permission matrix and `LEGACY_WORKSPACE`.
- Phase 0 bridge: until Phase 1 creates workspaces, every user is in one comped organisation, "Nexa" (`ws_nexa_legacy`). TUTOR becomes staff with the TUTOR role, STUDENT a learner (minor, payments hidden), PARENT a guardian with no children yet, ADMIN a Nexa admin. The shape is final; Phase 1 swaps the internals.
- `src/lib/safe-action.ts`: `viewerActionClient` and `guardianActionClient` added. `staffActionClient` and `adminActionClient` now add `ctx.viewer` beside `ctx.session` (non-breaking).
- `src/features/workspaces/actions.ts`: `switchWorkspace` (sets the `nexa_ws` cookie).
- `scripts/check-viewer.ts` (29 checks).

Next:
- Owner merges. Then legacy replacement batch 1 (design 07).

Blocked on the other agent:
- For B: import `getViewer` and `requireViewer` from `@/lib/viewer` in server code. Client components import types and `can()` from `@/lib/viewer-core`, because `viewer.ts` is server-only. The contract is updated to say so in its own PR.

Questions for the owner:
- None.

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

## 2026-11-19 Sentry, `revamp/a-sentry`

Done:
- `@sentry/nextjs` 10.77.1 (pinned, Next 15 supported). `src/instrumentation.ts`, `src/instrumentation-client.ts`, `withSentryConfig` in `next.config.ts`. All off unless `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is set; source maps upload only when `SENTRY_AUTH_TOKEN` is set.
- Privacy in `src/lib/sentry/scrub.ts` (`beforeSend`): no PII, bodies, cookies or auth headers; no replay; traces 0.1; environment from `VERCEL_ENV`. Check: `scripts/check-sentry-scrub.ts`.
- `defineJob` failures are captured, tagged with the job name. Owner steps: `ops/sentry-setup.md`.

Next:
- Capture errors in the Paystack webhook route when it exists (`Sentry.captureException(e, { tags: { route: "paystack-webhook" } })`).

Blocked on the other agent:
- For B (optional, no change made): an App Router `src/app/global-error.tsx` that calls `Sentry.captureException(error)` would also catch root-layout render errors. Route-level errors are already captured through `onRequestError`.

Questions for the owner:
- Create the Sentry project and set the variables (see `ops/sentry-setup.md`). Nothing happens until you do.

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
