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

**Built (2026-11-19):** `startFirstPayment`, `payPlatformInvoice`, `getBillingPaymentStatus`, `startCardReplacement`. The return page sends the payer back to `returnPath` with `?reference=…&trxref=…` added by Paystack; poll `getBillingPaymentStatus({ reference })` every 2 to 3 seconds until it is not `PENDING`. The poll asks Paystack itself, so it settles even when the webhook is late. A `FAILED` checkout can still be retried on Paystack's page.

## 2. Parent and adult-student payments (Gate 2: payers pay tutors)

| Name | Kind | Permission | Input | Returns |
| --- | --- | --- | --- | --- |
| `listPayableInvoices` | query | guardian, or `fees.pay` | `{ status?: "OPEN" \| "PAID" }` | `Array<{ id, number, child: { userId, name }, payee: { name }, workspaceName, totalCents, dueAt, status: InvoiceStatus, lockedUntil: string \| null }>` |
| `startCheckout` | action | `fees.pay` | `{ invoiceIds: string[], discountCode?: string }` | `{ authorizationUrl, reference, totalCents, discountCents }` |
| `getCheckoutStatus` | query | the payer | `{ reference }` | `{ status: PaymentStatus, invoices: Array<{ id, status: InvoiceStatus }> }` |

One checkout may hold invoices for several children and several tutors.

**Built (2026-11-20):** all of section 2. `listPayableInvoices` in `src/features/payments/fee-queries.ts`; `startCheckout` and `getCheckoutStatus` in `checkout-actions.ts` (actions, so the return page can poll `getCheckoutStatus`; it asks Paystack while the payment is pending). `startCheckout` also takes `returnPath` (default `/dashboard/fees/return`); Paystack adds `?reference=`. `discountCode` (2026-11-20): a workspace's `PARENT_INVOICE` code lowers that workspace's invoices only; errors `CODE_INVALID`, `CODE_EXPIRED`, `CODE_USED`. PERCENT takes that share of each invoice; FIXED is one amount per checkout spread by invoice total; every invoice keeps at least R1. It is used once per child per checkout and runs out for a child after `durationPeriods` paid checkouts; `maxRedemptions` counts children. The invoice gets a `Discount <CODE>` line and its lower total only when the payment succeeds. `previewCheckout({ invoiceIds, discountCode? })` (action, same checks, nothing locked) returns `{ totalCents, discountCents, code, invoices: Array<{ id, totalCents, discountCents }> }` for the confirm step. A failed card keeps the invoices locked until the 30 minutes run out (the payer can retry on Paystack's page). `lockedUntil` is set while an invoice is in a pending checkout, so it cannot be paid twice.

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
| ~~`requestRefund`~~ | | | | Dropped (owner decision 2026-11-20): refunds are never self-serve; a Nexa admin refunds after an investigation (`adminRefundFeeInvoice`, section 4) |
| `listFeeDiscountCodes` | query | `fees.manage`, owners and admins only | none | `Array<{ id, code, description, kind, percentBps, amountCents, startsAt, endsAt, maxRedemptions, redemptions, durationPeriods, active }>` |
| `createFeeDiscountCode` | action | `fees.manage`, owners and admins only | `{ code, description, kind, percentBps?, amountCents?, startsAt, endsAt?, maxRedemptions?, durationPeriods? }` | `{ id, code }` |
| `deactivateFeeDiscountCode` | action | `fees.manage`, owners and admins only | `{ id }` | `{ active: false }` |
| `listPayoutRecoveries` | query | `payouts.connect` or `fees.manage` | none | `Array<{ id, payoutAccountId, invoiceNumber, refundCents, reason, owedCents, repaidCents, outstandingCents, status, noticeSentAt, deductFrom, payPath, closedAt }>` |

**Refund recovery (2026-11-20, owner decision).** Paystack takes a refund from Nexa's balance. The payee owes their share of it (refund x the invoice's split share / the invoice total); Nexa bears its commission part. The payee is emailed a notice of deduction when Paystack processes the refund. From 7 days later, each checkout that pays them sends them less, at most 50% of that payout, oldest debt first, until it is repaid. After 60 days with nothing recovered they are emailed an invoice to pay by card at `payPath` (`/api/payouts/recoveries/[id]/pay`, a plain link); afterwards they land on `/dashboard/fees?recovery=paid|pending|failed|nothing-owed|not-found|unknown|unavailable|error`. `listPayoutRecoveries` shows a tutor their own account's recoveries (owners and admins see all); `status` is `ACTIVE`, `RECOVERED`, `CANCELLED` or `WAIVED`. B: show active ones on the payouts or fees screen with what is outstanding and when deductions start, a Pay button when `payPath` is set, and handle the `recovery` query parameter on `/dashboard/fees`.

