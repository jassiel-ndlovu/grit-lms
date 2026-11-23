# Contract: services and tiers

Owner: Agent A. Reader: Agent B. Status: **Draft 1.7, 2026-11-23.** B asks for changes in `docs/revamp/b/HANDOFF.md` or an issue labelled `needs-a`; A edits this file in its own pull request.

**Answer first.** Every feature that a tier or add-on gates has a stable kebab-case **service key**. A course's tier is the highest tier among the premium services switched on for it: Core R99, Plus R139 or Pro R179 per active student per month. B gates UI and server code with `hasService(viewer, courseId, key)`, and shows the switches with `getCourseServices()` and `setCourseService()`. Keys never change once shipped; a retired key is marked `retired`, not reused.

Sources: plan "Pricing and payment gates (revision 2)", [a/research/02-service-catalogue.md](../a/research/02-service-catalogue.md), and the owner decisions of 16 November in [a/research/SUMMARY.md](../a/research/SUMMARY.md).

## Tiers

| Tier | Price per active student per course per 30-day period (excl. VAT) | What puts a course on it |
| --- | --- | --- |
| `CORE` | R99 | Basic services only |
| `PLUS` | R139 | At least one Plus service on |
| `PRO` | R179 | At least one Pro service on |

Prices live in the database (`Tier` rows, [a/design/03-billing.md](../a/design/03-billing.md)), not in code. B never hard-codes a price; it reads them from `getCourseServices()` or the billing contract.

## Service keys

`Status`: `v1` ships in v1; `later` is planned after v1; `parked` is on hold by owner decision (the key is reserved, `hasService` always returns `false`).

### Basic (Core, always on)

| Key | Name | Status |
| --- | --- | --- |
| `courses-lessons` | Courses, lessons and lesson groups (block editor, markdown, LaTeX) | v1 |
| `templates` | Course, lesson and group templates across the workspace | v1 |
| `tests` | Tests with the current question types, shuffling, memos, auto-marking of objective questions | v1 |
| `assignments` | Assignments with uploads, marking, rubrics and feedback | v1 |
| `gradebook` | Gradebook, progress reports and CSV export | v1 |
| `calendar` | Calendar, events and due dates | v1 |
| `messages` | Course-wide and organisation-wide messages, in-app and in digests | v1 |
| `notifications` | Notifications, search and settings | v1 |
| `portals` | Student portal and parent portal | v1 |
| `fee-collection` | Invoicing parents and collecting fees (2% commission, card fees separate) | v1 |
| `storage-allowance` | Storage per workspace plus per active student | v1 |
| `bulk-import` | Add students by CSV or invite link; import tests from JSON | v1 |
| `attendance` | The attendance register: mark present, late, absent or excused (moved to Core 22 Nov) | v1 |

### Premium

| Key | Name | Tier | Metered | Status |
| --- | --- | --- | --- | --- |
| `math-input` | Visual maths input (MathLive) | `PLUS` | no | v1 |
| `graphing` | Graphs in lessons and graph answers (Mafs) | `PLUS` | no | v1 |
| `question-bank` | Tagged question bank and randomised tests | `PLUS` | no | v1 |
| `live-sessions` | Live-session check-in codes, and emails to parents about absences (the register itself is Core) | `PLUS` | no | v1 |
| `advanced-analytics` | Item analysis and question difficulty | `PLUS` | no | v1 |
| `custom-branding` | Workspace logo, accent colour and sender name | `PLUS` | no | v1 |
| `calendar-sync` | ICS calendar feed per user | `PLUS` | no | v1 |
| `session-booking` | Tutors' bookable times; students and parents book lessons, using prepaid lesson-pack credits when the course sells packs | `PLUS` | no | v1 |
| `ai-assist` | AI help for tutors: question batches, course outlines from documents, and tidying or simplifying text. Capped runs a month on Plus, many more on Pro (`features/ai-assist/limits.ts`); every run spends AI credits | `PLUS` | AI credits | v1 |
| `secure-tests` | Lockdown settings, tab-switch and focus logs (honours extra time) | `PRO` | no | v1 |
| `ai-marking` | AI-suggested marks for written answers; the tutor approves every mark | `PRO` | answers above 30 per active student per period, pooled per course, billed at cost ÷ 0.8 | v1 |
| `at-risk-alerts` | At-risk alerts (falling or low marks, missed work, absences) that staff share with parents and students | `PRO` | no | v1 |
| `leaderboards` | Course leaderboards (everyone enrolled appears) | `PRO` | no | later |
| `api-access` | Workspace API keys and outgoing webhooks | `PRO` | requests above a quota | later |
| `automarker` | Coding automarker | `PRO` | runs | parked |
| `judge-mode` | Contests and rankings for code | `PRO` | no | parked |
| `code-plagiarism` | Code similarity report | `PRO` | no | parked |

### Add-ons

Add-ons are bought, not switched on per course. `retired` keys are never reused. `hasService` treats an active add-on as granting its services.

| Key | Unit | Grants | Status |
| --- | --- | --- | --- |
| `day-pass` | per course per day | Every `PRO` service on that course for the day | later |
| `ai-credits` | per 100 answers | Replaced by pass-through overage on `ai-marking` | retired |
| `extra-storage` | per GB per month | Storage above the allowance | v1 |
| `live-room` | per participant-hour | Nexa-hosted video | later |
| `runner-capacity` | per runner-hour | Extra code runners | parked |

### Candidates (not keys yet)

