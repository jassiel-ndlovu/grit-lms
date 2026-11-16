# Test designer: continuous question list, number strip, virtualisation

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Keep one continuous scrolling list for both authoring and sitting, with a sticky strip of question-number chips that show state (empty, done, error, flagged). Moodle, Inspera and TAO all use this navigator pattern.
- Autosave to the server, not only to localStorage. Add a version number on `Test` so two tabs (or two tutors) cannot silently overwrite each other.
- Do not virtualise yet. Typical tutor tests (10-60 questions) are fine as plain DOM with lazy MathJax. Plan for virtualisation only for the question bank list and for tests above roughly 150 rendered questions (Guess).
- If virtualisation is needed later, use TanStack Virtual (MIT, headless, about 64 kB unpacked) with dnd-kit's vertical list strategy. It works with React 18 and 19.
- Question bank and randomised tests are a Plus feature. Model them as "bank item copied into test with a source link", not live linking (see 07-reusable-content.md).

## 1. What the code does today

Sources: `src/features/assessments/components/test-form.tsx`, `test-question-editor.tsx`, `test-runner.tsx`, `src/components/tree-reorder-dialog.tsx`, `src/lib/use-local-draft.ts`, `src/features/assessments/actions.ts`.

### Authoring (`TestForm` + `TestQuestionEditor`)

- One long page. The form holds the whole question tree in React state. Each top-level question renders a `TestQuestionEditor` card in a column. Sub-questions render recursively inside their parent card.
- A "jump list" of label chips (`1`, `1.a`, ...) sits above the list. Chips scroll to the card (`scroll-mt-24` anchors). The chips do not show state; they are plain links.
- Reorder has two paths. Up/down chevron buttons on each card, and a `TreeReorderDialog` (dnd-kit `DndContext` + `@dnd-kit/sortable`) that edits the tree as labelled rows. Horizontal drag sets depth. It has multi-select, indent/outdent buttons, undo, and nothing applies until "Apply".
- Type-specific fields per question: options and correct choice(s), true/false, text answer, model answer (essay/code), file or markdown memo (file upload), match pairs, reorder items, blank count, and NONE (context-only parent).
- Attachments: drop or pick a file, upload to Vercel Blob at `tests/{testId}/questions/{questionId}/...`, and append a markdown link to the question text.
- Saving: `useLocalDraft` mirrors the form to localStorage on a short debounce, on "Save progress" and on `pagehide`. The server only hears about the test when the tutor presses Save draft, Publish or Preview. On load, a newer local draft triggers a restore prompt.
- Server save (`actions.ts`) walks the tree. It updates rows whose id belongs to this test, creates the rest, then deletes every question not in the payload. Deleting cascades `QuestionGrade` and `UploadedFile`. There is no version check, so the last save wins.
- Validation is minimal and late: toasts for missing title, course and due date. Per-question problems come back as one generic message ("check every question has text").

### Sitting (`TestRunner`)

- One top-level question at a time with Previous / Next buttons. Every navigation calls `saveNow()` first.
- A sticky sidebar lists label chips. Each top-level row has its own chip plus a chip per answerable part. Chips show `active`, `done` and `partial`. A counter shows answered / answerable.
- Draft answers autosave through `saveTestAnswersDraft` on a debounce of about 3 seconds, with a max-wait ceiling, and flush on `visibilitychange`. Failed saves show "Not saved" with the error in a tooltip. An online/offline indicator sits beside the timer.
- The timer auto-submits at zero. Manual submit asks for confirmation.
- No flag-for-review state. No "unanswered" summary page before submit beyond the confirm dialog.
- Preview mode reuses the runner: nothing autosaves, and the tutor's answers become the answer key.

### Gaps against the revamp

| Area | Today | Gap |
| --- | --- | --- |
| Navigator in editor | Plain jump chips | No state (empty / error / incomplete memo) |
| Navigator in runner | done / partial / active | No flag, no "error" (failed save per question) |
| Layout in runner | One question per screen | No continuous scroll option |
| Autosave in editor | localStorage only | No server draft, so a second device sees nothing |
| Conflicts | Last write wins | No version or etag |
| Validation | Toast at save time | No inline per-question errors |
| Keyboard | Browser defaults | No shortcuts for next / prev / flag / add question |

## 2. How others do it

### Authoring tools

