# Contract: billing and payments

Owner: Agent A. Reader: Agent B. Status: **Draft 1, 2026-11-16.** B asks for changes in `docs/revamp/b/HANDOFF.md` or an issue labelled `needs-a`; A edits this file in its own pull request.

**Answer first.** These are the queries and server actions B's billing, payments, parent portal and admin screens call, with their inputs and return shapes. Workspaces pay Nexa in **30-day periods anchored to the payment date** (no calendar months, no proration). Tiers are Core R99, Plus R139 and Pro R179 per active student per course. Parents and adult students pay tutors through one checkout that can cover several children and tutors. B never computes a price; every amount comes from these calls.

Designs behind this contract: [a/design/03-billing.md](../a/design/03-billing.md) (workspace pays Nexa) and [a/design/04-payments.md](../a/design/04-payments.md) (provider, parent payments, webhooks). Service keys: [services.md](services.md). Viewer and permissions: [viewer.md](viewer.md).

## Conventions

- **Files.** Billing: `src/features/billing/queries.ts` and `actions.ts`. Payments: `src/features/payments/queries.ts` and `actions.ts`. Queries are server-only async functions; actions are next-safe-action clients with Zod input.
- **Results.** Actions return the next-safe-action shape `{ data?, serverError?, validationErrors? }`. `serverError` starts with a stable code: `TRIAL_CAP_REACHED`, `READ_ONLY`, `PAST_DUE`, `BILLING_DISABLED`, `NOT_FOUND`, `CODE_INVALID`, `CODE_EXPIRED`, `CODE_USED`, `CARD_REQUIRED`, `PROVIDER_ERROR`, `FORBIDDEN`. B maps codes to messages; the rest of the string is for logs.
- **Money.** Integer cents in ZAR, in fields ending `Cents`. VAT appears only as `vatCents` and only when `vatRegistered` is true.
- **Dates.** ISO 8601 strings. Day-only values are `YYYY-MM-DD` in the workspace's time zone.
- **Permissions.** Each call names the permission from [viewer.md](viewer.md) it checks. "Guardian" means the caller holds an active guardianship for the child concerned.
- **Redirects.** Paystack checkout returns an `authorizationUrl`. B redirects to it, and the return page polls the matching `*Status` query. B never treats the redirect itself as proof of payment.

## Shared types

```ts
type TierKey = "CORE" | "PLUS" | "PRO";
type BillingState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "COMPED" | "CANCELLED";
type Meter = "active-students" | "ai-marks" | "storage-gb" | "api-pass-through" | "live-room-minutes";

type Period = { start: string; end: string; renewsAt: string };

type EstimateLine = {
  kind: "SEATS" | "CATCH_UP" | "USAGE" | "PASS_THROUGH" | "DISCOUNT" | "CREDIT" | "VAT";
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};

type CapStatus = {
  meter: Meter;
  used: number;
  limit: number | null;
  percent: number | null;
  hardStop: boolean;
  source: "TRIAL" | "TUTOR" | "ADMIN";
};

type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";
type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
```

## 1. Workspace billing (Gate 1: the workspace pays Nexa)

### Queries

| Name | Permission | Input | Returns |
| --- | --- | --- | --- |
| `getBillingOverview()` | `billing.view` | none | `{ state: BillingState, trialEndsAt, trialDaysLeft, card: { brand, last4, expMonth, expYear } \| null, period: Period \| null, nextRenewalEstimateCents, estimate: EstimateLine[], caps: CapStatus[], overdueInvoiceId: string \| null, deleteAfter: string \| null, vatRegistered: boolean }` |
| `getCourseTiers()` | `billing.view` | none | `Array<{ courseId, title, derivedTierKey, billedTierKey, holdUntil: string \| null, drivers: string[], seatsThisPeriod, pendingCatchUpSeats, unitPriceCents, aiPool: { included, used } \| null, override: { tierKey, until } \| null }>` |
| `getCourseServices(courseId)` | `courses.services` | `{ courseId }` | `Array<{ key, name, kind, tierKey, status, enabled, availableNow, reason?: "PARKED" \| "LATER" \| "PAST_DUE" \| "READ_ONLY" }>` |
| `previewServiceChange(input)` | `courses.services` | `{ courseId, enable: string[], disable: string[] }` | `{ fromTier, toTier, seats, catchUpCents, nextRenewalDeltaCents, holdUntil: string \| null }` |
| `getUsage(input)` | `billing.view` | `{ meter: Meter, periodStart?: string }` (default: current period) | `{ period: Period, days: Array<{ day, quantity }>, totalQuantity, cap: CapStatus \| null, estimatedCents }` |
| `listPlatformInvoices(input)` | `billing.view` | `{ cursor?: string, limit?: number }` | `{ items: Array<{ id, number, periodStart, periodEnd, status: InvoiceStatus, totalCents, issuedAt, paidAt }>, nextCursor: string \| null }` |
| `getPlatformInvoice(id)` | `billing.view` | `{ id }` | `{ ...summary, lines: EstimateLine[], subtotalCents, discountCents, creditCents, vatCents, payments: Array<{ at, amountCents, via, status }>, pdfUrl }` |