`math-solve` (step-by-step checking; waits on the Wolfram quote or B's local engine), `originality-check`, `read-receipts`, `certificates`, `custom-roles`. They get keys when the owner adds them.

## API

```ts
// src/features/billing/services.ts (server only), types re-exported for clients
export type Tier = "CORE" | "PLUS" | "PRO";
export type ServiceKey =
  | "courses-lessons" | "templates" | "tests" | "assignments" | "gradebook"
  | "calendar" | "messages" | "notifications" | "portals" | "fee-collection"
  | "storage-allowance" | "bulk-import" | "attendance"
  | "math-input" | "graphing" | "question-bank" | "live-sessions"
  | "advanced-analytics" | "custom-branding" | "calendar-sync" | "session-booking" | "ai-assist"
  | "secure-tests" | "ai-marking" | "at-risk-alerts" | "leaderboards" | "api-access"
  | "automarker" | "judge-mode" | "code-plagiarism";

export type ServiceInfo = {
  key: ServiceKey;
  name: string;
  tier: Tier;                       // CORE for basic services
  kind: "basic" | "premium";
  status: "v1" | "later" | "parked";
  metered: boolean;
};

/** Static catalogue, safe on the client. */
export const SERVICES: Record<ServiceKey, ServiceInfo>;

/**
 * True when the service is usable on this course for this viewer right now.
 * Cached per request. Never throws for a missing course: returns false.
 */
export function hasService(
  viewer: Viewer,
  courseId: string,
  key: ServiceKey,
): Promise<boolean>;

```

The course settings screen uses three calls defined in [billing.md](billing.md), so prices and services stay in one place:

| Call | Kind | Use |
| --- | --- | --- |
| `getCourseServices({ courseId })` | query | Every service with its tier, status, whether it is on, and why it is unavailable (`PARKED`, `PAST_DUE`, `READ_ONLY`) |
| `previewServiceChange({ courseId, enable, disable })` | query | The tier before and after, and the change to this month's bill, shown before the tutor confirms |
| `setCourseServices({ courseId, enable, disable })` | action | Switches services on and off and returns the course's tier now and for the month |

## Rules

1. **Basic services** return `true` for any viewer who can see the course.
2. **Premium services** return `true` when the key is in the course's `enabled` list and the status is `v1`. (A `day-pass` will also grant them once it ships.)
3. **During the trial** a tutor can switch on any `v1` premium service. The tier still follows from what is on, so the first invoice is predictable.
4. **Parked and later keys** always return `false`. B ships no UI for them.
5. **Billing state:** `hasService` does not check `READ_ONLY`; it answers "is the feature on". Write blocking is `viewer.workspace.readOnly` ([viewer.md](viewer.md)). Learners keep every service they had, so a read-only workspace never breaks a learner's view.
6. **Tier changes:** billing runs in 30-day periods from each payment. Raising a course's tier bills it at that tier for the next 30 days, even if the service is switched off sooner ([a/design/03-billing.md](../a/design/03-billing.md)). B shows `previewServiceChange()` before the tutor confirms.
7. **Who can switch:** `courses.services` permission: owner, admin, or the course lead.

8. **Flag off:** with `BILLING` unset (production until the owner switches billing on) `hasService` is true for every `v1` key and false for the rest, so gating a feature now changes nothing for today's users.
9. **New courses start on Pro** (owner decision 2026-11-20): `setUpCourseTenancy`, which `createCourse` already calls, switches on every v1 premium service for a new course outside the legacy workspace. That covers the trial ("every Pro service on") and stays after it: a tutor who wants a cheaper plan switches services off for Core or Plus. B: the course settings and billing screens must say that Core and Plus exist and cost less. `hasService` follows the rows as before.

Built (2026-11-19): `hasService` in `src/features/billing/services.ts`; the catalogue in `src/features/billing/catalogue.ts` (client-safe, re-exported from `services.ts`).

## Examples

```ts
// Show the maths keyboard in an answer field
const showMathInput = await hasService(viewer, courseId, "math-input");

// Guard a server action
if (!(await hasService(viewer, courseId, "ai-marking"))) {
  throw new ViewerError("FORBIDDEN");
}
```

## Change log

| Date | Change |
| --- | --- |
| 2026-11-23 | Draft 1.7. New `PLUS` service `ai-assist` (#216 phase 2). Migration 35 switches it on for courses already on Plus or Pro |
| 2026-11-23 | Draft 1.6. New `PLUS` service `session-booking` (#216 phase 2). Migration 34 switches it on for courses already on Plus or Pro, so no course changes tier |
| 2026-11-23 | Draft 1.5. New `PRO` service `at-risk-alerts` (#216 phase 2). Migration 33 switches it on wherever `ai-marking` is on, so courses already on Pro keep everything Pro |
| 2026-11-20 | Draft 1.4. Rule 9: new courses start on Pro; tutors downgrade for a cheaper plan |
| 2026-11-19 | Draft 1.3. `hasService` built; rules 8 (flag off) and 9 (trial) |
| 2026-11-16 | Draft 1. Owner prices R99 / R139 / R179; `math-input` and `graphing` on Plus; automarker, judge mode and code plagiarism parked; `leaderboards` split from `judge-mode` (owner decision: everyone enrolled appears) |
| 2026-11-16 | Draft 1.2. 30-day periods; `day-pass` later; `ai-credits` retired (overage at cost ÷ 0.8); Pro includes 30 AI marks per student per period |
| 2026-11-16 | Draft 1.1. Course-settings calls moved to `billing.md` (`setCourseServices` with enable and disable lists, plus `previewServiceChange`); highest-tier-in-month rule |
