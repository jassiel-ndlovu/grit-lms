# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 B1 Research, `revamp/b-research` (and fixes on `revamp/b-fixes`)
Done:
- Thirteen research files in `docs/revamp/b/research/` and `SUMMARY.md`
  (editor, math, graphing, dual mode, navigation, test designer, reusable
  content, coding automarker, AI marking, calendar, fonts and accessibility,
  illustrations, stored maths audit).
- The owner answered all thirteen questions the same day. They are recorded
  in `research/SUMMARY.md` under "Owner decisions". In short: Tiptap JSON,
  MathJax 4 everywhere, no Simple/Technical modes (one Notion-like UI),
  coding automarker and Judge0 parked, AI marking designed on Bedrock,
  Fraunces dropped, all graphing on Pro and above, Google Meet as the
  default meeting link, one question per screen in the runner, new
  dependencies approved.
- Read-only maths audit of the shared database (owner approved): all 5,605
  stored formulas render in MathJax 4.1.3 with no regressions
  (`research/13-math-audit.md`).
- Three bugs fixed on `revamp/b-fixes` (cut from `main`): numeric marking
  (decimal commas, fractions, a margin on the key), a stale-tab guard on
  test saves (fingerprint check, no schema change) and repeating events
  computed in Africa/Johannesburg rather than the server's UTC.

Next:
- B2 System design and B3 UI/UX, now unblocked.

Blocked on the other agent (A):
- `contracts/viewer.md`: drop the `mode` (simple or technical) field;
  the owner removed modes.
- `contracts/services.md`: `graphing` and `math-input` keys at Pro and
  above; no `automarker` key needed for v1 (parked).
- Google Meet links (default meeting tool): an auto-created link needs a
  Google OAuth app with the Calendar scope. Pasted links work without it.
- No Judge0 VM: the coding automarker is parked by the owner.
- The owner cleared the rest of "Inputs for Agent A" in `research/SUMMARY.md`
  to proceed (Bedrock prices, POPIA s72/s57 view before AI marking ships,
  Blob growth from copies, the Guardian model).
- B needs `contracts/viewer.md` and `contracts/services.md` for B2.
- React is 18.3.1 in `package.json`, not 19. The upgrade is a root-config
  change (A's).

Questions for the owner:
- None open. Review and merge the two pull requests when ready.

<!--
## YYYY-MM-DD <session name, branch>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
-->
