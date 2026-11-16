# Block-based reusable content: copy, link, templates

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Make reuse copy-on-use with provenance. A copy is fully independent, but remembers where it came from (`sourceId`, `sourceVersion`, `copiedAt`). The source can then say "update available" and the tutor chooses to pull it.
- Do not ship live-linked (synced) content in the first release. Canvas item banks and Notion synced blocks show the pain: edits leak into other courses, and deleting or unsyncing the original can wipe copies.
- The one linked thing worth having later is a Plus question bank item pinned by version, as Moodle does.
- Blob files are the biggest copy risk in this codebase. Lesson deletes already delete their blobs, and question images live under the source test's path. A copy must duplicate blobs, or blobs must stop being owned by one record.
- There is no team or workspace model yet (`Tutor` owns `Course` directly). Cross-tutor sharing needs that model first. Agent A owns the POPIA side of sharing.

## 1. What the schema allows today

From `prisma/schema.prisma`:

| Model | Reuse-relevant fields | Notes |
| --- | --- | --- |
| `Course` | `tutorId`, `imageUrl`, `lessonLabelScheme` | Owned by one `Tutor`. No team, no template flag. |
| `Lesson` | `courseId`, `parentId`, `order`, `type` (CONTENT / NONE), `description`, `videoUrl[]`, `attachmentUrls` (via `Attachment`) | Tree within a course. Lesson body and attachments point at Blob URLs under `courses/{courseId}/lessons/{lessonId}/...` (`src/lib/blob/paths.ts`). |
| `Attachment` | `url`, `lessonId` (cascade) | One row per file. |
| `Test` | `courseId`, `memoFileUrls[]`, `labelScheme`, `weight`, `dueDate`, `isActive`, `totalPoints` | Course-scoped. Memo files are Blob URLs. |
| `TestQuestion` | `id` is a UUID; `parentId` tree; `answer`, `matchPairs` JSON; `options`, `reorderItems` arrays | Question images are markdown links inside `question`, stored at `tests/{testId}/questions/{questionId}/...`. |
| `TestSubmission` | `answers Json` keyed by question id; `UploadedFile.questionId`; `QuestionGrade.questionId` | Student work is bound to question ids. |
| `Submission` (assignment) | `descriptionFiles[]`, `memoFileUrls[]`, `dueDate`, `lastDueDate` | Brief and memo are Blob URLs. |

What already exists for reuse:

- Test JSON export / import (`export-test-button.tsx`, `import-test-dialog.tsx`, `lib/test-io.ts`). Import creates a new test in a chosen course. This is already copy-on-use, without provenance.
- No course copy, no lesson copy, no template gallery.

Things that will bite a copy feature:

