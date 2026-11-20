# Maths in students' answers: plan

Status: plan, approved by the owner for planning on 2026-11-20. Nothing is
built yet. It follows visual maths input for tutors (#157) and B research 02.

## The problem

Students can only type maths as plain text: `x^2+3x`, `sqrt(2)/2`, `1/2`.
- **Short answers** (`SHORT_ANSWER`) are auto-marked by exact text match,
  ignoring case and outer spaces (`auto-grade.ts`). So `x^2+3x`,
  `x(x+3)` and `3x + x^2` are three different answers, and only the one
  that matches the key gets the mark. Tutors fix these by hand.
- **Numeric answers** (`NUMERIC`) already accept `0,5`, `1/2` and a
  "± margin" key (`numeric.ts`). Numbers are fine; expressions aren't.
- **Essays** (`ESSAY`) are marked by hand and shown to the tutor as plain
  text, so maths written in them is hard to read.

## What students get

1. **A maths field** (the MathLive field from #157) where an answer is maths.
   - Fractions, powers and roots look the way they're written.
   - An on-screen maths keyboard comes up on phones and tablets, and can
     be opened with a button on a computer.
   - MathLive reads maths aloud for screen readers.
2. **Essays: an "Insert maths" button** that adds a formula into the text,
   so a working-out paragraph can hold typeset steps.
3. **Review:** after release, students see their maths typeset, beside the
   tutor's answer.

## What tutors get

1. A new question type, **Maths expression**. The tutor enters the
   answer in the same maths field and picks how strictly it's marked:
   - **Equivalent** (default): any form that's mathematically equal gets
     the mark. `x(x+3)`, `x^2+3x` and `3x+x^2` all match.
   - **Same form:** the answer must have the key's form after tidying
     (spaces, order of terms and factors), for "factorise" or "simplify"
     questions. `x(x+3)` matches `(x+3)x` but not `x^2+3x`.
   - **Decimal within a margin**, as NUMERIC keys do today.
2. **Grading:** the student's answer typeset, the result ("Equal to the
   answer" or "Not equal"), and the usual override. When the checker can't
   decide, the question goes to the tutor to mark by hand, never counted
   wrong.
3. **Essays and long answers** show typeset in the grading view and in
   review.

## How it works

### Storage

- **Answers are TeX strings** in `TestSubmission.answers`, as all text
  answers are today. The key is TeX in `TestQuestion.answer`. There's no new
  JSON shape, so import and export (`test-io.ts`) carry them as text.
- **New enum value** `QuestionType.MATH_EXPRESSION`. That's a migration,
  which is **A's** to write.
- **Marking mode** (`equivalent`, `form`, or `margin`), stored in a new
  nullable `TestQuestion.mathMode` column (A's migration) or in an existing
  options field. A decides.

### Marking (server only)

- **Cortex Compute Engine** (`@cortex-js/compute-engine`, MIT; research
  02) parses the TeX of both answers. It's large (about 1.9 MB gzip), so
  it runs in the server marking path only and never ships to browsers.
  It's a new dependency, which needs A's OK.
- **Equivalent:** `ce.parse(answer).isEqual(ce.parse(key))`. When that
  returns undecided, check numerically at a few random points in x and
  other variables. If even that is unclear, send the question to manual
  marking.
- **Same form:** compare canonical forms (`ce.parse(…, { canonical: true })`
  with `isSame`), so term and factor order and spacing don't matter.
- **Safety:**
  - limit the answer length (200 characters);
  - put a time limit on each check;
  - catch every parse error and send that question to manual marking.
  A student answer must never crash or slow down marking for the class.
- The checks run in `auto-grade.ts`, beside `numericMatches`. They get
  fixture tests (`scripts/check-maths-answers.ts`) with real CAPS-style
  answers.

### Showing maths (no schema change)

- In the grading view and review, essay and short answers that contain
  `$…$` render through `LessonMarkdown` with MathJax, the same as
  questions do.
- Plain-text answers stay plain: a single `$` (for example "R5" written
  as "$5") is escaped by the existing delimiter rules in
  `tex-delimiters.ts`.

### Loading and gating

- The test runner preloads MathLive when the test has a maths question, so
  the first maths question doesn't stall a timed test.
- Students get the maths field wherever the question type needs it, on
  any tier. Tutors need the Plus `math-input` service to create maths
  expression questions; that's the same gate as #157.

## Phases

| Phase | What | Needs A | Size |
| --- | --- | --- | --- |
| 1 | Typeset maths in grading and review, and "Insert maths" in essays | No | Small |
| 2 | The Maths expression question type: the tutor's key and mode, the student's maths field, marking with Compute Engine, the grading view | Enum value and mode column (migration); `@cortex-js/compute-engine` dependency | Medium |
| 3 | Optional: allow equivalent expressions in existing short answers (a per-question switch) | Same as 2 | Small, after 2 |

Phase 1 can start once math input (#157) is merged.

## Decisions for the owner

1. **Default marking mode:** equivalent (recommended), or same form?
2. **Undecided answers:** send them to the tutor (recommended), or count
   them wrong?
3. **Tier:** the maths field for students on every tier, with only creating
   maths questions on Plus (recommended), or all of it on Plus?
4. **Phase 3:** should existing short-answer questions be able to opt in to
   equivalence marking?

## Risks

- **Checker gaps:** Compute Engine can't decide everything (trigonometric
  identities, some radicals). Undecided answers go to the tutor, and the
  fixture tests show where the edges are before release.
- **Bundle size:** MathLive is about 250 KB gzip on test pages with maths
  questions only. Compute Engine never ships to browsers.
- **Phones:** MathLive's keyboard covers half the screen. The runner's
  one-question-per-screen layout scrolls the question above it; check this
  on a small phone before release.
