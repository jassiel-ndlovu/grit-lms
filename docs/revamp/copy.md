# Wording guide

Status: **Draft 1.0, 2026-11-24.** Owner's request, 24 Nov: text in Nexa must be useful, unambiguous, relevant and specific, and mustn't assume people already know the app. Both agents follow this for every word a person reads: pages, buttons, messages, errors and emails.

## The five rules

1. **Say it the way the reader would.** Write for a parent on a phone, not for the team that built it. Use everyday words: "pay", "class", "marks", "your tutor or school".
2. **Name no suppliers.** People don't need to know which companies run payments, email, hosting or AI. Say what happens instead.
   - Instead of "Paystack takes the card", write "You'll enter your card details on a secure payment page."
   - Instead of "Refund sent to Paystack", write "Refund started. It reaches the card in 5 to 10 working days."
   - Only Nexa staff screens (admin) may name a supplier, where they need it to find a payment.
3. **Be specific.** Say what, when, how much, and who.
   - "Something went wrong" says nothing. Write "We couldn't save your changes. Check your connection and try again."
   - Write "Due Fri 28 Nov", not "Due soon". Write "R850", not "the amount".
4. **Say what happens next.** After any action, tell people what changed, what they'll see, and whether they need to do anything.
   - "Sent. Your tutor gets a notification; you'll be told when they reply."
5. **Explain the first time.** A heading should make sense to someone who has never seen the page. Add one plain line under it if the word alone could mean several things, for example "Payouts: where your card payments are paid to."

## Headings, buttons and messages

- **Headings** name the thing on the page, in a few words: "Fees", "Your queries". No slogans.
- **Buttons** start with a verb and say exactly what they do: "Pay R2 150", "Send reply", "Close query". Avoid "OK", "Submit" and "Continue" when a precise verb exists.
- **Empty states** say why the page is empty and what to do: "No tests yet. Tests you create from New test show up here."
- **Errors** say what went wrong, in the reader's terms, and how to fix it. Never show codes such as `FORBIDDEN`, `READ_ONLY:`, ids or the word "error" on its own.
- **Confirmations** before something can't be undone say exactly what will happen: "Delete Quiz 1? Students' answers are deleted too. This can't be undone."
- **Numbers** use South African formats: R1 250, 24 Nov 2026, 14:05.
- **Tone:** friendly and direct, second person ("you"), no exclamation marks, no blame ("you entered it wrong" becomes "Check the email address").

## Glossary

| Don't write | Write | Notes |
| --- | --- | --- |
| workspace | organisation (staff); your tutor or school (students and parents) | A solo tutor's organisation is still "your organisation" in settings |
| tenant, persona, membership | (rephrase) | Internal words |
| learner (in UI) | student | "Learner" is fine in South African school reports |
| guardian | parent | "Parent or guardian" where it matters legally |
| submission (for a student) | your answers, your work, hand in | Staff may say "submissions" |
| release marks | share marks | "Students and parents see them after you share them" |
| off-site payment | paid in cash or by bank transfer | |
| payout account, subaccount | the bank account your fees are paid into | |
| split | your share, Nexa's fee | |
| read-only | locked: you can see everything but can't make changes | Say why and how to unlock |
| comped | free of charge | Nexa admin only |
| sign-in code | sign-in code | Keep; explain once: "a code your tutor gives you instead of an email address" |
| credits (AI) | study credits (students), AI credits (organisations) | Always say what they're for |
| Paystack, Resend, Vercel, Anthropic, Neon, QStash | (rephrase) | Except on Nexa admin screens |

## Checks

`scripts/check-copy.ts` (CI) fails if a supplier's name appears in text outside Nexa admin screens, or if an error code reaches a person. Add a word there when the glossary grows.

## Changes

| Date | Change |
| --- | --- |
| 2026-11-24 | Draft 1.0 |
