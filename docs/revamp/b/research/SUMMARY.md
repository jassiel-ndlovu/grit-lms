# Agent B research: summary

Checked: 2026-11-16. Author: Agent B (Product and learning), session B1,
branch `revamp/b-research`. Plan of record: "Nexa LMS: Platform revamp plan",
revision 2.

Twelve topic files sit next to this one. Each has its sources, the date each
fact was checked, and its own open questions. This page pulls out the
recommendations, the places where research changes the plan, the code issues
found on the way, and the decisions only the owner can make.

## Recommendations at a glance

| # | Topic | Pick | Fallback | File |
| --- | --- | --- | --- | --- |
| 1 | Rich-text and block editor | **Tiptap 3** (MIT core; math, drag handle, markdown and static renderer are free) | Plate | [01](01-block-editors.md) |
| 1 | Stored format | **Tiptap JSON is the source of truth**, with a markdown copy regenerated on every save (search, AI marking, export, fallback rendering) | Markdown stays canonical, which points to Plate | [01](01-block-editors.md) |
| 2 | Math rendering | **Stay on MathJax, move to v4, self-hosted** (today: 3.2.2 from cdnjs) | KaTeX on the server with MathJax for what KaTeX rejects, only after a content audit | [02](02-math-input-rendering.md) |
| 2 | Math input | **MathLive** (MIT), client-only, loaded only where a Plus service is on | Plain LaTeX box with live preview (the free tier anyway) | [02](02-math-input-rendering.md) |
| 2 | Solving and answer checking | **Cortex Compute Engine on the server**; an LLM only turns free text into a problem the engine solves. **Not Wolfram\|Alpha** (no caching allowed, branding rules, commercial prices not published) | nerdamer-prime for polynomials | [02](02-math-input-rendering.md) |
| 3 | Graphing, lessons and answers | **Mafs** (MIT, React, about 95 KB gzip), driven by our own JSON graph spec, answers marked on the server | JSXGraph. Not GeoGebra (paid commercial licence) or Desmos (terms unknown) | [03](03-graphing.md) |
| 4 | Simple and Technical modes | **One per-user `uiMode`** (default Simple), set as `data-mode` on the server; density from CSS variables and a Tailwind `technical:` variant; one config panel component with basic and advanced fields. **A mode never removes a feature** | Ship the density switch alone first | [04](04-dual-mode-ux.md) |
| 5 | Navigation | **Azure-style**: header (breadcrumb with switcher, status chip, help, one main action) plus a ribbon (view links left, an ARIA toolbar right, overflow into "More"); today's ⌘K search grows into a command palette. Per-screen table for all nine screens | — | [05](05-navigation.md) |
| 6 | Test designer and runner | **One continuous list** with a sticky number strip (empty, partial, done, error, flagged); server-side drafts; a `Test.version` check on save; inline validation. **No virtualisation yet** | TanStack Virtual with dnd-kit when the question bank needs it | [06](06-test-designer.md) |
| 7 | Reusable content | **Copy with provenance** (`sourceId`, `sourceVersion`, `copiedAt`) and an "update available" prompt that opens a draft. Copies land as drafts, dates cleared, blobs duplicated. No live linking | Version-pinned bank items later (Plus) | [07](07-reusable-content.md) |
| 8 | Coding automarker | **Self-hosted Judge0 CE 1.13.1** on its own VM, every language through the multi-file runner (id 89) with our own scripts, HMAC-tokened callbacks, a stuck-run poller and our own output checker, all behind a `Runner` interface | Piston, or a thin worker over isolate 2.x | [08](08-coding-automarker.md) |
| 9 | AI-assisted marking | **Claude Haiku 5.5 on Bedrock** for first pass, escalate hard cases to Sonnet 5.5; queued structured-output jobs; the tutor accepts or edits every mark; an audit table | Azure OpenAI in South Africa North | [09](09-ai-assisted-marking.md) |
| 10 | Calendar and attendance | **Keep our own grid** (`calendar-view.tsx`), extend with date-fns and shadcn; store an **RRULE string + time zone + exceptions table**, expand with rrule-temporal. v1: pasted meeting links, per-user ICS feed, P/L/A/E attendance per occurrence, optional check-in code | FullCalendar v7 (MIT) if drag-to-reschedule is needed | [10](10-calendar-attendance.md) |
| 11 | Fonts and accessibility | **Geist and Geist Mono** via `next/font/google` (`latin` + `latin-ext`). Several colour tokens fail WCAG AA and need darker values (below) | Inter | [11](11-fonts-accessibility.md) |
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