**Built (2026-11-19):** `getBillingOverview`, `getCourseTiers`, `getCourseServices`, `previewServiceChange` and the action `setCourseServices`, in `src/features/billing/`. All are behind `BILLING=1`; with the flag off they throw `BILLING_DISABLED`. `previewServiceChange`: `catchUpCents` is the extra arrears this change adds to the next renewal (tier upgrades and catch-up seats for the current period); `nextRenewalDeltaCents` is the whole change to the next renewal invoice and **includes** `catchUpCents`; `holdUntil` is the date the tier after the change is held until, whether the hold is new or already running. `getCourseServices` returns `status` as `"v1" | "later" | "parked"` and `kind` as `"basic" | "premium"`, as in services.md.

`derivedTierKey` is what the switched-on services make the course today. `billedTierKey` is what it bills at: a raised tier holds for 30 days (`holdUntil`).

### Actions

| Name | Permission | Input | Returns |
| --- | --- | --- | --- |
| `setCourseServices` | `courses.services` | `{ courseId, enable: string[], disable: string[] }` | `{ derivedTierKey, billedTierKey, holdUntil }` |
| `confirmTrialTiers` | `billing.manage` | `{ courses: Array<{ courseId, tierKey }> }` | `{ updated, firstPaymentCents }` |
| `startFirstPayment` | `billing.manage` | `{ returnPath }` | `{ authorizationUrl, reference, amountCents }` |
| `payPlatformInvoice` | `billing.manage` | `{ invoiceId }` | `{ status: "CHARGED" } \| { status: "REDIRECT", authorizationUrl, reference }` |
| `startCardReplacement` | `billing.manage` | `{ returnPath }` | `{ authorizationUrl, reference }` |
| `getBillingPaymentStatus` | `billing.manage` | `{ reference }` | `{ status: "PENDING" \| "SUCCEEDED" \| "FAILED" }` |
| `setUsageCap` | `billing.manage` | `{ meter, limitQuantity, hardStop }` | `CapStatus` |
| `redeemDiscountCode` | `billing.manage` | `{ code }` | `{ description, scope, periodsLeft: number \| null }` |
| `updateBillingDetails` | `billing.manage` | `{ billingEmail, legalName?, customerVatNumber? }` | `{ ok: true }` |
| `cancelWorkspace` | `workspace.delete` | `{ reason }` | `{ endsAt, finalInvoiceEstimateCents, deleteAfter }` |

The first payment ends the trial and starts the first 30-day period. There is no day-pass action in v1.

**Built (2026-11-19):** `startFirstPayment`, `payPlatformInvoice`, `getBillingPaymentStatus`. The return page sends the payer back to `returnPath` with `?reference=…&trxref=…` added by Paystack; poll `getBillingPaymentStatus({ reference })` every 2 to 3 seconds until it is not `PENDING`. The poll asks Paystack itself, so it settles even when the webhook is late. A `FAILED` checkout can still be retried on Paystack's page.

## 2. Parent and adult-student payments (Gate 2: payers pay tutors)

| Name | Kind | Permission | Input | Returns |
| --- | --- | --- | --- | --- |
| `listPayableInvoices` | query | guardian, or `fees.pay` | `{ status?: "OPEN" \| "PAID" }` | `Array<{ id, number, child: { userId, name }, payee: { name }, workspaceName, totalCents, dueAt, status: InvoiceStatus, lockedUntil: string \| null }>` |
| `startCheckout` | action | `fees.pay` | `{ invoiceIds: string[], discountCode?: string }` | `{ authorizationUrl, reference, totalCents, discountCents }` |
| `getCheckoutStatus` | query | the payer | `{ reference }` | `{ status: PaymentStatus, invoices: Array<{ id, status: InvoiceStatus }> }` |

One checkout may hold invoices for several children and several tutors. `lockedUntil` is set while an invoice is in a pending checkout, so it cannot be paid twice.

## 3. Tutor fees and payouts

| Name | Kind | Permission | Input | Returns |
| --- | --- | --- | --- | --- |
| `getPayoutSettings` | query | `payouts.connect` or `fees.manage` | none | `{ payoutMode, accounts: Array<{ id, membershipId, businessName, bankName, accountNumberLast4, accountName, status }> }` |
| `listBanks` | query | `payouts.connect` | none | `Array<{ code, name }>` |
| `resolvePayoutAccount` | action | `payouts.connect` | `{ bankCode, accountNumber, idNumber? }` | `{ accountName }` |
| `connectPayoutAccount` | action | `payouts.connect` | `{ bankCode, accountNumber, businessName, idNumber? }` | `{ id, status }` |
| `setPayoutMode` | action | `workspace.settings` | `{ payoutMode }` | `{ payoutMode }` |
| `upsertFeeSchedule` | action | `fees.manage` | `{ id?, courseId, learnerId?, kind, amountCents, lessonsInPack?, description, billingDay?, startsOn, endsOn? }` | `{ id }` |
| `listFeeInvoices` | query | `fees.manage` | `{ courseId?, learnerId?, status?, cursor? }` | `{ items: Array<{ id, number, learnerName, payeeName, totalCents, status, dueAt, paidVia }>, nextCursor }` |
| `issueInvoice` | action | `fees.manage` | `{ learnerId, lines: Array<{ courseId?, description, quantity, unitAmountCents }>, dueAt }` | `{ id, number }` |
| `voidInvoice` | action | `fees.manage` | `{ invoiceId, reason }` | `{ status }` |
| `markInvoicePaidOffsite` | action | `fees.markOffsite` | `{ invoiceId, method, amountCents, receivedOn, reference?, note }` | `{ status: "PAID" }` |
| `voidOffsitePayment` | action | `fees.markOffsite` | `{ offsitePaymentId, reason }` | `{ invoiceStatus }` |
| `requestRefund` | action | `fees.manage` | `{ invoiceId, amountCents?, reason }` | `{ refundId, status }` |

