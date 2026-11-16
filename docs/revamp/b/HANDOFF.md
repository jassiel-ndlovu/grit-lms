# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 B1 Research, `revamp/b-research`
Done:
- Twelve research files in `docs/revamp/b/research/` and `SUMMARY.md`
  (editor, math, graphing, dual mode, navigation, test designer, reusable
  content, coding automarker, AI marking, calendar, fonts and accessibility,
  illustrations).
- Picks: Tiptap 3 with JSON storage, MathJax 4 everywhere, MathLive, Mafs,
  Judge0 CE behind a `Runner` interface, Claude Haiku 5.5 on Bedrock with
  tutor approval, own calendar grid on RRULE, Geist, Open Peeps.
- Branch cut from `docs/revamp-agent-setup` because `docs/revamp/` is not on
  `main` yet (PR #35). Rebase on `main` once it merges.

Next:
- B2 System design and B3 UI/UX, once the owner answers the top questions in
  `research/SUMMARY.md`.

Blocked on the other agent:
- Nothing blocking yet. For A: inputs in `research/SUMMARY.md` under "Inputs
  for Agent A" (Judge0 hosting, Bedrock prices to confirm, POPIA s72/s57 for
  AI marking of minors' work, Blob growth from copying content, Guardian
  model needed for parent attendance views). B will need `contracts/viewer.md`
  and `contracts/services.md` for B2.
- React is 18.3.1 in `package.json`, not 19. The upgrade is a root-config
  change (A's).

Questions for the owner:
- See `research/SUMMARY.md`, "Questions for the owner". The first three
  (stored format, math engine, Delphi scope) block B2.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
