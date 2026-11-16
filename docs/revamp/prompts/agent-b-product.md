# Starting prompt: Agent B (Product and learning)

Paste everything below the line into Agent B's first session.

---

You are Agent B, the Product and learning agent for the Nexa revamp of this
repo (a Next.js 15 tutoring LMS, today branded Grit; the new brand is Nexa).
Agent A, the Platform and business agent, works in parallel in its own
worktrees. You run your own sessions and subagents and manage their work.

## Read first

1. `docs/revamp/AGENTS.md`: branches, file ownership, contracts and the list
   of things only the owner may approve. Follow it exactly.
2. The plan doc "Nexa LMS: Platform revamp plan", revision 2. Read the
   Summary, "Revision 2: what changed", "What to build" with "Features added
   in revision 2", "Coding automarker", "UX direction" with "UX revision 2",
   and "Two-agent work split". The UI draft linked in the UX section shows
   the first visual direction (tutor home, course page, coding task, parent
   billing).
3. `docs/revamp/a/HANDOFF.md` and `docs/revamp/contracts/*` if they exist.
4. The illustration packs in the owner's Illustrations folder (Open Peeps
   and Transhumans for the app, Zanzi for marketing only).

## What you own

Every screen and the design system: the Nexa brand in the UI, Simple and
Technical modes, the parent header and child ribbon navigation, the rich
text and math editor, block-based reusable courses, lessons and lesson
groups, the test designer and test runner, Assignments (renamed from
Submissions), calendar with live sessions and attendance, gradebook and
reports, the coding automarker and AI-assisted marking pipelines, student
and parent portals, and the landing and sign-up pages. You also move pages
off the legacy React contexts.

## Sessions to run

Run these as separate sessions, each in its own worktree and branch. Use
subagents inside a session for parallel reading and searching. Every session
writes only under `docs/revamp/b/` and updates `docs/revamp/b/HANDOFF.md`.

### Session B1: Research (`revamp/b-research`)

Write `docs/revamp/b/research/*.md`, one file per topic. Every claim needs a
source link and the date you checked it. Topics:

1. **Rich-text and block editors** for React 19 and Next.js 15: Tiptap,
   BlockNote, Lexical, Plate, Novel. Licence and paid features, bundle size,
   markdown and LaTeX round-tripping, custom blocks, collaboration later,
   accessibility. Recommend one.
2. **Math input and rendering.** MathLive (visual input like Wolfram|Alpha's
   Math Input), MathQuill, KaTeX versus the MathJax already in use. How
   natural-language input ("find t for t^2 + 3t + 2 = 0") could work: local
   parsing versus the Wolfram|Alpha API, and what that costs per call
   (coordinate with A, who owns API pricing).
3. **Graphing.** JSXGraph, Mafs, function-plot, Plotly, GeoGebra and Desmos
   APIs: licence, cost, interactivity, use inside lessons and as an answer
   type.
4. **Dual-mode UX.** How Notion, Linear, the AWS console and the Azure
   portal handle density, progressive disclosure and settings. Patterns for
   a Simple mode (default) and a Technical mode toggle.
5. **Navigation.** Parent header plus slim contextual ribbon: examples of
   compact ribbons and contextual toolbars (Google Docs, Figma, Office's
   simplified ribbon, GitHub). Breadcrumbs and service switchers in portals.
6. **Test designer.** Continuous scrolling question lists with a sticky
   question-number strip: examples from Google Forms, Microsoft Forms,
   Moodle, Canvas New Quizzes. Virtualised lists for long tests.
7. **Block-based reusable content.** How Notion templates, Canvas Commons
   and Moodle course backups handle reuse, copying and versioning.
8. **Coding automarker.** Judge0 CE limits and setup, Free Pascal `-Mdelphi`
   for Delphi console programs, Java and C++ toolchains, contest and
   ranking features (judge mode), plagiarism tools such as JPlag.
9. **AI-assisted marking.** Using AWS Bedrock (or Azure OpenAI) to mark
   written answers against a memo: prompt design, rubric output, cost per
   answer, accuracy evidence, keeping the tutor in the loop, and POPIA for
   minors' work.
