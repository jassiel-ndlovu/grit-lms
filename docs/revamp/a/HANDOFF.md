# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-24 Branding and API screens (taken from B's backlog), cover fixes, `revamp/a-brand-api-screens`

The owner asked A to take B's backlog items. No migration.

**Settings › Branding** (`/dashboard/settings/branding`, `workspace.branding`):
- Plus: logo upload (new Blob kind `workspace-logo`, PNG, JPEG or WebP under 1 MB; the token needs `workspace.branding` in that organisation), colour, sender name and welcome text.
- A live preview of the email header and From line.
- The sign-in link to share.
- Pro: white-label on or off, with the support email it requires. Below Plus or Pro, it explains the plan with a link to Billing.

**Branded sign-in page** `/w/<slug>`:
- The organisation's logo, name, welcome text and colour over the shared sign-in form. The form moved to `components/auth/sign-in-card.tsx`; `AuthFrame` takes an optional `brand`.
- With white-label on: no "Nexa" in the header or footer, no Back to home, and the support email is shown.
- Without Plus branding, the page sends people to `/auth`.

**Settings › API and webhooks** (`/dashboard/settings/developers`, `workspace.settings`, Pro):
- **Keys:** create (name, what it can read, expiry), shown once with Copy; revoke.
- **Webhooks:** add (https address, events), signing secret shown once; send a test; switch on or off; new secret; recent deliveries with Send again; delete.
- Short notes for developers on the key header and checking signatures.

