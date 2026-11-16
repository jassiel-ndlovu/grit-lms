# Contract: rich content and the editor

Owner: Agent B. Reader: Agent A. Status: **Draft 2, 2026-11-16.** A asks for changes in `docs/revamp/a/HANDOFF.md` or an issue labelled `needs-b`; B edits this file in its own pull request.

**Answer first.** Rich text in Nexa is a Tiptap document stored as JSON, inside a small versioned envelope, in a nullable `Json` column. The old string column stays and holds a markdown copy that is regenerated on every save, for search, AI marking, export and older screens. Maths is TeX in node attributes, rendered by MathJax on every page (version 4 with `REVAMP_UI`, version 3 until then; one version per app), never KaTeX. One extension list defines the format; the editor, the converter, the validator and the renderers all build from it. A stores and renders rich content (messages, email templates) with B's functions and never parses the JSON by hand. A owns the email renderer, `renderEmailHtml`.

Changes in Draft 2:
- The components have shipped. Their real props are listed under "Components".
- `RichEditor` hands back the envelope only. The server derives the markdown.
- Email HTML is A's `renderEmailHtml`; B's planned `renderContentHtml` is dropped.
- The Phase 0 toolbar sits above the field, not in the page ribbon.
- Empty maths writes no markdown.

Decisions behind it: [b/research/SUMMARY.md](../b/research/SUMMARY.md), owner decisions 1, 2 and 6 (2026-11-16); research files [01](../b/research/01-block-editors.md), [02](../b/research/02-math-input-rendering.md) and the maths audit [13](../b/research/13-math-audit.md).

## Stored format

```json
{
  "schemaVersion": 1,
  "doc": { "type": "doc", "content": [ { "type": "paragraph", "content": [ ... ] } ] }
}
```

- **Column pair.** For a field `x`, the JSON goes in `xJson Json?` beside the existing `x String`. On every save, both are written together: the envelope and `docToMarkdown(doc)`.
- **Reading.** Use `readStoredContent(row.xJson)`. When it returns null (no JSON yet, or a version this build does not know), show the markdown column with today's renderer.
- **Schema version.** `CONTENT_SCHEMA_VERSION` is 1. A node change bumps it, and `readStoredContent` gains an upgrade step. Rows are never rewritten in bulk without the owner's approval.
- **Columns need the owner.** Each `Json` column is added in the PR that moves its field to the editor, with `prisma db push` approved by the owner first (AGENTS.md section 4). No column exists yet.
- **Plain fields stay plain.** Options, match pairs, reorder items and short answers stay markdown strings: they are short and need no blocks.

## The node set (version 1)

| Node or mark | Attributes | Markdown form |
| --- | --- | --- |
| `paragraph`, `heading` (levels 1 to 6), `blockquote`, `bulletList`, `orderedList`, `listItem`, `codeBlock`, `horizontalRule`, `hardBreak` | StarterKit defaults | CommonMark |
| `bold`, `italic`, `strike`, `code`, `underline`, `link` | `link`: `href`, `title` | CommonMark; underline as `<u>…</u>` |
| `image` (a block) | `src`, `alt`, `title`, `width` (`"50%"` or `"320px"`) | `![alt [50%]](src)`, today's width convention |
| `table`, `tableRow`, `tableHeader`, `tableCell` | Tiptap defaults | GFM table |
| `inlineMath` | `latex`, `display` (true for a `$$…$$` written mid-line) | `$…$`, or `$$…$$` when `display` |
| `blockMath` | `latex` | `$$` on its own line, the TeX, `$$` on its own line |

- **Empty maths.** A maths node with blank TeX writes nothing to markdown. `$$` would read back as display maths. The editor removes empty maths nodes when you leave them.
- **Importing markdown.** `\(…\)` and `\[…\]` are rewritten to dollars first. A compact `\[26\]` stays text, the mark-allocation rule in `src/lib/tex-delimiters.ts`. Maths inside code stays code. A literal `\$` stays a dollar.
- **Images in a line.** An image mid-line ("See ![icon](…) here") becomes its own block between the two halves of the line.
- **Planned nodes, each in its own version bump:**
  - `graph` (spec JSON, Mafs; service `graphing`)
  - `embeddedQuestion` (only `{ questionId }`, never a copy of the question)
  - `callout`
  - `fileAttachment` (Blob URL)
- **Markdown for planned nodes.** They have no markdown form. The derived markdown shows a one-line placeholder, such as `[Graph: y = x^2]`, so search and AI marking still see something.

## Functions (in `src/lib/content/`, server-safe, no React)

