# Payment providers

**Answer first.** Use **Paystack (South Africa)** as the primary provider, with **Payfast** as the fallback. Paystack is the only provider checked that documents per-transaction splits to many subaccounts that hold only a bank account, with configurable fee bearer, plus card subscriptions and variable-amount card charges through one API. Card fees are 2.9% + R1 and EFT is 2% (both excluding 15% VAT), payouts arrive after 2 working days, and transfers cost R3 each. Stripe **cannot** onboard a South African merchant directly today: Stripe's own country page lists South Africa as "Extended network" and routes it to Paystack. Payfast is the fallback because it also has split payments, subscriptions and tokenised variable charges, at a higher card fee (3.2% + R2) and a R8.70 payout fee.

Currency: all amounts are ZAR. No USD prices were needed in this file; where USD appears elsewhere in the research it is converted at R17.00/USD (Wise mid-market 16.95 on 2026-11-16, rounded).

## What Nexa needs

| Need | Detail |
|---|---|
| A. Platform billing | Monthly subscription to tutors and organisations (tier price per student per subject) plus usage (API pass-through, add-on hours). Amount changes every month. |
| B. Parent payments | Parent pays a tutor's fee through Nexa. Money is split: tutor payout plus Nexa commission. Many tutors, each with their own bank account. |
| C. Discounts | Discount codes on platform plans and possibly on parent payments. |
| D. Small team | Good API, webhooks, test mode, Node/TypeScript friendly. |

## Stripe: can it serve South African merchants?