| Product | List shape | Navigator | Reorder | Sections / pages | Notes |
| --- | --- | --- | --- | --- | --- |
| Google Forms | One continuous list of cards | None in the editor (unverified) | Drag handle on each card (unverified) | Sections split the respondent view | Respondent drafts autosave for 30 days when signed in ([Google help](https://support.google.com/docs/answer/10952360)) |
| Microsoft Forms | One continuous list | None | Up/down arrows and drag (unverified) | Sections via "+ Add new" | Shuffle is disabled once a form has sections ([Microsoft support](https://support.microsoft.com/en-us/forms/add-sections-to-your-survey-or-questionnaire)) |
| Moodle quiz (edit page) | One list of slots with page breaks | Section headings show in the quiz navigation block | Drag with the move icon | Page breaks, sections, per-section shuffle, Repaginate | Add from bank or add a random question by category ([Moodle docs: Building Quiz](https://docs.moodle.org/501/en/Building_Quiz)) |
| Canvas New Quizzes | Builder list | Not verified | Not verified | "One question at a time" with optional backtracking ([BC guide](https://cteresources.bc.edu/documentation/assignments-and-grades/get-started-with-new-quizzes/new-quizzes-support-for-academic-integrity/)) | Items come from shared item banks ([Canvas guide](https://community.canvaslms.com/docs/DOC-17609)) |
| Blackboard Ultra | Test canvas | Not verified | Not verified | Question pools (random blocks) | "Reuse questions" copies questions from other tests and banks ([Blackboard help](https://help.blackboard.com/Learn/Instructor/Ultra/Tests_Pools_Surveys/ULTRA_Reuse_Questions)) |
| Typeform | Left panel list of questions, one canvas per question | Left panel acts as the navigator | Drag in the left panel | Logic jumps | Users complain the list cannot show full question text while reordering ([Typeform community](https://community.typeform.com/build-your-typeform-7/easy-way-to-reorder-questions-17534)); logic jumps cannot be dragged ([community](https://community.typeform.com/build-your-typeform-7/reorder-the-logic-on-a-question-8795)) |

Takeaways:

- Every builder uses a single scroll of cards. None of the general form builders give tutors a state-aware number strip. Moodle's edit page comes closest with sections.
- The Typeform complaint is useful. A compact navigator must still let the tutor see enough of each question to reorder confidently. Our `TreeReorderDialog` already shows the label with full text in a tooltip; a one-line plain-text snippet would be better (the form already has `plainSnippet()`).

### Exam runners

| Runner | Navigator | States shown | Flag | Notes |
| --- | --- | --- | --- | --- |
| Moodle quiz | Quiz navigation block of numbered boxes | Answered is half grey, unanswered white; after review green / orange / red for correct / partial / wrong ([Moodle 3.1 docs](https://docs.moodle.org/31/en/Using_Quiz)) | Red triangle at top right of the box ([Moodle 3.1 docs](https://docs.moodle.org/31/en/Using_Quiz)) | "Finish attempt" leads to a summary page that lists unanswered questions ([Moodle 3.1 docs](https://docs.moodle.org/31/en/Using_Quiz)). Flags are set by the student; teachers can see but not change them ([Moodle dev docs](https://docs.moodle.org/dev/Flagging_questions_during_a_quiz_attempt)). Screen readers get offscreen text for current and flagged ([tracker](https://tracker-old.moodle.org/browse/MDL-71304), issue match unverified) |
| Inspera | Navigation bar along the bottom, plus table of contents | Answered state per question | Clickable flag on each question, mirrored in the bar ([Inspera support](https://support.inspera.com/hc/en-us/articles/360028703912)) | Flagged questions also appear on the deliver page ([UiO guide](https://uio.no/english/for-employees/support/studies/inspera/author/design.html)). Flagging is discouraged with one-way navigation ([Inspera](https://support.inspera.com/hc/en-us/articles/35448022443165-One-Way-Navigation-compatibility-with-other-Inspera-features)) |
| TAO | Optional review panel on the left | Progress per test part | Flags; click a flag to return ([TAO review panel](https://userguide.taotesting.com/user-documentation/latest/public/review-panel)) | Overview panel for non-linear tests ([TAO navigation](https://userguide.taotesting.com/user-documentation/latest/public/test-navigation-for-test-takers)) |
| Canvas New Quizzes | Not verified | Not verified | No official flag docs found; community says instructors cannot see student flags ([community](https://community.canvaslms.com/t5/New-Quizzes-Discussion/Instructor-Access-to-Students-Flagging-Questions-on-New-Quizzes/td-p/627622)) | One question at a time with optional backtracking |

Takeaways:

- Flag-for-review is standard in exam runners. It belongs to the student. Showing it to the tutor in grading is optional.
- A pre-submit summary ("3 unanswered, 2 flagged") is standard. Our confirm dialog should list them with links.
- One-way (lockdown) tests should hide flags. This ties to the Pro "lockdown tests" tier.

## 3. Proposed question states

One state model, shared by the editor strip and the runner strip. A chip can carry one main state plus a flag badge.

| State | Editor meaning | Runner meaning | Visual (both modes) |
| --- | --- | --- | --- |
| empty | No question text yet | Not answered | Outline only |
| partial | Text but no answer key / memo (for auto-marked types) | Some parts answered | Half fill |
| done | Text, points, and key where needed | All parts answered | Solid fill |
| error | Fails validation (see 5) | Last save of this answer failed | Red border + icon (not colour alone) |
| flagged | Tutor "come back to this" note | Student flag | Corner triangle, like Moodle |
| current | Card in view | Card in view | Ring |

Accessibility: each chip is a button with an `aria-label` that spells out state ("Question 4, answered, flagged"), as Moodle does with offscreen text. Do not rely on colour.

## 4. Autosave and conflict handling

Patterns seen:

- Google Forms respondent drafts: autosave when signed in, kept 30 days from last edit, off when offline, can be disabled per form ([Google help](https://support.google.com/docs/answer/10952360), [Workspace update](https://workspaceupdates.googleblog.com/2021/08/your-progress-is-automatically-saved-as.html)). If the owner deletes a question, that draft answer goes too.
- Our runner already does debounce + max-wait + flush-on-hide. That is the right shape.

Proposal for the editor:

1. Keep `useLocalDraft` as the crash net.
2. Add server autosave of the draft test every few seconds after idle, using the existing diff-upsert. Only for unpublished tests, or into a separate draft copy for published ones (published tests with submissions must not change under students).
3. Add `Test.version Int` (or `updatedAt` check). The client sends the version it loaded. The action rejects a stale version with "This test was changed in another tab. Reload or keep yours". Optimistic locking is cheap in Prisma: `updateMany({ where: { id, version }, data: { version: { increment: 1 } } })` and check the count. Schema changes use `db push` here, so this is a one-column add (ask the owner first).
4. Warn before saving a deletion of a question that has student answers. Today the sweep silently cascades `QuestionGrade` and `UploadedFile`.

For the runner, add per-question save status so a failed save marks the chip as error, not only the header.

## 5. Validation

Inline, per card, and summarised in the strip:

- Missing question text (not for NONE).
- Points missing or zero on an answerable leaf.
- MCQ / multi-select with fewer than two options or no correct option.
- Matching with an empty side; reorder with fewer than two items; fill-in-the-blank where `blankCount` does not match the number of answers.
- NUMERIC with a non-numeric key.
- Parent points not matching the sum of children (warning, not error).
- Unbalanced TeX delimiters (warning). `src/lib/tex-delimiters.ts` already parses delimiters.

Run these on the client as a pure function over the `EditorQuestion` tree, and reuse it in the server schema so the error names a question label instead of "check every question has text". Publish is blocked by errors; Save draft is not.

## 6. Drag reorder and keyboard

- Keep the dialog-based tree reorder for deep restructuring. It already handles depth, multi-select and undo.
- In the main list, add a drag handle per top-level card for quick moves within siblings. dnd-kit's `verticalListSortingStrategy` supports this. The docs recommend a `DragOverlay` for scrollable lists and warn not to render the same `useSortable` component inside the overlay ([dnd-kit sortable docs](https://dndkit.com/presets/sortable)).
- Also allow dragging chips in the number strip (compact reorder), since cards with MathJax and images are tall.
- dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates` gives Space to lift, arrows to move, Space to drop (key mapping unverified; see [dnd-kit sortable docs](https://dndkit.com/presets/sortable)).

Suggested shortcuts (Guess, to test with tutors):

| Keys | Editor | Runner |
| --- | --- | --- |
| Alt+Down / Alt+Up | Next / previous question | Next / previous question |
| Alt+N | Add question after current | - |
| Alt+F | Toggle tutor flag | Toggle flag |
| Ctrl/Cmd+S | Save draft now | Save now |
| Ctrl/Cmd+Enter | Preview current question | - |

Avoid single-letter shortcuts; users type into markdown fields.

## 7. Virtualised lists

### Options

| Library | Version (npm latest) | Licence | Unpacked size | React 19 peer | Dynamic heights | Scroll to index | Sticky items |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [@tanstack/react-virtual](https://www.npmjs.com/package/@tanstack/react-virtual) | 3.14.26 | MIT | ~64 kB | Yes (`^18 \|\| ^19`) | `measureElement` ref + `data-index`, ResizeObserver ([API](https://tanstack.com/virtual/latest/docs/api/virtualizer)) | `scrollToIndex(i, { align, behavior })`, keeps correcting as items get measured; `cancelScroll` on user input ([API](https://tanstack.com/virtual/latest/docs/api/virtualizer)) | `rangeExtractor` keeps chosen indexes rendered ([API](https://tanstack.com/virtual/latest/docs/api/virtualizer)) |
| [react-virtuoso](https://www.npmjs.com/package/react-virtuoso) | 4.18.23 | MIT (Message List component is commercial) ([virtuoso.dev](https://virtuoso.dev/)) | ~250 kB | Yes (`>=16`) | Automatic, no manual measuring ([virtuoso.dev](https://virtuoso.dev/)) | `scrollToIndex` on `VirtuosoHandle` | `GroupedVirtuoso` sticky group headers |
| [react-window](https://github.com/bvaughn/react-window) | 2.5.3 | MIT | ~428 kB | Yes (`^18 \|\| ^19`) | `useDynamicRowHeight` cache, ResizeObserver; docs note dynamic heights cost more | `scrollToRow`; "content that resizes later may require another scrollToRow call" ([README](https://github.com/bvaughn/react-window)) | Not built in (unverified) |

Versions, licences, sizes and peer ranges come from the npm registry `latest` metadata, checked 2026-11-16 ([TanStack](https://registry.npmjs.org/@tanstack/react-virtual/latest), [Virtuoso](https://registry.npmjs.org/react-virtuoso/latest), [react-window](https://registry.npmjs.org/react-window/latest)). Unpacked size is not bundle size; bundle sizes were not verified.

### MathJax and changing heights

- Rows change height after MathJax typesets, and again when images load. All three libraries re-measure with ResizeObserver, so the list self-corrects. The risk is scroll jumps above the viewport.
- TanStack advises a large but realistic `estimateSize`, and translating the whole rendered block by the first item's start rather than absolutely positioning each item ([API](https://tanstack.com/virtual/latest/docs/api/virtualizer)). During smooth scroll it measures only items near the target to avoid shifting.
- MathJax: typeset only the new container with `typesetPromise([node])`, call `typesetClear([node])` before replacing content, and avoid parallel async typeset calls ([MathJax docs](https://docs.mathjax.org/en/latest/web/typeset.html); page is for v4, the repo uses v3 via better-react-mathjax, same API names). Virtualised rows mount and unmount often, so each mount typesets again. Cache rendered SVG per question text (Guess: a `Map<text, html>`) to avoid repeat cost.
- Cheaper alternative before virtualising: `content-visibility: auto` with `contain-intrinsic-size` on each card, plus typesetting only cards near the viewport (IntersectionObserver). This keeps every card in the DOM, so find-in-page, anchors and dnd-kit keep working. (Browser support not checked here.)

### dnd-kit with virtualisation

- `verticalListSortingStrategy` and `horizontalListSortingStrategy` support virtualised lists; the default `rectSortingStrategy` does not ([dnd-kit sortable docs](https://dndkit.com/presets/sortable)).
- Use a `DragOverlay`, because the source row can scroll out and unmount while dragging.
- The new `@dnd-kit/react` (0.5.3, pre-1.0, MIT, React 18/19 peer) has a virtualised list example with TanStack Virtual ([npm](https://www.npmjs.com/package/@dnd-kit/react); example on a [docs mirror](https://mintlify.com/clauderic/dnd-kit/examples/virtualized-lists), unverified against the official site). The repo uses the legacy `@dnd-kit/core` 6.3.1. Do not migrate for this alone.
- Tree drag (depth by horizontal offset) inside a virtualised list is harder. Keep tree reordering in the dialog, which shows short rows and does not need virtualisation.

### When is virtualisation needed?

- Lighthouse warns above about 800 body nodes and errors above about 1,400 ([Chrome docs](https://developer.chrome.com/docs/lighthouse/performance/dom-size)). That is a hint, not a hard limit.
- Guess: an editor card with toolbar, markdown textarea, preview, type fields and four options is about 80-150 DOM nodes, plus MathJax SVG. So 10 questions already passes the Lighthouse warning. Users will not feel that. The real cost is MathJax typesetting and React re-rendering the whole tree on every keystroke, because `TestForm` holds all questions in one state object.
- Guess: tests in this product have 5-40 top-level questions, often with sub-parts (60-150 nodes in the tree). Fix re-render cost first (memoised cards keyed by `clientId`, per-card state, `useDeferredValue` for previews). Then measure on a low-end Android phone, since many students are on phones.
- Guess: virtualise when a list renders more than about 150-200 heavy cards, or when profiling shows >100 ms interactions. In this product that is the question bank browser (hundreds to thousands of items), not a single test.

## 8. Question banks and randomised tests (brief)

| Product | Model | Versioning | Random draw |
| --- | --- | --- | --- |
| Moodle 5.x | Quiz-only bank plus course shared banks, reusable across courses ([Moodle docs](https://docs.moodle.org/en/Question_bank), [upgrade notes](https://docs.moodle.org/en/Question_banks_in_upgraded_sites)) | A quiz slot uses "Always latest" or pins a specific version ([Moodle docs](https://docs.moodle.org/en/Question_bank)) | "Add a random question" by category and tags ([Building Quiz](https://docs.moodle.org/501/en/Building_Quiz)) |
| Canvas New Quizzes | Item banks owned by a user, shared with users, courses or the account ([Canvas guide](https://community.canvaslms.com/docs/DOC-17609)) | Bank edits show in every quiz that uses the item; once students answered, only "edit a copy" is allowed ([Canvas guide](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-edit-an-item-bank-item-in-New-Quizzes/ta-p/703)) | Random draw from a bank (unverified detail) |
| Blackboard Ultra | Question banks (old pools) and question pools (random blocks) ([SIUE KB](https://kb.siue.edu/155696)) | Reused questions are copies ([Blackboard help](https://help.blackboard.com/Learn/Instructor/Ultra/Tests_Pools_Surveys/ULTRA_Reuse_Questions)) | Pools draw N at random |

Lessons:

- Canvas's live linking causes confusion: edits propagate across courses, and a community idea asks to copy instead of link ([Canvas idea](https://community.canvaslms.com/t5/Canvas-Ideas/New-Quizzes-Offer-option-to-copy-rather-than-link-to-questions/idi-p/545797)). Moodle solves the same problem with explicit versions.
- For Nexa: bank items are their own rows. Adding to a test copies the item into `TestQuestion` with `sourceItemId` and `sourceVersion`. The editor can show "bank has a newer version" and offer update. This never changes a test students already sat.
- Randomised tests: a "random slot" stores a bank filter and count. At attempt start, draw with a seed stored on `TestSubmission` (the repo already seeds choice shuffling per attempt in `lib/shuffle.ts`). Store the drawn question ids on the submission so grading and review are stable. Total points must be equal per slot, or the draw must be stratified by points.

## Recommendation

Pick: one continuous, non-virtualised question list in both editor and runner, with a sticky number strip that shows empty / partial / done / error / flagged, server autosave with a `Test.version` optimistic lock, inline validation shared with the server schema, and dnd-kit sortable on top-level cards and on the strip. Keep the runner's one-question mode as an option for lockdown tests. Reasons: it matches what tutors know from Google Forms and Moodle, fixes real data-loss risks (cross-device drafts, silent overwrites, silent cascade deletes), and adds no dependency.

Fallback: if profiling shows long tests are slow after memoising cards, add `content-visibility: auto` plus lazy MathJax first, and only then `@tanstack/react-virtual` with `verticalListSortingStrategy` and a `DragOverlay`. Use the same library for the Plus question bank list.

## Open questions for the owner

1. Should the student runner default to continuous scroll or one question per screen? (Mobile students may prefer one per screen.)
2. Should tutors see which questions a student flagged during grading?
3. May I add `Test.version` (one column, via `db push`) for conflict detection?
4. Should editing a published test with submissions be blocked, or create a new draft version?
5. What is the largest real test you have built (number of questions and parts)? This sets the virtualisation threshold.
6. Is randomised generation part of the Plus question bank, or a separate Pro feature?

## Sources

- https://support.google.com/docs/answer/10952360 (checked 2026-11-16)
- https://workspaceupdates.googleblog.com/2021/08/your-progress-is-automatically-saved-as.html (checked 2026-11-16)
- https://support.microsoft.com/en-us/forms/add-sections-to-your-survey-or-questionnaire (checked 2026-11-16)
- https://docs.moodle.org/501/en/Building_Quiz (checked 2026-11-16)
- https://docs.moodle.org/31/en/Using_Quiz (checked 2026-11-16)
- https://docs.moodle.org/dev/Flagging_questions_during_a_quiz_attempt (checked 2026-11-16)
- https://tracker-old.moodle.org/browse/MDL-71304 (checked 2026-11-16)
- https://docs.moodle.org/en/Question_bank (checked 2026-11-16)
- https://docs.moodle.org/en/Question_banks_in_upgraded_sites (checked 2026-11-16)
- https://cteresources.bc.edu/documentation/assignments-and-grades/get-started-with-new-quizzes/new-quizzes-support-for-academic-integrity/ (checked 2026-11-16)
- https://community.canvaslms.com/docs/DOC-17609 (checked 2026-11-16)
- https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-edit-an-item-bank-item-in-New-Quizzes/ta-p/703 (checked 2026-11-16)
- https://community.canvaslms.com/t5/Canvas-Ideas/New-Quizzes-Offer-option-to-copy-rather-than-link-to-questions/idi-p/545797 (checked 2026-11-16)
- https://community.canvaslms.com/t5/New-Quizzes-Discussion/Instructor-Access-to-Students-Flagging-Questions-on-New-Quizzes/td-p/627622 (checked 2026-11-16)
- https://help.blackboard.com/Learn/Instructor/Ultra/Tests_Pools_Surveys/ULTRA_Reuse_Questions (checked 2026-11-16)
- https://kb.siue.edu/155696 (checked 2026-11-16)
- https://community.typeform.com/build-your-typeform-7/easy-way-to-reorder-questions-17534 (checked 2026-11-16)
- https://community.typeform.com/build-your-typeform-7/reorder-the-logic-on-a-question-8795 (checked 2026-11-16)
- https://support.inspera.com/hc/en-us/articles/360028703912 (checked 2026-11-16)
- https://support.inspera.com/hc/en-us/articles/35448022443165-One-Way-Navigation-compatibility-with-other-Inspera-features (checked 2026-11-16)
- https://uio.no/english/for-employees/support/studies/inspera/author/design.html (checked 2026-11-16)
- https://userguide.taotesting.com/user-documentation/latest/public/review-panel (checked 2026-11-16)
- https://userguide.taotesting.com/user-documentation/latest/public/test-navigation-for-test-takers (checked 2026-11-16)
- https://tanstack.com/virtual/latest/docs/api/virtualizer (checked 2026-11-16)
- https://virtuoso.dev/ (checked 2026-11-16)
- https://github.com/bvaughn/react-window (checked 2026-11-16)
- https://registry.npmjs.org/@tanstack/react-virtual/latest (checked 2026-11-16)
- https://registry.npmjs.org/react-virtuoso/latest (checked 2026-11-16)
- https://registry.npmjs.org/react-window/latest (checked 2026-11-16)
- https://www.npmjs.com/package/@tanstack/react-virtual (checked 2026-11-16)
- https://www.npmjs.com/package/react-virtuoso (checked 2026-11-16)
- https://www.npmjs.com/package/@dnd-kit/react (checked 2026-11-16)
- https://dndkit.com/presets/sortable (checked 2026-11-16)
- https://mintlify.com/clauderic/dnd-kit/examples/virtualized-lists (checked 2026-11-16)
- https://developer.chrome.com/docs/lighthouse/performance/dom-size (checked 2026-11-16)
- https://docs.mathjax.org/en/latest/web/typeset.html (checked 2026-11-16)
