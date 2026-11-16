# Basic and premium service catalogue

**Answer first.** Every service in the plan of record gets a stable kebab-case key: 11 basic services (Core), 12 premium services (6 Plus, 6 Pro) and 5 add-ons, 28 keys in all. These keys are the draft for `docs/revamp/contracts/services.md` and for `hasService(viewer, courseId, key)`. About half of the basic services exist in the codebase today, but none of the premium services does: math input, graphing, the automarker, AI marking and the rest are all new builds. The market suggests 7 more keys with evidence (section 4). The strongest are `originality-check`, `math-solve` (Wolfram step checks, which need their own meter) and `bulk-import`.

Currency: USD is converted at R17.00/USD (Wise mid-market R16.95 on 2026-11-16, rounded). Prices are in [01-pricing-market.md](01-pricing-market.md).

## How to read the tables

- **Key**: stable, kebab-case, never renamed once `services.md` is published. To rename one, add a new key with an alias.
- **Tier**: the plan's tier. Switching any Plus or Pro service on moves the course to that tier.
- **Metered (unit)**: a usage charge on top of the tier, at cost ÷ 0.8 (01, section 6). "no" means flat.
- **Exists today**: the main file, "partial", or "no". Paths are relative to the repo root on branch `revamp/a-research`.
- **Evidence**: a competitor that gates the same feature behind a paid plan ("-" when the market includes it for free). Evidence keys are listed below, and all were checked 2026-11-16.

| Evidence key | What the page shows |
| --- | --- |
| [TH] | Thinkific: API and webhooks, bulk enrolment and reporting on Grow ($219/mo, R3,723); Exams and advanced reporting on Plus only; mobile app add-on $199/mo |
| [TE] | Teachable: certificates, branding removal and custom admin permissions on Growth ($189/mo, R3,213) |
| [GW] | Google Workspace for Education: 5 originality reports per class free, unlimited on Education Plus; Meet 100 vs 1,000 |
| [GS] | Gradescope: AI-powered grading, programming autograder and LMS integration on Institutional only |
| [SS] | Seesaw: AI tools and content library on higher school licences |
| [CD] | ClassDojo Plus (families pay): enhanced messaging with read receipts, progress reports, calendar sync, homework helper |
| [TG] | Teach 'n Go: Pro adds card billing and unlimited AI |
| [TB] | TutorBird: portal, invoicing and payments in its one plan ($16.95, R288) |
| [MC] | MoodleCloud: storage caps per plan (1 GB at 50 users to 50 GB at 750) |
| [AZ] | Azure DevOps: Test Plans as a per-user premium tier ($52 vs $6); extra pipeline parallel jobs $15-$40/month |

## 1. Basic services (Core, always included)

| Key | Name | Description | Tier | Metered (unit) | Exists today | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `courses-lessons` | Courses and lessons | Courses, lessons and lesson groups in the block editor, with plain text, markdown and LaTeX | Core | no | partial: `src/features/courses/actions.ts`, `src/features/lessons/actions.ts`, `src/features/lessons/lib/lesson-tree.ts`, TeX via `src/app/components/math-provider.tsx` (no block editor yet) | - |
| `templates` | Templates | Reusable course, lesson and group templates across the workspace | Core | no | no | - |
| `tests` | Tests | Tests with the 12 current question types, shuffling, memos and auto-marking of objective questions | Core | no | `src/features/assessments/actions.ts`, `src/features/assessments/lib/auto-grade.ts`, `src/features/assessments/lib/shuffle.ts`, `src/features/assessments/components/test-memo-files.tsx`; `QuestionType` in `prisma/schema.prisma` | - |
| `assignments` | Assignments | Assignments with uploads, marking, rubrics and feedback (renamed from Submissions) | Core | no | partial: `src/features/submissions/actions.ts`, `src/features/submissions/components/entry-grading-form.tsx` (no rubrics) | - |
| `gradebook` | Gradebook and reports | Gradebook, progress reports and CSV export | Core | no | partial: `src/features/grades/gradebook.ts`, `src/features/grades/lib/weighting.ts`, `src/features/grades/components/charts.tsx` (no printable report or CSV) | [TH] reporting on Grow |
| `calendar` | Calendar | Calendar, events and due dates | Core | no | `src/features/events/actions.ts`, `src/features/events/lib/recurrence.ts`, `src/app/dashboard/calendar/page.tsx` | - |
| `messages` | Messages | Course-wide and organisation-wide messages, in-app and in email digests | Core | no | partial: digests in `src/features/notifications/jobs.ts`; no announcements or threads | [CD] enhanced messaging paid |
| `notifications` | Notifications, search and settings | In-app notifications, reminders, global search, user settings | Core | no | `src/features/notifications/actions.ts`, `src/features/notifications/jobs.ts`, `src/features/search/queries.ts`, `src/features/users/preferences.ts` | - |
| `portals` | Student and parent portals | Student portal, plus a parent portal with child switcher, progress, upcoming work and invoices | Core | no | partial: student dashboard in `src/app/dashboard/home/page.tsx`; `src/features/parents/components/parent-dashboard.tsx` is a placeholder | [CD] progress reports paid; [AZ] free stakeholder seat |
| `fee-collection` | Fee collection | Invoicing parents and collecting fees through split checkout (card fees separate; 2% commission) | Core | commission (% of each payment) | no | [TB] included; [TG] card billing on Pro only; [TE] 7.5% on Starter |
| `storage-allowance` | Storage allowance | Storage per workspace plus per active student (**Guess:** 1 GB + 100 MB per student) | Core | no (above the allowance: `extra-storage`) | partial: `src/lib/blob.ts`, `src/app/api/upload` (no quota) | [MC] storage tied to plan |

