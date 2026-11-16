# Rich-text and block editors for Nexa

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Pick **Tiptap 3** (MIT core, headless). It is the only option that gives us free math, drag handle, markdown, a server-side static renderer and a self-hostable collaboration server, with a toolbar we can place in our own child ribbon.
- Store **editor JSON as the source of truth**, with a derived markdown copy kept beside it for AI marking, search, export and fallback rendering. Markdown alone cannot hold graph blocks, embedded questions or callouts without inventing our own syntax.
- Migrate lazily. Existing markdown + TeX stays readable through today's `LessonMarkdown`. A row converts to JSON the first time a tutor opens it in the new editor.
- **Plate** is the fallback. Its markdown pipeline is remark-based (the same family as our react-markdown) and round-trips `$..$` math. Choose it instead if the owner insists markdown stays the stored format.
- Avoid BlockNote (heavy, Mantine-first UI, GPL/paid XL packages, client-only) and Novel (last release January 2025, still on Tiptap 2).

## What we have today

- Tutor text is a plain `<Textarea>` with a "Preview render" modal: `src/components/markdown-textarea.tsx`. It is used in 7 files, including `src/features/lessons/components/lesson-form.tsx` and `src/features/assessments/components/test-question-editor.tsx`.
- Stored as markdown strings: `Lesson.description`, `TestQuestion.question`, test/assignment `description`, `CourseEvent.description` (`prisma/schema.prisma`). Answers and match pairs are `Json`. Options and reorder items are `String[]`.
- Rendered by `src/app/components/markdown.tsx` (react-markdown 10 + remark-gfm + MathJax 3 through better-react-mathjax). It is a client component, so student pages already ship the renderer and MathJax.
- `src/lib/tex-delimiters.ts` rewrites `\(..\)` and `\[..\]` to dollar forms and protects TeX bodies from markdown. It also handles a real ambiguity: `\[26\]` is a mark allocation, not display math. Any editor import must reuse this logic, or it will break existing content.

## The candidates at a glance