Account numbers never come back in full; only `accountNumberLast4`. B shows card and bank fees as their own line, because the tutor bears them (2% Nexa commission plus the provider fee).

## 4. Nexa admin

| Name | Kind | Permission | Input | Returns |
| --- | --- | --- | --- | --- |
| `adminListWorkspaceBilling` | query | `admin.console` | `{ state?, q?, cursor? }` | `{ items: Array<{ workspaceId, name, kind, state, trialEndsAt, renewsAt, lastPeriodCents, overdueCents, deleteAfter }>, nextCursor }` |
| `adminGetPaymentVolume` | query | `admin.console` | none | `{ lifetimeCents, capCents, percent }` (Paystack sole-proprietor limit, R1,000,000) |
| `adminExtendTrial` | action | `admin.override` | `{ workspaceId, days, note }` | `{ trialEndsAt }` |
| `adminSetComp` | action | `admin.override` | `{ workspaceId, until: string \| null, note, end?: boolean }` | `{ state }` |
| `adminOverrideCourseTier` | action | `admin.override` | `{ courseId, tierKey: TierKey \| null, until?, note }` | `{ billedTierKey }` |
| `adminIssueCreditNote` | action | `admin.override` | `{ workspaceId, amountCents, reason }` | `{ creditNoteId }` |
| `adminVoidPlatformInvoice` | action | `admin.override` | `{ invoiceId, note }` | `{ status }` |
| `adminMarkPaidOffsite` | action | `admin.override` | `{ platformInvoiceId, method, amountCents, receivedOn, reference?, note }` | `{ status: "PAID" }` |
| `adminRefundPayment` | action | `admin.override` | `{ paymentId, amountCents?, reason }` | `{ refundId, status }` |
| `adminCreateDiscountCode` | action | `admin.override` | the `DiscountCode` fields in 03, minus counters | `{ id, code }` |
| `adminDeactivateDiscountCode` | action | `admin.override` | `{ id, note }` | `{ active: false }` |

Every admin action takes a `note` (or `reason`) and writes an `AuditLog` row.

## Rules for B

1. Show prices and totals only from these calls. Never multiply seats by a price on the client.
2. Before a tutor switches a service, call `previewServiceChange()` and show `catchUpCents` and `holdUntil` in the confirmation.
3. The "renews on" date is `period.renewsAt`. Do not say "this month".
4. When `viewer.workspace.readOnly` is true, show the overdue banner with `overdueInvoiceId` and a pay button (`payPlatformInvoice`). Learners and guardians never see it.
5. When `deleteAfter` is set, show the date in the cancellation and read-only screens: data is deleted 2 months after the last payment.
6. The return page after a checkout polls the status query every 2 seconds for up to 60 seconds, then shows "We're confirming your payment" and lets the user leave. The webhook settles it.

## Renewal rules (owner decisions, 16 November)

- A period is exactly **30 days** from the payment: paid 3 February, renews 5 March.
- A late payment starts a new 30-day period **on the day it is paid**; `period.renewsAt` moves with it.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-19 | Draft 1.3. `startFirstPayment`, `payPlatformInvoice` and `getBillingPaymentStatus` built, plus `POST /api/webhooks/paystack`. New code `NOTHING_TO_BILL` (first payment with no enrolled learners). `payPlatformInvoice` takes an optional `returnPath` (default `/dashboard/billing`) and may also return `{ status: "PENDING", reference }` when a saved-card charge is still processing: poll it like a redirect |
| 2026-11-19 | Draft 1.2. Section 1 queries and `setCourseServices` built. Added `PAST_DUE`, `BILLING_DISABLED` and `NOT_FOUND` codes, the `active-students` and `live-room-minutes` meters, and the `VAT` estimate line; defined `catchUpCents`, `nextRenewalDeltaCents` and `holdUntil` in `previewServiceChange` |
| 2026-11-16 | Draft 1.1. Renewal rules confirmed by the owner |
| 2026-11-16 | Draft 1. 30-day periods anchored to payment; tier hold of 30 days; Pro AI allowance with pass-through overage; no day pass or AI credits in v1 |