**Built (2026-11-19):** all of section 3. Actions in `src/features/payments/fee-actions.ts`, queries in `fee-queries.ts`, behind `BILLING=1`. Rules for the screens: `resolvePayoutAccount` first and show the `accountName`, then `connectPayoutAccount`; an account is `ACTIVE` at once (Paystack holds the first payout until it has verified it). In `PER_TUTOR` mode `connectPayoutAccount` connects the caller's own account, and tutors may call it. `issueInvoice` refuses lines paid to different tutors (one invoice per payee) and needs a connected payee; invoice numbers are `INV-<year>-<6 digits>` per workspace. `markInvoicePaidOffsite` takes the full total only. `voidInvoice` and the off-site mark are refused while a checkout holds the invoice. A tutor sees and manages only invoices for courses they teach.

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
| `adminRefundFeeInvoice` | action | `admin.override` | `{ invoiceId, amountCents?, reason }` (after an investigation; the reason is quoted to the payee) | `{ refundId, status }` |
| `adminListPayoutRecoveries` | query | `admin.console` | `{ status?, workspaceId? }` | the `listPayoutRecoveries` rows plus `workspaceId`, `payeeName` (includes `AWAITING_REFUND`) |
| `adminHoldRecovery` | action | `admin.override` | `{ recoveryId, until, note }` (pauses deductions during a dispute) | `{ id, deductFrom }` |
| `adminWaiveRecovery` | action | `admin.override` | `{ recoveryId, note }` | `{ id, status: "WAIVED" }` |
| `adminSettleRecoveryOffsite` | action | `admin.override` | `{ recoveryId, note }` (repaid by EFT or similar) | `{ id, status: "RECOVERED" }` |

Every admin action takes a `note` (or `reason`) and writes an `AuditLog` row.

