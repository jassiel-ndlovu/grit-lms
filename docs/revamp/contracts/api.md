# Contract: the Nexa API and webhooks

Owner: Agent A. Reader: Agent B (the settings screens) and workspace developers. Status: **Draft 1, 2026-11-24.**

#216 phase 3, **Pro**. A workspace gets API access when:
- any of its courses has a v1 Pro service on;
- it's comped;
- or billing isn't switched on yet.

Otherwise the API answers 403, and the settings actions refuse with "API keys and webhooks are part of the Pro plan."

## 1. Keys

Owners and admins (`workspace.settings`) manage keys from `@/features/api/actions`:

| Action | Input | Returns |
| --- | --- | --- |
| `getApiSettings` | `{}` | `{ available, scopes: [{ key, label }], events }`, for building the forms |
| `listApiKeysAction` | `{}` | `[{ id, name, prefix, scopes, createdAt, lastUsedAt, expiresAt, revokedAt }]` |
| `createApiKeyAction` | `{ name, scopes, expiresInDays? (1–730, or null for never) }` | The row plus **`key`, shown once**. Show it with a copy button and "You won't see this again" |
| `revokeApiKeyAction` | `{ id }` | `{ ok }`. Revoking takes effect immediately |

- **Format:** keys look like `nexa_live_` followed by 32 letters and digits. Only a SHA-256 of the key is stored.
- **Limits:** 10 active keys per workspace.
- **Scopes (all read-only):** `courses.read`, `learners.read`, `grades.read`, `attendance.read`, `invoices.read`, `bookings.read`.
- **Audit log:** creating, revoking, and every webhook change is written to it.

## 2. REST API (read-only)

Base URL: `https://www.nexa-lms.co.za/api/v1`. Send `Authorization: Bearer <key>`.

| Endpoint | Scope | Filters | Each item |
| --- | --- | --- | --- |
| `GET /courses` | `courses.read` | | `id, name, curriculum, subject, gradeLevel, lessons, createdAt` |
| `GET /learners` | `learners.read` | `courseId` | `id, userId, name, email (null for placeholder addresses), status, courses: [{ courseId, since }], createdAt` |
| `GET /grades` | `grades.read` | `courseId`, `since` | `id, courseId, studentUserId, type, title, score, outOf, percent, markedAt, updatedAt` |
| `GET /attendance` | `attendance.read` | `courseId`, `from`, `to` | `id, courseId, eventId, eventTitle, occurrenceStart, learnerId, status, method, markedAt` |
| `GET /invoices` | `invoices.read` | `status`, `since` | `id, number, learnerId, studentUserId, status, issuedAt, dueAt, paidAt, paidVia, subtotalCents, discountCents, totalCents, currency, lines` |
| `GET /bookings` | `bookings.read` | `courseId`, `from`, `to` | `id, courseId, tutorMembershipId, learnerId, startsAt, endsAt, status, usedCredit, cancelledAt, createdAt` |

**Paging:**
- Every list is newest first and returns `{ data, nextCursor }`.
- Pass `cursor=<nextCursor>` for the next page.
- `limit` runs from 1 to 100; the default is 50.

**Dates:** ISO 8601 in, ISO 8601 UTC out. Money is in cents (ZAR).

**Errors:** `{ error }`, with status:
- 400: a bad filter, limit or cursor;
- 401: no key, or a revoked or expired one;
- 403: a missing scope, or not on Pro;
- 429: rate limited;
- 500.

**Rate limit:**
- 120 requests a minute per key.
- Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds).
- A 429 carries `Retry-After`.

Write endpoints come later, on request.

## 3. Webhooks

Owners and admins manage webhook endpoints:

| Action | Input | Returns |
| --- | --- | --- |
| `listWebhooksAction` | `{}` | `[{ id, url, description, events, secretPrefix, active, createdAt, lastSuccessAt, failingSince, disabledReason }]` |
| `createWebhookAction` | `{ url, events, description? }` | The row plus **`secret` (`whsec_…`), shown once** |
| `updateWebhookAction` | `{ id, events?, description?, active? }` | The row. Switching on clears the failure state |
| `rotateWebhookSecretAction` | `{ id }` | `{ secret, secretPrefix }`. The old secret stops working at once |
| `deleteWebhookAction` | `{ id }` | `{ ok }` |
| `testWebhookAction` | `{ id }` | `{ ok, status, error, ms }`. Sends a signed `ping` now |
| `listWebhookDeliveriesAction` | `{ id, limit? }` | The last deliveries: `event, status, attempts, lastStatus, lastError, createdAt, deliveredAt, nextAttemptAt` |
| `retryWebhookDeliveryAction` | `{ deliveryId }` | Queues a FAILED delivery again |

**URLs:**
- They must be `https` on the standard port, with a public host name.
- Not allowed: an IP address, a private or internal name, credentials, or a Nexa or `vercel.app` host.
- Each delivery also resolves the name and refuses private addresses.
- Up to 5 endpoints per workspace.

**Events:**

| Event | `data` |
| --- | --- |
| `enrolment.created` | `courseId, learnerId, studentUserId?, source (join-request, managed-account or import), startedAt?` |
| `invoice.paid` | `invoiceId, number, paidVia (ONLINE or OFFSITE), paidAt, amountCents` |
| `booking.created` | `bookingId, courseId, learnerId, tutorMembershipId, startsAt, endsAt, usedCredit` |
| `booking.cancelled` | `bookingId, courseId, learnerId, startsAt, cancelledBy, creditReturned, reason` |
| `attendance.marked` | `eventId, courseId, occurrenceStart, marks: [{ learnerId, status }]` |
| `risk_alert.opened` | `alertId, courseId, studentUserId, level, reasons` |
| `grade.released` | Emitted by B's grading code: see below |

`enrolment.ended` will come when enrolments can end through A's code.

**Body:** `{ id: "evt_…", type, created, workspace, data }` as JSON. The same `id` can arrive more than once, so de-duplicate on it.

**Signature:**
- The header is `Nexa-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the secret>`.
- Recompute it, compare in constant time, and reject timestamps more than 5 minutes old.
- `verifySignature()` in `@/features/api/api-math` is the reference.

**Delivery:**
- The notifications job sends deliveries every 5 minutes, so expect up to about 5 minutes' delay.
- Any 2xx counts as received. Redirects aren't followed. The timeout is 8 seconds.
- **Retries:** after 1, 5, 30, 120, 720 and 1440 minutes, then FAILED.
- An endpoint that has failed for 3 days is switched off with a reason. Switching it back on resumes.
- Deliveries are kept 30 days.

**For B:**
- To send `grade.released`, call `emitWebhook(tx ?? prisma, workspaceId, "grade.released", { gradeId, courseId, studentUserId, title, score, outOf })` where a mark becomes visible to the student. Inside your transaction is fine: it only writes rows.
- **The settings screen:** under Settings › Integrations, owners and admins only. Show:
  - keys (create with scope tick boxes, a one-time key display, revoke);
  - webhooks (URL, event tick boxes, the one-time secret, test, the delivery log with retry, the on/off switch, and `disabledReason`).
- Hide the screen when `getApiSettings().available` is false; show the Pro upsell there instead.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-24 | Draft 1. Keys, read-only REST API, webhooks |
