# Agent B research: summary

Checked: 2026-11-16. Author: Agent B (Product and learning), session B1,
branch `revamp/b-research`. Plan of record: "Nexa LMS: Platform revamp plan",
revision 2.

Twelve topic files sit next to this one. Each has its sources, the date each
fact was checked, and its own open questions. This page pulls out the
recommendations, the places where research changes the plan, the code issues
found on the way, and the decisions only the owner can make.

## Owner decisions, 2026-11-16

The owner answered the questions below the same day. Where a decision
differs from a pick in the table, the decision wins.

| # | Topic | Decision | Effect on B's plan |
| --- | --- | --- | --- |
| 1 | Stored format | **Tiptap JSON is the source of truth**, markdown derived. Tiptap Cloud (collaboration) is a later decision | Pick stands |
| 2 | Math engine | **MathJax 4 everywhere.** Audit approved and run: every stored formula renders ([13](13-math-audit.md)) | Pick stands; no content migration |
| 3 | Coding automarker | **Parked, Judge0 included**, because of cost. To be reviewed later together with a sandbox option | Drop coding from B2 and v1. Keep the `Runner` interface idea in file 08 for later |
| 4 | AI marking | **Proceed with design on Bedrock** | Design in B2. Shipping still waits for A's POPIA view (s72, s57) |
| 5 | Fonts and colours | **Fraunces goes.** The darker tokens are accepted (`#6F6E69`, `#2563EB`, `#8A6116`, `#C53030`, `#8F8F8B` input outline) | B3 uses Geist only and these tokens |
| 6 | Modes | **No Simple and Technical modes.** One UI: technically capable, with a natural, friendly UX and a Notion-like look | Drop `uiMode`, `data-mode` and the `technical:` variant. File 04's density and progressive-disclosure ideas apply to the one UI |
| 7 | Timed tests | **Tutors and organisations grant extra time, and Pro lockdown tests honour it** | Per-student time accommodation in B2's test model |
| 8 | Test runner and copies | **One question (with its subquestions) per screen** by default. **Copied tests bring everything**, memos included | Runner design changes (file 06 suggested one continuous list); the number strip stays as the navigator |
| 9 | Graphing tier | **All graphing is Pro and above**, lesson graphs and graph answers | Service gating via A's `hasService` |
| 10 | Video links | **Set in settings; Google Meet is the default** (easy, free) | Meet first. Auto-created Meet links need a Google OAuth app (A's infrastructure) |
| 11 | Leaderboards | **Everyone enrolled in the course appears** | No opt-out in v1 |
| 12 | Dependencies | **Approved:** Tiptap, MathLive, Mafs, `@radix-ui/react-toolbar`, rrule-temporal | Add them in the PRs that use them |
| 13 | Illustrations | General-purpose packs; **B picks what fits** | Open Peeps in the app; Medical Icons not used unless a health-related screen appears; Transhumans small only |

The three code issues below were fixed on `revamp/b-fixes` the same day.

## Recommendations at a glance

| # | Topic | Pick | Fallback | File |
| --- | --- | --- | --- | --- |
| 1 | Rich-text and block editor | **Tiptap 3** (MIT core; math, drag handle, markdown and static renderer are free) | Plate | [01](01-block-editors.md) |
| 1 | Stored format | **Tiptap JSON is the source of truth**, with a markdown copy regenerated on every save (search, AI marking, export, fallback rendering) | Markdown stays canonical, which points to Plate | [01](01-block-editors.md) |
| 2 | Math rendering | **Stay on MathJax, move to v4, self-hosted** (today: 3.2.2 from cdnjs) | KaTeX on the server with MathJax for what KaTeX rejects, only after a content audit | [02](02-math-input-rendering.md) |
| 2 | Math input | **MathLive** (MIT), client-only, loaded only where a Plus service is on | Plain LaTeX box with live preview (the free tier anyway) | [02](02-math-input-rendering.md) |
| 2 | Solving and answer checking | **Cortex Compute Engine on the server**; an LLM only turns free text into a problem the engine solves. **Not Wolfram\|Alpha** (no caching allowed, branding rules, commercial prices not published) | nerdamer-prime for polynomials | [02](02-math-input-rendering.md) |
| 3 | Graphing, lessons and answers | **Mafs** (MIT, React, about 95 KB gzip), driven by our own JSON graph spec, answers marked on the server | JSXGraph. Not GeoGebra (paid commercial licence) or Desmos (terms unknown) | [03](03-graphing.md) |
| 4 | ~~Simple and Technical modes~~ (dropped, decision 6) | **One per-user `uiMode`** (default Simple), set as `data-mode` on the server; density from CSS variables and a Tailwind `technical:` variant; one config panel component with basic and advanced fields. **A mode never removes a feature** | Ship the density switch alone first | [04](04-dual-mode-ux.md) |
| 5 | Navigation | **Azure-style**: header (breadcrumb with switcher, status chip, help, one main action) plus a ribbon (view links left, an ARIA toolbar right, overflow into "More"); today's ⌘K search grows into a command palette. Per-screen table for all nine screens | — | [05](05-navigation.md) |
| 6 | Test designer and runner (runner: one question per screen, decision 8) | **One continuous list** with a sticky number strip (empty, partial, done, error, flagged); server-side drafts; a `Test.version` check on save; inline validation. **No virtualisation yet** | TanStack Virtual with dnd-kit when the question bank needs it | [06](06-test-designer.md) |
| 7 | Reusable content | **Copy with provenance** (`sourceId`, `sourceVersion`, `copiedAt`) and an "update available" prompt that opens a draft. Copies land as drafts, dates cleared, blobs duplicated. No live linking | Version-pinned bank items later (Plus) | [07](07-reusable-content.md) |
| 8 | Coding automarker (parked, decision 3) | **Self-hosted Judge0 CE 1.13.1** on its own VM, every language through the multi-file runner (id 89) with our own scripts, HMAC-tokened callbacks, a stuck-run poller and our own output checker, all behind a `Runner` interface | Piston, or a thin worker over isolate 2.x | [08](08-coding-automarker.md) |
| 9 | AI-assisted marking | **Claude Haiku 5.5 on Bedrock** for first pass, escalate hard cases to Sonnet 5.5; queued structured-output jobs; the tutor accepts or edits every mark; an audit table | Azure OpenAI in South Africa North | [09](09-ai-assisted-marking.md) |
| 10 | Calendar and attendance | **Keep our own grid** (`calendar-view.tsx`), extend with date-fns and shadcn; store an **RRULE string + time zone + exceptions table**, expand with rrule-temporal. v1: pasted meeting links, per-user ICS feed, P/L/A/E attendance per occurrence, optional check-in code | FullCalendar v7 (MIT) if drag-to-reschedule is needed | [10](10-calendar-attendance.md) |
| 11 | Fonts and accessibility | **Geist and Geist Mono** via `next/font/google` (`latin` + `latin-ext`). Several colour tokens fail WCAG AA and need darker values (below) | Inter | [11](11-fonts-accessibility.md) |
| 13 | Stored maths audit | MathJax 4 renders all 5,605 stored formulas; KaTeX would too today | — | [13](13-math-audit.md) |
| 12 | Illustrations | **Open Peeps SVGs** in the app (optimised, strokes set to `currentColor`); Transhumans only at small size; Zanzi on marketing pages only | — | [12](12-illustrations.md) |

### How the editor, math and graph picks fit together

The three picks have to agree, because a lesson holds text, formulas and
graphs in one document.

- Tiptap stores the document as JSON. A math node holds TeX; a graph node
  holds our graph spec. The derived markdown writes them as `$...$`,
  `$$...$$` and a fenced `graph` block, so search, AI marking and export keep
  working on plain text.
- **One math engine everywhere.** Tiptap's stock math extension and Mafs both
  use KaTeX, while student pages use MathJax. If we keep both, a formula can
  look right in the editor and break for the student. Recommendation: write
  our own Tiptap math node view that renders with MathJax 4, and keep graph
  labels plain text in v1. Revisit KaTeX only after a read-only audit of the
  stored TeX (needs the owner's go-ahead, since it reads the shared database).
- Existing content converts from markdown to JSON lazily, the first time a
  tutor opens it, and the converter must reuse `src/lib/tex-delimiters.ts` so
  `\(...\)` content survives. `@tiptap/markdown` is an early release: build
  fixture tests from real lessons before trusting it.

## Where research changes the plan

1. **React is 18.3.1, not 19.** `package.json` pins `react@^18.3.1`; only the
   type packages are v19. Every pick above works on both, so this is not a
   blocker, but the React 19 upgrade is its own task (and a root-config
   change, which Agent A owns).
2. **Delphi automarking covers less than the plan hopes.** CAPS and NSC Paper
   1 Delphi is mostly GUI (VCL forms), which cannot run on a Linux sandbox.
   Console Delphi covers tutor-written drills, not typical school tasks. The
   GUI-detection-and-route-to-rubric plan stays; the marketing promise should
   shrink. (The CAPS split is partly unverified: the NSC PDFs could not be
   read.)
3. **Judge0 is older than the plan assumes.** The stock image has FPC 3.0.4,
   OpenJDK 13 and GCC 9.2. Java 17/21 and FPC 3.2.x need a custom image. There
   has been no Judge0 release since April 2024, it needs cgroup v1, systemd 258
   dropped cgroup v1, and Ubuntu 22.04 standard support ends May 2027. The
   `Runner` interface is there so we can swap to Piston or isolate later.
4. **Code plagiarism for Delphi has no turnkey tool.** JPlag has no Pascal;
   MOSS is non-commercial only. Dolos (MIT) with a tree-sitter Pascal grammar
   is the route. Deferred to v1.1 with judge mode.
5. **No AI-marking option keeps data in South Africa.** Bedrock in Cape Town
   offers Claude only through global routing; Azure South Africa North has
   only embeddings in region. Every option is a cross-border transfer (POPIA
   s72), and children's data may need prior authorisation from the Information
   Regulator (s57(1)(d)). This needs Agent A's and the owner's sign-off before
   AI marking ships.
6. **Colour tokens need adjusting** (contrast re-checked in this session):

   | Token | Plan value | Contrast | Use instead | Contrast |
   | --- | --- | --- | --- | --- |
   | Muted text on white | `#787774` | 4.48 | `#6F6E69` | 5.11 |
   | Accent text on sidebar grey | `#2F6FEB` | 4.26 | `#2563EB` | 4.82 |
   | Warning as text | `#CB912F` | 2.75 | `#8A6116` | see file 11 |
   | Danger as text | `#E03E3E` | 4.26 | `#C53030` | see file 11 |
   | Input outline | `#E9E9E7` | 1.22 (needs 3:1) | `#8F8F8B` for inputs; keep `#E9E9E7` for dividers | see file 11 |

   Body text `#37352F` passes easily (11.43 on the sidebar grey). The current
   terracotta accent `#C2410C` passes at 5.18 on white, if the owner prefers
   to keep it.

## Code issues found during research

Checked against the code in this session unless marked otherwise. The
first three were fixed on `revamp/b-fixes` after the owner asked for them.

| Issue | Where | Impact | Status |
| --- | --- | --- | --- |
| NUMERIC answers compared with `===`: `0.5` vs `1/2` fails, no tolerance | `src/features/assessments/lib/auto-grade.ts:116` | Wrong marks on numeric questions (also `0,5`, the decimal comma the runner allows) | **Fixed** on `revamp/b-fixes` |
| Saving a test deletes every question missing from the payload, with its grades and uploads; there is no version check, so a stale tab can wipe questions | `src/features/assessments/actions.ts:200` | Data loss risk | **Fixed** on `revamp/b-fixes` with a fingerprint check (no schema change); `Test.version` can replace it |
| Weekly recurrence uses the server's local weekday (`getDay()`); Vercel runs in UTC, so events starting 00:00 to 01:59 SAST can land on the wrong day | `src/features/events/lib/recurrence.ts:79` | Rare wrong-day events | Reproduced under `TZ=UTC`; **fixed** on `revamp/b-fixes` |
| Lesson delete removes its blobs; any future copy sharing those URLs would break. `deleteTest` leaks blobs | `src/features/lessons/actions.ts:276`; assessments actions | Blocks naive copy-on-reuse | Lesson part verified; test leak reported by research |
| Old reorder question is drag-only (fails WCAG 2.5.7 and 2.1.1); new one's ↑/↓ buttons lack `aria-label` | `src/app/dashboard/tests/components/question-input.tsx`, `question-renderer.tsx` | Accessibility | Reported by research |
| Timed tests auto-submit with no way to grant extra time (WCAG 2.2.1) | Test runner | Accessibility, and a likely accommodation request | Reported by research |
| `--font-mono` defined in terms of itself | `src/app/globals.css` | Mono font may not apply | Reported by research |
| `EventContext` still used by the tutor submission-create page; `student-calendar.tsx` and `tutor-calendar.tsx` look dead | `src/context/`, calendar components | Legacy-context removal | Reported by research |

## Schema changes the picks imply

All of these need `prisma db push` (or, after Phase 0, a migration) against a
database that today is shared with production, so **none happen without the
owner's approval**. They belong in B2's design, in the `learning`,
`assessments`, `coding` and `calendar` schema files after Agent A's split.

- Lesson and question content as JSON (new columns), keeping markdown alongside.
- `Test.version`; provenance fields (`sourceId`, `sourceVersion`, `copiedAt`) on copyable content.
- Per-question rubric; an `AiMarkSuggestion` table.
- `CourseEvent.rrule` and `timeZone`; a `CourseEventException` table; an attendance table.
- ~~`UserPreferences.uiMode`~~ (modes dropped).
- ~~Coding tables~~ (automarker parked).
- Per-student extra time on timed tests (decision 7).

## Inputs for Agent A

Costs and infrastructure facts found during B's research. A owns pricing and
infrastructure; these are leads, not decisions.

- **Judge0 hosted:** €27, €54 or €107 per month for 2k, 5k or 10k submissions a day; each test case counts as a submission ([08](08-coding-automarker.md)). Self-hosting needs an Ubuntu 22.04 VM in cgroup v1 mode with a custom image.
- **AI marking:** Anthropic list prices Haiku 5.5 $0.10 / $0.50 and Sonnet 5.5 $2 / $10 per million tokens in / out (re-checked in this session). That is about $0.0002 per short answer on Haiku and $0.0041 on Sonnet. **Bedrock prices are separate**; the AWS pricing page did not load, so confirm them. Caching the memo and rubric across a class saves about 38-40%. No batch discount on Bedrock for these models ([09](09-ai-assisted-marking.md)).
- **Collaboration (later):** Tiptap Cloud $49-59 a month for 500 documents; Liveblocks Pro from $25-30 a month plus usage; Hocuspocus is free but needs a long-running WebSocket host outside Vercel ([01](01-block-editors.md)).
- **Wolfram|Alpha:** not recommended; commercial prices are not published ([02](02-math-input-rendering.md)).
- **Calendar:** auto-created Meet, Teams or Zoom links each need an OAuth app and review; Teams does not work with personal Microsoft accounts. v1 avoids all three ([10](10-calendar-attendance.md)).
- **Blob storage:** copy-on-reuse duplicates files, which adds to the nearly full 1 GB store ([07](07-reusable-content.md)).
- **POPIA:** AI marking is a cross-border transfer of minors' work (see above). A public template gallery would raise its own questions.
- **Parent model:** parent attendance and progress views need A's Guardian link model.

## Questions for the owner

All thirteen were answered on 2026-11-16; see "Owner decisions" at the top.
The original questions are in this file's git history.

## What the design sessions take from here

- **B2 System design:** content model and editor contract (`contracts/editor.md`) on Tiptap JSON and MathJax 4; test designer with `Test.version` and per-student extra time; one-question-per-screen runner; copy-with-provenance that brings everything; calendar on RRULE with exceptions and a meeting-link setting (Meet default); AI marking queue on Bedrock; frontend shell with the header/ribbon slots (`contracts/navigation.md`). No modes, no coding automarker.
- **B3 UI/UX:** one Notion-like UI; corrected colour tokens and Geist type scale (no Fraunces); the header and ribbon table in file 05 as the starting point for mockups; number-strip states from file 06; illustration rules from file 12.
