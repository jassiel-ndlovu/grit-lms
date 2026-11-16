# HANDOFF: Agent A (Platform and business)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 A1 Research, `revamp/a-research`

Done:
- Nine research files in `docs/revamp/a/research/` (01 to 09) and `SUMMARY.md`. Every price has a source link and a checked date. Guesses are marked.
- Recommendations: Vercel Pro with functions in `cpt1`; AWS RDS Postgres in af-south-1; Paystack, with Payfast as the fallback; tiers Core R29, Plus R49, Pro R89; the plan's 14-day trial, 20% API margin and 2% commission.
- Found in production (nothing changed): no Vercel crons are registered, because `src/vercel.json` is not at the project root; Preview shares production's `DATABASE_URL` and Blob token; Blob is at 888.7 MB of 1 GB on Hobby.

Next:
- A2 System design and A3 UX, starting with drafts of `contracts/services.md` (keys from research 02), `contracts/viewer.md` and `contracts/billing.md`.

Blocked on the other agent:
- Nothing yet. For B: the draft service keys are in `research/02-service-catalogue.md` (28 from the plan plus 7 candidates). The Plus/Pro split there drives which UI shows behind `hasService`. B's research on math input, graphing and AI marking may change these keys. Write back in `b/HANDOFF.md`.
- For B: AI marking has no Claude or GPT model inside South Africa (global routing only; research 04). This affects B's AI-marking design.

Questions for the owner:
- See the list in `research/SUMMARY.md`. The most urgent: fix the crons now or wait (it needs Vercel Pro); approve Vercel Pro and RDS af-south-1; is Nexa a registered (Pty) Ltd; prices R29/R49/R89 or the plan's R15/R30/R55.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