**Cover (B's four points):**
- managers with `cover.manage` for that course (whole organisation, or the course's branch) are told when cover is asked for;
- the covering tutor is told when it's called off;
- changing or calling off cover keeps the covering tutor's access while they cover another unfinished class of that course;
- the absent tutor's note links to `/dashboard/cover`.

**viewer.md Draft 1.30:** `getStudyStatus` reason `OFF_FOR_STUDENT`.

**For B:** using the brand in the dashboard shell (logo and colour for that organisation's members) is still yours, as viewer.md says.

**Tested:**
- **Real Chrome, 30 checks:** logo upload, saving, white-label refused without a support email then saved, and the branded page (logo, welcome text, colour on both buttons, no Back to home, support email, an unknown slug goes to /auth).
- **The API key against /api/v1:** 200 for its scope, 403 for another, 401 once revoked.
- **Webhook:** created, test sent (a 405 is shown as a failure with its reason), switched off, deleted.
- **Phone width.** No console errors.
- **Cover:** 6 checks on Preview with a temporary class, cleaned up.
- **Test data restored.** The test organisation's branding is back as it was, and the test logo was deleted from Blob.

## 2026-11-24 Sidebar scroll, personal details removed, legal pages, sign-in theming, contact form, `revamp/a-sidebar-legal`

Owner's requests (24 Nov). No migration.

**Sidebar:** the sections scroll when they don't fit, and Settings and Help stay pinned at the bottom (`app-shell.tsx`, `data-slot="sidebar-scroll"`). The account menu's organisation list scrolls on its own after about eight rows.

**No personal details on the site:**
- `APP_CONTACT` now holds only `supportPath`, `contactPath` and "South Africa".
- Nexa's own inbox is server-only: `NEXA_INBOX` and `ENQUIRY_INBOX` in `lib/email/config.ts` (SUPPORT_TO, then ENQUIRY_TO, then the owner's inbox until those are set).
- Removed:
  - the landing page's email links ("Request access", "Ask about your organisation" and "Email us"; they now go to `/contact`);
  - the sign-in page's request-access email;
  - the parent dashboard's "Contact the school" email (now "Ask for help" in Help);
  - the legacy sidebar's contact block;
  - the old footer, deleted.

**Contact form** (B's backlog item, taken):
- `/contact` with `?kind=ACCESS|TEAM|OTHER`, sending to A's `submitPlatformEnquiry`.
- **Nexa-admin inbox:** `/dashboard/admin/enquiries`, "Enquiries" under Platform. Mark each one Replied, Done or Spam, with a note. The enquiry email's button opens it.

**Legal pages rewritten:** `/privacy-policy` (POPIA-shaped: responsible party vs operator, children, AI, cross-border, retention, cookies, rights, the Information Regulator) and `/terms-of-service` (accounts, organisations, use, content, AI, plans, fees, credits, ending, liability, law). Both use the shared `components/legal/legal-page.tsx`. Every fact follows the code: 14-day trial, 30-day billing, 2% commission, 14-day deletion grace, retention periods, cookies. **The owner should have both reviewed legally.**

**Sign-in theming:** the auth pages and parts (sign-in, sign-up, invite, set password, two-step) use theme tokens instead of slate, white and orange. Dark mode and the colour themes follow what the person chose, which is saved in the browser and survives signing out.

**Tested:** real Chrome:
- the sidebar at 560 px high (scrolls; Help visible; the last item reachable);
- the auth pages in light, dark with Ocean, and Sunset (buttons follow the theme);
- legal, contact and landing at 1366 and 390 px (no personal details, no Nexa email links, no sideways scroll);
- the contact form end to end. No console errors.

## 2026-11-24 Wording pass, part 1: payments, billing, settings and messages, `revamp/a-wording`

Owner's request (24 Nov): text must be useful, unambiguous, relevant and specific; no supplier names; don't assume people know the app.

**New:**
- **`docs/revamp/copy.md`**, the wording guide for both agents: five rules, headings and buttons, a glossary.
- **`scripts/check-copy.ts`** (CI): fails if text people read names a supplier (Paystack, Resend, Vercel, Anthropic and so on) or shows an error code. Nexa-admin screens, provider code and the developer API are exempt.

**Changed (A's side, plus shared shell and sign-up text):**
- **No supplier names on any screen people see.** Payment screens say "a secure payment page" and "your bank confirms the payment", and tell people not to pay twice while a payment is confirming.
- **Payment-service errors** no longer reach people word for word. `safe-action` logs the detail and returns "We couldn't reach the payment service. Nothing was charged. Try again in a minute." Payout errors used to show the raw message.
- **"Workspace" becomes "organisation"** everywhere people read it: sign-up, the account menu, billing, banners, errors and billing emails. Nexa-admin screens keep "workspace".
- **"Read-only" becomes "locked"**, with what it means: everyone can still see their work, but nothing can be changed until it's paid for. One sentence for it in `safe-action`, the API guard, billing and `READ_ONLY_REASON`.
- **"Off-site" becomes "paid in cash or by transfer".** "Payout account" becomes "the bank account your fees are paid into". The refund-recovery emails explain payouts in those words too.
- **"Something went wrong" is replaced** with what failed and what to do (sign-in, sign-up, password, invitations, services, imports, fees and billing fallbacks). Technical fee and discount errors ("percentBps from 1 to 10000", "No open invoice with that id") are reworded.
- **Short descriptions under headings that needed them:** Fees (staff, and families), and each billing tab (Billing, Usage, Payments, AI credits).

Check scripts updated for the new wording. Not changed: Nexa-admin screens (admins need the supplier's name to find payments) and the API's English, which is for developers.

**For B, part 2:** the learning pages (tests, assignments, grades, courses, calendar) with copy.md. For example, "release marks" becomes "share marks"; also check headings and empty states. `check-copy.ts` will flag supplier names and codes as you go.

## 2026-11-24 Help and contact centre (owner's request), `revamp/a-help-centre`

Contract: `docs/revamp/contracts/support.md` (Draft 1.0). Migration `44_support_queries` (additive: SupportQuery, SupportMessage, four enums; references start at Q-1001).

**What it is:** one place for students, parents, tutors and organisations to ask a question, report a problem or give feedback, and get an answer in a tracked thread.

**Routing:**
- Students and parents: questions about classes, tests and fees go to their organisation (the tutors of the chosen course, plus staff with "Handle enquiries" in scope). Everything else goes to Nexa. They can change the suggestion.
- Staff and the public always reach Nexa.
- A Nexa admin can hand a query to the organisation, or take it back.

**Pages:**
- `/dashboard/help`: rebuilt. Help articles for the viewer's role (searchable, plain words), Contact us, and their queries.
- `/dashboard/help/new` and `/dashboard/help/[id]`: the form and the thread.
- Inboxes: `/dashboard/support` (organisation, "Queries" under People) and `/dashboard/admin/support` (Nexa, "Support" under Platform).
- `/support`: the public page, rebuilt in the new look. It no longer shows a personal email address or phone number. Its form sends a confirmation email with a private link (`/support/q/<token>`).

**Also:**
- Screenshots: a new upload kind, `support-attachment` (images only, 5 MB, the uploader's own folder only).
- Emails: `support:staff` (to SUPPORT_TO, else ENQUIRY_TO, else the contact address) and `support:requester` (public requesters only; signed-in people get notifications).
- Housekeeping deletes queries closed for 2 years. Account deletion removes the person's own queries and takes their name off messages they wrote.

**Tested:**
- `scripts/check-support.ts` (in CI): routing, statuses, attachments, input, and the help text (it never names a provider).
- 37 checks against the Preview DB: who sees what across two organisations, tutors and families, internal notes, reopening, the public form with honeypot, the private link, the hand-over, and deletion. Cleaned up afterwards.
- Real Chrome, 22 checks: student sends from Grades, owner answers and adds a note, student sees the reply but not the note and rates it, the public form, and phone width (390 px, no sideways scroll). No console errors.

For B: restyle freely. The help articles are data in `features/support/help-articles.ts`, so keep them current when screens change.

## 2026-11-24 Test pass before the switch to the new look, `revamp/a-test-pass-fixes`

Main at d226489 (#267), built for production and run locally against the Preview database with `REVAMP_UI=1` and `BILLING=1`.

Results:
- **Checks:** types, lint and all 90 check scripts pass (85 static, and the 5 database ones against Preview).
- **Crawl:** 12 seeded roles x 55 pages, 660 page loads. No 5xx responses, no error screens. Every 404 and redirect matches the role's permissions.
- **Walkthrough:** 69 page loads in real Chrome, desktop (1366px) and phone (390px).

Fixed here:
- **Phone tables scrolled the whole page sideways** (Tests, Billing, and every table in an `overflow-x-auto` box). An `sr-only` label in the last column is absolutely positioned and escaped the scroll box. Each scroll box is now `relative`, as `components/ui/table.tsx` already was.
- **Hydration error on the student's Grades page.** The chart's SVG `<title>`s were built from several text pieces. React 19 wants one string, so each is now one template string (`features/grades/components/charts.tsx`).
- **Staff opening `/dashboard/courses`** saw "No student profile found". Staff with no student profile now go to Manage courses; staff who are also students still see their courses.

Not faults:
- Headless Chromium's cut-down locale data formats en-ZA as en (R2,150). Real Chrome and Edge match Node (R2 150), so prices don't change on load.

## 2026-11-24 Owner decisions: credit top-ups and a student-paid study assistant, `revamp/a-credit-topups`

**Owner decisions** (brief: https://claude.ai/artifact/5yD1pSuxqSh2mCGDY3BcN6):
- **Parked:** WhatsApp and SMS reminders; the tutor-funded study assistant; audio and video transcription (after January, with a market check).
- **The study assistant is paid by students** or their parents.
- **Top-ups:** a markup of 8 to 15%; healthy packs only; validity follows the AI supplier (Anthropic now, the CPA's 3 years on AWS).

Migration `43_ai_credit_topups`: PaymentPurpose `AI_CREDITS` and AiCreditPool `STUDENT`. Billing contract Draft 1.18, viewer Draft 1.29.

Done:
- **`ai-credits/topup-math.ts`** (pure): packs, markup bounds, validity, credits per pack, unspent at expiry.
- **`ai-credits/topups.ts` and `topup-actions.ts`**:
  - the offer, starting a top-up (organisation, adult paying student, parent for a child);
  - `applyTopupPayment` (called from `settlePayment`), and the status for the return page;
  - study credits, `expireCredits` (housekeeping).
- **The study assistant** spends the student's STUDENT credits only. Its status gives a reason; with billing off it's closed.
- `AI_CREDITS.markupBps` is now 12%; `check-ai-credits` was updated.

Tested:
- `scripts/check-ai-topups.ts` (in CI).
- 14 checks against the Preview DB (BILLING=1, provider stubbed): no credits refused; purchase and repeat settle; the return-page status and its ownership; the organisation's pool untouched; a failed payment; spend, then expiry with the newer pack kept; run once. Cleaned up afterwards.
- **Real Paystack test mode, run 24 Nov after the merge.** `PAYSTACK_TEST_SECRET_KEY` from `.env.local` was passed in as `PAYSTACK_SECRET_KEY` for the test only, against the Preview DB, with BILLING=1:
  - `startTopup` got a real checkout link, and an unpaid checkout settled to nothing;
  - a purchase paid with Paystack's published test card under Nexa's own reference was verified and settled by Nexa's code: the student got exactly the pack's credits, and a repeat settle added nothing.
  - Paystack's fee on R150 was R6.16 (about 4.1%), which leaves about 8% at the 12% markup.
  - The hosted checkout page itself wasn't driven (Paystack's own UI).
  - Cleaned up afterwards.

## 2026-11-24 #216 phase 3: AI marks on photo answers, session notes, diagrams, `revamp/a-ai-media`

Migration `42_ai_media`: AiMarkSuggestion `fromPhotos` and `transcript` (B's assessments file; additive), and the `NOTES` and `DIAGRAM` values on AiAssistFeature. Viewer contract Draft 1.28.

Done:
- **AI marking:**
  - `FILE_UPLOAD` questions and uploads are included;
  - `readableFiles`: only Blob-store images and PDFs, at most 5;
  - the marker sends them as URL image or document blocks, with photo rules in the prompt and a `transcript` field;
  - photo answers go to the escalation model, and evidence is checked against the transcript;
  - evidence matching now ignores notation (², TeX, ×, spacing).
- **`ai-assist/media-rules.ts`** (pure): `transcriptText` (VTT, SRT, plain), `speakersOf`, `cleanSvg`.
- **`ai-assist/pro.ts`**:
  - `sessionNotes` (transcript text or file; speakers and roster scrubbed);
  - `diagram` (SVG cleaned, or refused);
  - both Pro only, with caps 200 and 300.

Tested:
- `check-ai-marking` (new photo and notation checks) and `check-ai-media` (in CI).
- **Live:**
  - a synthetic handwriting image, uploaded to the Blob store and deleted straight after, was transcribed exactly and marked 3/3. That run found the ² versus ^2 evidence problem, now fixed.
  - Session notes from a VTT had homework and follow-ups right, with no names left.
  - A free-body diagram came back as a clean SVG.
  - Run rows were cleaned up.
- **Not done:** audio and video transcription (needs a provider decision).

## 2026-11-24 #216 phase 3: course study assistant (Pro), `revamp/a-study-assistant`

Migration `41_study_assistant`: StudyChat and StudyMessage, plus the `study-assistant` Service row, backfilled where `ai-marking` is on. Viewer Draft 1.27, services Draft 1.8.

Done:
- **`study/study-rules.ts`** (pure): material picking (all lessons when they fit, so they cache; otherwise the most relevant), concern handling, citation checks.
- **`study/study-model.ts`**: a cached system prompt and course material, structured answers (answer, citations, outOfScope, concern), refusal fallback, Opus 5.5.
- **`study/study.ts` and `actions.ts`**:
  - students and parents ask; 25 a day;
  - credits spent;
  - wellbeing and safety concerns flag the chat and alert the tutors;
  - tutors list and read chats; the flag is hidden from students.
  - Chats are pruned after a year, included in the user export, and deleted on anonymisation.

Tested:
- `scripts/check-study.ts` (in CI).
- Live against the Preview DB (4 questions): a grounded answer with citations, off-topic marked out of scope, an assignment request refused (integrity), and a distress message (wellbeing: flag and tutor alert).
- Access: the tutor list puts flagged chats first, and another student is refused.
- Cleaned up afterwards.

## 2026-11-24 #216 phase 3: branding, white-label and bulk onboarding, `revamp/a-whitelabel-onboarding`

Migration `40_whitelabel_onboarding`:
- Workspace `senderName`, `welcomeText`, `hideNexaBranding` and `supportEmail`;
- Branch `rollout` (BranchRollout) and `rolloutAt`;
- Invite `teamIds`.

Viewer contract Draft 1.26, imports Draft 1.2. **Custom domains are on hold (owner).**

Done:
- **`billing/workspace-plan.ts`**: a workspace's plan from its courses' services (Pro while billing is off, or when comped).
- **`workspaces/brand-rules.ts`** (pure):
  - which templates are branded;
  - the sender name and From header;
  - `applyBrand`: the header logo and name, the accent colour, and with white-label the Nexa name swapped outside tags, with "through Nexa LMS" dropped.
- **`workspaces/branding.ts`**:
  - get and set branding (Plus), white-label (Pro, needs a support email);
  - the public brand for `/w/<slug>`;
  - `emailBrandFor`, cached for 5 minutes.
- **The email queue** applies the brand to workspace emails; `sendEmail` takes `fromName`.
- **Bulk onboarding:**
  - the `branches` importer (`teams.manage`, whole-organisation scope);
  - the staff importer's Teams column, with `Invite.teamIds` joined on accept;
  - `workspaces/rollout.ts` and `onboarding-rules.ts`: the checklist, branch progress, rollout (LIVE needs staff and a course), and the admin overview.
- **Two mistakes caught before commit:** I overwrote two existing files (`workspaces/onboarding.ts` and `scripts/check-branding.ts`) with new code and restored both from git; the new code is in `rollout.ts` and `check-whitelabel.ts`.

Tested:
- `scripts/check-whitelabel.ts` (in CI).
- A real booking email rebranded: no Nexa left in the visible text.
- 16 checks against the Preview DB: plan, logo and colour rules, the sender name, white-label and support email, the public brand, the branches import and re-check, the staff Teams column and invite teams, onboarding progress, and rollout rules. Restored and cleaned up.
- Not tested: accepting an invitation end to end (joining its teams).

## 2026-11-24 #216 phase 3: enquiry pipeline, tutor outcomes and reviews, `revamp/a-enquiries-reviews`

Migration `39_enquiries_reviews`: WorkspaceEnquiry, EnquiryNote, StaffReview and their enums, plus `Workspace.enquiryFormOn`. Viewer contract Draft 1.25.

Owner, 24 Nov: **white-labelling for businesses stays in scope; custom domains are on hold.**

Done:
- **`crm/enquiries.ts`**:
  - the public form (off by default; honeypot, fill time, rate limits);
  - in-app notes to managers in scope;
  - create, update, stage moves (LOST needs a reason), notes;
  - staff-written emails to the enquirer (`enquiry:reply`, Reply-To the staff member);
  - the board with counts and search, and the funnel for the dashboard;
  - follow-up reminders and a 24-month prune (housekeeping).
- **`staff/outcomes-math.ts`** (pure) and **`staff/outcomes.ts`**: per-tutor outcomes; reviews (create with the outcomes saved, edit, share, acknowledge, list) with scope from `staff.reviews`.
- **`crm/actions.ts`**.
- Shared reviews are in the user export.

Tested:
- `scripts/check-outcomes.ts` (in CI).
- 25 checks against the Preview DB covering form off and on, the honeypot, board, search, notes, stage rules, email, funnel, reminder, outcomes scope, and the review lifecycle. Cleaned up afterwards.

## 2026-11-24 #216 phase 3: timesheets, payroll export and cover, `revamp/a-timesheets-cover`

Migration `38_timesheets_cover`: Timesheet, TimesheetEntry, PayRate and CoverRequest, with their enums. Viewer contract Draft 1.24.

Done:
- **`staff/timesheet-math.ts`** (pure): suggestions from classes, cover and bookings; pay; month ranges in the workspace zone; status moves; clashes.
- **`staff/scope.ts`**: the staff a manager covers (whole workspace, branch teams, or self).
- **`staff/timesheets.ts`**:
  - the month view with suggestions;
  - adding suggestions, manual entries, edits, submit;
  - approve, reject or reopen, with the rate and pay recorded at approval;
  - pay rates, the manager list, and the payroll CSV (`/api/exports/payroll`).
- **`staff/cover.ts`**:
  - request, free candidates, assign (temporary ASSISTANT access, plus an email and in-app notes), cancel, list;
  - `endCoverAccess` runs in housekeeping.
- **Bug found in testing and fixed:** a covered class now counts as cover, and courses reached only through cover don't add their other classes.

Tested:
- `scripts/check-timesheets.ts` (in CI).
- Against the Preview DB:
  - suggestions, adding without duplicates, month bounds, totals, rate permissions;
  - submit, lock, reject-needs-a-note, approve with snapshot, the manager list, the payroll CSV (summary and detail);
  - cover request, double request refused, candidates, assign, access, both tutors' suggestions, the email, the list, access ended after a day, cancel.
  - Cleaned up afterwards.

## 2026-11-24 #216 phase 3: API keys, read-only REST API and webhooks (Pro), `revamp/a-api-webhooks`

Migration `37_api_webhooks`: ApiKey, WebhookEndpoint, WebhookDelivery and WebhookDeliveryStatus. New contract `contracts/api.md` (Draft 1).

Done:
- **`api/api-math.ts`** (pure): keys (shown once, sha256 stored), bearer parsing, scopes, webhook URL rules, private-address checks, HMAC signatures (`t=…,v1=…`), retry timing, cursors, the per-key minute rate limit.
- **`api/manage.ts` and `actions.ts`**: the Pro gate (`apiAccessAvailable`), keys (create, list, revoke), endpoints (create, update, rotate the secret, delete, test, deliveries, retry), `authenticateApi`, and audit rows.
- **`api/v1.ts` and `app/api/v1/*`**: courses, learners, grades, attendance, invoices and bookings, paged and workspace-scoped.
- **`api/webhooks.ts`**:
  - `emitWebhook` writes rows, inside the caller's transaction when given one;
  - `drainWebhooks` runs from the notifications job: DNS-checked, signed, retried, and switches an endpoint off after 3 days of failures;
  - deliveries are pruned after 30 days by housekeeping.
  - Secrets are sealed with a key derived from NEXTAUTH_SECRET.
- **Events emitted from A's code:**
  - `invoice.paid` (online and offsite);
  - `booking.created` and `booking.cancelled`;
  - `attendance.marked`;
  - `risk_alert.opened`;
  - `enrolment.created` (join requests, managed accounts, import).
  - B emits `grade.released`.

Tested:
- `scripts/check-api.ts` (in CI).
- Against the Preview DB, with fetch stubbed (no real POSTs), 24 checks covering:
  - keys, 401, 403, 400, 429 and paging;
  - emit, drain, the signature, a 500 retried, switched off after 3 days, the test ping, and secret rotation.
  - Cleaned up afterwards.

## 2026-11-24 #216 phase 3: Pro AI drafts, and B's #243, `revamp/a-pro-ai` and `revamp/a-role-scope-243`

Migration `36_ai_assist_pro`: four `AiAssistFeature` enum values. Viewer contract Draft 1.23.

Done:
- **`ai-assist/pro.ts` and `model-pro.ts`** (Pro only, through the shared gate, credits and run records):
  - lessons, tests and assignments from a document;
  - feedback drafts (answers scrubbed);
  - term-report comments (students sent as S1…; names filled in after);
  - curriculum gaps (`uncoveredTopics` is pure) with restructure ideas.
- `PRO_ONLY` and per-feature Pro caps in `limits.ts`.
- `call()` now streams (`finalMessage()`), so long drafts don't hit the SDK's 10-minute non-streaming guard.
- **#243 (PR #252, live):** role scope in `setCourseTeamFor`, the calendar's `visibleCourseIds` and `listPayoutRecoveries`. Pure helpers (`actorCourseWhere`, `calendarCourseWhere`, `seesAllPayoutRecoveries`) are covered in `check-roles`.

Tested:
- `check-ai-assist` (in CI).
- One live run of each Pro feature against the Preview DB (about R3.30), with the course restored and run rows deleted.
- All CI checks.

## 2026-11-23 #216 phase 2: AI help for tutors (Plus limited, Pro more), `revamp/a-ai-assist`

Migration `35_ai_assist`: AiAssistRun (counts and cost only), plus the `ai-assist` Service row, backfilled for courses on Plus or Pro. Viewer contract Draft 1.22, services Draft 1.7.

Done:
- **`ai-assist/limits.ts`** (pure): monthly caps per plan, refusal messages, `plainText` for lesson HTML.
- **`ai-assist/model.ts`**: structured-output calls (Opus 5.5, refusal fallback, cached system prompt) for questions, outlines (text or PDF) and tidy or simplify. The material is wrapped in tags as data.
- **`ai-assist/assist.ts`**: the gate (`courses.edit`, `ai-assist` service, the monthly cap, the AI credit check with billing on), the course context (level and curriculum topics; topic codes filtered to the list), run records, credit spends, and Blob-only file reads.
- `ai-assist/actions.ts`.
- `ai-marking/rules.ts` prices now include Opus 5.5. `check-billing` pins `ai-assist`.

Tested:
- `scripts/check-ai-assist.ts` (in CI).
- One live run of each feature against the Preview DB with the production Anthropic key (about R1.90 in total). Results were sensible; run rows cleaned up.

## 2026-11-23 #216 phase 2: session booking with prepaid lesson packs (Plus), `revamp/a-booking`

Migration `34_session_booking`:
- adds BookingAvailability, BookingTimeOff, Booking (`slotKey` unique while booked) and LessonCredit (`invoiceLineId` and `reversesLineId` unique);
- adds Workspace booking policy columns;
- adds the `session-booking` Service row, backfilled for courses already on Plus or Pro.

Viewer contract Draft 1.21, services Draft 1.6.

Done:
- **`booking/booking-math.ts`** (pure): time-zone conversion, free slots (lead, horizon, buffers, time off, busy), the refund rule, rule validation and balances.
- **`booking/credits.ts`**:
  - `syncLessonCredits` credits paid LESSON_PACK invoice lines and reverses refunded ones, once each;
  - balances, packs on sale, staff adjustments;
  - `buyPack` issues an invoice for checkout (billing on).
- **`booking/bookings.ts`**:
  - availability and time off (own, or `cover.manage`) and the workspace policy;
  - slots (the tutor's classes come from `occurrencesFor`);
  - book (credit used in the same transaction; double-booking stopped by `slotKey`);
  - cancel (credit returned by the policy), mark, meeting link, list;
  - reminders from the notifications cron.
- **Emails:** `booking:confirmed`, `booking:cancelled` and `booking:reminder`, for tutor, student and parent.
- **POPIA:** export (bookings and the credit ledger); anonymising clears notes.
- `check-billing`'s pinned Plus keys now include `session-booking`.

Tested:
- `scripts/check-booking-math.ts` (in CI).
- Against the Preview database with BILLING off and on:
  - availability, slots, booking, double-booking and odd times refused;
  - a pack on sale with no credits refused, a paid pack credited once;
  - a credit used, returned on early cancel, kept on late cancel;
  - an adjustment, and the credits taken back after a refund;
  - lists, marking before the start refused, a single reminder, tutor cancel.
  - Cleaned up, with the tutor's availability restored.

## 2026-11-23 #216 phase 2: at-risk alerts (Pro), `revamp/a-at-risk`

Migration `33_risk_alerts`:
- adds RiskAlert, RiskLevel and RiskAlertStatus;
- adds the `at-risk-alerts` Service row;
- backfills CourseService wherever `ai-marking` is on.

Viewer contract Draft 1.20, services Draft 1.5.

Done:
- **`risk/rules.ts`** (pure): `assessRisk` covers falling and low marks, missed work and absences, with WATCH or AT_RISK. Also `nextStep` (open, update, escalate, resolve) and `riskSummary` (plain language).
- **`risk/evaluate.ts`**: `gatherCourse` (5 queries a course) and `runRiskAlerts`, which runs from housekeeping. It covers Pro courses (every course while billing is off) and skips read-only and cancelled workspaces. Staff get one in-app notification per course.
- **`risk/alerts.ts` and `actions.ts`**:
  - staff list and count, scoped by `grades.view`;
  - share (by email and in-app notice to parents and/or the student, with a note; Pro and `messages.direct`);
  - dismiss (14 quiet days) and resolve;
  - the shared list for students and parents.
- **Email** template `risk:shared` (parent and student versions).
- **POPIA:** alerts are in the user export and deleted on anonymisation; FK cascades cover courses and workspaces.

Tested:
- `scripts/check-risk-rules.ts` (in CI).
- Against the Preview database with a seeded course: open, the second run idempotent, the staff list, share to the student (email queued and the alert visible to the student), dismiss and quiet, reopen after the quiet period, resolve by hand, and auto-resolve. Cleaned up afterwards.
- The full CI check set, `check-schema-split` included (the model lives in messaging.prisma).

## 2026-11-23 #216: landing page support, `revamp/a-landing-support`

Migration `32_platform_enquiries` (PlatformEnquiry, EnquiryStatus). Viewer contract Draft 1.19.

Done:
- **Plan prices:** `marketing/plans.ts` (`getPublicPlans`: Tier rows, cached for an hour, with `live` following BILLING) and `plans-math.ts` (pure).
- **Enquiries:**
  - `marketing/enquiry-rules.ts`: the schema, bot screening (honeypot, fill time) and spam (links).
  - `marketing/enquiries.ts`: rate limits (5 an hour per IP hash, 3 a day per email), saving, the `enquiry:new` email to ENQUIRY_TO (else APP_CONTACT.email) with Reply-To the enquirer, list, update, and prune after 12 months (housekeeping).
  - `enquiry-actions.ts`: public submit and the admin list and update actions.
  - `sendEmail` now takes a per-message `replyTo`.
- **Search setup:** `lib/site.ts`, `app/sitemap.ts` and `app/robots.ts` (production only indexable); root layout metadataBase, Open Graph and Twitter; metadata on support, privacy and terms; a canonical on `/`.
- **Analytics:** `@vercel/analytics` 2.0.1 through `components/site/site-analytics.tsx`. Public paths only, utm tags only, production only.

Tested:
- `scripts/check-landing.ts` (in CI): validation, screening, sources, spam, plans from tier rows, siteUrl, indexable and public paths.
- Against the Preview database: submit, the queued email, bot saved as SPAM without email, the per-email limit, stale forms, list and SPAM filter, update and un-handle, and prune. Cleaned up afterwards.
- Tier rows in Preview and production give R99, R139 and R179.

Owner: switch on Web Analytics in Vercel. Optional: set ENQUIRY_TO to a support inbox.

## 2026-11-23 Phase 1: term report PDFs and offline reading, `revamp/a-reports-offline`

No migration. Viewer contract Draft 1.18. This closes A's phase 1 list in #216.

Done:
- **`reports/term-report-pdf.ts`:**
  - `renderTermReportPdf` (A4, pdf-lib): header and logo, a summary, a block per course (assessments, attendance, comment), a general comment, signatures, page numbers, and "continued" headers;
  - `termReportFileName` and `pdfResponse`.
  - B gathers the data and serves it from B's own route.
- **Offline reading:**
  - `public/sw.js`: static files cached as they load; lessons only when saved; an offline fallback; saved lessons cleared on sign-out; API, auth and non-GET never cached; 50 lessons at most.
  - `public/offline.html`, which lists saved lessons.
  - `@/lib/offline`, for B's buttons.
  - `next.config.ts` serves `sw.js` uncached.

Tested:
- `scripts/check-term-report-pdf.ts` (in CI) checks validity, one page against many, wrapping, line breaks (a bug turned them into "?"; fixed), safe text and a broken logo.
- The service worker was checked in the browser pane on a local server: register, the static cache, save, list, remove and clear, and refusal of API and other-site addresses. Serving a saved lesson while offline couldn't be simulated there.
- Types and lint.

## 2026-11-23 Phase 1: the business dashboard data; #236, `revamp/a-business-dashboard`

No migration. Billing contract Draft 1.17 ("Business dashboard"). New A feature folder `src/features/reports/`.

Done:
- **`reports/business.ts`:**
  - money: invoiced, collected (and off-site), refunded, the collection rate, overdue, and due in the next 7 days;
  - students: active, joined, left;
  - six-month trend, per-tutor table, and AI credits used.
  - A branch role's view counts invoice lines on its branches' courses.
  - Available on Plus and Pro (any course with a Plus or Pro service), when comped, or with billing off.
- **`reports/actions.ts`:** `getBusinessDashboardStatus` and `getBusinessDashboard` (`reports.view`).
- **#236 (B's practice sets):** account deletion removes `PracticeReview` rows; the POPIA export has `practice`. The blob audit already scans `PracticeItem.data` (all JSON columns).
- **`services.md`:** `question-bank` is `v1`, matching the catalogue.

Tested:
- 14 checks against Preview: every money figure, students, trend, per tutor, the branch view, the Plus/Pro gate with billing on, and the export's practice list.
- Types and lint.

## 2026-11-23 Phase 1: AI credits, `revamp/a-ai-credits`

Billing contract Draft 1.16 ("AI credits"). New A feature folder `src/features/ai-credits/`.

Done:
- **Migration `31_ai_credits`** (additive):
  - `AiCreditEntry`, a signed ledger with pool, kind, spender, period key, feature, expiry and an idempotency key;
  - `AiCreditAllowance`;
  - `Workspace.aiPersonalCredits`.
- **`credits-math.ts`** (pure, `scripts/check-ai-credits.ts` in CI): the credit unit, included credits per seat, purchase price, the spending plan and the 80% warning.
- **`credits.ts`:**
  - included grants made lazily per billing period (or trial), from seat charges;
  - balances, allowances (person, team, branch, default), `canSpend` and `spendCredits` (with a per-workspace advisory lock; forced spends record debt on bought credits);
  - the report, allowance and personal-credit settings, and the admin grant.
  - Only with `BILLING=1`; comped workspaces are never refused.
- **AI marking** checks credits before queueing and before each mark, and spends the real cost after.
- **Actions:** `ai-credits/actions.ts` and `adminGrantAiCredits`.

Tested:
- 15 checks against Preview (with BILLING on):
  - the seat-based pool, granted once;
  - spends, the allowance stop, and own credits after the allowance;
  - included then bought, the 80% warning, forced debt, and refusal when empty;
  - the report, comped and trial workspaces, and billing off.
- The pure checks, types and lint. The forced-debt path was wrong at first (the debt went to the included pool and left bought credits untouched); fixed.

Open (owner): pool sizes, the credit unit, the 5% markup, and the legal check on how long bought credits last. Card purchases come with live payments in January.

## 2026-11-23 Phase 1: roles as permission sets, branches and teams, `revamp/a-roles-branches`

Viewer contract Draft 1.17 ("Roles and branches").

Done:
- **Migration `30_branches_roles`** (additive):
  - `Branch` and `Team.branchId`;
  - `WorkspaceRole` and `RoleScope`;
  - on `Membership`: `presetRole`, `customRoleId` and `branchIds`.
- **`src/lib/roles.ts`:** nine presets (the three base roles plus executive, branch manager, project manager, finance, support staff and assistant tutor), `effectiveRole`, and a ceiling (no custom role holds more than an admin). Six new permission keys for the coming tools.
- **Viewer:**
  - permissions come from the effective role;
  - `membership.scope`, `branchIds` and `branchTeamIds`;
  - `needsScope` covers branch roles;
  - `staffScope`, `courseScopeOf` and `scopedCourseWhere`;
  - `canIn` reaches branch courses and teams.
  - Existing members are unchanged: base roles map to their presets with the same grants.
- **A's course-scope call sites now use `scopedCourseWhere`:** imports (both importers, the export, the hourly context), the join-request inbox, fee invoices and `canIn`.
- **Actions** (`role-actions.ts`): roles (list, create, update, delete), member role, branches and teams (create, rename, delete), team members, and course to team. Nobody gives more than they hold or a wider scope; owners are never changed here.

Tested:
- `scripts/check-roles.ts` (pure, in CI).
- 22 checks against Preview covering branches and teams, roles and their limits, branch reach in `canIn`, custom roles, and the branch-scoped inbox.
- Every static check script, types and lint.

For B:
- Move `course-access.ts` (`manageableBy`) and `fee-courses.ts` onto `courseScopeOf` and `scopedCourseWhere`, so branch managers see their branches' courses.
- Screens: roles, member role, and branches and teams in organisation settings.

## 2026-11-23 Phase 1: attendance in Core, weekly parent summary, referrals, `revamp/a-core-parents`

Viewer contract Draft 1.16; services contract updated.

Done:
- **Migration `29_referrals`** (additive): `ReferralCode`, `Referral` and `ReferralStatus`.
- **Attendance register in Core:** a new basic service `attendance`; `live-sessions` (Plus) now means check-in codes and absence emails. `openCheckIn` is gated on it, and `markAttendance` sends absence emails only with it. `check-billing` counts 13 basic keys.
- **Weekly parent summary** (`notifications/weekly-summary.ts`, template `parent:weekly`): queued on Mondays by the daily housekeeping job.
  - Per child: last week's marks, this week's due tests and assignments (done or not), and attendance.
  - Skipped for quiet weeks, email off, and unverified or placeholder addresses. One per parent per week.
- **Referrals** (`workspaces/referrals.ts`; `getReferralLink`, `listReferrals`; `GET /api/referrals/<code>` sets a 30-day cookie):
  - credited on a join request and marked joined on approval, keyed by workspace and student, so cancelling and asking again keeps the credit;
  - your own link, your own child, and students already in the workspace don't count; the first referrer wins;
  - in the POPIA export as `referralLinks`.
  - Rewards are the owner's call.

Tested:
- 19 checks against Preview: the register without absence emails, the summary's content, duplicates, email off and quiet families, and the full referral flow including the cancel-and-ask-again path, which found and fixed a bug.
- Types and lint.

## 2026-11-23 B's findings (#223, #228) and calendar import, `revamp/a-calendar-import`

No migration. Viewer contract Draft 1.15; imports contract Draft 1.1.

Done:
- **Read-only workspaces show their pages (#223.3).** Staff keep their permissions; writes are refused on the server instead.
  - A's write actions on `viewerActionClient` moved to `writableViewerActionClient`: account actions, invites, calendar writes and the teaching switch.
  - The legacy API write routes use the new `requireApiStaffWrite`, which answers 423. Before this they ignored read-only entirely.
  - Billing, fees, payouts, settings and privacy requests still work.
- **Find courses (#223.1, .2):** search matches the lead tutor's name; `enrolledUserIds` (from `forUserIds`) marks courses the viewer or their child is on. **Inbox:** `decidedBy` per request (#223.7).
- **Smaller fixes (#223):** "switch teaching off" needs the exact name; the user list's date is in the school's zone; the Preview seed only shows a saved card when it can seal a (fake) authorisation (#223.4). The email-change message (#223.5) was already fixed in #220.
- **#223.6:** migration 23's `password <> ''` clause can't catch real self sign-ups in production. Better Auth sign-ups leave `User.password` empty, and `changeOwnPassword` only started writing it after migration 23 ran. On Preview it caught the seed's adult, because the seed sets a password for everyone.
- **Question bank (#228):**
  - workspace deletion (retention) removes `BankQuestion` rows and their images;
  - the POPIA export includes `savedQuestions`;
  - account deletion removes the person's saved questions.
  - The blob audit already scans every JSON column, so bank images count as in use.
- **Calendar import (.ics):** `imports/ics.ts` (time zones, repeat rules, skipped dates, all-day, folded lines) and `importers/calendar.ts`. Checked by `scripts/check-imports-ics.ts` in CI. The engine gained `readText` and `defaults`.

Tested:
- 15 checks against Preview: read-only permissions, tutor-name search, enrolled marks, decline author, calendar import with re-import and undo, tutor course limits, saved questions in export and deletion.
- Every static check script, types and lint.

Still to do:
- Re-seed Preview with `PAYMENT_ENC_KEY` set, so seed-lerato's card counts as saved.

## 2026-11-22 Phase 1: the import and export engine, `revamp/a-imports`

Phase 1 of the backlog (#216). New contract `contracts/imports.md`, Draft 1. New A feature folder `src/features/imports/`.

Done:
- **Migration `25_import_jobs`** (additive): `ImportJob` and `ImportStatus`. Rows live on the job as JSON; sign-in codes are sealed on it until they expire; jobs are deleted after 30 days.
- **Engine** (`imports/engine.ts`): create (parse and check), edit (re-check every row), confirm (check again; `consentAttested` where needed; optionally skip error rows), apply in batches under a lease, and undo within 24 hours, newest row first.
  - Rows commit one by one, so a bad row fails alone and a long import survives timeouts.
  - Applying is driven by `after()` on confirm, by the screen's poll, and by the hourly notifications job.
- **CSV** (`imports/csv.ts`): quoting, line breaks in quotes, byte-order mark, comma, semicolon or tab, header aliases, and formula-safe export. Checked by `scripts/check-imports-csv.ts`, which runs in CI.
- **Students importer:** students with parents, sign-in codes and courses by name.
  - A student the workspace manages is updated; anyone with their own account is skipped (they use join requests).
  - Tutors import only into their own courses.
  - Undo removes accounts that never signed in.
- **Staff importer:** invitations per row, with only owners inviting admins. Undo revokes invitations not yet accepted.
- **Sign-in cards:** `getSignInCards`, audited. **Students export:** `GET /api/exports/students`, in the template's columns.
- **Actions** for B in `imports/actions.ts`.

Tested:
- An end-to-end script against Preview (34 checks) covered every row type, edits, consent, applying, cards, the export, undo (including keeping a student who had signed in), tutor course limits and the staff import. All data was removed afterwards.
- The CSV checks, types, lint and the build pass.

Notes:
- Local test runs need `NEXTAUTH_SECRET`, because codes are sealed with the email queue's key. Preview and production have it.
- Next for A in phase 1: calendar import (.ics), then the other phase 1 items in #216.

## 2026-11-22 B's requests and NextAuth's removal, `revamp/a-admin-batch`

Clears what was waiting on A before phase 1 of the backlog (#216). Viewer contract Draft 1.14.

Done:
- **Migration `24_themes_accessibility_meeting_provider`** (additive): `UiTheme` gains OCEAN, SUNSET and CONTRAST (#217); `UserPreferences.textSize` and `readingFont` (#216); `Workspace.meetingProvider` (#211).
- **Viewer:** `user.textSize`, `user.readingFont` and `workspace.meetingProvider`. `setMeetingProvider` is for owners and admins.
- **NextAuth removed (#203):** the stand-in `/api/auth/[...nextauth]`, `lib/next-auth.d.ts`, and the `next-auth` and `@next-auth/prisma-adapter` packages.
- **Error messages (#185, #150):** user-facing errors in AI marking, calendar, email change, notifications and the old admin student form are now `UserError`. The old form's "already exists" message no longer repeats the email.
- **Read-only (#150):** a new `writableViewerActionClient`; the AI marking writes use it. They were already refused (read-only removes `courses.edit`), but with the wrong message.
- **Sign-up return path (#174):** `signUpWithPassword` takes `callbackUrl` (same-site paths only).
- **CI (#215):** `.github/workflows/ci.yml` runs types, lint and every `scripts/check-*` on pull requests, except the 5 that need a database.
- **Admin home (#215):** `AdminDashboard` is on `PageFrame`, and its "coming soon" cards are replaced by links to the admin tools that now exist.
- **Two small type fixes in B's files,** needed once `UI_THEMES` grew: `components/preferences-provider.tsx` (theme type) and `features/courses/components/theme-picker.tsx` (a branch that became unreachable). For B's review.
- **Billing go-live runbook** (`ops/billing-go-live.md`): billing stays off until January (owner, 22 Nov).
- **Backlog (owner, 22 Nov):** split of work in #216; the landing page was added to the tracker.

## 2026-11-22 React 18.3 to 19, `revamp/a-next`

The owner's tracker lists this as A's (root config). PR #202 (with #206 and the #201 follow-up) merged and is live. Production has migrations 22 and 23, applied after the backup `backup-teaching-joins-20261122`.

Done:
- **React 19.3.1:** `react` and `react-dom` upgraded; the types were already 19.
- **Peer dependency:** `mafs` pulls in `use-resize-observer`, which still declares React up to 18. An npm `overrides` entry gives it the app's React, and `npm ls` is now clean.
- **Removed APIs:** none in our code. `findDOMNode`, `ReactDOM.render`, `defaultProps` on functions and string refs are all absent; the `useFormState` in `form.tsx` is react-hook-form's.

Tested:
- Types, lint and `next build` pass.
- **Local dev server against the Preview database,** signed in as a seed owner. No console errors on:
  - sign-in and two-factor setup;
  - dashboard, manage courses and a course overview;
  - the lesson editor (Tiptap with maths);
  - students and calendar;
  - the graph dialog (`mafs`), which renders its live preview.
- Fees showed "page not found" locally only because billing was off in that setup.

For B: rebase or merge `main` into open branches. Nothing in your code needed changing.

## 2026-11-21 Teaching switch, join requests and colour themes (#206), `revamp/a-206-teaching-joins-themes`

Owner decisions of 2026-11-21, relayed by B in #206. Viewer contract Draft 1.12. Stacked on `revamp/a-restart-and-nextauth` (PR #202).

Done:
- **Migration `22_teaching_join_requests_theme`**, additive only:
  - `Workspace.teachingOffAt` and `teachingOffById`;
  - `CourseListing` and `JoinRequest`, with one open request per course and student (a partial unique index);
  - `UserPreferences.theme` (`UiTheme`: CALM, BRIGHT).
  Applied on Preview; production not yet.
- **Back-relations on `Course`** in B's `learning.prisma` (`listing`, `joinRequests`), like the billing ones. No columns. For B's review.
- **Teaching switch** (`workspaces/teaching.ts`):
  - `switchTeachingOff` is owner only and needs the organisation's name. It's refused while an owner or admin still teaches.
  - `adminSwitchTeachingOn` needs `admin.override` and a note.
  - `viewer.workspace.teaches`; the mode is null while teaching is off.
  - `setUpCourseTenancy` and invite acceptance skip CourseStaff for owners and admins while it's off (`mayTeach`).
- **Join requests** (`workspaces/join-requests.ts` and `join-request-actions.ts`):
  - listing, browse, request, cancel, inbox, approve and decline;
  - three emails (`join:requested`, `join:approved`, `join:declined`);
  - limits: 5 open, 10 a day.
- **Tutors can't search for self-registered students.** The enrol picker was already limited to the workspace. The "account already exists" error now points to join requests.
- **`viewer.user.theme`**, saved with `updateOwnPreferences({ theme })`.
- **`UserError`** (`src/lib/user-error.ts`): the safe-action layer now passes its message through. Before this, every plain `Error` from A's account, invite and email-change code reached users as "Something went wrong". Those throws now use `UserError`.

Also in this branch (same session, after #206):
- **#201 reviewed:** B's `assertMayResetPassword` is right. I added one thing it couldn't know about: join requests let staff reach accounts they didn't make.
- **Migration `23_user_managed_by_workspace`:** `User.managedByWorkspaceId`, backfilled for tutor-made and pre-tenancy students and staff-made parents. `assertWorkspaceManages` now guards `resetUserPassword`, `issueSignInCode` and student account deletion, so staff can't take over an account someone made themself. Applied on Preview (seeded students marked; `seed.adult` stays self-made).
- **Audit of A's staff actions for unchecked ids:**
  - AI marking, calendar writes, billing, invites, privacy and email change were already scoped.
  - Fixed: a tutor could invoice, or set a fee schedule for, a student who isn't on their course (`assertLearnerOnCourses`).
  - Fixed: an owner in tutor mode saw the whole workspace's calendar.
  - Fixed: join request checks now use `canIn`, so a course's owner counts.
- **`changeOwnPassword`** compared only `User.password`, so every account made since the cutover got "Current password is incorrect". It now uses `checkPassword`, which reads the credential account. `updateOwnProfile` no longer fails when there is no Student or Tutor row.
- **Housekeeping:** closed #106, #120, #125, #137, #142, #148, #161 and #175.
- **For B:** please audit your own actions (courses, lessons, tests, assignments, grades, events) the same way. Any id taken from input should be checked against `viewer.workspace` or `canIn`.

Tested:
- A throwaway script ran 42 checks against Preview: teaching off and on, the viewer, listings, every request path, consent, limits and emails. All passed and the data was removed.
- Types and lint pass.

Next:
- Push after PR #202 merges (Vercel deploy limit), then migrate production (backup first, AGENTS.md 4.1).
- B builds the browse page, the staff inbox, the theme picker and the teaching switch in settings.

## 2026-11-21 Restarting cancelled workspaces (#191); NextAuth removed from A's code, `revamp/a-restart-and-nextauth`

Owner decision (2026-11-21): restarting with no students is free with a card on file.

Done:
- **`billing/restart.ts`** and the `restartWorkspace` action (billing contract Draft 1.15). It returns PAY_OUTSTANDING, PAY_FIRST_PERIOD, CARD_REQUIRED or RESTARTED (a R0 first period).
- **NextAuth removed from A's code:**
  - `lib/auth.ts` is Better Auth only, with its own `Session` type;
  - middleware checks only the Better Auth cookie;
  - `auth-client.ts` has no NextAuth fallback;
  - the API routes import `Session` from `@/lib/auth`;
  - sign-ins are written to the activity log from a Better Auth hook.
- **What stays until B moves off it:** B's `providers.tsx` (`SessionProvider`) and `features/search/queries.ts` (a type import). The `next-auth` package and `lib/next-auth.d.ts` remain, and a stand-in `/api/auth/[...nextauth]` answers "no session". Delete all three once B is done.
- **`check-branding`:** allows the Neon project name and the word "integrity".
- **Checks:**
  - restart: 8 checks on preview (Preview reseeded afterwards);
  - all check scripts pass;
  - local `next build` passes with a secret set.
- **Process:** the 2026-11-21 deploy limit was hit (#198 merged without a build). This PR waits for every check to pass. See AGENTS.md 4.4.

## 2026-11-21 Organisation and tutor mode (#192); two-factor answers (#178), `revamp/a-viewer-mode`

Done:
- **`viewer.mode`:**
  - set only for org owners and admins who teach; defaults to organisation;
  - tutor mode computes a tutor's grants, and `needsScope` treats them as a tutor;
  - the `nexa_mode` cookie, switched with `switchViewerMode`;
  - the loader counts CourseStaff per membership.
- **`check-viewer.ts`:** the old "no mode field" checks (from the Simple/Technical decision) are replaced by 5 mode checks.
- **#178:**
  - two-factor `allowPasswordless`, which applies only to accounts without a password;
  - the QR package `uqr@0.1.3` approved for B;
  - email change with two-factor needs a session from the last 15 minutes.
- The owner decided two-factor is **not** a hard stop for owners ("Remind me tomorrow" stays), so it isn't enforced on the server.

Waiting on the owner: #191, how much restarting a cancelled workspace with no students costs.

## 2026-11-21 Read-only guard and enrolment scoping (#189); seed seat charges (F5), `revamp/a-read-only-guard`

The owner confirmed production sign-in works after the cutover.

Done:
- **Permissions:** in a read-only workspace, staff keep only `READ_ONLY_STAFF_KEEPS`: content.view, grades.view, billing.*, fees.*, payouts.connect, workspace.settings, workspace.delete. Learners, guardians and Nexa admins are unaffected.
- **Action clients:** `tutorActionClient` and `staffActionClient` refuse with `READ_ONLY:` in a read-only workspace. `tutorReadActionClient` is new, for exports (B to move `exportTestJson` onto it).
- **Enrolment:** `setCourseEnrollment` refuses students who aren't learners in the course's workspace, except in the legacy workspace.
- **F5:** the Preview seed now records advance seat charges for paid periods, as a real payment does. Preview was reseeded.
- **F8:** `/dashboard/fees` is B's page; passed back.
- Checks: 7 on preview; `check-viewer` passes.

## 2026-11-20 Production switched to Better Auth, `revamp/a-auth-cutover`

The owner and B finished the Preview pass (`docs/revamp/b/testing/preview-e2e-2026-11-20.md`). Sign-in worked for every role after #175; no finding blocks the switch.

Done:
- Backup branch `backup-auth-cutover-20261120`.
- `scripts/migrate-auth-accounts.ts --apply --confirm-existing` on production: 9 credential accounts created and 9 emails marked confirmed.
  - The new `--confirm-existing` option exists because 7 of 9 existing users never verified their email. NextAuth didn't require it, so Better Auth would have locked them out. `emailVerified` stays empty, so notification email still waits for verification.
- `AUTH_PROVIDER` and `NEXT_PUBLIC_AUTH_PROVIDER` set to `better-auth` for Production, and production redeployed.
- Checked live:
  - `/api/ba/ok`;
  - a wrong password gets 401, and a foreign origin gets INVALID_ORIGIN;
  - Google sign-in sends people to Google with the live site's return address;
  - signed-out visitors go to sign-in;
  - the sign-in page shows "Continue with Google" and the username field.

Next:
- #189: read-only guard and enrolment scoping.
- F5: the seed lacks advance seat charges.
- F8: a message for minors' fees.
- Two-factor required for owners and admins; email change with two-factor.
- Remove NextAuth.

## 2026-11-20 Email change, `revamp/a-email-change`

Design 02, section 8. Viewer contract Draft 1.9.

Done:
- Migration `21_email_change`: the `EmailChangeRequest` table.
- `features/auth/email-change.ts`: the password is re-checked (credential Account or User.password, bcrypt or scrypt).
  - The confirm link goes to the new address and lasts 1 hour.
  - On confirm: the email is verified, the legacy profiles are updated, and all sessions end.
  - The old address gets an undo link that lasts 7 days.
  - Emails `account:email-confirm` and `account:email-changed`, with sealed tokens that are removed after sending.
- Checks: an end-to-end run on preview passed 12 checks; rows removed.
- The owner approved deleting 5 old Neon backups. Kept: `backup-invites-20261120`, `backup-account-deletion-20261120`.

Not yet: two-factor re-authentication. It comes with required two-factor after the Better Auth cutover.

## 2026-11-20 POPIA rights: data export and account deletion, `revamp/a-popia-rights`

Design 02, section 8. Viewer contract Draft 1.8.

Done:
- Migration `20_account_deletion`: `User.deletionRequestedAt`, `deletionCancelTokenHash` and `deletedAt`.
- `features/users/export.ts` and `GET /api/account/export`: own data, or a tutor for a student they teach; once a day per person; JSON with no secrets.
- `features/users/deletion.ts`:
  - request: the sole owner is blocked; otherwise sessions end and an email with a cancel link goes out (`account:deletion`, sealed token);
  - cancel by the link, or by the tutor;
  - after 14 days, the housekeeping job anonymises the account. Production needs `ACCOUNT_DELETIONS=1`, which is the owner's call.
- Sign-in is refused during deletion (Better Auth hook and NextAuth). The mailer never sends to any `.invalid` address.
- Checks: an end-to-end run on preview in Better Auth mode passed 14 checks; rows removed.

Next: email change, after the Better Auth cutover. It needs re-authentication.

## 2026-11-20 Student limits, limit warnings, two-factor flag; Preview sign-in fix, `revamp/a-usage-caps`

Done:
- `features/billing/caps.ts`:
  - `assertCanAddLearners` is called from `setCourseEnrollment` (B's course forms) and `createStudentAccountFor`. A hard-stop student limit refuses the learner that would go over it.
  - `sendCapWarnings` runs in the daily billing job: one email at 80% and one at 100% per limit per period. Template `billing:cap-warning`.
- Viewer: `twoFactorEnabled` is read from the account; `twoFactorRequired` is true for owners and Nexa admins without two-factor sign-in.
- #175 (PR #176): B's Preview builds were from a branch made before #170, so they rejected their own addresses; B is to merge main. Sign-in errors now show the real reason. Off production, `@example.test` sign-ups count as verified.
- Checks: an end-to-end run on preview (BILLING=1 in the test) passed 10 checks; rows removed and the limit restored. No migration.

## 2026-11-20 Tutor-created students and parents, sign-in codes, staff invites, `revamp/a-invites-students`

Design 02, sections 5 and 5.1, built on Better Auth. Viewer contract Draft 1.6.

Done:
- Migration `19_invites_student_codes`: the `Invite` table, with a partial unique index for one pending invite; `User.mustChangePassword`, `initialCodeExpiresAt` and `emailIsPlaceholder`.
- `features/auth/codes.ts`: codes, usernames and placeholder emails. `features/users/accounts.ts`: student accounts, new codes, parent linking, the first password. `features/auth/invites.ts`: staff invites.
- Sign-in:
  - Better Auth accepts a code typed loosely;
  - a session hook refuses an expired code;
  - NextAuth accepts a loosely typed code too;
  - placeholder addresses are never mailed;
  - tutor-created accounts are `emailConfirmed`, so they can sign in at once.
- Emails `auth:invite` (sealed token, removed after sending) and `guardian:linked`.
- Checks: `scripts/check-accounts.ts` (15). An end-to-end run on preview in Better Auth mode passed 21 checks; rows removed.

Note: students and parents without an email can only sign in once production runs Better Auth (username sign-in).

## 2026-11-20 Calendar and attendance backend (#149), `revamp/a-calendar-attendance`

Following B research 10's fallback: today's recurrence columns stay, a time zone and an exceptions table are added, and RRULE goes only into feeds. B's preferred `rrule` column would have needed a destructive conversion of existing events and a rewrite of B's expander. Contract: `docs/revamp/contracts/calendar.md`.

Done:
- Migration `18_calendar_attendance` (additive): `CourseEvent.timeZone`, `CourseEventException`, `SessionAttendance`, `AttendanceCode`, `CalendarFeedToken`.
- Occurrences with exceptions; series edits THIS / FOLLOWING / ALL; the attendance sheet; marking, with one parent email per absence; rotating check-in codes; history; private ICS feeds (basic detail for minors and guardians) and per-event `.ics`.
- Checks: `scripts/check-calendar.ts` (17). An end-to-end run on preview with seeded data passed 14 checks; rows removed.

Earlier on 2026-11-20:
- The Anthropic key was added to Vercel Production. A live test marked correctly and caught an injection attempt, for about $0.007.
- Better Auth is on in Preview (#170). B and the owner are testing before the production switch.
- Migration 16 (maths answers, #164) was merged and applied.

## 2026-11-20 AI-assisted marking backend (#150), `revamp/a-ai-marking`

The owner chose Anthropic's API (not Bedrock). The models follow B's research 09: Haiku 5.5, escalating to Sonnet 5.5. Setup, privacy and cost are in `docs/revamp/a/ops/ai-marking.md`.

Done:
- Migration `17_ai_mark_suggestion`: `Test.aiMarking`, `TestQuestion.rubric`, the `AiMarkSuggestion` table and its enums. Applied to preview.
- `src/features/ai-marking/`:
  - `rules.ts`: scrub, injection signals, post-check, escalation, cost;
  - `marker.ts`: `@anthropic-ai/sdk@1.6.0`, structured output, cached memo prefix, server-side refusal fallback on Sonnet;
  - `jobs.ts`: queue, runner, usage records, the AI mark limit, suggestions, tutor actions;
  - `actions.ts`: `setTestAiMarking`, `requestAiMarking`, `getAiSuggestions`, `recordAiSuggestionAction`.
- The hourly notifications cron finishes anything still queued.
- Checks: `scripts/check-ai-marking.ts` (22). An end-to-end run on preview with a stand-in marker passed 15 checks: queueing, scrubbing, escalation, flags, usage, the limit, the cascade on deleting a submission. Rows removed.

Not yet:
- `ANTHROPIC_API_KEY` (the owner creates it). No real provider call has been made yet.
- Photos of handwritten answers.
- Per-tutor calibration.
- Grouping identical answers.

## 2026-11-20 Self sign-ups choose their role, `revamp/a-choose-role`

Owner decision (20 November): a sign-up (email or Google) is not a tutor by default. Unconfirmed users go to a page where they choose a role and set some dashboard preferences. Google Cloud setup comes later (an internal issue on the owner's side).

Done:
- Migration `15_user_role_unconfirmed` (one column, default false).
- Better Auth sign-ups are `roleUnconfirmed`, with legacy role STUDENT meanwhile.
- `chooseAccountRole` (once; TUTOR, STUDENT or PARENT; a student gets a Student profile). The viewer has `user.roleConfirmed`. `createWorkspace` needs a confirmed TUTOR or ADMIN.
- The legacy viewer now goes by account date (before 2026-11-20).
- On preview, 9 checks pass; rows removed. `check-viewer` passes.

**Process slip:** Neon's 10-branch limit was full, so the backup before migration 15 failed, and the command applied the migration anyway. The change is one defaulted column, and the backup `backup-better-auth-20261120` was taken about an hour earlier. From now on the backup and the deploy run as separate steps, and the deploy runs only after the backup is confirmed. The old backup branches need the owner's OK to delete.

## 2026-11-20 Better Auth stage 2 (behind AUTH_PROVIDER), Google sign-in ready, `revamp/a-better-auth-stage2`

The owner approved the cutover and asked for Google sign-in. Design 02, section 10a, has the details.

Done:
- `auth()` follows `AUTH_PROVIDER`. Middleware works in both modes. Sign-up (email and Google) opens with the switch.
- Self sign-ups are role TUTOR with no workspace; the legacy viewer is limited to accounts with old profiles.
- Password writers keep the credential Account in step; a reset signs out every device.
- Better Auth's verification emails go through our queue (`auth:verify` with `urlSealed`).
- `src/lib/auth-client.ts` for B. `docs/revamp/a/ops/google-sign-in.md` for the owner's Google Cloud setup.
- Checks: on preview with `AUTH_PROVIDER=better-auth`, 11 checks pass (sign-up, the TUTOR role, the queued verification, no sign-in before verifying, session role, reset, credential sync, new and old passwords); rows removed. `check-viewer`, `check-email-queue` and `check-payments` pass. No migration.

Not yet: B's client swap and sign-up page; the production backfill and the switch; required 2FA; removing NextAuth; the owner's Google Cloud client.

## 2026-11-20 Better Auth stage 1 (alongside NextAuth), `revamp/a-better-auth-stage1`

Design 02 says to move to Better Auth before invites and sign-in codes are built. Stage 1 adds it next to NextAuth with nothing switched over; design 02, section 10a, has the details.

Done:
- Migrations `13_better_auth_tables` and `14_user_password_default` (both additive), applied to preview.
- `src/lib/better-auth.ts`; route `/api/ba/[...all]` (404 unless `BETTER_AUTH_ENABLED=1`); `scripts/migrate-auth-accounts.ts`.
- On preview: backfilled 10 users; a Better Auth sign-in with the test admin's carried-over bcrypt password works; a database session is written and read back; a wrong password and sign-up are refused.

Next (stage 2, the cutover): the owner's go-ahead (everyone signs in once more), B's 7 client files, then invites, sign-in codes and parent linking (ux/01, sections 5 to 7) on Better Auth.

## 2026-11-20 Optional trial, paying during the trial, courses start on Pro, `revamp/a-trial-options`

Owner decisions (20 November): the trial is optional. A tutor may skip it, pay during it (the first 30 days start when the trial ends), or pay any time after it. A card before the trial comes later; for now the card is added after. New courses start on Pro, and tutors must be told that Core and Plus exist and cost less. Up to 3 owned workspaces and a verified email are confirmed.

Done:
- `createWorkspace({ ..., trial: false })`: READ_ONLY until the first payment; no trial caps; deleted 2 months later if never paid.
- `markInvoicePaid`: paid during the trial, the period starts at `trialEndsAt` (the workspace is ACTIVE and the trial caps are lifted at once).
- `setUpCourseTenancy` switches on every v1 premium service for a new course outside the legacy workspace (`switchOnProServices`). services.md rule 9, Draft 1.4.
- The trial-ending and trial-ended emails say courses are on Pro and that Core and Plus cost less, and that paying early keeps the trial days.
- A one-off run on preview passed 5 checks; rows removed. `check-email-queue.ts` passes. No migration.

## 2026-11-20 Onboarding: create a workspace with its trial, `revamp/a-onboarding`

Done:
- `workspaces/onboarding.ts` and actions `createWorkspace`, `updateWorkspaceProfile` (viewer contract Draft 1.3).
- `createWorkspace` makes the caller OWNER and starts the 14-day trial: a Subscription billed to the owner's email and TRIAL caps (20 active students, 100 AI marks). It also switches the active workspace.
- Refused without a verified email, or past 3 owned workspaces (each with its own trial). Behind `BILLING=1`.
- A one-off run on preview passed 10 checks; rows removed. No migration.
- Branch cleanup (#135): the owner approved; A's 47 branches deleted and "Automatically delete head branches" turned on.

Not yet:
- Switching on services for courses created during the trial. Design 03 says every Pro service is on in the trial; services.md rule 9 says rows are switched on at creation. That needs course creation (B) or `setUpCourseTenancy` to switch them on, and a rule for what happens to them at the first payment.
- Staff invites, and tutor-created student and parent accounts (ux/01, sections 5 and 6).

## 2026-11-20 Discount codes on parent invoices, `revamp/a-fee-discounts`

Done:
- `payments/fee-discounts.ts`: workspace-issued `PARENT_INVOICE` codes (owners and admins only, as the discount comes out of every payee's share). Applied at checkout to that workspace's invoices; redeemed per payer and child; `durationPeriods` counts paid checkouts; `maxRedemptions` counts children.
- `discountShares` in `checkout-math.ts`: PERCENT per invoice, FIXED once per checkout spread by total, at least R1 left on each invoice.
- Checkout: `previewCheckout` (no locks); the discount is kept in `Payment.splitSent` and written to the invoice (a `Discount <CODE>` line, lower total, redemption) only when the payment succeeds.
- Actions `createFeeDiscountCode`, `deactivateFeeDiscountCode`; query `listFeeDiscountCodes`. Contract Draft 1.13. No migration.
- Checks: `check-payments.ts` (4 new); a one-off end-to-end run on preview, 12 checks; rows removed.
- Branch cleanup (#135): A's 46 merged branches and the superseded `revamp/a-contracts` wait for the owner's OK to delete.

Known limit: two checkouts at the same moment may take one redemption past `maxRedemptions`.

## 2026-11-20 Refund recovery from payees, `revamp/a-refund-recovery`

Owner decisions (20 November): Nexa pays refunds and recovers the payee's share from their later payouts, after a notice; with no payout for 60 days the payee is offered an invoice. Refunds happen only after an investigation (refund policy to be written), so `requestRefund` is dropped. A disputes policy (parents dispute records, tutors held accountable, payers can't escape payment) comes later.

Done:
- Migration `12_payout_recovery` (additive): `PayoutRecovery`, `PayoutRecoveryDeduction`, `PaymentPurpose.PAYOUT_RECOVERY`. Applied to preview.
- `payments/recovery-math.ts` (7-day grace, 50% cap per payout, 60 days to invoice) and `payments/recovery.ts`.
- Admin: `refundFeeInvoice`, `holdRecovery`, `waiveRecovery`, `settleRecoveryOffsite`, `adminListPayoutRecoveries`. Tutor query `listPayoutRecoveries`.
- Checkout deducts from payee splits; settlement closes repaid recoveries; refund processing (API answer or webhook) starts recoveries and marks fee invoices REFUNDED or PARTIALLY_REFUNDED.
- Emails `payouts:recovery-notice`, `recovery-invoice`, `recovery-repaid`. Routes `/api/payouts/recoveries/[id]/pay` and `/return`. The fees job offers invoices at 60 days.
- Checks: `check-payments.ts` (6 new); a one-off end-to-end run on preview with a fake provider, 21 checks; rows removed.
- Paystack test mode: split payments to the owner's "Main Branch" and "Secondary Branch" subaccounts, refunded in full and in part.

Production: backup branch `backup-payout-recovery-20261120`, then `12_payout_recovery` applied. B's `12_time_accommodation` (#134) landed at the same time with the same number; both are independent and applied, so the names stay. Next migration is 13.

Not yet: B's screens for recoveries and admin refunds.

## 2026-11-20 Fees job, fee emails; admin queries and setUsageCap for B, `revamp/a-fees-daily`

Done:
- **For B** (#120, #106), contract Draft 1.11:
  - `adminGetWorkspaceBilling`, `adminGetPlatformInvoice` (with `paymentId` and `refundableCents`) and `adminListDiscountCodes`.
  - `setUsageCap`: stored and shown; enforcement (`assertUnderCap`) comes with metering.
  - Admin actions now revalidate `/dashboard/admin`.
  - `getCourseTiersFor` was split out for reuse.
- **`/api/cron/fees-daily`** (daily 00:30 UTC, `payments/fees-daily.ts`):
  - MONTHLY schedules invoice on their billing day in the workspace's time zone, grouped into one invoice per learner and payee.
  - A schedule invoices a learner once per month, and a voided one isn't reissued.
  - Learners without a payee account are skipped and counted.
  - Overdue reminders go out at 1 and 7 days, unless the workspace turned them off.
  - The job then drains the email queue.
- **Fee emails** (`lib/email/fee-templates.ts`, `payments/fee-emails.ts`):
  - A new invoice, from the job or issued by hand, emails its payers: every active guardian, else the adult student who may see fees, else nobody.
  - Payers get a receipt after a checkout.
  - `issueInvoice` takes a null actor for the job, and then writes no audit row.
- **Checks:**
  - `check-jobs.ts` passes.
  - A one-off end-to-end run on the preview DB: 11 checks covering grouping, the billing day, idempotency, no payee, email recipients, reminders once each, and the receipt. Rows removed.

Not yet:
- `requestRefund` for fee invoices. A partial refund of a multi-split payment debits the subaccounts in a way Paystack hasn't confirmed (design 04, open question). It waits for the owner's Paystack test account.
- Parent-invoice discount codes.

## 2026-11-20 Parent checkout; owner admin account; Prisma engine fix; test admin, `revamp/a-gate2-checkout`

Done:
- **The owner's Nexa admin account** (`platformRole NEXA_ADMIN`, `role ADMIN`) on production, at the owner's request. It was created with a random password nobody knows; the owner sets their own through the new reset link.
- **A production bug fixed (#127):** the first reset request failed with "Prisma Client could not locate the Query Engine". Next's file tracing hadn't copied the engine from `src/generated/prisma` into that route's function. `outputFileTracingIncludes` now adds it to every route. After the fix the reset email was delivered (Resend: delivered).
- **Test admin for the agents** (owner's request), on the **preview** DB only: `test-admin@example.com`, Nexa admin. The password is in the owner's git-ignored `.env.test-admin`, for passing to B privately (#129).
  - Vercel Preview variables are forced to "sensitive" on this project, so `vercel env pull` can't hand them to an agent.
  - Two stale variables, `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`, are left on Preview because Vercel needs the owner's approval to remove them. They're harmless; the password they hold was rotated.
- **Gate 2 checkout** (contract section 2, Draft 1.10): `listPayableInvoices`, `startCheckout`, `getCheckoutStatus` (`src/features/payments/checkout*.ts`).
  - The split is `planCheckout`: Nexa's 2% is grossed up so it still nets 2% after Paystack's proportional fee, and payee shares use largest remainder.
  - Locking is all-or-nothing, for 30 minutes.
  - `settlePayment` now handles PARENT_CHECKOUT: invoices are paid online and the fee is shared across invoices. An invoice paid another way meanwhile is flagged (`fees.checkout.unapplied`) for a refund by hand.
  - Reconciliation now includes parent checkouts.
- **Design 04 correction:** the worked example's tutor shares were a cent off its own rule. They are 140,040 and 117,516 (257,556 × 143,000 ÷ 263,000 = 140,039.95).
- **Checks:**
  - `check-payments.ts` now covers the split.
  - A one-off end-to-end run on the preview DB, with Paystack stubbed because subaccounts need real bank details: 15 checks, rows removed.

Next:
- The `fees-daily` job (monthly invoices from schedules, overdue reminders), `requestRefund`, payer receipts, and parent-invoice discount codes.

## 2026-11-20 Password reset; Nexa admin account for the owner, `revamp/a-password-reset`

Done:
- **Password reset.** `/forgot-password` was a form with nothing behind it; it now works.
  - `src/features/auth/password-reset.ts`: a token stored as a SHA-256 hash, valid for one hour and usable once.
  - The answer is the same whether or not the email has an account. Requests are throttled to one per account every 2 minutes.
  - The link goes through the send queue at AUTH priority, with the token sealed in the row and removed once sent.
  - Resetting spends every other outstanding link for that account. Passwords need at least 10 characters, mixing letters with numbers or symbols.
  - Pages: `/forgot-password` and `/forgot-password/reset`.
  - Migration `11_password_reset_token` (additive).
- **Checks:** tsc, lint, and a one-off end-to-end run on the preview DB with 12 checks, covering the request, throttle, unknown email, rules, reset, single use, expiry and the email. The test rows were removed.

## 2026-11-19 Gate 2, slice 1: payouts and fee invoices; retention switched on, `revamp/a-gate2-payouts`

Done:
- **Retention:** the dry run on production listed nothing due. The only workspace is `ws_nexa_legacy` (COMPED, protected). With the owner's OK, `RETENTION_DELETES=1` is set on Production; it has no effect while `BILLING` is off there.
- **Gate 2 tutor side** (contract section 3, Draft 1.9), in `src/features/payments/fees.ts`, `fee-actions.ts` and `fee-queries.ts`:
  - Payout accounts are Paystack subaccounts. The bank checks the account first; only the last 4 digits are stored. Connecting again replaces the account.
  - Payout mode is WORKSPACE or PER_TUTOR, and `resolvePayee` picks the course lead's account in PER_TUTOR mode.
  - Fee schedules.
  - `issueInvoice` gives one payee per invoice, numbered `INV-<year>-<6 digits>`.
  - `voidInvoice`, `markInvoicePaidOffsite` and `voidOffsitePayment` are refused while a checkout holds the invoice.
  - `listFeeInvoices`: tutors are scoped to the courses they teach.
  - Every money action is audited.
- **Checks:**
  - The real Paystack test-mode bank list works (33 banks).
  - Account resolution can't be tried in test mode without real bank details, so the one-off end-to-end run on the preview DB stubbed the account check and subaccount creation. It passed 21 checks, and the test rows were removed.

Next (Gate 2, slice 2):
- `listPayableInvoices`, `startCheckout` (multi-split, Nexa's 2% grossed up, 30-minute locks), `getCheckoutStatus`, and `PARENT_CHECKOUT` in `settlePayment` and the webhook.
- The `fees-daily` job (monthly invoices, overdue reminders), `requestRefund`, and receipts.

Questions for the owner:
- Before live payouts, try one real subaccount in Paystack test mode with your own bank details (design 04, open question 1: multi-split on a South African account).

## 2026-11-19 Retention deletes (switched off) and invoice PDFs, `revamp/a-retention`

Done:
- **Retention deletes** (owner approved the policy), in `billing/retention.ts` `deleteWorkspaceData`:
  - Each course goes in its own transaction: B's `deleteCourseContent` (#119), then the course's notifications, then the Course, which takes its staff, enrolments and billing settings with it.
  - Then learners, memberships, usage rows and the logo.
  - Files are deleted after each commit, and only links on our Blob store.
  - Kept: the Workspace row (renamed to its legal name or "Deleted workspace"), Subscription, invoices and lines, seat charges, payments, refunds and AuditLog, plus user accounts.
  - Refused: `ws_nexa_legacy`, and any workspace that isn't READ_ONLY or CANCELLED past its `deleteAfter`.
- **Switched off by default.** The billing job deletes only with `RETENTION_DELETES=1` (at most 3 workspaces per run); otherwise it reports the plan. `adminRetentionPreview()` lists every due workspace with exact counts (a dry run).
  - Today there are no subscriptions in production, so nothing is due.
- **Invoice PDFs:** `GET /api/billing/invoices/[id]/pdf` renders the invoice from its stored lines with `pdf-lib` (new dependency, 1.17.1). It says "TAX INVOICE" only when VAT is charged. `getPlatformInvoice().pdfUrl` points to it.
- **Checks:**
  - `check-invoice-pdf.ts`: 7 checks.
  - A one-off end-to-end run on the preview DB: 14 checks covering the guards, preview counts, the dry run changing nothing, the delete, what's kept, only our 5 Blob files deleted and never the outside link, and the workspace not listed again. File deletion was stubbed, and the test rows were removed.

Questions for the owner:
- Switch on `RETENTION_DELETES=1` in Production when you're ready. Look at `adminRetentionPreview()` (or ask A for the list) first.

## 2026-11-19 Nexa admin billing, `revamp/a-admin-billing`

Done:
- **Contract section 4, in full** (Draft 1.7):
  - `adminListWorkspaceBilling` and `adminGetPaymentVolume`.
  - `adminExtendTrial`, `adminSetComp`, `adminOverrideCourseTier`, `adminIssueCreditNote`, `adminVoidPlatformInvoice`, `adminMarkPaidOffsite`, `adminRefundPayment`, `adminCreateDiscountCode`, `adminDeactivateDiscountCode`.
  - The logic is in `src/features/admin/billing-overrides.ts`; it takes the acting admin, so scripts can test it. Every override writes an AuditLog row in the same transaction.
- **Safety:**
  - An off-site payment must be the full invoice total.
  - Void refuses an invoice with a payment taken or in progress.
  - Reconciliation no longer resends a partial refund. Paystack has no idempotency key, so a lost answer to a partial refund could pay out twice; such refunds stay PENDING with a Sentry warning.
  - `lifetimeVolume()` is shared by reconciliation and the admin console.
- **#93 step 5:** B merged #115 and applied the migration to production (status: up to date). The backup branch is `backup-legacy-course-links-20261119`.
- **Checks:**
  - tsc and lint pass.
  - A one-off end-to-end run on the preview DB: 20 checks covering every override, the audit rows and the admin list. The test rows were removed.

For B:
- The admin billing screens can be built against contract section 4 (rules under the table).

## 2026-11-19 Usage and invoice queries; answers for B; drop backup, `revamp/a-billing-queries`

Done:
- **Queries B was waiting for** (contract Draft 1.6), each with a `…For(workspace)` core for scripts and the admin console:
  - `listPlatformInvoices` pages with a cursor, newest first.
  - `getPlatformInvoice` returns the lines, card and off-site payments, and `pdfUrl: null` for now.
  - `getUsage` covers active students (counted from the enrolment intervals) and AI marks (from the usage meter), with an estimate built by the same invoice builder as the renewal.
- **`getBillingPaymentStatus` returns `purpose`** (`CARD` or `INVOICE`), so B no longer has to rely on the `nx-card-` prefix.
- **A bug fixed:** `payPlatformInvoice`'s default return path and every billing email linked to `/dashboard/billing`, which doesn't exist. Both now use `/dashboard/settings/billing`.
- **#93 step 5 (B's #115):**
  - Took the production backup branch `backup-legacy-course-links-20261119`.
  - My code compiles with B's drop merged in.
  - The queries' end-to-end run passed on the preview DB, which already has the drop (11 checks, test rows removed).
- **Checks:** tsc, lint, `check-email-queue.ts`.

Next:
- Invoice PDFs (`pdfUrl`).
- Usage metering for AI marks once B's AI marking records rows.
- The retention deletes after #113.

## 2026-11-19 All email through the queue; retention warnings, `revamp/a-email-queue-all`

Done:
- **Every email now goes through `OutboundEmail`:**
  - The verification email: AUTH priority, tried at once. The token is sealed with a key derived from `NEXTAUTH_SECRET`, so no new secret was needed, and removed from the row once the email is sent or given up.
  - Immediate notification emails: one row per notification, tried at once.
  - Digests: queued by the hourly job, which then drains the queue.
  - The queue sets `Notification.emailedAt` when a mail is actually sent, and retries failures.
  - Nothing calls `sendEmail` directly any more except the queue.
- **Retention** (owner approved the policy on 2026-11-19), in `billing/retention.ts`:
  - Warning emails go out 30 and 7 days before `deleteAfter`.
  - `planRetention` lists the workspaces that are due and what would go.
  - The billing job reports `retentionDue` and **deletes nothing yet**: deleting a course needs B's content tables to cascade or a delete helper from B (#113).
  - `ws_nexa_legacy` is never planned for deletion.
- **#93:** step 1 merged (#111). Replied to B with my OK for my paths in the drop PR, and moved the issue to `needs-b`.
- **Checks:**
  - `check-email-queue.ts`: 23 checks.
  - A one-off end-to-end run on the preview DB: 8 checks, covering verification queued and suppressed with the token removed, a notification email through the queue without being marked emailed when suppressed, the 7-day warning queued once, and the plan listing the due workspace without deleting it. The test rows were removed.

Next:
- The retention deletes, once #113 lands, behind a flag and after the owner has seen a dry run.

## 2026-11-19 Off the old course links in A's paths (#93 step 1); support@ live, `revamp/a-legacy-links`

Done:
- **#93 step 1:** nothing in A's paths reads `Course.tutorId`, `Course.tutor`, `Course.students` or the implicit join any more. Teaching now comes from CourseStaff and enrolment from open Enrollment rows, mostly through B's `src/features/courses/lib/tenancy-where.ts`.
  - `src/lib/api-guard.ts`: `tutorOwnsCourse`, `visibleCoursesWhere` (plus a local `enrolledEmail`).
  - `src/lib/viewer.ts`: the legacy-viewer fallbacks.
  - The routes `/api/courses`, `/api/submissions` (and `[id]`), `/api/submission-entry` (and `[id]`), `/api/blob/upload-token`.
  - `src/features/notifications/` (`server.ts` fan-out, `jobs.ts`, `queries.ts`). The "tutor" audience is now every active staff member of the course.
  - `/api/courses` keeps its response shape: `tutor` (Tutor profile) and `students` (Student profiles), built from the owner membership and open enrolments.
  - `src/lib/global.d.ts` spells out the legacy `tutor`, `students` and `courses` fields, so it compiles after the drop.
- **Parity:** a read-only comparison of old and new filters and of the `/api/courses` shape found 0 differences (11 comparisons on preview, 14 on production).
- **Domain:** the Cloudflare zone is active, `support@` forwards to the owner (tested), and `EMAIL_REPLY_TO` is set on Production and redeployed.

Blocked on the other agent:
- For B (#93 step 2): please write the drop PR. My OK for my paths in it: drop `Student.courses` and `Tutor.courses` in `core.prisma`, and remove the course and enrolment parts of `scripts/backfill-tenancy.ts` (it was one-off).

## 2026-11-19 Email queue, billing emails, discounts, credit, cancel and comp end, `revamp/a-billing-emails`

Done:
- **Email send queue** (design 05, section 6):
  - The `OutboundEmail` table, added by migration `9_outbound_email` (additive).
  - `enqueueEmail` in `src/lib/email/queue.ts` upserts on a unique idempotency key, which is also sent to Resend as `Idempotency-Key`.
  - `drainEmailQueue` claims rows with `FOR UPDATE SKIP LOCKED` and retries after 1 min, 5 min, 30 min, 2 h and 12 h (429, 409 and 5xx only). It keeps a daily budget (`EMAIL_DAILY_BUDGET`, default 90); once it is used up, only AUTH and BILLING mail goes out.
  - **Non-production guard:** off production, only `EMAIL_ALLOWLIST` addresses are mailed; everyone else is SUPPRESSED. It is set on Preview to the owner's address.
  - For now the billing job drains the queue hourly. Existing `sendEmail` callers are unchanged.
- **Billing emails** (`src/lib/email/billing-templates.ts`, `billing/emails.ts`):
  - Trial ending (4 days and 1 day left) and trial ended.
  - Dunning on day 0, 3 and 7, and read-only on day 14.
  - A receipt for every card payment.
  - Recipients are the active owners and admins plus the billing email. Each event goes to each person once.
- **Discount codes and credit:**
  - `redeemDiscountCode` lets a workspace use one whole-bill code at a time, each code once, and counts a use only while the code still has room.
  - Invoices and the billing overview's estimate apply the code and any open credit.
  - On payment, one period of the code is counted (it is exhausted at `durationPeriods`) and credit notes are used oldest first, with a remainder note for a partly used one.
- **Cancel at period end:** the workspace goes CANCELLED and gets a final invoice for the closing period's arrears only, charged to the saved card. Paying it opens no new period.
- **Comps ending at `compedUntil`:** the workspace goes back to ACTIVE, or to READ_ONLY if it never paid.
- **Reconciliation:** compares Paystack's transaction list for the last 2 days with our payments. A paid Nexa transaction that we hold as unpaid is settled; one with no Payment row is reported to Sentry.
- Transactions run by jobs and webhooks now have a 30 s limit; Prisma's default is 5 s.
- **Checks:**
  - `check-email-queue.ts`: 21 checks.
  - `check-payments.ts` and `check-jobs.ts` pass.
  - A one-off end-to-end run on the preview DB: 19 checks, covering discount and credit on a renewal, the receipt to two people, trial emails, comp end, every email suppressed off production, the day-0 email sent once over two runs, the code exhausted after its second paid period, and cancel with a final invoice. The test rows were removed.

Not yet:
- Usage metering and cap emails (they need B's AI-marking rows).
- Retention deletes and their warnings (owner-only).
- A 5-minute email trigger, and moving other mail onto the queue.

## 2026-11-19 Renewals, dunning, card replacement and reconciliation, `revamp/a-billing-jobs`

Done (all behind `BILLING=1`, so they do nothing in production yet):
- **`buildRenewalInvoice(workspaceId, at)`** in `billing/invoice.ts`:
  - Bills seats in advance, catch-up seats for learners who joined during the closing period, tier upgrades, and AI marks above the Pro pool.
  - It is idempotent per closed period.
  - It writes the closing period's CATCH_UP seat charges and tier upgrades when the invoice is built.
  - A COMPED workspace gets a COMP line that brings the total to zero.
- **`/api/cron/billing`** (hourly, `billing/daily.ts`):
  - Unpaid trials go READ_ONLY.
  - Renewals due are invoiced and charged to the saved card. A zero total is marked paid without a charge.
  - If the charge fails, or there is no saved card, dunning starts: PAST_DUE on day 0, retries on day 3 and day 7, READ_ONLY (LOCKED) on day 14.
  - Owners who cancelled go CANCELLED.
  - The rules are in `dunningStep` (pure).
- **`startCardReplacement`**: a R10 card check that saves the new card and is refunded straight away. The refund is retried by reconciliation if the provider call fails; Paystack refuses a second full refund, so retrying is safe. Refund webhooks (`refund.processed` / `refund.failed`) now update `Refund` and `Payment`.
- **`/api/cron/payments-reconcile`** (daily, `payments/reconcile.ts`):
  - Pending payments older than 30 minutes are checked with Paystack; after 24 hours they become ABANDONED.
  - FAILED webhook events are retried up to 5 times, then reported to Sentry.
  - Refunds that never reached Paystack are sent.
  - A Sentry warning fires at 70% and 90% of the Paystack lifetime limit.
- **Refactors:**
  - `markInvoicePaid` in `settle.ts` is shared by card, comp and credit payments. It sets `deleteAfter` to 2 calendar months after payment, and a COMPED workspace stays COMPED.
  - `chargeSavedCard` and `createInvoicePayment` are in `billing/charge.ts`.
- **Registry and workflow:** both jobs are in the registry and the backup workflow. QStash schedules are re-synced after the merge.
- **Checks:**
  - `check-payments.ts`: 34 checks.
  - `check-jobs.ts` passes.
  - A one-off end-to-end run on the preview DB: 22 checks covering an on-time renewal with a catch-up seat, a second run doing nothing, the day 0 → day 3 → day 7 dunning path, the day 14 lock, card replacement with its refund, abandoning stale checkouts, and sending an unsent refund. The test rows were removed.

Not yet:
- Usage metering (needs B's AI-marking rows).
- Cap emails, trial emails and dunning emails.
- The final arrears invoice when an owner cancels.
- Ending comps.
- Discount codes and credit notes on invoices.
- Comparing Paystack's transaction list with our payments.
- Retention deletes (owner-only).

## 2026-11-19 Gate 1 payments in Paystack test mode; DMARC and support@, `revamp/a-next`

Done:
- **Workspace payments (Gate 1)**, behind `BILLING=1`:
  - Actions in `src/features/billing/actions.ts`: `startFirstPayment`, `payPlatformInvoice` and `getBillingPaymentStatus`.
  - The first invoice is built in `billing/invoice.ts`.
  - `settlePayment` in `payments/settle.ts` is the only code that moves a payment out of PENDING. The webhook route `POST /api/webhooks/paystack` (`payments/webhooks.ts`) calls it.
  - A payment counts only when Paystack's `verifyTransaction` confirms status, amount and currency.
  - On success it marks the invoice PAID, opens a 30-day period from the payment and writes the ADVANCE seats. It saves the card, encrypted, sets the workspace ACTIVE and removes the trial caps.
  - The seats are the learners enrolled when the invoice was issued, rebuilt from the enrolment intervals.
- **Two Paystack behaviours handled:**
  - An unpaid checkout reports "abandoned", so ABANDONED never closes a payment.
  - A payer can retry a declined card on the same reference, so a verified success replaces FAILED.
- **Checks:**
  - `scripts/check-payments.ts`: 23 checks.
  - A one-off end-to-end run on the preview DB with the Paystack test key: 21 checks, covering a real test checkout, bad signature → 401, signed success, redelivery, a short payment refused, and cleanup.
- `PAYMENT_ENC_KEY` (AES-256-GCM, generated) is on Vercel Preview only. Production needs its own key before billing goes live there.
- **Email:**
  - DMARC is `p=quarantine` in both Cloudflare and Vercel DNS.
  - The Resend records are copied into Vercel DNS.
  - The Email Routing rule `support@` → owner exists and is waiting for the zone to activate. See `ops/domain-dns.md`.

For B:
- Billing contract Draft 1.3: build the pay button and return page against `startFirstPayment` / `payPlatformInvoice`. The return page polls `getBillingPaymentStatus`.
- Map the new code `NOTHING_TO_BILL`.
- `payPlatformInvoice` can also return `PENDING` with a `reference`; poll it the same way.

Next:
- `startCardReplacement`, and nightly reconciliation (`payments-reconcile`: PENDING over 24 h → ABANDONED, FAILED events retried).
- `buildRenewalInvoice` and the daily billing job.

Questions for the owner:
- **At xneelo:** remove `ns1.vercel-dns.com` and `ns2.vercel-dns.com` from the nameservers and keep only Cloudflare's two. Cloudflare can't activate the zone until then, and `support@` waits on that.
- **Paystack test webhook URL:** set it to `https://www.nexa-lms.co.za/api/webhooks/paystack` for live later. Preview deployments sit behind Vercel's login, so test webhooks can't reach them. On Preview the return-page poll settles payments instead.

## 2026-11-19 Domain on Cloudflare; email from notify.nexa-lms.co.za, `revamp/a-domain`

Done (details in `ops/domain-dns.md`):
- **DNS moved to Cloudflare.** The nameservers at xneelo are now Cloudflare's. The records Cloudflare imported were proxied, which breaks Vercel's certificates, so I set the apex, www and `_domainconnect` to DNS-only and deleted the imported wildcard. www serves 200 and the apex redirects 308 to www.
- **QStash 401s fixed.** The owner had changed `APP_URL` to the bare apex while the schedules targeted the old vercel.app host. I set `APP_URL=https://www.nexa-lms.co.za` on Production, re-synced the schedules and redeployed. `/api/health` shows all three jobs ok.
- **Resend:** `notify.nexa-lms.co.za` (eu-west-1) is verified, with DKIM, the return-path CNAMEs and DMARC `p=none` added in Cloudflare. `EMAIL_FROM="Nexa LMS <noreply@notify.nexa-lms.co.za>"` is set on Production and redeployed. A test email to the owner was delivered.

For B: nothing changes in code. Mail to students and tutors now leaves Production from the real domain; Preview still uses the dev sender (owner-only delivery).

Next: DMARC to `p=quarantine` after a few clean weeks; a support inbox and `EMAIL_REPLY_TO`.

## 2026-11-19 Tenancy writes for B; billing and Sentry live, `revamp/a-tenancy-writes`

Done:
- **Tenancy write helpers** (issue #93, step 1) in `src/features/workspaces/tenancy.ts`, server-only. Each takes a Prisma transaction client and is idempotent:
  - `setUpCourseTenancy(tx, { courseId, viewer })` sets `workspaceId` and `ownerMembershipId`, plus a LEAD `CourseStaff` row. It keeps an existing owner.
  - `setCourseEnrollment(tx, { courseId, studentIds, at? })` takes Student profile ids. It creates any missing `Learner` rows in bulk, opens new intervals, closes the dropped ones (`endedAt`, `DROPPED`), never reopens a closed row, and keeps at most one open row per course and learner. The rule itself is `planEnrollmentChanges` in `enrollment-plan.ts`, which is pure.
  - `ensureLearner(tx, …)` and `workspaceIdFor(viewer)`.
- `createStudentUser` now runs one interactive transaction. It links `Student.userId` and creates the `Learner` in the creator's workspace.
- **Checks:** `scripts/check-tenancy-writes.ts` has 8 checks. On preview, inside a transaction that was then rolled back:
  - the same set changed nothing;
  - dropping one student closed 1 row;
  - re-adding opened a new row, leaving that student with `DROPPED` closed and `ACTIVE` open;
  - a new course got its workspace and owner, and a second call still left 1 staff row.
- **Merged** #97 and #98, the billing core (the owner merged #97 because it touches B's back-relations). **Production, under rule 4.1:**
  - Backup branch `backup-billing-core-20261119`, the preview branch already migrated, and `migrate diff` showing only `8_billing_core` (27 new tables, no change to existing tables).
  - Then `migrate deploy`, and the seed: 3 tiers, 31 services, `BillingConfig`. A re-run of the seed found no changes. Billing stays behind `BILLING=1`.
- **Sentry, set up for the owner:**
  - CLI signed in.
  - Project `jassiel/nexa-lms` (javascript-nextjs).
  - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` on Vercel Production only.
  - Alerts "New or regressed issue" and "Busy issue: over 30 events in 15 min". Sentry has no 10-minute window. The default high-priority alert stays.
  - No source-map token yet (optional).
- **#93:** replied to B and moved it to `needs-b`.

Next:
- Batch 4 deletions after the owner tests B's Batch 3b.
- Paystack test mode on Preview once the owner supplies the test key.
- Domain and email (`nexa-lms.co.za` is bought).

Blocked on the other agent:
- For B (#93): the helpers are on `main` once this merges. Call them inside the same `$transaction` as your old-column writes, and give that transaction a `timeout` of about 15 s for large classes.

Questions for the owner:
- The Paystack test secret key for Preview, and where DNS for `nexa-lms.co.za` lives (xneelo or Cloudflare).

## 2026-11-19 Phase 2 billing core, no live money, `revamp/a-billing-core` (#97) and `revamp/a-billing-provider`

Done:
- **Schema (#97):** every design 03 and 04 model in `billing.prisma`, migration `8_billing_core` (additive: 29 enums, 27 tables). Money records restrict workspace deletion and keep course and learner ids as plain strings, so they outlive the retention job. Additions to the design: `ServiceStatus.RETIRED` and `UsageCapSource.ADMIN`.
- **Seed:** `scripts/seed-billing.ts` (idempotent, dry run by default): tiers 9900/13900/17900 cents with 0/0/30 AI marks, every key in `contracts/services.md` with its status, and `BillingConfig` (30-day periods, 8000 bps margin, 14-day trial, no VAT). **Preview:** #97's Preview build applied `8_billing_core`, and the seed wrote 3 tiers, 31 services and the config. A re-run changed nothing.
- **Provider:** `src/features/payments/provider/`: the design 04 `PaymentProvider` interface, `PaystackProvider` (fetch, `PAYSTACK_SECRET_KEY`) and `getProvider()` (`PAYMENT_PROVIDER`, Paystack only; Payfast is not built). Webhook signatures are HMAC-SHA512 compared in constant time and fail closed. `scripts/check-paystack.ts` has 29 checks, including a vector computed independently with `openssl`, and drives the provider with a fake fetch. No Paystack account or keys were created.
- **Pricing (pure):** `src/features/billing/pricing.ts`: derived and billed tiers, the 30-day hold, periods, the period invoice (advance seats, catch-ups, tier upgrades, AI overage at cost ÷ 0.8, discount, credit, VAT) and `previewServiceChange`. `scripts/check-billing.ts` has 50 checks, including both worked examples in design 03 (333 600 and 457 400 cents).
- **Queries and actions** behind `BILLING=1`: `getBillingOverview`, `getCourseTiers`, `getCourseServices`, `previewServiceChange`, `setCourseServices` (writes a `CourseTierHold` on a raise outside the trial, plus an `AuditLog` row) and `hasService`. `safe-action` passes `BillingError` and `ProviderError` codes through as `"CODE: message"`. Contracts `billing.md` (draft 1.2) and `services.md` (draft 1.3) record what was built.
- **Not merged, not on production:** #97 adds back-relation fields to B's `learning.prisma`, so AGENTS.md 4.1 (condition 3) needs B's written OK or the owner. B was not running. The production migration waits for the merge.

Next:
- Payment actions and the webhook route (`startFirstPayment`, `payPlatformInvoice`, `/api/webhooks/paystack`) once the owner has Paystack test keys.
- `buildRenewalInvoice` and the billing daily job (metering, renewals, dunning), then `getUsage`, `listPlatformInvoices` and `getPlatformInvoice`.
- Onboarding: create a `Subscription`, trial caps and the trial's switched-on services with each new workspace.

Blocked on the other agent:
- For B: **please review the `Course` back-relations in `learning.prisma`** (#97): `services`, `tierHolds`, `tierOverride` and `feeSchedules`. They are relation fields only and add no column to `Course`. You were not running, so they went in under AGENTS.md section 2 with this note. Say in `b/HANDOFF.md` if you want them changed.
- For B: billing screens can be built against `contracts/billing.md` section 1 now. Everything is behind `BILLING=1`, so set it on Preview only. Codes to map: `READ_ONLY`, `PAST_DUE`, `BILLING_DISABLED`, `NOT_FOUND`, `FORBIDDEN`. `hasService()` is safe to call today: with the flag off it is true for every v1 key.

Questions for the owner:
- **Merge #97, then this PR** (stacked on #97), unless B OKs the `Course` back-relations first. After the merge A applies `8_billing_core` to production under 4.1 (backup branch `backup-pre-billing-<date>` first) and runs `seed-billing.ts --apply --allow-production`. Both are additive. The `BILLING` flag stays off in production.
- **Paystack test keys:** a test secret key in Vercel's Preview environment as `PAYSTACK_SECRET_KEY` (A may not create the account or keys).
- **Sole-proprietor Paystack account** (proof of address under 6 months) before February 2027.
- **Paystack sales answers** (design 04, open questions 1 to 4): multi-split to many subaccounts on one South African account, `charge_authorization` for Gate 1, the minimum charge for the R10 card-replacement step, how `all-proportional` spreads the fee, how partial refunds of a split debit the shares, and whether account checks need the holder's ID number.

## 2026-11-19 getViewer() on the tenancy tables, `revamp/a-viewer-tenancy`

Done:
- **Production migration under rule 4.1:** `7_course_workspace_restrict` applied on 2026-11-19, after backup branch `backup-course-restrict-20261119`. It ran cleanly on `preview` first (by the Preview build, which proved #79). `migrate diff` showed only that foreign key, and production now matches `main`.
- **`getViewer()` reads the tenancy tables:**
  - Active memberships (with teams), learner rows and guardianships.
  - The active workspace comes from the `nexa_ws` cookie, ignored if the user doesn't belong to that workspace. The default is the first membership, then the first learner row.
  - Persona: staff, then learner, then guardian, then Nexa admin. A Nexa admin who also teaches keeps the console permissions.
  - `learner.paymentVisible` is never true for a minor. `fees.pay` is withheld when the learner has an active guardian.
  - Users with no tenancy rows fall back to the Phase 0 bridge, unchanged.
- **`canIn()`:** a course is always checked against the active workspace, owners and admins included. Before, owners and admins skipped the check, which would have crossed workspaces once there are several. Tutors must own the course or be on its staff. Learners need an open `Enrollment`, falling back to the legacy join during the bridge. Guardians need a child with an open enrolment.
- **Pure parts:** `buildTenancyViewer()` and `hasTenancy()` in `viewer-core.ts`. `scripts/check-viewer.ts` has 47 checks.
- **Exercised on preview's fake data:** the test tutor is staff and OWNER of `ws_nexa_legacy`, teaching both courses. The test student is a learner with 1 open enrolment and no billing access.

Next:
- `withWorkspace()`, the tenant-scoped data layer (design 01 §4), and `workspaceId` on the remaining tenant tables.
- Batch 4 deletions after the owner's test of B's Batch 3b.

Blocked on the other agent:
- For B: `viewer.learner.id` is now the `Learner` row id, not the `Student` profile id (nothing in `src` read it). `viewer.membership.id` is the `Membership` id. Owners now hold `billing.*` and `workspace.*` permissions, so the owner's nav may show more links once those pages exist.

Questions for the owner:
- None.

## 2026-11-19 New working rules: agents merge, apply additive migrations, talk directly, `revamp/a-agents-autonomy`

Done:
- `docs/revamp/AGENTS.md` section 4 is rewritten as "Approvals and autonomy", at the owner's request on 2026-11-19. Both starting prompts point to it. Section 5 adds what the PR body must say when the author merges.

**For B, please read section 4 in full. In short:**
- **You may merge your own PRs** when:
  - CI and `tsc`/lint pass;
  - the Preview build succeeded;
  - the PR touches only your paths, or A has OK'd the exact change in a message or a PR comment, which you quote in the PR;
  - it does nothing in 4.2.
  If a merge breaks production, revert it first.
- **You may apply additive migrations to production** after three steps: a Neon backup branch `backup-<what>-<yyyymmdd>`, a clean run on `preview` (the Preview build now applies migrations by itself), and a `migrate diff` showing only that migration. Record it in HANDOFF. Destructive changes still go to the owner.
- **Message A directly.** Run your session on the owner's machine, then use `ListAgents` and `SendMessage`. A's session is named "Agent A platform revamp". Do not open HANDOFF-only PRs. Fold HANDOFF updates into PRs that ship work.
- **Deployment budget:** batch work, aim for one PR per session, and push only when ready. Vercel Hobby limits deployments per day.

Next:
- A merges #90 under these rules and applies `7_course_workspace_restrict` (non-destructive: it tightens one foreign key that every existing row already satisfies).
- `getViewer()` and `canIn()` on the tenancy tables, plus `withWorkspace()`.

Blocked on the other agent:
- For B: when you next start, message A. A wants to agree on the order of moving your queries off `tutorId` and the implicit enrolment join onto `CourseStaff` and `Enrollment`. After that, the old columns can go, as an owner-approved destructive migration.

Questions for the owner:
- None for this change.

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
