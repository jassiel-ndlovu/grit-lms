# HANDOFF: Agent B (Product and learning)

Newest entry first. Update at the end of every session, in the same pull
request as the work. The other agent reads this at the start of its sessions.

## 2026-11-16 Phase 0: design tokens, `revamp/b-design-tokens`
Done:
- The owner asked to start building after B1 (2026-11-16), so B2 and B3
  run as part of the build: each Phase 0 PR carries its own design notes.
- Revamp tokens in `src/app/revamp-tokens.css`: Notion-like palette with
  the owner-approved contrast fixes, light and dark, Geist and Geist Mono,
  14 px body, Geist 600 headings (Fraunces gone). Active under
  `data-ui="revamp"`, which the root layout sets when `REVAMP_UI=1`.
  Without the flag production is unchanged, except that `font-mono` now
  really uses JetBrains Mono (its variable referenced itself before).
- New `success`, `warning` and `link` colour utilities.
- `/design-system` preview page (development, or with the flag).
- Illustration set in PR #41 (`revamp/b-illustrations`, subagent): 14
  Open Peeps scenes for empty states and onboarding, 32 avatar busts picked
  by a hash of the user id, 4 Transhumans spot images. Theme-aware inline
  SVG, one module each, 68% smaller after SVGO. Preview at
  `/design-system/illustrations`. Dark mode inverts the figures (light
  lines, dark fills); one variable (`--illustration-surface`) changes it.

Next:
- Component library (button, input, table, property row, sidebar, command
  palette, empty state), then the new app shell and `contracts/navigation.md`.

Blocked on the other agent (A):
- Set `REVAMP_UI=1` on staging when the shell lands (env vars are A's).

Questions for the owner:
- None.

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
