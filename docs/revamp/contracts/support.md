# Contract: help and contact centre

Status: **Draft 1.0, 2026-11-24.** Owner's request, 24 Nov: one place where students, parents, tutors and organisations ask questions, give feedback and report problems, and where someone answers. A builds the data, rules, email and pages. This replaces the old `/support` page and the mailto link on `/dashboard/help`.

## What a query is

A **query** is one conversation between the person who asked and whoever answers. It has a short reference (`Q-1042`), a **kind**, a **topic**, a **status** and a thread of messages.

| Kind | Shown as | For |
| --- | --- | --- |
| `QUESTION` | Ask a question | "How do I…", "Why can't I…" |
| `PROBLEM` | Report a problem | Something is broken or wrong |
| `FEEDBACK` | Share feedback | An idea, a complaint, praise |

| Topic | Shown as |
| --- | --- |
| `ACCOUNT` | Signing in and my account |
| `CLASSES` | Classes, lessons and bookings |
| `TESTS` | Tests, assignments and marks |
| `PAYMENTS` | Fees and payments |
| `SUBSCRIPTION` | Nexa plan and billing (organisations) |
| `APP` | Using the app (pages, errors, speed) |
| `OTHER` | Something else |

**Status:**
- `OPEN`: waiting for an answer.
- `ANSWERED`: answered, waiting for the person who asked.
- `CLOSED`: done.

A reply from the person who asked sets it back to `OPEN`. Replying to a closed query reopens it within 30 days; after that they start a new one.

## Who answers (routing)

Every query goes to **Nexa** (`NEXA`) or to **the organisation** (`WORKSPACE`, with `workspaceId`). The pure rule is `defaultRoute` in `features/support/support-rules.ts`:

- **Signed out** (the public form): Nexa.
- **Staff** (owners, admins, tutors): Nexa. They are Nexa's customers.
- **Students and parents:**
  - `CLASSES`, `TESTS` and `PAYMENTS` go to their organisation. If they have several, they choose which; a course is optional.
  - Everything else goes to Nexa.

They can change the suggestion ("Who should answer?") before sending. A Nexa admin can move any query to the organisation, or back.

**Who sees an organisation's query:**
- Staff with `enquiries.manage` ("Handle enquiries") whose scope covers it:
  - whole-organisation roles see all of them;
  - branch roles see those about a course in their branches, and those with no course.
- The tutors of the query's course, who see queries about their own courses even without `enquiries.manage`.

A solo tutor's practice: the tutor sees everything.

**Nexa queries:** Nexa admins see all of them (`/dashboard/admin/support`).

## Privacy and safety

- A requester sees only their own queries. A parent's queries are their own, not their child's.
- **Internal notes:** staff can add notes that the requester never sees.
- **Public form:** the same bot and spam screen and hashed-IP rate limits as the landing-page enquiry. The requester gets one confirmation email with their reference and a private link. Replies go to the email they gave, and only when staff reply.
- **Attachments:** up to 3 images (PNG, JPEG or WebP, 5 MB each) per message, in Blob under `support/`. Shown only to people who can see the query.
- Queries are kept for 2 years after they close, then deleted (housekeeping).

## Actions (`@/features/support/actions`)

| Action | Who | Input | Returns |
| --- | --- | --- | --- |
| `getHelpContext` | signed in | `{}` | `{ persona, organisations: [{ id, name }], courses: [{ id, name, workspaceId }], suggestedRoute }` for the form |
| `submitQuery` | signed in | `{ kind, topic, subject (≤140), message (≤5000), route?, workspaceId?, courseId?, pagePath?, attachments? }` | `{ id, ref }` |
| `submitPublicQuery` | anyone | `{ kind, topic, name, email, subject, message, pagePath?, startedAt, website (honeypot) }` | `{ ok: true }` |
| `listMyQueries` | signed in | `{ status? }` | `[{ id, ref, kind, topic, subject, status, route, organisationName, updatedAt, unread }]` |
| `getQuery` | requester or staff who can see it | `{ id }` | the query, with messages (internal notes only for staff) |
| `replyToQuery` | requester or staff | `{ id, body, internal?, attachments? }` | the new message |
| `setQueryStatus` | staff; the requester may close or reopen their own | `{ id, status }` | `{ status }` |
| `listInbox` | staff (`enquiries.manage` or a course's tutor), Nexa admin | `{ route: "WORKSPACE" \| "NEXA", status?, topic?, cursor? }` | `{ items, nextCursor, counts }` |
| `moveQuery` | Nexa admin | `{ id, route, workspaceId? }` | `{ route }` |
| `rateAnswer` | requester | `{ id, helpful: boolean }` | `{ ok }` |

## Pages (A builds; B may restyle)

| Page | Who |
| --- | --- |
| `/dashboard/help` | Everyone signed in. Help for their role (searchable), "Contact us" and their queries |
| `/dashboard/help/new` | The form. `?topic=` and `?from=` (the page they came from) prefill it |
| `/dashboard/help/[id]` | A query's thread |
| `/dashboard/support` | The organisation's inbox (staff who can see queries) |
| `/dashboard/admin/support` | Nexa's inbox |
| `/support` | Public: short help, and the public form; sign in to see your queries |

**Notifications:**
- A new organisation query: an in-app notice (and email, per preferences) to the staff who can see it.
- A new Nexa query: an email to the support inbox (`SUPPORT_TO`, else the contact address).
- Each staff reply: the requester gets an in-app notice and an email.

## Changes

| Date | Change |
| --- | --- |
| 2026-11-24 | Draft 1.0 |