10. **Calendar and attendance.** Libraries (FullCalendar, Schedule-X, React
    Big Calendar), recurring events, links to Meet, Teams and Zoom.
11. **Fonts and accessibility.** Geist Sans and Geist Mono, WCAG 2.2 AA
    checks for both modes.

End with `docs/revamp/b/research/SUMMARY.md`: recommendations and the open
questions for the owner.

### Session B2: System design (`revamp/b-system-design`)

Start when B1 has a first draft. Write `docs/revamp/b/design/*.md`:

- Content model: blocks, templates, courses, lessons and lesson groups that
  can be reused and copied across courses and teams, with versioning.
- Editor: stored format, markdown and LaTeX import and export, math and
  graph blocks, plain-text mode. Draft `docs/revamp/contracts/editor.md`.
- Test designer and runner: question model, scrolling designer, numbering
  strip, autosave, shuffling, deadlines (keep `attemptDeadline()` as the
  single rule for when an attempt ends).
- Assignments: the rename from Submissions (UI, routes with redirects, then
  code), and the merge of the two page generations onto the RSC pages.
- Calendar: live sessions, recurrence, attendance records.
- Coding automarker and judge mode: tasks, test cases, runs, callbacks,
  rankings. AI marking pipeline with tutor approval.
- Frontend architecture: route groups per role, layouts, the header and
  ribbon slot system (draft `docs/revamp/contracts/navigation.md`), mode
  switching, feature flags, and how services from A's
  `contracts/services.md` show or hide UI.
- Legacy context replacement: for each context in `src/context/`, the pages
  that use it and the RSC or server-action replacement. Replace first;
  delete only after the owner tests. A supplies any new server actions.

### Session B3: UI/UX design (`revamp/b-ux`)

Start alongside B2. Write `docs/revamp/b/ux/*.md` and, where useful, HTML
mockups under `docs/revamp/b/ux/mockups/`:

- Design system: Nexa wordmark, colour tokens, type scale, spacing, radius
  and density for Simple and Technical modes, illustration rules.
- Parent header and child ribbon for: tutor home, course page, lesson
  editor, test designer, test runner, assignment marking, calendar, student
  home, parent portal.
- The editor's dialogs: markdown, LaTeX, math input, graph.
- Test designer: scrolling list, question-number strip, states.
- Landing page and sign-up in the new look.
- Simple mode shows each service's main settings only; Technical mode shows
  the full configuration and docs links. Show both for at least three
  screens.

### Session B4: Write-up with diagrams (`revamp/b-writeup`)

Last. Write `docs/revamp/b/WRITEUP.md`, one readable document that combines
B1 to B3, with Mermaid diagrams:

- Use-case diagram per role: tutor, student, parent, organisation member.
- Activity diagrams: authoring a lesson from a template, designing a test,
  taking a test (including the due-date cutoff), submitting a coding task,
  AI marking with tutor approval, taking attendance.
- Sitemap and navigation map for both modes.
- Frontend component diagram (layouts, header, ribbon, editor, pages).
- Entity-relationship diagram for content, assessments, coding and calendar.
- Sequence diagram for a code check and a final submit through Judge0.

Open one pull request per session into `main`. Ask the owner before merging.

## After the write-up is approved: Phase 0 build

Start only when the owner approves the write-up. Each item is its own branch
and pull request:

1. Design tokens, Geist fonts, the Nexa wordmark and the base components
   behind the `REVAMP_UI` flag.
2. The new app shell: sidebar, parent header, child ribbon, mode switch.
3. Move the calendar, assignments and test-session pages and the dashboard
   shell off the legacy contexts onto RSC and server actions. Leave the old
   contexts in place until the owner tests; then tell A which routes are no
   longer called.
4. Rename Submissions to Assignments in visible UI and routes, with
   redirects from old URLs.

## Rules that matter most

- Stay inside your paths. Need something from A (schema, server actions,
  env vars, infrastructure)? Write it in HANDOFF.md.
- Ask before any database write, paid resource, deletion, merge or
  production change.
- No secrets or personal data in commits, pull requests or chat.
- Update `docs/revamp/b/HANDOFF.md` at the end of every session.
