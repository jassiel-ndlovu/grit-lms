# Nexa admin console

**Answer first.** The admin console at `/admin` is for Nexa staff (`platformRole = NEXA_ADMIN`, two-factor required). It has six views: **Overview, Workspaces, Revenue, Failed payments, Discounts, Audit log**. A workspace's page shows its state, plans, renewals and payments, and holds every **override**: extend the trial, comp, change a course's plan, credit, mark paid off-site, void, refund. Each override needs a written reason and writes the audit log in the same step. **Impersonation** lets an admin see Nexa as a user for up to 30 minutes, under a banner that can't be hidden. Money and security actions are blocked while impersonating. The console never ignores the rules it enforces for others: it is read-mostly, and every write is named, reasoned and logged.

Read [README.md](README.md) first. Rules come from design/01, section 7, and design/03, section 10.

## Map

```mermaid
flowchart LR
  ov[/admin: Overview/] --> ws[/admin/workspaces/] --> one[/admin/workspaces/id/]
  one --> ovr[Override dialogs] --> audit
  one --> users[People in the workspace] --> imp[Start impersonation]
  imp --> app[The app as that user, with the banner] --> end[End: back to /admin]
  ov --> rev[/admin/revenue/]
  ov --> fail[/admin/payments/failed/]
  ov --> disc[/admin/discounts: see 05/]
  ov --> audit[/admin/audit/]
```

Shell: the same header, with "Nexa admin" in place of the workspace switcher and a fixed red-outlined "Admin" chip in the status slot. Ribbon: the six views. Signing in to `/admin` always asks for the 2FA code if the session is older than 12 hours (proposal).

## 1. Overview

| | |
| --- | --- |
| Purpose | What needs attention today |
| Route | `/admin` |
| Who | `admin.console` |

```
Overview · 16 Nov 2026
──────────────────────────────────────────────────────────────────────
Workspaces          Trials ending in 3 days    Past due     Read-only
42 · 30 paying      5 [View]                   2 [View]     1 [View]

Renewals next 7 days   R28 400 from 11 workspaces
Last 30 days           Plans R96 200 · Usage R1 340 · Commission R7 820
Paystack collected     R412 000 of R1 000 000 sole-proprietor limit  ▓▓▓▓░░░░ 41%

Needs attention
• 2 renewals failed today                                  [Failed payments]
• 1 payout account waiting on Paystack for 5 days          [View]
• 3 webhook events failed to process                       [View]
```

- The **Paystack lifetime limit** bar matters until a company is registered (research 03; `adminGetPaymentVolume`, design/04). At 80% it turns to the warning colour and emails the owner.
- Each number links to the filtered list.

## 2. Workspaces

| | |
| --- | --- |
| Purpose | Find any workspace and see its billing state |
| Route | `/admin/workspaces` |

```
Workspaces          [ Search name, slug, owner email ]  State [All ▾]  Kind [All ▾]
──────────────────────────────────────────────────────────────────────────────
Name                  Kind    State      Students  Per 30 days  Renews     Owner
Ubuntu Tutors         Org     Active     148       R19 860      30 Dec     thandi@…
Thandi Maths          Solo    Trial (4)  12        R1 668       —          thandi@…
Bongi Tutors          Solo    Past due   9         R1 251       failed 2 Dec  bongi@…
Nexa (legacy data)    Org     Comped     310       —            —          jassiel@…
```

Query: `adminListWorkspaceBilling({ state, q, cursor })` (design/03).

## 3. One workspace

| | |
| --- | --- |
| Purpose | Everything about one workspace, and the place for overrides |
| Route | `/admin/workspaces/[id]` |
| Entry points | Workspaces list, overview links, failed payments, audit rows |

