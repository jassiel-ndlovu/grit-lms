# Contract: question bank

Owner: Agent B. Reader: Agent A. Status: **Draft 1, 2026-11-23** (#216, phase 2). A asks for changes in an issue labelled `needs-b`.

**Answer first.**
- A tutor saves a question from a test to their **bank** ("Save to bank" on a top-level question, sub-questions included).
- "Add from bank" in the test designer **copies** chosen items into the test. The copy remembers its source in `TestQuestion.bankQuestionId`, and never changes when the bank item changes or is removed.
- It is the Plus service `question-bank`, checked with `hasService` on the course being edited. Every student still sits every question of a test; there is no per-student random draw.

## Data (B's schema, migration `28_question_bank`, additive)

| Model | Field | Notes |
| --- | --- | --- |
| `BankQuestion` | `workspaceId` | The workspace of the course it was saved from. No foreign key, because `Workspace` is A's model. |
| | `ownerUserId` | The user who saved it. Only they list, use or delete it. |
| | `stem`, `type`, `points`, `topics` | For lists and filters. `points` covers the whole tree. |
| | `subject`, `gradeLevel` | Taken from the source course's curriculum (contracts/curriculum.md). |
| | `data` | One question tree in the test JSON format (`lib/test-io.ts`, `ImportQuestionSchema`), answers and rubric included. |
| | `sourceTestId` | Provenance only. |
| `TestQuestion` | `bankQuestionId String?` | Set on the top question of a copied tree. No foreign key. |

## Code

- Pure helpers: `src/features/assessments/lib/question-bank.ts` (`editorToBankNode`, `bankNodeToEditor`, `readBankNode`, `bankStem`, `bankNodePoints`, `bankNodeTopics`).
- Actions: `src/features/assessments/bank-actions.ts` (`saveQuestionToBank`, `listBankQuestions`, `deleteBankQuestion`). Saving and listing need the service on the course; deleting doesn't, so a tutor can tidy up after a downgrade.
- UI: `QuestionBankDialog` and the "Save to bank" button in the test designer.

## Notes for A

- **Service status.** `question-bank` is `later` in `src/features/billing/catalogue.ts`, so the bank stays hidden until A moves it to `v1`.
- **Workspace deletion.** When a workspace is deleted, `BankQuestion` rows with its `workspaceId` should go too, since there is no cascade.
- **Account deletion and POPIA export.** A user's `BankQuestion` rows (`ownerUserId`) are theirs: include them in an export, and delete them with the account.
- **Blob files.** A bank item can reference question images stored under the source test's path. Test deletion doesn't remove blobs today. Any future blob cleanup must treat a URL found in `BankQuestion.data` as in use.

## Not in this draft

- Per-student random draws, and "generate a test from topics".
- Sharing a bank between tutors.
- Editing a bank item in place. To change one, add it to a test, edit it there, save it again and remove the old one.