**Built (2026-11-19):** all of section 4. Queries in `src/features/admin/billing-queries.ts`, actions in `src/features/admin/billing-actions.ts` (Nexa admin persona plus `admin.override`). Rules worth knowing for the screens: `adminMarkPaidOffsite` takes the full invoice total only (no part payments) and opens the period from `receivedOn`; `adminVoidPlatformInvoice` refuses an invoice with a payment taken or in progress (refund instead); `adminRefundPayment` sends a partial refund once, and if Paystack's answer is lost it stays `PENDING` for a person to check; `adminExtendTrial` reopens an expired, never-paid trial from today; ending a comp makes a never-paid workspace `READ_ONLY`. `adminListWorkspaceBilling` also takes `limit` (1 to 200, default 50); `q` matches name or slug.

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
| 2026-11-20 | Draft 1.13. Parent-invoice discount codes: `createFeeDiscountCode`, `deactivateFeeDiscountCode`, `listFeeDiscountCodes` (owners and admins, since the discount comes out of every payee's share); `startCheckout` applies `discountCode`; new `previewCheckout` |
| 2026-11-20 | Draft 1.12. `requestRefund` dropped (refunds only by a Nexa admin after an investigation). Refund recovery from payees: `adminRefundFeeInvoice`, `adminListPayoutRecoveries`, `adminHoldRecovery`, `adminWaiveRecovery`, `adminSettleRecoveryOffsite`, tutor query `listPayoutRecoveries`, pay link `/api/payouts/recoveries/[id]/pay`. Rules in section 3 |
| 2026-11-20 | Draft 1.11. `setUsageCap` built (`limitQuantity: null` removes the owner's cap; storage in GB; returns CapStatus or null; caps are stored and shown, not yet enforced). Admin queries `adminGetWorkspaceBilling({ workspaceId })` (list row + `courses` in the getCourseTiers shape + first `invoices` page), `adminGetPlatformInvoice({ id })` (getPlatformInvoice + `workspaceId`; payments carry `paymentId`, null for off-site, and `refundableCents`), `adminListDiscountCodes({ active?, cursor?, limit? })`. Admin actions now revalidate `/dashboard/admin`. Fee emails to payers: new invoice, overdue (1 and 7 days), receipt after checkout |
| 2026-11-20 | Draft 1.10. Section 2 built (parent checkout); rules under the table |
| 2026-11-19 | Draft 1.9. Section 3 built (payouts, fee schedules, fee invoices; `requestRefund` later); rules under the table |
| 2026-11-19 | Draft 1.8. `getPlatformInvoice().pdfUrl` is now `/api/billing/invoices/<id>/pdf` (a PDF rendered on request; staff with `billing.view` for their own workspace, Nexa admins for any). New admin query `adminRetentionPreview()`: workspaces past their retention date and what deleting each would remove (a dry run), plus `deletesEnabled` |
| 2026-11-19 | Draft 1.7. Section 4 (Nexa admin) built; rules under the table |
| 2026-11-19 | Draft 1.6. `getUsage`, `listPlatformInvoices` and `getPlatformInvoice` built. `getBillingPaymentStatus` also returns `purpose: "CARD" | "INVOICE"` (use it instead of the `nx-card-` prefix; the prefix stays stable too). `payPlatformInvoice`'s default `returnPath` is now `/dashboard/settings/billing`, and billing emails link there. Invoice `status` shows `PAST_DUE` as `OPEN`; `pdfUrl` is `null` until invoice PDFs exist. `getUsage` for `active-students`: `days[].quantity` is distinct learners enrolled that day, `totalQuantity` distinct learners in the period, `estimatedCents` the period's seat charges so far (advance plus catch-ups and upgrades); in a trial, what the first 30 days would cost now. `ai-marks`: `estimatedCents` is the pass-through above the Pro pools so far. Other meters: 0 until those features record usage |
| 2026-11-19 | Draft 1.5. `redeemDiscountCode` built (`CODE_INVALID`, `CODE_EXPIRED`, `CODE_USED`); `periodsLeft` is the code's `durationPeriods` (null = no limit). Invoices and `getBillingOverview` apply the workspace's discount and open credit. Billing emails (trial ending and ended, dunning days 0, 3 and 7, read-only, receipt) go to owners, admins and the billing email; B builds no email screens |
| 2026-11-19 | Draft 1.4. `startCardReplacement` built: a R10 card check, refunded as soon as it succeeds. Poll `getBillingPaymentStatus` as for a payment; `SUCCEEDED` means the new card is saved. Renewals, dunning (`PAST_DUE` on day 0, `READ_ONLY` on day 14) and trial ends now run hourly in `/api/cron/billing` |
| 2026-11-19 | Draft 1.3. `startFirstPayment`, `payPlatformInvoice` and `getBillingPaymentStatus` built, plus `POST /api/webhooks/paystack`. New code `NOTHING_TO_BILL` (first payment with no enrolled learners). `payPlatformInvoice` takes an optional `returnPath` (default `/dashboard/settings/billing` since Draft 1.6) and may also return `{ status: "PENDING", reference }` when a saved-card charge is still processing: poll it like a redirect |
| 2026-11-19 | Draft 1.2. Section 1 queries and `setCourseServices` built. Added `PAST_DUE`, `BILLING_DISABLED` and `NOT_FOUND` codes, the `active-students` and `live-room-minutes` meters, and the `VAT` estimate line; defined `catchUpCents`, `nextRenewalDeltaCents` and `holdUntil` in `previewServiceChange` |
| 2026-11-16 | Draft 1.1. Renewal rules confirmed by the owner |
| 2026-11-16 | Draft 1. 30-day periods anchored to payment; tier hold of 30 days; Pro AI allowance with pass-through overage; no day pass or AI credits in v1 |