## 2. Premium services

| Key | Name | Description | Tier | Metered (unit) | Exists today | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `math-input` | Visual math input | Wolfram-style keyboard and natural-language maths input for answers and questions | Plus | no (solving is `math-solve`, section 4) | no (TeX rendering only, `better-react-mathjax`) | **Unverified:** no competitor page found that gates this |
| `graphing` | Graphing | Function plots and geometry in lessons and answers | Plus | no (library licence in Agent B's research) | no | **Unverified:** as above |
| `question-bank` | Question bank | Tagged questions and randomised test generation | Plus | no | no | [TH] Exams (question pools, attempt rules) on Plus only |
| `live-sessions` | Live sessions | Scheduling with attendance; links to Meet, Teams or Zoom | Plus | no (hosted video is `live-room`) | partial: `LIVE` and `MEETING` in `EventType`, `prisma/schema.prisma` | [GW] Meet capacity gated |
| `advanced-analytics` | Advanced analytics | Item analysis and question difficulty | Plus | no | no (basic charts only, `src/app/dashboard/analytics/page.tsx`) | [TH] advanced reporting on Plus only |
| `custom-branding` | Custom branding | Workspace logo, colours and email sender name | Plus | no | partial: `src/lib/branding.ts` holds Nexa's own branding, not per workspace | [TE] branding removal on Growth; [TH] on Grow |
| `automarker` | Coding automarker | Run Delphi, Java, C++ and Python against hidden tests in a Judge0 sandbox | Pro | runs above the included quota (per 1,000 runs) | partial: `CODE` question type in `prisma/schema.prisma` and `src/features/assessments/components/question-renderer.tsx` (marked by hand) | [GS] programming autograder on Institutional only |
| `judge-mode` | Judge mode | Contests, rankings and leaderboards | Pro | no (uses `automarker` runs) | no | **Unverified:** no tutoring competitor found |
| `secure-tests` | Specialised tests | Lockdown settings, tab-switch and focus logs | Pro | no | partial: timer and auto-submit in `src/features/assessments/lib/attempt-deadline.ts`, `src/app/api/auto-submit/route.ts` | [TH] Exams (attempt limits, pass marks) on Plus only |
| `ai-marking` | AI-assisted marking | Suggested marks and feedback for written answers (Bedrock or similar); the tutor always approves | Pro | answers above the Pro allowance (per 100 answers, via `ai-credits`) | no | [GS] AI-powered grading on Institutional; [SS] AI on higher licences; [TG] AI limits on Standard |
| `code-plagiarism` | Code plagiarism report | Similarity report across a class's code submissions | Pro | no (**Guess:** runs on Nexa's own servers) | no | **Unverified:** no tutoring competitor page found |
| `api-access` | API and webhooks | Workspace API keys and outgoing webhooks | Pro | requests above a quota (**Guess:** per 10,000) | no (internal `src/app/api/**` only) | [TH] API and webhooks on Grow |

## 3. Add-ons (per hour or per day)

| Key | Name | Description | Unit | Price (01, section 6) | Exists today | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `day-pass` | Exam or competition day pass | Pro services for one day without moving the course to Pro | per course per day | R99 for up to 30 students, +R3 per extra student | no | **Guess:** no competitor sells this |
| `runner-capacity` | Extra code-runner capacity | Extra Judge0 workers for exam windows | per runner-hour (min 2) | R29 | no | [AZ] extra parallel jobs sold separately |
| `live-room` | Hosted live-session room | Nexa-hosted video (ACS) instead of an external link | per participant-hour | R5.50 (min R11); recording +R13/h | no | [GW] Meet capacity gated |
| `ai-credits` | AI marking credits | Answers above the Pro allowance | per 100 answers | R45 | no | [TG] AI limits by plan |
| `extra-storage` | Extra storage | Storage above the allowance | per GB per month | R7 | no | [MC] storage caps per plan |