1. Blob ownership. `cleanupAttachmentBlobs` in `src/features/lessons/actions.ts` deletes a lesson's blobs when it is removed. If a copy reuses the same URLs, deleting the source lesson breaks the copy. `deleteTest` does not clean blobs today, so tests leak blobs instead; fixing that leak without fixing copies would break copied tests.
2. Blob paths encode owner ids (`tests/{testId}/questions/{questionId}/`). A copy that keeps the URL still "lives" under the source test. Upload-kind checks are role-gated by path (`BlobKind`), so a copied URL may fail validation if re-saved under a different test (unverified; check `validate` in `paths.ts`).
3. Markdown bodies contain absolute Blob URLs and internal links. A copy must rewrite URLs inside `Lesson.description`, `TestQuestion.question`, memo markdown in `answer` JSON (FILE_UPLOAD text memo), and any links to other lessons or tests.
4. IDs. `TestQuestion.id` is a UUID; others are cuids. A deep copy must mint new ids and remap `parentId`. Student answers are keyed by question id, so never copy submissions into a new test; a new test starts empty.
5. Dates. `dueDate`, `lastDueDate`, `CourseEvent.date` and recurrence copy as stale values. Moodle shifts activity dates to the new course start on restore ([Moodle restore docs](https://docs.moodle.org/501/en/Restore)); we should offer a date shift or clear dates.
6. `isActive` / published state. Canvas Commons keeps the published state of shared items, so imports can go live immediately ([Canvas guide](https://community.canvaslms.com/t5/Commons/What-types-of-sharing-options-are-available-in-Commons/ta-p/1815)). Copies should always arrive as drafts.

## 2. How others do reuse

### Copy semantics

| Product | Unit of reuse | Copy or link | Files on copy | Update from source |
| --- | --- | --- | --- | --- |
| Notion duplicate / Move to | Page or block | Copy. Moving to another workspace duplicates; the original stays ([Notion help](https://www.notion.com/help/transfer-content-to-another-account)) | Copied with the page; links, relations, permissions and page history may break ([Notion help](https://www.notion.com/help/transfer-content-to-another-account)) | None |
| Notion template (public page) | Page | Copy via a Duplicate button on the shared page ([Thomas Frank guide](https://thomasjfrank.com/how-to-move-pages-between-workspaces-in-notion/)) | Copied | None |
| Notion synced block | Block group | Link. Edit one, all update ([Notion help](https://www.notion.com/help/synced-blocks)) | Shared | Live |
| Canvas Commons | Course, module, page, quiz, file | Copy on import | Copied | Notification when the author publishes a new version; tutor accepts, and accepting overwrites local edits ([USask warning](https://teaching.usask.ca/articles/2021-05-04-warning-about-templates-canvas-commons-updates.php), [Canvas guide](https://community.canvaslms.com/docs/DOC-3837)) |
| Canvas Blueprint | Whole course | Link with locks. Locked items are overwritten on sync; unlocked items can be edited and are not overwritten ([USU guide](https://www.usu.edu/teach/help-topics/canvas/blueprint-courses)) | Synced | Manual, all-or-nothing sync to all associated courses ([QU guide](https://qilt.qu.edu/knowledge-resources-learnings-posts/blueprints-syncing-content-across-canvas-courses)) |
| Canvas New Quizzes item banks | Question | Link. Bank edits show in every quiz that uses the item ([Canvas guide](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-edit-an-item-bank-item-in-New-Quizzes/ta-p/703)) | Shared | Live, until students answer; then only "edit a copy" |
| Moodle import | Activities from another course | Copy; user data excluded by default ([TU Darmstadt FAQ](https://www.e-learning.tu-darmstadt.de/werkzeuge/moodle/moodle_faq_lehrende/artikel_details_52800.en.jsp)) | Copied | None |
| Moodle backup / restore | Whole course (.mbz) | Copy; restore into existing course can overwrite content ([TU Darmstadt FAQ](https://www.e-learning.tu-darmstadt.de/werkzeuge/moodle/moodle_faq_lehrende/artikel_details_52800.en.jsp)) | In the backup | None; dates shift to new start, user data keeps original dates ([Moodle docs](https://docs.moodle.org/501/en/Restore)) |
| Moodle question bank | Question | Link with versions: "Always latest" or a pinned version per quiz ([Moodle docs](https://docs.moodle.org/en/Question_bank)) | Shared | Explicit |
| Google Classroom reuse post | One post | Copy of the post; attachments are copied only if "Create new copies of all attachments" is ticked, else they stay linked to the same Drive files ([Google help](https://support.google.com/edu/classroom/answer/6272593)) | Optional | None |
| Blackboard Ultra copy content | Whole course or items | Copy ([Blackboard help](https://help.blackboard.com/Learn/Instructor/Ultra/Course_Content/Reuse_Content/Ultra_Copy_Content)) | Copied | None. Reused questions are copies ([Blackboard help](https://help.blackboard.com/Learn/Instructor/Ultra/Tests_Pools_Surveys/ULTRA_Reuse_Questions)) |
| Brightspace copy components | Selected components from another org unit | Copy ([D2L community](https://community.d2l.com/brightspace/kb/articles/16767-about-import-export-copy-components)) | Copied; files with the same name overwrite destination files (third-party guides, unverified on D2L docs) | None |

### Permissions and sharing scope

- Canvas Commons: share to self, account, groups, consortium, or public; licence chosen at share time ([Canvas guide](https://community.canvaslms.com/t5/Commons/What-types-of-sharing-options-are-available-in-Commons/ta-p/1815)). Only instructors can share. Some universities say exams and answer keys must not go to Commons ([same page](https://community.canvaslms.com/t5/Commons/What-types-of-sharing-options-are-available-in-Commons/ta-p/1815)).
- Canvas item banks: shared with users, courses or the account; view or edit access ([Canvas guide](https://community.canvaslms.com/docs/DOC-17609)).
- Notion synced blocks: editing a copy needs edit access to the original; people without access cannot see the content ([Notion help](https://www.notion.com/help/synced-blocks)). Admins can block moving pages to other workspaces ([Notion help](https://www.notion.com/help/transfer-content-to-another-account)).
- Brightspace: separate permissions to copy into and out of an org unit ([D2L permissions](https://community.d2l.com/brightspace/kb/articles/4818-import-export-copy-components-permissions)).
- Moodle 5.0: shared question banks rely on non-editing-teacher capabilities that upgraded sites must enable ([Moodle upgrade notes](https://docs.moodle.org/en/Question_banks_in_upgraded_sites)).

### Known pitfalls, from the field

- Accepting a Commons update silently overwrites local edits; a university team calls it hard to undo and suggests sharing a new resource instead ([USask](https://teaching.usask.ca/articles/2021-05-04-warning-about-templates-canvas-commons-updates.php)). Only the instructor who imported gets the notification ([Canvas idea](https://community.canvaslms.com/t5/Canvas-Ideas/Commons-All-teachers-on-a-course-can-see-notifications-of/idi-p/561181)).
- Canvas item banks stay linked across course copies, so an edit in one course shows in all; users ask for a copy option ([Canvas idea](https://community.canvaslms.com/t5/Canvas-Ideas/New-Quizzes-Offer-option-to-copy-rather-than-link-to-questions/idi-p/545797), [discussion](https://community.canvaslms.com/t5/New-Quizzes-Discussion/Edits-made-to-a-copy-of-a-New-Quiz-in-one-course-are-mirrored-in/m-p/611818)).
- Notion synced blocks with more than 10 copies: "Unsync all" or deleting the original removes every copy, and Undo will not restore them ([Notion help](https://www.notion.com/help/synced-blocks)).
- Notion duplication is rate-limited (50,000 blocks per hour) and locked Marketplace templates fail to duplicate across workspaces ([Notion help](https://www.notion.com/help/transfer-content-to-another-account)).
- Google Classroom: teachers argue both ways on copying attachments. Copies diverge (students keep an old syllabus); links mean one edit hits every class ([Alice Keeler](https://alicekeeler.com/2015/08/28/google-classroom-uncheck-duplicate-attachments/)). Full course copy duplicates every Drive file ([Alice Keeler](https://alicekeeler.com/2023/08/05/please-do-not-copy-your-class/)).
- Blackboard: guides warn against copying LTI and third-party links; recreate them ([Blackboard help](https://help.blackboard.com/Learn/Instructor/Ultra/Course_Content/Reuse_Content/Ultra_Copy_Content), institutional guides).
- Canvas Blueprint: first association syncs everything to all associated courses; locked files must be locked separately ([JHU](https://support.cmts.jhu.edu/hc/en-us/articles/30758133925517-Managing-Course-Content-Using-Canvas-Blueprints), [USU](https://www.usu.edu/teach/help-topics/canvas/blueprint-courses)).

## 3. Copy vs linked: what fits Nexa

| Concern | Copy-on-use + provenance | Linked / synced | Both (copy default, link for bank items) |
| --- | --- | --- | --- |
| Mental model for tutors | Simple: "it's mine now" | Surprising: edits elsewhere change my course | Simple default, opt-in power |
| Safety for students | Tests never change under students | Must freeze once answered (Canvas "edit a copy") | Freeze by pinning versions |
| Files / blobs | Must duplicate or reference-count | Shared, but delete is dangerous | Mixed |
| Schema cost | 3 nullable columns per model | Join tables, version tables, lock flags | Copy columns + bank version table |
| "Update available" | Yes, by comparing `sourceVersion` | Implicit | Yes |
| Diverging copies | Expected; shown as "edited since copy" | Not possible (or locked) | Expected |
| Cross-tutor permissions | Check at copy time only | Check on every read | Copy time + bank ACL |

## 4. Proposed reuse model

### Provenance columns

Add to `Course`, `Lesson`, `Test`, `TestQuestion`, `Submission` (Guess at names):

- `sourceId String?` - the record this was copied from (no foreign key, so deleting the source does not break the copy).
- `sourceVersion Int?` - the source's `version` at copy time.
- `copiedAt DateTime?`
- `version Int @default(1)` on the source side, bumped on publish (also used for the editor conflict check proposed in 06-test-designer.md).

The UI then shows "Copied from Algebra 2025, version 3" and, when the source is now version 5, "Update available". Pulling an update shows a diff and creates a new draft, never overwrites in place. That avoids the Commons overwrite problem.

### Deep-copy rules for a test

1. Copy `Test` with new id, `isActive = false`, dates cleared or shifted, `sourceId` set.
2. Walk `TestQuestion` tree; mint new UUIDs; remap `parentId`; keep `order`.
3. Copy `answer`, `matchPairs`, `options`, `reorderItems`, `blankCount`, `language` as-is (memos come along; tutors expect memos to travel).
4. Rewrite Blob URLs inside `question` and memo markdown; duplicate the blobs to `tests/{newTestId}/questions/{newQuestionId}/...`; duplicate `memoFileUrls`.
5. Never copy `TestSubmission`, `UploadedFile`, `QuestionGrade`, `AssessmentCompletion`.
6. Run in one transaction for rows; copy blobs before the transaction and clean up on failure (Blob is not transactional).

Lessons follow the same pattern (tree remap on `parentId`, `Attachment` rows and blobs duplicated, internal links remapped by an old-to-new id map). Whole-course copy is lessons + tests + assignments + events with a date shift.

### Blobs: duplicate or reference?

- Option A, duplicate on copy. Simple and safe. Costs storage (input for Agent A: Vercel Blob storage and operation pricing). Vercel Blob has a server-side copy operation (unverified; check `@vercel/blob` `copy()` in the SDK version used).
- Option B, content-addressed blobs with reference counting. Saves storage, but every delete path must check references. Higher risk.
- Guess: Option A first. Tutor content is mostly small images and PDFs.

### Templates

- A template is a normal course, lesson or test with `isTemplate = true` and a visibility (`private`, `team`, later `public`). "Use template" is the same deep copy.
- Gallery: start with "My templates" plus a small Nexa starter set (for example CAPS-aligned course skeletons; content not researched here). A public gallery needs licensing (Canvas asks for a licence at share time) and moderation; defer.

### Teams and permissions

- Today a course belongs to exactly one tutor. Sharing a template with another tutor needs either a team / workspace model or per-item share grants.
- Rule: copying requires read access to the source at copy time. After that, the copy is owned by the copier. Provenance shows the source title only if the copier can still read it; otherwise "Copied from a deleted or private item".
- Exams and memos are sensitive. Default share scope for tests is private, and memos may be excluded from shares by a toggle.
- Agent A input: sharing across tutors moves student-adjacent content between accounts. Templates must never include student data. Check POPIA implications of any public gallery.

### Linked content (later, Plus)

- Question bank items: a test slot may reference a bank item pinned to a version, like Moodle's "specific version". Updating means re-pinning. Once students sat the test, the pin is frozen. This is the only link worth building.
- Synced lesson blocks (Notion-style) across courses: not recommended. Our lesson bodies are single markdown strings, not block records, so syncing would need a block model first.

## Recommendation

Pick: copy-on-use with provenance for every content type (course, lesson subtree, test, assignment), with "Update available from source" that creates a reviewable draft, blobs duplicated on copy, and copies always landing as drafts with dates cleared or shifted. Build test copy first, since the JSON export/import path already exists and can share the tree-walk code.

Fallback: if blob duplication is too slow or costly, keep shared blob URLs but move lesson and test blob cleanup to a reference check (do not delete a blob still referenced by any row), and accept that copies share files. For the Plus question bank, add version-pinned linking, never "always latest" across courses.

## Open questions for the owner

1. Do you want tutors to share content with each other (teams), or only reuse their own content for now?
2. Should copied tests bring memos by default?
3. Should a copy shift dates by an offset (Moodle style) or clear them?
4. Is a public template gallery in scope, and who moderates it?
5. May I add provenance and `version` columns via `db push` when implementation starts?
6. Should deleting a source course warn that N copies point at it, or stay silent?

## Sources

- https://www.notion.com/help/synced-blocks (checked 2026-11-16)
- https://www.notion.com/help/transfer-content-to-another-account (checked 2026-11-16)
- https://thomasjfrank.com/how-to-move-pages-between-workspaces-in-notion/ (checked 2026-11-16)
- https://community.canvaslms.com/docs/DOC-3837 (checked 2026-11-16)
- https://teaching.usask.ca/articles/2021-05-04-warning-about-templates-canvas-commons-updates.php (checked 2026-11-16)
- https://community.canvaslms.com/t5/Canvas-Ideas/Commons-All-teachers-on-a-course-can-see-notifications-of/idi-p/561181 (checked 2026-11-16)
- https://community.canvaslms.com/t5/Commons/What-types-of-sharing-options-are-available-in-Commons/ta-p/1815 (checked 2026-11-16)
- https://community.canvaslms.com/docs/DOC-17609 (checked 2026-11-16)
- https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-edit-an-item-bank-item-in-New-Quizzes/ta-p/703 (checked 2026-11-16)
- https://community.canvaslms.com/t5/Canvas-Ideas/New-Quizzes-Offer-option-to-copy-rather-than-link-to-questions/idi-p/545797 (checked 2026-11-16)
- https://community.canvaslms.com/t5/New-Quizzes-Discussion/Edits-made-to-a-copy-of-a-New-Quiz-in-one-course-are-mirrored-in/m-p/611818 (checked 2026-11-16)
- https://www.usu.edu/teach/help-topics/canvas/blueprint-courses (checked 2026-11-16)
- https://qilt.qu.edu/knowledge-resources-learnings-posts/blueprints-syncing-content-across-canvas-courses (checked 2026-11-16)
- https://support.cmts.jhu.edu/hc/en-us/articles/30758133925517-Managing-Course-Content-Using-Canvas-Blueprints (checked 2026-11-16)
- https://docs.moodle.org/501/en/Restore (checked 2026-11-16)
- https://www.e-learning.tu-darmstadt.de/werkzeuge/moodle/moodle_faq_lehrende/artikel_details_52800.en.jsp (checked 2026-11-16)
- https://docs.moodle.org/en/Question_bank (checked 2026-11-16)
- https://docs.moodle.org/en/Question_banks_in_upgraded_sites (checked 2026-11-16)
- https://support.google.com/edu/classroom/answer/6272593 (checked 2026-11-16)
- https://alicekeeler.com/2015/08/28/google-classroom-uncheck-duplicate-attachments/ (checked 2026-11-16)
- https://alicekeeler.com/2023/08/05/please-do-not-copy-your-class/ (checked 2026-11-16)
- https://help.blackboard.com/Learn/Instructor/Ultra/Course_Content/Reuse_Content/Ultra_Copy_Content (checked 2026-11-16)
- https://help.blackboard.com/Learn/Instructor/Ultra/Tests_Pools_Surveys/ULTRA_Reuse_Questions (checked 2026-11-16)
- https://community.d2l.com/brightspace/kb/articles/16767-about-import-export-copy-components (checked 2026-11-16)
- https://community.d2l.com/brightspace/kb/articles/4818-import-export-copy-components-permissions (checked 2026-11-16)