| Question | Finding | Source |
|---|---|---|
| Can a South African business open a Stripe account? | **No, not directly.** Stripe's global page lists South Africa as "Extended network" and links it to Paystack, not to Stripe sign-up. Same for Nigeria, Ghana, Kenya and Côte d'Ivoire. | [stripe.com/global](https://stripe.com/global) (checked 2026-11-16) |
| Can a foreign Stripe platform pay out to South African tutors via Connect? | Self-serve cross-border payouts only work between US, UK, EEA, Canada and Switzerland. Other countries need sales or Global Payouts. | [docs.stripe.com/connect/cross-border-payouts](https://docs.stripe.com/connect/cross-border-payouts) (checked 2026-11-16) |
| Global Payouts? | Sender must be in GB or US (EU countries in private preview). Requires Stripe Treasury and is aimed at businesses that "already hold the licenses required to move money". | [docs.stripe.com/global-payouts](https://docs.stripe.com/global-payouts) (checked 2026-11-16) |

Conclusion: Stripe is not an option for a South African company. It would only work if Nexa incorporated in the US/UK/EU, and even then paying South African tutors is not self-serve. Some third-party blogs claim direct Stripe access in South Africa; Stripe's own page contradicts them. Stripe owns Paystack, so "Stripe in South Africa" in practice means Paystack.

## Fees (local)

All rates are per transaction and **exclude 15% VAT** unless stated. Worked column: fee on a R1,000 parent payment, VAT included.

| Provider | Local card | Instant EFT / pay-by-bank | International card | R1,000 card fee incl. VAT (R) | R1,000 EFT fee incl. VAT (R) | Source |
|---|---|---|---|---|---|---|
| Paystack | 2.9% + R1 | 2% (EFT; Ozow and Capitec Pay via Paystack) | 3.1% + R1 | 34.50 | 23.00 | [Paystack transactions pricing](https://support.paystack.com/en/articles/2130306), [SA compliance page (R34.50 example)](https://support.paystack.com/en/articles/2124418) (checked 2026-11-16) |
| Payfast | 3.2% + R2 | 2%, min R2 (Instant EFT and Capitec Pay) | No separate rate listed | 39.10 | 23.00 | [payfast.io/fees](https://payfast.io/fees) (checked 2026-11-16) |
| Peach Payments (Growth) | 2.95% + R1.50 (3DS); 3.50% + R1.50 non-3DS and recurring | 1.50% + R1.50 (Pay by Bank, Capitec Pay) | 3.50% + R1.50 | 35.65 (3DS); 41.98 (recurring) | 18.98 | [peachpayments.com/pricing](https://www.peachpayments.com/pricing) (checked 2026-11-16) |
| Ozow | 2.85% (under R250k/month), min R1 | 1.5%, min R1 | 3.5%, min R1 | 28.50 + VAT if applicable | 15.00 + VAT if applicable | [ozow.com/pricing](https://ozow.com/pricing) (checked 2026-11-16). **Unverified:** whether Ozow prices exclude VAT. |
| Yoco (online) | Not published as a separate rate. FAQ: online costs "0.5% more" than card-machine rates (Core card machine: 2.30% debit/credit up to R50k). | Not listed | Card machine 3.20% (Core) | **Guess:** about 2.8% + VAT = 32.20 | n/a | [yoco.com/za/fees](https://www.yoco.com/za/fees/) (checked 2026-11-16) |
| Stripe | Not available to SA merchants | n/a | n/a | n/a | n/a | see above |

Monthly or fixed fees:

| Provider | Monthly fee (R) | Other fixed fees | Source |
|---|---|---|---|
| Paystack | 0 (none shown) | Transfers R3 each, failed or successful | [Transfers pricing](https://support.paystack.com/en/articles/2130370) (checked 2026-11-16) |
| Payfast | 0 (none shown) | Payout R8.70 standard; immediate 0.8% (min R14); refund R2 | [payfast.io/fees](https://payfast.io/fees) (checked 2026-11-16) |
| Peach | 0 on Growth; R300 on Enterprise | Tokenisation R200/month (needed for recurring) | [peachpayments.com/pricing](https://www.peachpayments.com/pricing) (checked 2026-11-16) |
| Ozow | No subscription or setup fees | Payouts R3; real-time refunds R3; AVS R0.50 | [ozow.com/pricing](https://ozow.com/pricing) (checked 2026-11-16) |
| Yoco | Core R0; Plus R249; Pro R499 per location | Once-off sign-up fee for gateway without card machine (amount not shown) | [yoco.com/za/fees](https://www.yoco.com/za/fees/), [yoco.com/za/gateway](https://www.yoco.com/za/gateway/) (checked 2026-11-16) |

## Features for Nexa

| Feature | Paystack | Payfast | Peach | Ozow | Yoco |
|---|---|---|---|---|---|
| Split payments / marketplace | **Yes.** Subaccounts (bank details only), percentage or flat split, multi-split, dynamic split per transaction, fee bearer selectable (`account`, `subaccount`, `all`, `all-proportional`). [split](https://docs-v2.paystack.com/docs/payments/split-payments/), [multi-split](https://docs-v2.paystack.com/docs/payments/multi-split-payments/) | **Yes**, fixed, percentage or both; money lands in main account then is split "immediately" to a secondary Payfast account; works on subscriptions and tokenisation. [split payments](https://payfast.io/features/split-payments/) **Unverified:** limited to one receiver per transaction. | **No native split found.** Payouts API from a pre-funded float (bulk EFT to many recipients). [llms.txt index](https://developer.peachpayments.com/llms.txt), [Payouts FAQ](https://support.peachpayments.com/support/solutions/articles/47001121785-peach-payouts-float-management-and-faqs) | **No split found.** Payouts R3 each. | **No.** "Split" on Yoco means Happy Pay instalments. [gateway](https://www.yoco.com/za/gateway/) |
| Subscriptions (fixed) | Yes: plans hourly to annually, hosted manage link, webhooks. Card only. Failed charges are not retried. [subscriptions](https://docs-v2.paystack.com/docs/payments/subscriptions/) | Yes, fixed amount, min R5 per cycle. [subscriptions](https://payfast.io/features/subscriptions/) | Yes, recurring via tokenisation (R200/month). | Capitec Pay variable recurring payments only (1.5%). | **No** ("Not yet"). |
| Usage-based (variable amount each month) | Yes, by charging a saved card authorization with any `amount`; cards only. [recurring charges](https://docs-v2.paystack.com/docs/payments/recurring-charges/) | Yes, tokenisation charges on merchant instruction with variable amount. [developers.payfast.co.za](https://developers.payfast.co.za/) | Yes, card-on-file tokens. | Capitec Pay VRP only. | No. |
| Payout timing | 2 working days (automated); new subaccount: first payout held until verified. [automated payouts](https://support.paystack.com/en/articles/2123586), [getting your money](https://support.paystack.com/en/articles/2125314) | On request (R8.70) or immediate (0.8%). **Unverified:** automatic payout schedule. | Next business day, free; Growth starts after 2 weeks of trading. | Next-day settlement included. | Within 2 business days. |
| Refunds | Full or partial; fees not refunded; refunds within 1 year (from 15 Oct 2026); deducted from pending payout first. [refunds](https://support.paystack.com/en/articles/2127106) | R2 per refund. | Refund API for some methods. | Real-time refunds R3. | Refund API and webhooks. [llms.txt](https://developer.yoco.com/llms.txt) |
| Chargebacks | No penalty fee on accepted chargebacks; SA merchants have 48 hours to respond. [first chargeback](https://support.paystack.com/en/articles/2127234) | **Unverified** | **Unverified** | **Unverified** | **Unverified** |
| Discount / coupon support | **Unverified:** no coupon object found in docs. Build in Nexa (compute amount before charge). | **Unverified:** none found. | **Unverified** | n/a | n/a |
| Test mode / sandbox | **Unverified** in a fetched page (Paystack test keys are well known). | Sandbox that mirrors production. [developers.payfast.co.za](https://developers.payfast.co.za/) | Sandbox. [llms.txt](https://developer.peachpayments.com/llms.txt) | **Unverified** | Testing guides, sandbox. |
| Webhooks | Yes (subscription and charge events listed in docs). | ITN notifications. | Yes. | **Unverified** | Yes, signed. |
| Official Node SDK | **Unverified:** none found; plain REST is simple. | **Unverified:** none found. | Not found. | **Unverified** | Not found (iOS/Android SDKs only). |

## Onboarding requirements

| Provider | Individual / sole proprietor | Registered company | Limits | Source |
|---|---|---|---|---|
| Paystack | Starter: personal bank account, bank confirmation letter, photo ID; names must match. Sole proprietor also: proof of address under 6 months. | Corporate bank confirmation letter (under 6 months), CIPC certificate, CIPC enterprise number, at least one director. | Starter lifetime collections R80,000; sole proprietor R1,000,000; registered business no limit. Starter has no Paystack balance (refunds only from pending payouts). | [SA compliance](https://support.paystack.com/en/articles/2124418), [getting your money](https://support.paystack.com/en/articles/2125314), [refunds](https://support.paystack.com/en/articles/2127106) (checked 2026-11-16) |
| Payfast | "Individual" account for traders and sole proprietors. FICA verification required. | "Business" account; CIPC documents, directors' IDs, bank confirmation (per Payfast blog). | Not stated. | [account types](https://payfast.io/account-types/), [KYC blog](https://payfast.io/blog/kyc-explained-for-smes-how-to-get-verified-faster-with-payfast/) (checked 2026-11-16) |
| Peach | **Unverified** | **Unverified** | Growth plan for under R500k/month. | [pricing](https://www.peachpayments.com/pricing) |
| Ozow | **Unverified** | **Unverified** | AVS required for high-risk merchants. | [pricing](https://ozow.com/pricing) |
| Yoco | Business profile, website verification, R2 test payment. **Unverified:** sole trader eligibility for gateway. | Same. | n/a | [gateway](https://www.yoco.com/za/gateway/) |

For Nexa: register a (Pty) Ltd before going live with parent payments. A Paystack Starter account would hit the R80,000 lifetime cap quickly, and only registered businesses get a Paystack balance and manual payouts.

Tutor subaccounts on Paystack need only a business name, bank code and account number; Paystack warns it is not liable for payouts to wrong accounts, so Nexa must verify tutor bank details ([split payments](https://docs-v2.paystack.com/docs/payments/split-payments/), checked 2026-11-16).

## Policy fit for an education marketplace

| Provider | Finding | Source |
|---|---|---|
| Paystack | SA ineligible list: crypto trading, dropshipping, mobile wallets, lending, remittance, savings, betting, lotteries, SARS-prohibited goods. Education and marketplaces are **not** listed. Global list includes "escrow services" (holding funds until sale conditions are met), so Nexa must not hold parent money pending lesson delivery. | [ineligible businesses](https://support.paystack.com/en/articles/2127042) (checked 2026-11-16) |
| Payfast | Has a prohibited goods list; marketplaces are supported by the split feature ("marketplaces with multiple sellers"). **Unverified:** full list not fetched. | [split payments](https://payfast.io/features/split-payments/) |
| Peach | Payouts float model means Nexa receives then pays tutors itself, which looks like a "beneficiary service provider" under SARB Directive 1 of 2007 (see 09-compliance.md). Poor fit. | [Payouts FAQ](https://support.peachpayments.com/support/solutions/articles/47001121785-peach-payouts-float-management-and-faqs) |
| Ozow, Yoco | No split product; same problem as Peach. | above |

## Example monthly cost (parent payments)

**Guess** volume: 150 students x R1,000/month parent fees = R150,000/month, 70% card, 30% EFT, 5 tutors.

| Provider | Card fees incl. VAT (R) | EFT fees incl. VAT (R) | Payout fees (R) | Total (R/month) |
|---|---|---|---|---|
| Paystack | 105 x 34.50 = 3,622.50 | 45 x 23.00 = 1,035.00 | 0 (split payouts automatic) | **4,657.50** |
| Payfast | 105 x 39.10 = 4,105.50 | 45 x 23.00 = 1,035.00 | 5 x 10.01 = 50.05 | **5,190.55** |
| Peach | 105 x 35.65 = 3,743.25 | 45 x 18.98 = 854.10 | free settlement; payouts API fee **Unverified** | **4,597.35+** |

Peach looks cheapest on raw fees but has no split, so Nexa would hold tutor money. Paystack is about 3.1% of volume all-in.

## Recommendation

1. **Primary: Paystack.** Subaccount per tutor (or per organisation), dynamic multi-split on each parent checkout with Nexa's commission as the main-account share, `bearer_type` chosen by policy (Guess: tutor bears fees via `subaccount` or `all-proportional`). Platform billing: first card charge to get a reusable authorization, then a nightly or monthly job charges the computed amount (tier + usage - discount). Use Paystack Plans only if a fixed price is wanted.
2. **Fallback: Payfast.** Split payments and tokenised variable charges cover both needs. Higher card fee and R8.70 payout fee. **Unverified:** whether one transaction can split to more than one receiver.
3. Do not use Stripe (not available), Yoco (no recurring, no split) or Ozow/Peach for parent payments (no split; Nexa would hold funds).
4. Offer EFT for parents (2% on Paystack) but platform subscriptions must be card-based, since Paystack reusable authorizations are card-only.

## Provider interface sketch

A `PaymentProvider` interface in `src/lib/payments/` with one adapter per provider. Operations:

- `createPayee(tutorOrOrg, bankDetails)` returns a provider payee id (Paystack subaccount code).
- `updatePayee(payeeId, changes)` and `verifyBankAccount(bankCode, accountNumber)`.
- `createCheckout({ amount, currency, customer, reference, splits[], feeBearer, metadata, returnUrl })` returns a redirect URL.
- `verifyPayment(reference)` returns status, amount, channel, fees.
- `saveAuthorization(payment)` and `chargeSavedMethod({ authorizationRef, amount, reference })` for usage billing.
- `createPlan` / `subscribe` / `cancelSubscription` (optional; only if fixed plans are used).
- `refund({ reference, amount?, reason })` (full or partial).
- `listPayouts(payeeId, period)` and `getBalance()` for reconciliation.
- `parseWebhook(rawBody, headers)` verifies the signature and returns a normalised event (`payment.succeeded`, `payment.failed`, `refund.processed`, `chargeback.opened`, `subscription.*`, `payout.*`).
- `capabilities()` reports split, recurring, variable charge, EFT and refund support so the app can hide features a provider lacks.
- Discounts and commission are computed in Nexa before calling the provider; the provider only sees final amounts and split shares.
- Every call takes an idempotency key (Nexa reference) and stores the raw provider response.

## Against the plan

| Plan (rev 2) | This research | Note |
| --- | --- | --- |
| Paystack as the provider; confirm subaccounts, splits and subscriptions together with sales | Agrees. All three are documented for South Africa, but no source shows a subscription charge that also splits to a subaccount | Ask Paystack sales exactly this before Phase 2; until then, bill tutors (Gate 1) without splits and split only parent checkouts (Gate 2) |
| Fallback: Payfast split payments, "which reportedly only pay other Payfast merchants" | Agrees. Payfast's split page says funds are split to a secondary Payfast account | Each tutor would need their own Payfast account, which is more onboarding than a Paystack subaccount (bank details only) |
| Commission placeholder 2%, card fees "separate" | Payfast's split lets either party bear fees; Paystack's `bearer` setting does the same | The fee-bearer choice decides the tutor's take; see 01-pricing-market.md for the two commission models |
| "Stripe does not onboard South African businesses directly" | Confirmed on Stripe's own country page (checked 2026-11-16) | No change |

## Open questions for the owner

1. Is Nexa a registered (Pty) Ltd yet? Paystack Starter caps lifetime collections at R80,000.
2. Who bears provider fees on parent payments: tutor, Nexa, or proportional?
3. Should parents be able to pay by EFT (no saved method, so no auto-debit) as well as card?
4. Should Nexa hold money until a lesson happens? If yes, that is escrow and Paystack lists escrow as ineligible; recommend no.
5. Do organisations get one payee (org bank account) or one per tutor?
6. Ask Paystack sales to confirm: education marketplace fit, split availability in South Africa, chargeback fees, volume discounts.

## Sources

- https://stripe.com/global (checked 2026-11-16)
- https://docs.stripe.com/connect/cross-border-payouts (checked 2026-11-16)
- https://docs.stripe.com/global-payouts (checked 2026-11-16)
- https://support.paystack.com/en/articles/2130306 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2124418 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2130370 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2123586 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2125314 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2127106 (checked 2026-11-16)
- https://support.paystack.com/en/articles/2127234 (search result summary only, checked 2026-11-16; not fetched)
- https://support.paystack.com/en/articles/2127042 (checked 2026-11-16)
- https://docs-v2.paystack.com/docs/payments/split-payments/ (checked 2026-11-16)
- https://docs-v2.paystack.com/docs/payments/multi-split-payments/ (checked 2026-11-16)
- https://docs-v2.paystack.com/docs/payments/subscriptions/ (checked 2026-11-16)
- https://docs-v2.paystack.com/docs/payments/recurring-charges/ (checked 2026-11-16)
- https://payfast.io/fees (checked 2026-11-16)
- https://payfast.io/features/split-payments/ (checked 2026-11-16)
- https://payfast.io/features/subscriptions/ (search result summary, checked 2026-11-16)
- https://developers.payfast.co.za/ (search result summary; page body did not render, checked 2026-11-16)
- https://payfast.io/account-types/ (checked 2026-11-16)
- https://payfast.io/blog/kyc-explained-for-smes-how-to-get-verified-faster-with-payfast/ (search result summary, checked 2026-11-16)
- https://www.peachpayments.com/pricing (checked 2026-11-16)
- https://developer.peachpayments.com/llms.txt (checked 2026-11-16)
- https://support.peachpayments.com/support/solutions/articles/47001121785-peach-payouts-float-management-and-faqs (search result summary, checked 2026-11-16)
- https://ozow.com/pricing (checked 2026-11-16)
- https://www.yoco.com/za/fees/ (checked 2026-11-16)
- https://www.yoco.com/za/gateway/ (checked 2026-11-16)
- https://developer.yoco.com/llms.txt (checked 2026-11-16)