## 4. Missing from the plan

Only items with codebase or market evidence are listed. Each one needs the owner's yes before it goes into `services.md`.

| Key | Name | Description | Proposed tier | Metered (unit) | Exists today | Evidence | Why add it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `math-solve` | Step-by-step maths check | Wolfram step-by-step solving and checking of a student's working | Plus (metered) | per call | no | [CD] homework helper paid; the plan's math-input note says "solving via an external API is metered separately" | The plan mentions the meter but gives it no key. Wolfram also needs written approval before resale (topic 4). |
| `originality-check` | Originality check | Flag copied or AI-written answers in written work | Pro | per check, if an external API is used | no | [GW] 5 reports per class free, unlimited on Plus | The plan covers code plagiarism only, not written answers |
| `bulk-import` | Bulk enrolment and import | Add students by CSV or an invite link; import tests from JSON | Core | no | partial: `src/features/assessments/lib/test-io.ts` (test JSON), `src/app/dashboard/manage-courses/[id]/student-manager-dialog.tsx` (one by one) | [TH] bulk enrolment and CSV import on Grow | Already half built; organisations with 150 students need it |
| `calendar-sync` | Calendar sync | Subscribe to Nexa events in Google or Apple calendars (ICS feed) | Plus | no | no | [CD] calendar sync is a paid Plus feature | Parents ask for it; cheap to build |
| `read-receipts` | Message read receipts | Show who has read an announcement | Plus | no | no | [CD] read receipts paid | Small extension of `messages` |
| `certificates` | Completion certificates | Certificates when a course is completed | Core | no | no | [TE] gated on Growth; [TH] on all plans | The market is split, so it belongs in Core |
| `custom-roles` | Custom admin permissions | Roles beyond OWNER, ADMIN and TUTOR for large organisations | Pro (later) | no | partial: `Role` enum in `prisma/schema.prisma` | [TE] custom admin permissions on Growth | Only for big centres; not v1 |

Considered and left out: a mobile app ([TH] $199/mo add-on; the plan has no native app), LMS/LTI integration ([GS]; tutors do not run an institutional LMS) and 2FA (the plan's Identity module covers it, and security should not be a paid service).

## 5. Notes for `contracts/services.md`

- `hasService(viewer, courseId, key)` is true when the course's tier is at least the service's tier, or a `day-pass` is active for that course today. For metered keys, the workspace must also be under its monthly cap.
- A course's tier is derived from its switched-on services (plan, "Gate 1"). Basic keys are always on.
- Metered keys write `UsageRecord` rows: `fee-collection` (commission), `automarker`, `ai-marking` / `ai-credits`, `math-solve`, `api-access`, `runner-capacity`, `live-room`, `extra-storage`, `day-pass`.
- The trial switches every Pro key on, with caps: 20 students, 200 `automarker` runs, 100 `ai-marking` answers and, as recommended in 01, 25 `math-solve` calls.
- Core features that exist today stay Core. Moving one up a tier would take a feature away from current users.

## Open questions for the owner

1. Do `math-input` and `graphing` stay in Plus? Nexa's niche is maths tutors, so Plus is the main upsell, but it may slow adoption.
2. Add `math-solve` as its own metered key (recommended), or fold it into `math-input`?
3. Which "Missing from the plan" keys go into v1? Recommended: `math-solve`, `bulk-import` and `originality-check`.
4. The plan lists "12 current question types". The schema has 11 answerable types plus `NONE`, a container for sub-questions. Is `NONE` counted?
5. Does `fee-collection` stay in Core with commission as its only charge? This research assumes yes.

## Sources

- https://www.thinkific.com/pricing/ (checked 2026-11-16)
- https://teachable.com/pricing (checked 2026-11-16)
- https://edu.google.com/workspace-for-education/editions/compare-editions/ (checked 2026-11-16)
- https://turnitin.gradescope.com/pricing (checked 2026-11-16)
- https://seesaw.com/pricing (checked 2026-11-16)
- https://classdojo.com/plus (checked 2026-11-16)
- https://www.teachngo.com/pricing (checked 2026-11-16)
- https://www.tutorbird.com/pricing/ (checked 2026-11-16)
- https://www.moodlecloud.com/standard-plans/ (checked 2026-11-16)
- https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/ (checked 2026-11-16)
- Plan of record: "Nexa LMS: Platform revamp plan", revision 2, sections "Pricing and payment gates (revision 2)", "Roles and tenancy (revision 2)", "What to build for an independent platform" (read 2026-11-16)
- Codebase: `prisma/schema.prisma`, `src/features/*`, `src/app/dashboard/*`, `src/lib/*` on branch `revamp/a-research` (read 2026-11-16)
- Unit costs: 04-api-costs.md and 05-hosting.md in this folder (checked 2026-11-16)
