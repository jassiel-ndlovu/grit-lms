# Compliance

> **This is research, not legal or tax advice.** It summarises public sources as checked on 2026-11-16. A South African attorney (POPIA, consumer law, payments) and a tax practitioner must review it before launch. See "What a lawyer should review" below.

**Answer first.** Nexa processes children's personal information, which POPIA section 34 prohibits unless an exception in section 35 applies; the practical exception is prior consent from a "competent person" (a parent or guardian), so every learner under 18 needs a recorded guardian consent before their data is processed. Nexa must register its Information Officer (the head of the company) on the Information Regulator's free eServices portal, and because data sits in the US (Neon us-east-1), it needs a section 72 basis for the transfer (a binding data processing agreement, or consent); transferring children's data to a country without adequate protection also triggers **prior authorisation** under section 57(1)(d), which is a strong reason to move the database to South Africa or to get a lawyer's view before launch. VAT registration became compulsory above **R2.3 million** of taxable supplies (voluntary above **R120,000**) from 1 April 2026, but the law change is announced and applied by SARS and not yet promulgated. For parent payments, use the payment provider's split/subaccount feature so Nexa never holds tutor money, act as the tutor's appointed agent in the terms, and ask a lawyer whether that keeps Nexa outside PASA third-party payment provider (TPPP) registration.

Currency: all amounts are ZAR. No USD amounts in this file (standard conversion elsewhere: R17.00/USD, Wise mid-market 16.95 on 2026-11-16, rounded).

## 1. POPIA and children's personal information

### Key definitions (POPIA section 1)

| Term | Meaning | Source |
|---|---|---|
| Child | A natural person under 18 who is not legally competent to act or decide about themselves without a competent person's assistance. | [popia.co.za s1](https://popia.co.za/section-1-definitions/) (checked 2026-11-16) |
| Competent person | Any person legally competent to consent to an action or decision about a child (in practice a parent or legal guardian). | same |
| Consent | A voluntary, specific and informed expression of will giving permission for processing. | same |
| Responsible party | Determines the purpose and means of processing. Nexa is a responsible party; organisations and solo tutors may be joint responsible parties (**Guess**, lawyer to confirm). | same |
| Operator | Processes for a responsible party under a contract, not under its direct authority (Neon, Vercel, Resend, AWS are operators). | same |