| Export | File | What it does |
| --- | --- | --- |
| `contentExtensions()` | `extensions.ts` | The extension list that defines the format |
| `markdownToDoc(markdown)` | `markdown.ts` | Today's markdown and TeX to a document |
| `docToMarkdown(doc)` | `markdown.ts` | The derived markdown copy |
| `validateDoc(json)` | `schema.ts` | The document as the schema reads it, or null: unknown nodes, marks or nesting, or over 512 KB. Unknown attributes are dropped |
| `toStoredContent(doc)`, `readStoredContent(json)`, `CONTENT_SCHEMA_VERSION`, `StoredContent` | `value.ts` | The envelope |

`scripts/check-rich-content.ts` checks round trips and validation against fixtures in the shapes the maths audit found.

## Rules for code that saves or shows rich content (both agents)

1. **Validate on the server.** Every server action that saves rich content runs `validateDoc` on the incoming document and refuses null. The JSON comes from the browser.
2. **Save both columns in one write:** `toStoredContent(doc)` and `docToMarkdown(doc)`. Never save one without the other. The server derives the markdown from the validated document; it never takes markdown from the browser.
3. **Read the JSON first.** Fall back to the markdown column when `readStoredContent` returns null.
4. **Do not parse or edit the JSON by hand.** To change content in code (an import, a copy), go through `markdownToDoc` or the planned editor commands.
5. **Copies keep the JSON as is.** A copied test or lesson (owner decision 8) copies `xJson` and `x` unchanged. An `embeddedQuestion` points to the copied question's new id, which the copy step remaps.
6. **Search, AI marking and exports read the markdown column.** AI marking also goes through A's redaction step first (A's HANDOFF).

## Components

| Component | File | Runs on | Purpose |
| --- | --- | --- | --- |
| `<RichContent value markdown className? />` | `src/components/content/rich-content.tsx` | Server | Read-only view. Renders the JSON with `@tiptap/static-renderer`, or the markdown with `LessonMarkdown` when there is no valid JSON. Needs a `MathProvider` above it |
| `<RichEditor … />` | `src/components/editor/rich-editor.tsx` | Client | The editor (props below). Needs a `MathProvider` above it |
| `renderEmailHtml` | A's (messaging, design 05) | Server | HTML for emails. **Owned by A.** Rules below |

The dashboard layout mounts the `MathProvider`. Previews: `/design-system/content` and `/design-system/editor`.

### `RichEditor` props

| Prop | Type | Meaning |
| --- | --- | --- |
| `label` | `string` | Required. The accessible name, e.g. "Lesson body" |
| `value` | `unknown` | The stored `xJson` value |
| `fallbackMarkdown` | `string \| null` | The markdown column, converted when `value` has no usable JSON (lazy conversion) |
| `onChange` | `(value: StoredContent) => void` | The envelope after each change. No markdown: the server derives it (rule 2) |
| `name` | `string` | Adds a hidden input holding the envelope as JSON, for forms that post to a server action |
| `features` | `Partial<EditorFeatures>` | Hides commands (below). Never changes the schema, so any stored document loads |
| `placeholder`, `editable`, `className` | | As named |

In the editor:
- The formatting toolbar sits above the field: marks, block commands, undo and redo. It is one `role="toolbar"` tab stop. It is not part of the page's `RibbonToolbar`; that stays for page commands (navigation.md rule 6).
- A slash menu (`/`) offers the same block commands.
- Maths: `$x^2$` after a space becomes inline maths, and `$$` then space on an empty line makes a block. A TeX box shows under a selected maths node, with MathJax output above it.
- No bubble menu or drag handle in Phase 0.

`features` today: `math`, `tables`, `headings`. All default to on. Planned:
- `mathInput`: MathLive, when `hasService(viewer, courseId, "math-input")`.
- `graph`: when `hasService(…, "graphing")`. Both services are on Plus per services.md.
- `images`: the `BlobKind` to upload with.

Content made with a Plus service still renders for every reader, whatever their tier.

### For A

- **Messages and announcements.** Use `<RichEditor features={{ tables: false, headings: false }} />` (images once that feature exists). Validate on the server and store the envelope plus the derived copy (rules 1 and 2). Show it with `<RichContent>`. `bodyText` can be the markdown copy or plain text, A's choice.
- **Email (`renderEmailHtml`).**
  - Build it from `contentExtensions()` with `@tiptap/static-renderer`, and validate the stored body with `validateDoc` first.
  - Send maths as monospace TeX text: email clients run no MathJax, and Gmail drops inline SVG.
  - Cap images at 100% width.
  - Use `docToMarkdown(doc)` for the plain-text part.

## Not in version 1

- Real-time co-editing (Hocuspocus or Tiptap Cloud). That is a later owner decision.
- Converting rows in bulk. Conversion is lazy: a field converts when a tutor first opens it in the editor and saves.
- Server-side maths to SVG for read-only pages. It's possible with MathJax 4 in Node; decide after the renderer ships.
