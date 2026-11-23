# Contract: practice sets and item analysis

Owner: Agent B. Reader: Agent A. Status: **Draft 1, 2026-11-23** (#216, phase 2). A asks for changes in an issue labelled `needs-b`.

**Answer first.**
- **Practice sets:** a tutor builds a set on a course from their question bank. Students answer untimed, see the answer at once, and each question comes back after a gap that grows while they know it. Nothing counts for marks.
- **Item analysis:** a tutor sees how each question of a test performed. It reads existing marks and stores nothing.
- Owner's choices (23 Nov): questions come from the bank, practice is never marked, and tutors and parents see progress.

## Services

| Feature | Service | Where it's checked |
| --- | --- | --- |
| Practice sets | `question-bank` (Plus) | `hasPractice(courseId)`, on every page and action |
| Item analysis | `advanced-analytics` (Plus) | `hasItemAnalysis(courseId)`: the Analysis tab and page |

`advanced-analytics` is now `v1` in `src/features/billing/catalogue.ts`, switched with the owner's OK. Practice has no key of its own, because it is built from the bank.

## Data (B's schema, migration `29_practice_sets`, additive)

| Model | Field | Notes |
| --- | --- | --- |
| `PracticeSet` | `courseId` | Goes with the course (cascade). |
| | `isPublished` | Students see published sets only. |
| `PracticeItem` | `data` | One question tree in the test JSON format, copied from the bank, answers included. |
| | `bankQuestionId` | Where it came from. No foreign key. |
| `PracticeReview` | `itemId`, `studentId` | One row per student and question. `studentId` is `Student.id`, without a relation because `Student` is A's. |
| | `box`, `dueAt` | Where the question is in its schedule. |
| | `answered`, `correct`, `lastShare`, `lastAnsweredAt` | Totals, not a log of answers. Answers themselves aren't stored. |

## Schedule

Six boxes; a question comes back after 0, 1, 3, 7, 14 or 30 days, from midnight in South Africa.
- **All right:** up one box, if it was due. Practising early doesn't stretch the gap.
- **Half right or more:** back tomorrow.
- **Less:** back to the first box, due at once.
- **Known** means box 3 or higher.

A session is 20 questions: due ones first, then at most 10 new ones. A question that wasn't fully right comes back at the end, up to twice.

Only questions the auto-marker can mark, with an answer saved, can be practised (`canPractise`). When the maths checker can't decide, the student compares their answer and says whether it matches.

## Code

- **Pure:** `src/features/assessments/lib/practice.ts` and `lib/item-analysis.ts`, checked by `scripts/check-practice.ts`.
- **Reads:** `src/features/assessments/practice-queries.ts`. Callers check access first.
- **Actions:** `src/features/assessments/practice-actions.ts`.
- **Screens:**
  - tutor: `/dashboard/manage-courses/[id]/practice` and `/dashboard/tutor-tests/[id]/analysis`;
  - student: `/dashboard/courses/[id]/practice`;
  - parent: a Practice section on the child page.

## Asks for A

1. **Account deletion:** `anonymiseAccount` should delete `PracticeReview` rows for the student (`studentId`), as it does for `LessonCompletion`.
2. **POPIA export:** include the student's `PracticeReview` rows.
3. **Course deletion:** nothing to do; the rows cascade.
4. **Blob cleanup:** treat a URL found in `PracticeItem.data` as in use, as for `BankQuestion.data`.

## Not in this draft

- Reminders when practice is due.
- Adaptive practice (phase 3): choosing questions by topic from how a student does.
- Reordering or editing a set's questions in place. Remove one and add it again.