```
Ubuntu Tutors · Organisation · Active                   [Overrides ▾]
Owner Thandi Mokoena · created 3 Feb 2026 · slug ubuntu-tutors
Summary · Courses · People · Payments · Fees · Audit
──────────────────────────────────────────────────────────────────────
Current period  30 Nov – 29 Dec · paid R19 860 · renews 30 Dec on Visa ••4242
Discount        LAUNCH10, 1 payment left
Payouts         Workspace account FNB ••6789 · Connected
Data deletion   none scheduled
```

Tabs:
- **Courses:** course, plan, active students, services on, any plan override with its end date.
- **People:** staff, students and linked parents, with [Impersonate] on each row (section 7).
- **Payments:** Nexa payments for this workspace (same as the owner's view in 03) with per-row actions.
- **Fees:** parent fees and checkouts touching this workspace, for support questions. Read-only except refund.
- **Audit:** the audit log filtered to this workspace.

Overrides menu (design/03, section 10; design/04):

| Override | Dialog asks for | Effect shown before confirming |
| --- | --- | --- |
| Extend trial | Days (1–30), reason | "Trial ends 30 Nov → 7 Dec" |
| Comp | Until date or open-ended, reason | "No payments until 31 Jan 2027" |
| End comp | Reason | "Next payment due on the day comp ends" |
| Change a course's plan | Course, plan, until date, reason | "Gr 12 Maths billed as Plus instead of Pro until 31 Jan" |
| Credit | Amount, reason | "R500 off the next payment on 30 Dec" |
| Mark a payment paid off-site | Method, amount, received on, reference, note | "NX-2026-0198 → Paid; workspace back to Active" |
| Void a payment request | Reason | "NX-2026-0198 voided; a new one is built" |
| Refund | Payment, amount (full or part), reason | "R19 860 back to Visa ••4242; Nexa doesn't get the card fee back" |

Every override dialog:

```
Extend trial · Thandi Maths
Days     [ 7 ]           Trial ends 30 Nov → 7 Dec 2026
Reason   [ Asked for more time to set up; email 15 Nov ]   (required)
This is recorded in the audit log under your name.
[ Extend trial ]   Cancel
```

States:
- **Loading:** skeleton per tab.
- **Error:** inline in the dialog with the error code (`PROVIDER_ERROR` shows Paystack's message).
- **Deleted workspace:** a tombstone page with name, deletion date and audit rows only.

Actions: `adminExtendTrial`, `adminSetComp`, `adminOverrideCourseTier`, `adminIssueCreditNote`, `adminVoidPlatformInvoice` (design/03, section 11); `adminMarkPaidOffsite`, `adminRefundPayment` (design/04, section 8); a workspace detail query (proposed: `adminGetWorkspace`).

## 4. Revenue

| | |
| --- | --- |
| Purpose | How much Nexa earns, and from what |
| Route | `/admin/revenue` |

```
Revenue                    Range [ Last 6 months ▾ ]   [Export CSV]
──────────────────────────────────────────────────────────────────────
                Plans      Usage     Commission   Refunds   Net
Nov 2026        R96 200    R1 340    R7 820       −R0       R105 360
Oct 2026        R81 900    R980      R6 410       −R1 430   R87 860
…
[stacked bar chart: plans, usage, commission by month]

By plan (paying now)   Core 120 students · Plus 260 · Pro 88
Per 30 days now        R61 300 recurring (sum of next renewals)
```

- Revenue is grouped by the calendar month a payment **succeeded**, because periods are 30 days and don't line up with months. The page says so under the table.
- "Recurring" replaces MRR: the sum of every workspace's next renewal amount.
- Charts follow B's data-viz rules.

Query: proposed `adminRevenue({ from, to })` → rows per month with `planCents`, `usageCents`, `commissionCents`, `refundCents`.

## 5. Failed payments

| | |
| --- | --- |
| Purpose | Work through payments that failed, for workspaces and for parents |
| Route | `/admin/payments/failed` |

```
Failed payments            Workspace renewals · Parent checkouts · Webhooks
──────────────────────────────────────────────────────────────────────────────
Workspace       Amount     Failed    Reason               Next try   State
Bongi Tutors    R1 251     2 Dec     Insufficient funds   9 Dec      Past due  [Open] [Retry now]
Sizwe Academy   R4 170     29 Nov    Card expired         —          Read-only [Open]
```

- **Parent checkouts** tab: failed or abandoned checkouts over the last 7 days, for support. No retry; the parent pays again.
- **Webhooks** tab: `PaymentEvent` rows with status `FAILED`, with [Reprocess] (design/04, section 6).
- "Retry now" charges the saved card at once and asks for a reason.

Queries and actions: proposed `adminListFailedPayments({ kind })`, `adminRetryCharge({ invoiceId, note })`, `adminReprocessEvent({ eventId, note })`.

## 6. Audit log

| | |
| --- | --- |
| Purpose | Who did what, when, and why |
| Route | `/admin/audit` (and a filtered tab on each workspace) |

```
Audit log      Actor [All ▾]  Workspace [All ▾]  Action [All ▾]  Date [Last 30 days ▾]
──────────────────────────────────────────────────────────────────────────────────────
16 Nov 14:02  Jassiel (admin)               billing.trial.extend   Thandi Maths   "Asked for more time…"
16 Nov 13:40  Jassiel as Thandi Mokoena     course.update          Ubuntu Tutors  impersonation 4f2a
15 Nov 09:12  Thandi Mokoena                members.role           Ubuntu Tutors  Sipho: Tutor → Admin
```

- A row expands to show the before and after data (JSON shown as a property list).
- Rows written during impersonation show "admin **as** user" and link to the impersonation session.
- The log can't be edited or deleted from the console. Export to CSV is allowed.

Query: proposed `adminListAudit({ actorUserId?, workspaceId?, action?, from, to, cursor })`.

## 7. Impersonation

| | |
| --- | --- |
| Purpose | See exactly what a user sees, to support them |
| Route | Starts from [Impersonate] on a person row; then the normal app routes |
| Who | `admin.impersonate` |

Start dialog:

```
Impersonate Thandi Mokoena?
You'll see Nexa as Thandi for up to 30 minutes.
Reason   [ Support ticket: can't find the fees page ]   (required)
Thandi gets an email that a Nexa admin viewed her account.
[ Start ]   Cancel
```

Banner on every page while impersonating (the account banner slot, above everything else, can't be closed):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⚠ You are viewing as Thandi Mokoena (Ubuntu Tutors) · Jassiel, Nexa admin │
│   24:13 left · Payments and security settings are blocked   [ End now ]  │
└──────────────────────────────────────────────────────────────────────────┘
```

- Colour: B's danger tokens, so it never looks like a normal banner. On mobile it collapses to one line with the timer and [End].
- **Blocked while impersonating** (proposal): paying anything, changing the card or payout account, changing the password, email or 2FA, deleting the workspace, and accepting terms or consent. Those buttons show "Not available while impersonating".
- Other writes are allowed and each writes the audit log with both ids (design/01, section 7).
- At 30 minutes the session ends and returns to the user's row in `/admin` with "Impersonation ended (time limit)". "End now" does the same.
- The user gets an email at the start (proposal, for trust): "A Nexa admin viewed your account on 16 Nov at 13:38 to help with: 'can't find the fees page'."

Actions: proposed `startImpersonation({ userId, reason })` and `endImpersonation()` in `src/features/admin/actions.ts` (viewer.md rule 5); the banner reads `viewer.impersonatedBy`.

## Open points for A2

1. Which writes are blocked during impersonation (proposed list in section 7), and whether the user is emailed.
2. 2FA re-check for `/admin` after 12 hours.
3. Revenue grouped by the month a payment succeeded; "recurring" as the sum of next renewals.
4. Queries `adminGetWorkspace`, `adminRevenue`, `adminListFailedPayments`, `adminRetryCharge`, `adminReprocessEvent`, `adminListAudit`, `startImpersonation`, `endImpersonation` are not in design/03 or 04 yet.