| | Tiptap 3 | BlockNote | Lexical | Plate | Novel |
|---|---|---|---|---|---|
| Engine | ProseMirror | ProseMirror + Tiptap ([README](https://github.com/TypeCellOS/BlockNote)) | Own engine (Meta) | Slate | Tiptap 2 |
| Licence (core) | MIT ([npm pkg](https://unpkg.com/@tiptap/react/package.json)) | MPL-2.0 ([npm pkg](https://unpkg.com/@blocknote/react/package.json)) | MIT ([repo](https://github.com/facebook/lexical)) | MIT ([npm pkg](https://unpkg.com/platejs/package.json)) | Apache-2.0 ([npm pkg](https://unpkg.com/novel/package.json)) |
| Paid parts | Cloud plans from $49/mo, Notion-like template needs Start plan ([pricing](https://tiptap.dev/pricing), [template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor)) | XL packages: GPL-3.0 or $195/mo Business ([pricing](https://www.blocknotejs.org/pricing)) | None | Plate Plus €299 / €799 one-time ([pro](https://pro.platejs.org/)) | None |
| Latest version | 3.34.0 ([npm pkg](https://unpkg.com/@tiptap/react/package.json)) | 0.57.0, 30 Oct 2026 ([releases](https://github.com/TypeCellOS/BlockNote/releases)) | 0.53.0, 28 Oct ([releases](https://github.com/facebook/lexical/releases)) | 53.5.2 ([npm pkg](https://unpkg.com/platejs/package.json)) | 1.0.2, 18 Jan 2025 ([registry](https://registry.npmjs.org/novel)) |
| GitHub stars | 39.1k ([repo](https://github.com/ueberdosis/tiptap)) | 10.4k ([repo](https://github.com/TypeCellOS/BlockNote)) | 24.0k ([repo](https://github.com/facebook/lexical)) | 16.7k ([repo](https://github.com/udecode/plate)) | 16.5k ([repo](https://github.com/steven-tey/novel)) |
| Backer | Tiptap GmbH (ueberdosis), sells Cloud | TypeCell, NLNet-sponsored ([README](https://github.com/TypeCellOS/BlockNote)) | Meta ([repo](https://github.com/facebook/lexical)) | udecode (small team, sells Plus) | One author (Vercel-adjacent), stalled |
| React peer range | 17, 18, 19 ([npm pkg](https://unpkg.com/@tiptap/react/package.json)) | 18, 19 ([npm pkg](https://unpkg.com/@blocknote/react/package.json)) | >=18 ([npm pkg](https://unpkg.com/@lexical/react/package.json)) | >=18 ([npm pkg](https://unpkg.com/platejs/package.json)) | >=18 ([npm pkg](https://unpkg.com/novel/package.json)) |
| Min+gz (core pkg only) | `@tiptap/core` 37.2 KB + `@tiptap/react` 9.0 KB, ProseMirror (`@tiptap/pm`) extra ([core](https://bundlephobia.com/api/size?package=@tiptap/core), [react](https://bundlephobia.com/api/size?package=@tiptap/react)) | `@blocknote/core` 189.9 KB ([bundlephobia](https://bundlephobia.com/api/size?package=@blocknote/core)) | `lexical` 69.4 KB ([bundlephobia](https://bundlephobia.com/api/size?package=lexical)) | `platejs` 104.0 KB ([bundlephobia](https://bundlephobia.com/api/size?package=platejs)) | (unverified, bundlephobia rate-limited) |

Bundle notes. These numbers are not like-for-like. Tiptap's core excludes ProseMirror, and BlockNote's includes Tiptap plus ProseMirror. Guess: a Tiptap editor with StarterKit, math, tables, code highlight and drag handle lands around 150 to 250 KB min+gz. A BlockNote editor with its Mantine UI is larger. Either way the editor is tutor-only, so it should be loaded with `next/dynamic` on authoring routes and never shipped to students.

Milkdown is worth one line. It is MIT and built on ProseMirror and remark, so it is markdown-first ([repo](https://github.com/Milkdown/milkdown), 12.1k stars). Its React story and math plugin were not confirmed on the repo page (unverified), and the community is smaller than Tiptap's. Yoopta was not reviewed.

## Each option in more detail

### Tiptap 3

- The editor is "open source (MIT) and free". Only cloud documents and platform features are priced ([pricing](https://tiptap.dev/pricing)).
- In June 2025 Tiptap moved 10 former Pro extensions to MIT, including Mathematics, DragHandle (React and Vue), FileHandler, Details, UniqueID, TableOfContents and Emoji ([3.0 notes](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable), [HN announcement](https://5637469d.hackernews-40s.pages.dev/item/44202103)). `@tiptap/extension-mathematics` 3.34.0 is MIT, with `katex` as a peer dependency ([npm pkg](https://unpkg.com/@tiptap/extension-mathematics/package.json)).
- Still paid: AI Toolkit and Tracked Changes (contact sales), plus cloud collaboration, comments and conversion on hosted plans ([pricing](https://tiptap.dev/pricing)). The polished Notion-like UI template needs at least a Start plan in production ([template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor)). We would build our own UI with shadcn anyway.
- Next.js: mark the component `'use client'` and set `immediatelyRender: false` to avoid hydration mismatches ([Next.js guide](https://tiptap.dev/docs/editor/getting-started/install/nextjs)).
- Server rendering: `@tiptap/static-renderer` turns JSON into HTML, React or markdown "without a browser, DOM or even an editor instance" ([docs](https://tiptap.dev/docs/editor/api/utilities/static-renderer)). This is exactly what student pages need.
- Release cadence: 3.0 shipped mid-2025 and the line is at 3.34.0 now ([npm pkg](https://unpkg.com/@tiptap/react/package.json)), so minor releases are frequent and non-breaking.

### BlockNote

- Notion-style blocks out of the box: slash menu, side menu with drag handle, formatting toolbar.
- Core is MPL-2.0. The XL packages (AI, multi-column, PDF/DOCX/ODT/email exporters) are GPL-3.0, or need a commercial licence. That licence comes with Business at $195/month ($2,340/year), one app per licence ([pricing](https://www.blocknotejs.org/pricing)). Nexa is closed-source, so any XL package means paying.
- Must render client-side only, via `next/dynamic` with `ssr: false` ([Next.js docs](https://www.blocknotejs.org/docs/getting-started/nextjs)).
- Server-side export through `ServerBlockNoteEditor` needs a JSDOM-style DOM for HTML and markdown, has global side effects, and needs `serverExternalPackages` in Next.js App Router ([server processing](https://www.blocknotejs.org/docs/features/server-processing)). That is awkward for RSC student pages.
- UI is Mantine by default, with `@blocknote/shadcn` as an alternative that needs Tailwind 4 ([shadcn docs](https://www.blocknotejs.org/docs/advanced/shadcn), [releases](https://www.github.com/TypeCellOS/BlockNote/releases)).
- The formatting toolbar follows the selection. You can replace it ([toolbar docs](https://www.blocknotejs.org/docs/react/components/formatting-toolbar)), but a fixed toolbar in an external ribbon is not documented (unverified).
- Has an official `@blocknote/math-block` with inline and block math, rendered with KaTeX to MathML, exporting to `$$` and `$..$` in markdown ([math docs](https://www.blocknotejs.org/docs/features/blocks/math)).
- Pinned to Tiptap `^3.31.3` internally ([npm pkg](https://unpkg.com/@blocknote/react/package.json)). In practice it is "Tiptap with opinions", with less control and more weight.

### Lexical

- MIT, backed by Meta, framework-agnostic core with React bindings, Yjs collaboration ([repo](https://github.com/facebook/lexical)). Still pre-1.0 (0.53.0).
- React 18 became the minimum in v0.47.0. Projects on 18 or 19 need no changes ([releases](https://github.com/facebook/lexical/releases)).
- Markdown goes through "transformers" you pass explicitly. The built-in set has no table transformer, and math is not mentioned ([lexical-markdown](https://lexical.dev/docs/packages/lexical-markdown)). We would write transformers for tables, math and every custom block.
- No official math node, drag handle or slash menu package. These live in the playground example code, which you copy (unverified as packaged APIs). This is the most build-it-yourself of the five.

### Plate

- MIT, shadcn-native (components are copied into your repo like shadcn/ui), "Rich-text editor with AI and shadcn/ui" ([repo](https://github.com/udecode/plate)).
- Markdown via `@platejs/markdown`, built on remark. You pass `remark-gfm` and `remark-math` as `remarkPlugins` ([search summary of Plate markdown docs](https://platejs.org/docs/markdown)). The equation docs say inline math maps to `inline_equation` and block math to `equation`, and serialise back to the same markdown forms from `texExpression`. Rendering is KaTeX ([equation docs](https://next.platejs.org/docs/equation)).
- RSC: `createStaticEditor` plus `<PlateStatic>` from `platejs/static` render read-only content in Server Components ([static rendering](https://platejs.org/docs/static), [RSC guide](https://platejs.org/docs/installation/rsc)).
- Risk: the package is at major version 53 ([npm pkg](https://unpkg.com/platejs/package.json)). The project renamed from `@udecode/plate-*` to `platejs` / `@platejs/*`, and old docs still show the old imports ([search summary](https://platejs.org/docs/static)). Expect breaking upgrades.
- Plate Plus is a one-time €299 (personal) or €799 (team) for premium components and a Notion-like template ([pro](https://pro.platejs.org/)). It is optional.

### Novel

- A Notion-style wrapper over Tiptap ([repo](https://github.com/steven-tey/novel)). The latest npm version, 1.0.2, was published 18 Jan 2025 ([registry](https://registry.npmjs.org/novel)) and depends on Tiptap `^2.11.2` ([npm pkg](https://unpkg.com/novel/package.json)), a major version behind.
- Not a base to build on. It is useful only as a UI reference for a Tiptap slash menu and bubble menu.

## Deciding issue 1: markdown and LaTeX round-tripping

| | Markdown import/export | Math in markdown | Vendor's stated stance |
|---|---|---|---|
| Tiptap | `@tiptap/markdown` (MIT, uses `marked`) ([npm pkg](https://unpkg.com/@tiptap/markdown/package.json)). Per-extension parse/render handlers, custom tokenizers, `createBlockMarkdownSpec` / `createInlineMarkdownSpec` helpers ([docs](https://tiptap.dev/docs/editor/markdown)) | Not documented for the math extension (unverified). We would write an inline and a block tokenizer, which the helpers above are for | "Early release", may change. Tables allow one child node per cell ([docs](https://tiptap.dev/docs/editor/markdown)) |
| BlockNote | `tryParseMarkdownToBlocks` / `blocksToMarkdownLossy` | Math block exports `$$` / `$..$` ([math docs](https://www.blocknotejs.org/docs/features/blocks/math)) | Markdown is "lossy". Store BlockNote JSON ([formats](https://www.blocknotejs.org/docs/foundations/supported-formats)) |
| Lexical | Transformers, opt-in subset ([docs](https://lexical.dev/docs/packages/lexical-markdown)) | Write your own | Markdown is an application-chosen subset |
| Plate | remark/mdast ([docs](https://platejs.org/docs/markdown)) | `remark-math` round-trip documented ([equation docs](https://next.platejs.org/docs/equation)) | Best markdown fidelity of the five |

What this means for us:

1. **Plain markdown + TeX can round-trip** in Tiptap or Plate, once math tokenizers exist. But our pre-processing step (`normalizeTexDelimiters`) must run before import. Otherwise `\(..\)` content, of which the database has some (see comments in `src/lib/tex-delimiters.ts`), turns into literal parentheses. Export will normalise everything to `$..$` / `$$..$$`. That is fine, because our renderer already prefers those.
2. **Known lossy spots** (Guess, to confirm with fixtures): the image width convention `![alt [50%]](url)` from `markdown.tsx`, `&emsp;` entities in question prompts, raw HTML, hard line breaks, and tables with lists inside cells (Tiptap's one-node-per-cell limit).
3. **New blocks have no markdown form.** Graph, embedded question, callout and file attachment would each need invented syntax (for example `:::callout` directives or fenced ```` ```graph ```` JSON). Every consumer (react-markdown, the LLM import guide, AI marking) would then need to understand it.

**Stored format recommendation:** add a JSON column next to each rich text column (for example `Lesson.bodyJson Json?` and `TestQuestion.questionJson Json?`) and keep the existing string column as **derived markdown**, written on every save with the static renderer's markdown output. Reasons:

- JSON is lossless for our custom nodes. BlockNote's docs say the same about their JSON ([formats](https://www.blocknotejs.org/docs/foundations/supported-formats)).
- The markdown copy keeps AI-assisted marking, search, the LLM import flow, CSV/print export and old renderers working without change.
- Add a `schemaVersion` inside the JSON so node changes can be migrated.

Note: schema changes in this repo go through `prisma db push` against the remote Neon database, so the owner must approve them.

**Migration path:**

1. Ship the renderer switch first. If the JSON is present, render with the static renderer. Otherwise render the old string with `LessonMarkdown`. Nothing breaks on day one.
2. Lazy conversion: when a tutor opens a markdown-only field in the new editor, run `normalizeTexDelimiters`, then `@tiptap/markdown` with our math tokenizers, show the result, and save JSON plus regenerated markdown on save.
3. Build a fixture test from real rows (matrices with `\\`, `aligned`, `cases`, `\[26\]` mark allocations, image width alts, tables) and assert markdown -> JSON -> markdown is stable before any bulk backfill. Run the bulk backfill only on test accounts first.
4. Options, match pairs and reorder items (`String[]` / `Json`) stay plain markdown strings with the plain-text field mode. They are short and do not need blocks.

## Deciding issue 2: custom blocks and nodes

| Block | Tiptap 3 | Plate | BlockNote | Lexical |
|---|---|---|---|---|
| Inline + display math | `InlineMath`, `BlockMath`, `migrateMathStrings()` helper for `$` strings, KaTeX ([docs](https://tiptap.dev/docs/editor/extensions/nodes/mathematics)) | `inline_equation`, `equation`, KaTeX ([docs](https://next.platejs.org/docs/equation)) | `@blocknote/math-block`, inline + block ([docs](https://www.blocknotejs.org/docs/features/blocks/math)) | Build it |
| Code block + highlight | `CodeBlockLowlight` (Novel uses `@tiptap/extension-code-block-lowlight`, [npm pkg](https://unpkg.com/novel/package.json)) | Code block plugin (unverified) | Built-in code block (unverified) | `@lexical/code` (unverified) |
| Graph, embedded question, callout | Custom node + React node view | Custom element + component | Custom block schema | Custom DecoratorNode |
| File attachment | FileHandler extension, now MIT ([HN](https://5637469d.hackernews-40s.pages.dev/item/44202103)) plus our Vercel Blob upload | Media plugins (unverified) | File block (unverified) | Build it |

Notes:

- **Math renderer mismatch.** Every editor's math node uses KaTeX. Our student renderer uses MathJax 3. KaTeX does not cover every MathJax macro, so a formula could preview in the editor but render differently for students, or the other way round. Pick one engine for both. Another subagent covers this in depth. In Tiptap the node view is our own React component, so it can call MathJax instead of KaTeX if needed.
- **Embedded question** should be an atom node holding only `{ questionId }`. The node view fetches and renders the question. The JSON must never copy the question body, or two copies drift apart.
- **Graph block** (Plus tier) is an atom node with a JSON spec (functions, axes, points) and a React node view. The static renderer should output an SVG or a placeholder for server rendering.
- With Tiptap, the tier gate is simple: only register the `Graph` and `MathLive` input extensions when the tutor's tier allows them. Content created by a Plus tutor still renders for students regardless of tier.

## Deciding issue 3: authoring UX

| Need | Tiptap 3 | BlockNote | Plate | Lexical |
|---|---|---|---|---|
| Slash commands | `@tiptap/suggestion` + our shadcn `Command` menu (Novel depends on it, [npm pkg](https://unpkg.com/novel/package.json)) | Built in | Built in (shadcn registry) | Playground code |
| Drag handle | `@tiptap/extension-drag-handle-react` ([docs](https://tiptap.dev/docs/editor/extensions/functionality/drag-handle-react)), MIT since 2025 | Built in | Built in | Playground code |
| Block menu | Build on drag handle + Radix `DropdownMenu` | Built in | Built in | Build |
| Toolbar in our child ribbon | Natural. Headless, so any component can call `editor.chain()...` | Toolbar is selection-positioned ([docs](https://www.blocknotejs.org/docs/react/components/formatting-toolbar)). Fixed placement unverified | Possible, toolbar components are ours | Possible |
| Plain vs rich toggle per field | Easy (see below) | Harder, lossy markdown | Easy | Medium |

**Child ribbon.** Hold the active Tiptap `editor` instance in a small React context, or an editor registry keyed by field. The ribbon reads it with `useEditorState` and shows formatting controls only while a rich field has focus. In Simple mode the ribbon can also host a floating bubble menu. In Technical mode it can stay fixed.

**Plain vs rich toggle.** Keep `MarkdownTextarea` as the "plain" mode. Switching plain to rich parses markdown into JSON. Switching rich to plain serialises to markdown, and should warn and block if the doc has nodes with no markdown form (graph, embedded question). Make this a per-field setting with a default per field type: rich for lesson bodies and question stems, plain for options, match pairs and short-answer memos.

## Deciding issue 4: read-only rendering on student pages

- Goal: student pages are RSC, ship no editor bundle and ideally no client markdown parser.
- **Tiptap:** `@tiptap/static-renderer` renders JSON to React or HTML on the server with no DOM ([docs](https://tiptap.dev/docs/editor/api/utilities/static-renderer)). Custom nodes get a server-safe React mapping. Interactive nodes (graph, embedded question) become client islands.
- **Plate:** `<PlateStatic>` in Server Components ([docs](https://platejs.org/docs/static)). Equally good.
- **BlockNote:** needs JSDOM on the server ([docs](https://www.blocknotejs.org/docs/features/server-processing)). Weakest here.
- Math still needs client typesetting with MathJax, unless math is rendered to SVG or HTML on the server. KaTeX `renderToString` or MathJax in Node both can. That decision belongs to the math research file. Server-side math would let us delete the client `MathJax dynamic` re-typeset workarounds in `markdown.tsx`.

## Deciding issue 5: collaboration later

All three ProseMirror/Slate/Lexical options support Yjs.

| Route | Cost | Notes |
|---|---|---|
| Hocuspocus, self-hosted | Free software, MIT ([repo](https://github.com/ueberdosis/hocuspocus)) | Needs a long-running WebSocket Node server. Guess: Vercel functions do not suit this, so it needs a separate host (Fly, Railway, a VM). **Input for Agent A.** |
| Tiptap Cloud | Start $49/mo annual or $59/mo monthly, 500 cloud docs, 2 dev licences. Team $149/$179, 5,000 docs. Business $999/$1,199, 50,000 docs ([pricing](https://tiptap.dev/pricing)) | Includes collaboration, comments, markdown/DOCX conversion, history. Doc caps matter: every lesson and question is a doc. **Input for Agent A.** |
| Liveblocks | Free tier: 500 monthly active rooms, 10 connections per room. Pro $25/mo annual or $30 monthly, then metered (for example $0.002 per collaboration minute) ([pricing](https://liveblocks.io/pricing)) | Has Tiptap and Lexical integrations (unverified on the pricing page). **Input for Agent A.** |
| BlockNote | Collaboration is in the free tier ([pricing](https://www.blocknotejs.org/pricing)) | Still needs a Yjs provider (Hocuspocus, Liveblocks, etc.) |

Tutoring content is mostly single-author. Guess: real-time co-editing is a "later, maybe" need. Storing JSON now keeps the Yjs path open, because Yjs documents convert to and from ProseMirror JSON.

## Deciding issue 6: accessibility

- All of these editors use `contenteditable`. Screen reader support depends heavily on the UI we build around it.
- Tiptap says plainly that accessibility is our job. Add roles `textbox`, `toolbar`, `menu` and `menuitem`, make everything keyboard-reachable (their demo uses `Alt+F10` to reach the toolbar), avoid keyboard traps, and work around a VoiceOver issue where block boundaries get joined ([accessibility guide](https://tiptap.dev/docs/guides/accessibility)).
- Lexical claims built-in accessibility and WCAG compliance ([repo](https://github.com/facebook/lexical)). That is a self-claim (unverified).
- What we must do regardless: give each editor an `aria-label` tied to its field label, make the ribbon a proper `role="toolbar"` with roving tabindex (Radix Toolbar does this), make drag handles keyboard-operable (move-block-up/down shortcuts plus block menu items, because drag is mouse-only), and give math nodes an accessible label (the TeX source or MathML). The student-facing read-only output is plain semantic HTML, which is the bigger accessibility win for minors using assistive tech.

## What changes in this codebase

- New: `src/components/rich-editor/` (Tiptap editor, extensions, node views, slash menu), `src/lib/content/` (markdown<->JSON conversion reusing `tex-delimiters.ts`, static renderer mapping).
- Changed: the 7 files using `MarkdownTextarea` / `PreviewRenderButton` gain the plain/rich toggle. The preview modal becomes unnecessary for rich fields, since the editor is WYSIWYG.
- Changed: `src/app/components/markdown.tsx` stays as the legacy and plain-field renderer. A new server `RichContent` component renders JSON.
- Schema: new nullable `Json` columns beside each rich string column (owner approval needed for `db push`).
- Dependencies (not installed): `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/extension-mathematics` (+ `katex`, or a custom MathJax node view), `@tiptap/extension-drag-handle-react`, `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-file-handler`, `@tiptap/static-renderer`.

## Recommendation

**Pick: Tiptap 3, storing Tiptap JSON as the source of truth with derived markdown alongside.**

- MIT core, and the extensions we need (math, drag handle, file handler, markdown, static renderer) are free.
- Headless, so the toolbar can live in our child ribbon and the UI is ours (shadcn, Simple/Technical modes).
- Server-side static rendering suits RSC student pages.
- Biggest community (39.1k stars), React 17 to 19 support, so the React 19 upgrade is not blocked.
- A free, self-hostable Yjs server (Hocuspocus), with a paid cloud as an option.
- Cost: we build the slash menu, block menu and node views ourselves (Novel and the Tiptap Simple Editor are references). `@tiptap/markdown` is an "early release", so we need fixture tests.

**Fallback: Plate.** Choose it if we decide markdown must remain the only stored format, or if Tiptap's markdown handling of our TeX content fails the fixture tests. Plate's remark-based markdown with `remark-math` is the most faithful round-trip, and it has an RSC static renderer and shadcn-native components. Costs: frequent breaking majors (v53) and a heavier core.

## Open questions for the owner

1. Do you accept JSON as the stored format, with markdown derived? Or must markdown stay canonical, which points to Plate and invented syntax for new blocks?
2. Which math engine should be canonical, KaTeX or MathJax? The editor and the student pages must match. This depends on the math research file.
3. Should the plain/rich toggle be per field instance (the tutor chooses) or fixed per field type?
4. Is real-time co-editing a real need in the next 12 months? If not, skip collaboration infrastructure entirely for now.
5. Should lesson bodies get a dedicated column? Today lesson content lives in `Lesson.description`, which looks overloaded.
6. Do you approve a bulk markdown-to-JSON backfill, run first on test accounts only, or only lazy conversion on edit?

## Sources

- https://tiptap.dev/pricing (checked 2026-11-16)
- https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable (checked 2026-11-16)
- https://5637469d.hackernews-40s.pages.dev/item/44202103 (checked 2026-11-16)
- https://tiptap.dev/docs/editor/markdown (checked 2026-11-16)
- https://tiptap.dev/docs/editor/markdown/getting-started/installation (checked 2026-11-16)
- https://tiptap.dev/docs/editor/extensions/nodes/mathematics (checked 2026-11-16)
- https://tiptap.dev/docs/editor/getting-started/install/nextjs (checked 2026-11-16)
- https://tiptap.dev/docs/editor/api/utilities/static-renderer (checked 2026-11-16)
- https://tiptap.dev/docs/editor/extensions/functionality/drag-handle-react (checked 2026-11-16)
- https://tiptap.dev/docs/ui-components/templates/notion-like-editor (checked 2026-11-16)
- https://tiptap.dev/docs/guides/accessibility (checked 2026-11-16)
- https://github.com/ueberdosis/tiptap (checked 2026-11-16)
- https://github.com/ueberdosis/hocuspocus (checked 2026-11-16)
- https://unpkg.com/@tiptap/react/package.json (checked 2026-11-16)
- https://unpkg.com/@tiptap/markdown/package.json (checked 2026-11-16)
- https://unpkg.com/@tiptap/extension-mathematics/package.json (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@tiptap/core (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@tiptap/react (checked 2026-11-16)
- https://www.blocknotejs.org/pricing (checked 2026-11-16)
- https://github.com/TypeCellOS/BlockNote (checked 2026-11-16)
- https://github.com/TypeCellOS/BlockNote/releases (checked 2026-11-16)
- https://www.github.com/TypeCellOS/BlockNote/releases (checked 2026-11-16)
- https://www.blocknotejs.org/docs/foundations/supported-formats (checked 2026-11-16)
- https://www.blocknotejs.org/docs/getting-started/nextjs (checked 2026-11-16)
- https://www.blocknotejs.org/docs/features/server-processing (checked 2026-11-16)
- https://www.blocknotejs.org/docs/features/blocks/math (checked 2026-11-16)
- https://www.blocknotejs.org/docs/react/components/formatting-toolbar (checked 2026-11-16)
- https://www.blocknotejs.org/docs/advanced/shadcn (checked 2026-11-16)
- https://unpkg.com/@blocknote/react/package.json (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@blocknote/core (checked 2026-11-16)
- https://github.com/facebook/lexical (checked 2026-11-16)
- https://github.com/facebook/lexical/releases (checked 2026-11-16)
- https://lexical.dev/docs/packages/lexical-markdown (checked 2026-11-16)
- https://unpkg.com/@lexical/react/package.json (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=lexical (checked 2026-11-16)
- https://github.com/udecode/plate (checked 2026-11-16)
- https://platejs.org/docs/markdown (checked 2026-11-16)
- https://next.platejs.org/docs/equation (checked 2026-11-16)
- https://platejs.org/docs/static (checked 2026-11-16)
- https://platejs.org/docs/installation/rsc (checked 2026-11-16)
- https://pro.platejs.org/ (checked 2026-11-16)
- https://unpkg.com/platejs/package.json (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=platejs (checked 2026-11-16)
- https://github.com/steven-tey/novel (checked 2026-11-16)
- https://unpkg.com/novel/package.json (checked 2026-11-16)
- https://registry.npmjs.org/novel (checked 2026-11-16)
- https://github.com/Milkdown/milkdown (checked 2026-11-16)
- https://liveblocks.io/pricing (checked 2026-11-16)
