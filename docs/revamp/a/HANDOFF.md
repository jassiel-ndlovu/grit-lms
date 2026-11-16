# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 Owner decisions on research, `revamp/a-owner-decisions`

Done:
- Recorded the owner's answers in `research/SUMMARY.md` ("Owner decisions"): tiers Core R99, Plus R139, Pro R179 per student per course; Vercel Hobby and Neon until 2027; Paystack as an education marketplace; parent payments aggregated per parent; PII redacted before any LLM call; Blob audit and a Preview Neon branch approved; Wolfram quote drafted.

Next:
- A2 system design, starting with `contracts/viewer.md` (no `mode` field) and `contracts/services.md` (`graphing` on Pro, no `automarker` in v1).
- Preview on a fake-data Neon branch; the Blob audit once the store is connected.

Blocked on the other agent:
- For B: AI marking must send only redacted text (no names or IDs). The redaction step sits in A's design; B's marking queue calls it.
- For B: `math-input` tier is open (owner asked). Revision 3 only names graphing.

Questions for the owner:
- Tier order, `math-input` tier, Paystack account type, the exact `.co.za` name (decided: `.co.za` at xneelo), and the month of the first payment. See `research/SUMMARY.md`.

## 2026-11-16 Cron fix, `revamp/a-cron-scheduler`

Done:
- Vercel never ran the app's crons: `src/vercel.json` was not at the project root, and Hobby rejects crons more frequent than daily. Replaced it with a GitHub Actions schedule (`.github/workflows/scheduled-jobs.yml`): auto-submit every 5 minutes, notification jobs hourly.

Next:
- On Vercel Pro, move these to Vercel Cron or the queue (research 05 recommends QStash), then delete the workflow.

Blocked on the other agent:
- Nothing.

Questions for the owner:
- Set the shared `CRON_SECRET` in GitHub and Vercel (the agent was not allowed to). The PR has the commands.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