Note: popia.co.za is a non-official reproduction of the Act. The official gov.za PDF ([gov.za](https://www.gov.za/documents/protection-personal-information-act), checked 2026-11-16) is password-protected and could not be read by tools.

### Sections 34 and 35

| Section | Rule | Source |
|---|---|---|
| 34 | "A responsible party may, subject to section 35, not process personal information concerning a child." | [popia.co.za s34](https://popia.co.za/section-34-prohibition-on-processing-personal-information-of-children/) (checked 2026-11-16) |
| 35(1)(a) | Allowed with the prior consent of a competent person. | [popia.co.za s35](https://popia.co.za/section-35-general-authorisation-concerning-personal-information-of-children/) (checked 2026-11-16) |
| 35(1)(b)-(d) | Also allowed to establish/defend a legal right, for international public law, or for research/statistics with safeguards. | same |
| 35(1)(e) | Information the child deliberately made public, with competent person consent. | same |
| 35(2)-(3) | The Regulator may authorise other processing in the public interest, with conditions (let the competent person review and refuse further processing, give notice, do not encourage children to overshare, protect integrity). | same |

The Regulator runs a separate **s35(2) application** (form, motivation, 13 weeks to decide; processing may continue while pending) for processing that does not fit 35(1) ([inforegulator.org.za/popia](https://inforegulator.org.za/popia/), checked 2026-11-16). If Nexa relies on 35(1)(a) parental consent, this application should not be needed (**Guess**, lawyer to confirm).

### Parental consent mechanics (design proposal, not sourced law)

| Step | What Nexa does |
|---|---|
| 1. Age gate | Ask date of birth (or "under 18?") at learner sign-up and on invite acceptance. |
| 2. Block until consent | An under-18 learner account stays "pending consent": no profile, uploads, messages or AI marking until consent is recorded. Only the minimum needed to contact the guardian is kept (**Guess**: guardian email entered by tutor or learner). |
| 3. Guardian verifies | Guardian receives an email link, signs in or creates an account, confirms the relationship, reads a plain-language notice (what is collected, why, who sees it, US hosting, retention, rights). |
| 4. Specific consent | Separate tick boxes: (a) core tutoring processing, (b) transfer to US-hosted services, (c) AI marking via third-party models, (d) marketing (default off). Each recorded separately. |
| 5. Record | Store a `ConsentRecord`: guardian user id, learner id, notice version, scopes, timestamp, IP/user agent, method. Keep it for the life of the account plus a retention period. |
| 6. Withdraw | Guardian can withdraw any scope at any time; withdrawal stops future processing and triggers deletion or anonymisation per the retention policy. |
| 7. Turning 18 | On the 18th birthday, ask the learner to confirm their own consent. |
| 8. Tutor-created learners | Tutors who add learners manually must not activate them without guardian consent. |

Other POPIA conditions still apply (purpose limitation, minimality, security safeguards, data subject access and correction). Security compromises must be reported to the Regulator through the eServices portal (since 1 April 2025) and to affected people; there is no risk threshold ([inforegulator.org.za/popia](https://inforegulator.org.za/popia/), checked 2026-11-16).

### Information Officer registration

| Item | Finding | Source |
|---|---|---|
| Who must register | Every public and private body that processes personal information registers its Information Officer (IO). | [eServices: officers](https://eservices.inforegulator.org.za/officers/default.aspx) (checked 2026-11-16) |
| Who is the IO | Head of the private body: CEO, MD or highest authority. Deputy IOs strongly recommended for private bodies. | same |
| Process | Online on eServices: organisation details, IO, deputies, admin officers; processed immediately; certificate emailed. | same |
| Cost | Page lists no fee. Search summary of the portal home says services are currently free. **Unverified** on a fetched page. | same |

### Cross-border transfer: data hosted in the US

| Item | Finding | Source |
|---|---|---|
| s72(1) general rule | No transfer of personal information to a third party in a foreign country unless (a) recipient is bound by law, binding corporate rules or a binding agreement giving adequate protection, (b) data subject consents, (c) necessary for a contract with the data subject, (d) contract in the data subject's interest, or (e) for their benefit where consent is impractical. | [popia.co.za s72](https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/) (checked 2026-11-16) |
| s57(1)(d) prior authorisation | Prior authorisation from the Regulator is needed before transferring special personal information or **children's personal information** "to a third party in a foreign country that does not provide an adequate level of protection" under s72. | [popia.co.za s57](https://popia.co.za/section-57-processing-subject-to-prior-authorisation/) (checked 2026-11-16) |
| Process and penalty | Notify on the prior authorisation form; Regulator replies in 4 weeks whether it will investigate; investigation up to 13 weeks. Failure to notify is an offence: fine up to R10 million, up to 12 months' imprisonment, or both. | [inforegulator.org.za/popia](https://inforegulator.org.za/popia/) (checked 2026-11-16) |
| Neon terms | Neon has a DPA and lists SOC 2, ISO 27001 and ISO 27701; the security schedule does not mention POPIA or South Africa. | [neon.com/dpa](https://neon.com/dpa) (checked 2026-11-16) |

What this means for Nexa:

- The US has no POPIA "adequacy" status that we could find (**Unverified**). Nexa should rely on s72(1)(a) via signed DPAs with each US operator (Neon, Vercel, Resend, AWS/Azure AI), plus s72(1)(b) guardian consent as a second basis.
- Whether a DPA alone makes the transfer "adequate" and so avoids s57(1)(d) prior authorisation for children's data is a legal question. **Lawyer must answer this before launch.**
- The simplest risk reduction is the planned database move to a South African region (see 06 database research) and keeping the Blob store in cpt1. AI marking calls (Bedrock/Azure) may still send learner work abroad unless a South African region is used.

## 2. VAT

| Item | Figure | Status | Source |
|---|---|---|---|
| Standard rate | 15% | Current | [SARS VAT](https://www.sars.gov.za/types-of-tax/value-added-tax/) (checked 2026-11-16) |
| Compulsory registration | Taxable supplies over **R2.3 million** in any 12 months (was R1 million). Register within 21 business days. | Applied by SARS from 1 April 2026 | [SARS register for VAT](https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/) (checked 2026-11-16) |
| Voluntary registration | Taxable supplies over **R120,000** (was R50,000). SARS notes the Voluntary Registration Regulation is not yet updated. | Applied from 1 April 2026 | same |
| Legislative status | Announced in the 25 February 2026 Budget; "subject to Parliament's legislative process"; not yet promulgated per the FAQ. | Pending | [SARS Budget 2026 FAQ](https://www.sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/) (checked 2026-11-16) |
| Electronic services | The special e-services rules apply to **foreign** suppliers (register when supplies exceed R2.3 million). Nexa, as a South African supplier, charges VAT under normal rules once registered. | Current | [SARS register for VAT](https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/) (checked 2026-11-16) |

Notes:

- What counts toward Nexa's R2.3 million: **Guess**: if Nexa is the tutor's agent for parent payments, only Nexa's own fees (subscriptions, usage, commission) count, not the tutor's lesson fees. If Nexa is principal, the full parent payment counts. This hinges on the agent vs principal design below. Accountant to confirm (VAT Act s54 on agents was not checked).
- Tutors' own VAT: private tutoring by a business not registered or recognised under education legislation is generally standard-rated, not exempt under s12(h). **Unverified:** based on a search summary of SAIT guidance and SARS VAT Ruling VR 023 (27 July 2026); neither page was fetched successfully. Nexa invoices for tutors must handle both VAT-registered and non-registered tutors.

### Tax invoice requirements (once Nexa is a VAT vendor)

| Invoice type | When | Must show | Source |
|---|---|---|---|
| Full tax invoice | Consideration over R5,000 | The words "Tax Invoice", "VAT Invoice" or "Invoice"; supplier name, address, VAT number; recipient name and address (and VAT number if a vendor); serial number and date; description; quantity or volume; value, VAT charged and total. | [SARS tax invoices](https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/) (checked 2026-11-16) |
| Abridged tax invoice | R5,000 or less | Same as full but recipient details and quantity may be left out (**Unverified**: contents from search summary of SARS checklist, not the fetched page). | same |
| No invoice needed | R50 or less | Till slip or docket showing VAT. | same |
| Timing | Within 21 days of the supply. | | same |

Design impact: always generate full tax invoices (simpler, valid for any amount), with sequential serial numbers, stored immutably, and credit notes for refunds.

## 3. Consumer Protection Act (CPA) and ECTA

| Rule | What it requires | Applies to Nexa? | Source |
|---|---|---|---|
| ECTA s43(1) disclosures | Website must show: legal identity, physical address and phone, email, registration number and office bearers, address for legal service, service description, full price incl. taxes, payment methods, terms and how to save them, delivery timeframe, transaction record access, refund policy, ADR code, security and privacy policies, minimum duration of recurring agreements, cooling-off rights. | Yes, for parent and tutor checkouts. | [acts.co.za ECTA s43](https://www.acts.co.za/electronic-communications-and-transactions-act-2002/43__information_to_be_provided) (checked 2026-11-16) |
| ECTA s43(2) | Consumer can review the whole transaction, fix mistakes and withdraw before placing the order. | Yes: show a summary step before payment. | same |
| ECTA s43(3)-(4) | If (1) or (2) is not met, consumer may cancel within 14 days of receiving the service. | Yes | same |
| ECTA s43(5) | Payment system must be sufficiently secure by accepted standards; supplier liable for damage if not. | Use the provider's hosted checkout. | same |
| ECTA s44 cooling-off | Cancel within 7 days without reason or penalty (services: from conclusion of agreement); full refund within 30 days. | Likely for parent purchases; exclusions in s42(2) (for example services begun with consent within the 7 days) **Unverified** on a fetched page. | [acts.co.za ECTA s44](https://www.acts.co.za/electronic-communications-and-transactions-act-2002/44__cooling_off_period) (checked 2026-11-16) |
| CPA s16 | 5-business-day cooling-off for direct marketing; does not apply where ECTA s44 applies. | Rarely. | [MJK summary](https://mjkinc.co.za/compliance/consumer-protection-act/cooling-off-and-cancellation) (checked 2026-11-16, secondary source) |
| CPA s14 fixed-term agreements | Consumer may cancel on 20 business days' notice (reasonable penalty allowed); supplier must notify 80 to 40 business days before expiry; on expiry the agreement continues month-to-month. Not applicable between juristic persons. | Only if Nexa sells fixed terms (for example annual plans) to individuals or small businesses. Month-to-month plans avoid most of this. | [acts.co.za CPA s14](https://www.acts.co.za/consumer-protection-act-2008/14_expiry_and_renewal_of_fixed_term_agreements) (checked 2026-11-16) |
| CPA juristic person threshold | Juristic persons with assets or turnover of R2 million or more are not "consumers" (Government Notice 294 of 2011). | Organisations above R2m are outside the CPA; solo tutors and small centres are inside. | **Unverified**: gov.za notice page fetched but its PDF not read ([gov.za](https://www.gov.za/documents/consumer-protection-act-determination-threshold-applicable-size-juristic-person), checked 2026-11-16) |

Design impact:

- Subscriptions: month-to-month, cancel any time effective at period end, with a clear renewal date and price in the UI and in the email before each renewal (**Guess**: good practice, not a sourced legal duty for month-to-month).
- Trial to paid: show the price and the date the first charge happens, and require an explicit opt-in to auto-renew.
- Parent checkout: show tutor identity, Nexa's identity as collecting agent, full price, refund and cooling-off policy, and a review step.

## 4. Marketplace terms: collecting fees for tutors

### Agent vs principal

| Model | Meaning | Effect |
|---|---|---|
| Agent (recommended) | Tutor supplies the lessons; Nexa is the tutor's appointed collection agent and earns a commission. | Tutor is liable to the parent for the service; Nexa's VAT base is likely its commission only (**Guess**); fits SARB Directive 1 "appointed as an agent of each beneficiary". |
| Principal | Nexa sells lessons and subcontracts tutors. | Nexa is liable for the lessons and refunds, and (**Guess**) the full fee counts toward VAT turnover. |

### PASA / SARB rules on collecting for third parties

| Item | Finding | Source |
|---|---|---|
| Beneficiary service provider | A person who, as a regular part of its business, "accepts money or the proceeds of payment instructions" from multiple payers on behalf of a beneficiary. | [SARB Directive 1 of 2007](https://www.resbank.co.za/content/dam/sarb/what-we-do/payments-and-settlements/regulation-oversight/D1_2007(ThirdParty).pdf) (checked 2026-11-16) |
| Conditions | Be appointed agent of each beneficiary; keep records (date, amount, beneficiary) for 5 years; do not introduce risk to the NPS; tell your banker, who notifies the payment system management body. | same |
| PASA registration | Compulsory if providing Directive 1 services; done through a sponsoring bank; no PASA fee; about 21 working days. The page does not say whether merchants collecting through a registered provider are exempt; PASA asks for queries to TPPP@pasa.org.za. | [PASA TPPP registration](https://authorisation.pasa.org.za/pasa-compliance/tppp-registration/) (checked 2026-11-16) |

Does the provider's split feature avoid TPPP status?

- With **Paystack split payments**, Paystack settles the tutor's share directly to the tutor's subaccount bank account and Nexa's share to Nexa. Nexa never receives the tutor's money ([Paystack split payments](https://docs-v2.paystack.com/docs/payments/split-payments/), checked 2026-11-16). **Guess:** this makes Paystack (a registered provider) the party accepting money, so Nexa is arguably not a beneficiary service provider. Not confirmed by any official source found.
- With **Payfast**, funds first appear in the main account and are then split immediately ([Payfast split payments](https://payfast.io/features/split-payments/), checked 2026-11-16). Weaker argument than Paystack.
- With a **payouts float** (Peach, Ozow) Nexa receives and pays out itself, which matches the beneficiary service provider definition; that route likely needs TPPP registration.
- Do not hold money until lessons happen: that looks like escrow, which Paystack lists as ineligible ([Paystack ineligible businesses](https://support.paystack.com/en/articles/2127042), checked 2026-11-16).
- Off-site payments (cash or EFT straight to the tutor, marked paid by an admin) involve no money flow through Nexa.

Terms Nexa needs:

- **Tutor/organisation terms**: appointment of Nexa (and its payment provider) as limited collection agent; commission rate and when it changes; who bears provider fees; payout timing; refunds and chargebacks (who pays, set-off against future payouts); tutor's own tax and VAT responsibility; tutor warrants bank details; POPIA operator/joint-responsible-party clause.
- **Parent terms**: who supplies the lessons, Nexa's agent role, price display, cancellation and cooling-off, refunds, dispute route, POPIA notice and consent for the child.
- **Platform subscription terms**: month-to-month billing, usage charges and caps, trial conversion, discount code rules, suspension for non-payment.
- **Privacy policy and PAIA manual** (PAIA manual: **Unverified** requirement for small private bodies; lawyer to confirm).
- **DPAs** with every operator (Neon, Vercel, Resend, AWS/Azure, Wolfram, Judge0 host).

## What a lawyer should review

1. Whether Nexa may rely on s35(1)(a) parental consent alone, and the consent flow and wording.
2. Whether US hosting of children's data needs s57(1)(d) prior authorisation despite signed DPAs, and whether to delay launch until data is in South Africa.
3. Roles under POPIA: Nexa vs organisations vs solo tutors (responsible party, joint, or operator).
4. Agent vs principal structure, and whether Paystack split settlement keeps Nexa outside PASA TPPP registration (confirm with PASA in writing if needed).
5. Which ECTA s42(2) exclusions apply to lessons, and the cooling-off wording.
6. CPA s14 if annual plans are offered; CPA applicability to small organisations.
7. Draft tutor terms, parent terms, platform terms, privacy policy, PAIA manual.

For the tax practitioner: VAT registration timing under the new thresholds, whether commission-only counts for the threshold (VAT Act s54), invoice format, and tutors' VAT status.

## Open questions for the owner

1. Is Nexa a registered company, and who will be the Information Officer (by law, the head of the company)?
2. Can launch wait until the database is in a South African region, or should we get a legal opinion on US hosting first?
3. Agent model (recommended) or principal model for parent payments?
4. Will Nexa ever hold parent money before paying tutors? (Recommend no.)
5. Annual plans, or month-to-month only?
6. Budget for a lawyer review of the items above?

## Sources

- https://popia.co.za/section-1-definitions/ (checked 2026-11-16; unofficial reproduction of the Act)
- https://popia.co.za/section-34-prohibition-on-processing-personal-information-of-children/ (checked 2026-11-16)
- https://popia.co.za/section-35-general-authorisation-concerning-personal-information-of-children/ (checked 2026-11-16)
- https://popia.co.za/section-57-processing-subject-to-prior-authorisation/ (checked 2026-11-16)
- https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/ (checked 2026-11-16)
- https://www.gov.za/documents/protection-personal-information-act (checked 2026-11-16; PDF password-protected)
- https://inforegulator.org.za/popia/ (checked 2026-11-16)
- https://eservices.inforegulator.org.za/officers/default.aspx (checked 2026-11-16)
- https://neon.com/dpa (checked 2026-11-16)
- https://www.sars.gov.za/types-of-tax/value-added-tax/ (checked 2026-11-16)
- https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/ (checked 2026-11-16)
- https://www.sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/ (checked 2026-11-16)
- https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/ (checked 2026-11-16)
- https://www.acts.co.za/electronic-communications-and-transactions-act-2002/43__information_to_be_provided (checked 2026-11-16)
- https://www.acts.co.za/electronic-communications-and-transactions-act-2002/44__cooling_off_period (checked 2026-11-16)
- https://www.acts.co.za/consumer-protection-act-2008/14_expiry_and_renewal_of_fixed_term_agreements (checked 2026-11-16)
- https://mjkinc.co.za/compliance/consumer-protection-act/cooling-off-and-cancellation (checked 2026-11-16; secondary)
- https://www.gov.za/documents/consumer-protection-act-determination-threshold-applicable-size-juristic-person (checked 2026-11-16)
- https://www.resbank.co.za/content/dam/sarb/what-we-do/payments-and-settlements/regulation-oversight/D1_2007(ThirdParty).pdf (checked 2026-11-16)
- https://authorisation.pasa.org.za/pasa-compliance/tppp-registration/ (checked 2026-11-16)
- https://docs-v2.paystack.com/docs/payments/split-payments/ (checked 2026-11-16)
- https://payfast.io/features/split-payments/ (checked 2026-11-16)
- https://support.paystack.com/en/articles/2127042 (checked 2026-11-16)