Checked against the code in this session unless marked otherwise. None are
fixed here; research sessions only write docs.

| Issue | Where | Impact | Status |
| --- | --- | --- | --- |
| NUMERIC answers compared with `===`: `0.5` vs `1/2` fails, no tolerance | `src/features/assessments/lib/auto-grade.ts:116` | Wrong marks on numeric questions | Verified |
| Saving a test deletes every question missing from the payload, with its grades and uploads; there is no version check, so a stale tab can wipe questions | `src/features/assessments/actions.ts:200` | Data loss risk | Verified (the sweep is deliberate; the missing version check is the gap) |
| Weekly recurrence uses the server's local weekday (`getDay()`); Vercel runs in UTC, so events starting 00:00 to 01:59 SAST can land on the wrong day | `src/features/events/lib/recurrence.ts:79` | Rare wrong-day events | Verified by reading; not reproduced |
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
- `UserPreferences.uiMode`.
- Coding tables from the plan (`CodingTask`, `TestCase`, `CodeSubmission`, `CodeRun`).

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

Ordered by what blocks B2 and B3 most.

1. **Stored format:** accept Tiptap JSON as the source of truth with markdown derived? (If markdown must stay canonical, the pick becomes Plate.)
2. **Math engine:** accept MathJax 4 everywhere, including a custom editor node, and plain-text graph labels in v1? And may B run a read-only audit of stored TeX against KaTeX on the shared database?
3. **Delphi scope:** is console-only Delphi automarking still worth building for v1, knowing school Delphi is mostly GUI? And: FPC 3.2.x in a custom image, Java 17 or 21, is Judge0's GPL-3.0 acceptable?
4. **AI marking and POPIA:** proceed with design on Bedrock global routing, pending Agent A's legal view on s72 and s57?
5. **Colour tokens:** accept the darker muted grey and accent (`#6F6E69`, `#2563EB`), or keep terracotta `#C2410C`? Does Fraunces go entirely?
6. **Modes:** can students and parents see the Simple/Technical toggle, or is it tutors only?
7. **Timed tests:** who grants extra time, and do Pro lockdown tests honour it?
8. **Test runner:** continuous scroll or one question per screen by default? Do copied tests bring memos by default?
9. **Graphing tier:** lesson graphs free and only the graph answer type on Plus?
10. **Video tools:** which do your tutors actually use (Meet, Teams, Zoom)? This decides which auto-link integration comes first, after v1.
11. **Leaderboards:** may minors appear on judge-mode rankings, and to whom?
12. **New dependencies:** OK to add Tiptap, MathLive, Mafs, `@radix-ui/react-toolbar` and rrule-temporal in B's pull requests (root config is A's; small additions need A's approval)?
13. **Illustrations:** is the Medical Icons sheet meant for Nexa? Are there larger originals of Transhumans for the landing hero?

## What the design sessions take from here

- **B2 System design:** content model and editor contract (`contracts/editor.md`) from the format, math and graph decisions; test designer with `Test.version`; copy-with-provenance; calendar on RRULE with exceptions; `Runner` interface and Judge0 pipeline; AI marking queue; frontend shell with `data-mode` and the header/ribbon slots (`contracts/navigation.md`).
- **B3 UI/UX:** corrected colour tokens and Geist type scale; the header and ribbon table in file 05 as the starting point for mockups; number-strip states from file 06; illustration rules from file 12.
