# AI-assisted marking

**Answer first.** Tutors can ask for AI-suggested marks on written answers (short answers and essays). The model only suggests a mark: the tutor accepts, edits or rejects it, and nothing reaches the student until the tutor releases marks as today. Provider: Anthropic's API (owner decision, 2026-11-20).
- **Models:** Claude Haiku 5.5 marks first, at low effort. Claude Sonnet 5.5 marks again, once, when Haiku is unsure, when the answer looks like it is giving the marker instructions, or when the code's checks find a problem. For Sonnet, Anthropic's server-side refusal fallback is on: if Sonnet declines, another model marks the answer.
- **Not set up yet:** it needs `ANTHROPIC_API_KEY`.

## Setup (owner)

1. In the Anthropic Console (<https://console.anthropic.com>), under the account that pays, create an API key named "Nexa production". Set a monthly spend limit.
2. Put it in Vercel (Production, Sensitive) and in `.env.local` as `ANTHROPIC_API_KEY`. Never paste it in chat, an issue or a commit.
3. Optional overrides: `AI_MARKING_MODEL` (default `claude-haiku-5-5`), `AI_MARKING_ESCALATION_MODEL` (default `claude-sonnet-5-5`), `AI_USD_TO_ZAR` (default 18.5, used only for the cost kept on usage rows).
4. Ask Anthropic about zero data retention (ZDR) for the organisation. Without it, Anthropic keeps API inputs and outputs for up to 30 days for abuse monitoring.

Until the key is set, `requestAiMarking` answers "AI-assisted marking isn't set up yet" and the hourly job skips marking.

## What is sent

Each request sends three things, and nothing else:
- the question;
- the memo and rubric;
- the student's answer, after scrubbing.

Before sending, the code replaces names from the class roster, emails, phone numbers and 13-digit ID numbers with placeholders. It never sends names, emails, student numbers, school or course names. The only id is an opaque request id (`m_…`), and the link back to the student stays in our database. Answers are still treated as personal information.

POPIA:
- this is a transfer outside South Africa (section 72);
- tutors must confirm they hold parents' consent before turning it on for a test (`setTestAiMarking` requires `consentConfirmed`);
- the parent consent wording at sign-up should name AI-assisted marking and processing outside South Africa;
- whether section 57(1)(d) prior authorisation applies to children's information is an open question for a lawyer.

## How it runs

- **Switching it on:** `setTestAiMarking` turns it on per test. That needs the course's `ai-marking` service (Pro) and the consent confirmation.
- **Queueing:** `requestAiMarking` queues one suggestion per written answer and starts marking straight away. The hourly `/api/cron/notifications` job finishes anything left over. Rows are claimed by question, so a class shares the cached memo.
- **Checks in code** (`src/features/ai-marking/rules.ts`):
  - marks are clamped to 0..max per criterion;
  - the total is recomputed;
  - evidence quotes that don't appear in the answer are dropped and flagged;
  - instruction-like text is flagged as `possible_injection`.
- **Usage:** each mark counts as one `AI_MARKS` usage row, with the provider cost. A workspace's hard-stop AI mark limit stops further marking: those rows become SKIPPED.
- **Stored:** suggestions live in `AiMarkSuggestion`, with the model, prompt version, tokens, cost and the tutor's action. They're deleted with the submission. No prompt text is stored.

## Cost

These are Anthropic first-party prices, checked 2026-11-03:

| Model | Per million tokens (input / output) | About 2,000 tokens in, 300 out |
| --- | --- | --- |
| Haiku 5.5 | $0.10 / $0.50 | $0.00035 |
| Sonnet 5.5 | $2 / $10 | $0.007 |

Pro includes 30 AI marks per student per period. Overage is billed at cost ÷ 0.8 (owner decision).
