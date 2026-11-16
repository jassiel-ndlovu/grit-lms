# Stored maths audit: MathJax 3, MathJax 4 and KaTeX

Checked: 2026-11-16. Author: Agent B (main session), with the owner's
go-ahead for a read-only pass over the shared database.

## Bottom line

- **Every stored formula renders in MathJax 4.1.3**, with no regressions from
  today's MathJax 3.2.2. The move to MathJax 4 needs no content changes.
- KaTeX 0.19.1 also renders all of it today, because tutors use a small,
  plain set of commands (86 distinct). This does not change the decision:
  MathJax 4 stays the one engine, and the editor's math node must not use
  KaTeX, so the editor and the student page always agree.
- Things that would break under KaTeX if tutors start using them: `\ce`
  (chemistry, mhchem), `\bbox`, `\class` and `\require`. MathJax 4 handles
  all of them. This is the real argument for MathJax over KaTeX here.

## What was read

Read-only Prisma `findMany` selects, run from a script outside the repo.
Tutor-authored text only; no student answers or submissions were read.

| Field | Formulas |
| --- | --- |
| `TestQuestion.question` | 2,095 |
| `TestQuestion.options` | 1,800 |
| `TestQuestion.answer` | 871 |
| `Lesson.description` (lesson body) | 507 |
| `Test.preTestInstructions` | 247 |
| `TestQuestion.matchPairs` | 50 |
| `TestQuestion.reorderItems` | 31 |
| `Test.description` | 4 |
| `Course.description`, `Submission.description`, `CourseEvent.description` | 0 |
| **Total** | **5,605** (3,010 distinct; 413 display, the rest inline) in 1,856 fields |

## Method

1. Each field went through `normalizeTexDelimiters` (as `LessonMarkdown`
   does), then `$$...$$` and `$...$` bodies were taken out, skipping code.
2. The normaliser escapes punctuation inside maths so markdown leaves it
   alone, and markdown then strips those escapes. The audit strips them the
   same way, so each engine sees what the browser's MathJax sees.
3. Each formula was parsed by MathJax 3.2.2 (`mathjax-full`), MathJax 4.1.3
   (`@mathjax/src`) and KaTeX 0.19.1, with errors thrown, not drawn.
   MathJax loaded every TeX extension it ships (the browser bundle autoloads
   them), except `noundefined` and `noerrors` (so unknown commands fail
   loudly) and `bussproofs` (needs a layout engine; no content uses it).
4. The harness was checked with probes that must fail: an unknown `\foo`, a
   missing brace and `\require`. All three engines reported them.

| Engine | Failures |
| --- | --- |
| MathJax 3.2.2 (today) | 0 |
| MathJax 4.1.3 | 0 |
| KaTeX 0.19.1 | 0 |

## What tutors write

Most used: `\text` 549, `\dfrac` 421, `\times` 294, `\frac` 284, `\sqrt` 170,
`\pi` 137, `\log` 127, `\sigma` 124, `\circ` 123, `\mu` 119, `\bar` 85.
Environments: `align*` 3, `cases` 2. Also seen: `\boxed`, `\cancel`,
`\mathbb`, `\overrightarrow`, `\xrightarrow`, `\binom`, `\operatorname`.

## Limits

- The math finder is a regular expression, not a markdown parser. A dollar
  amount like `$5 and $10` can be read as maths; the 0-failure result shows
  no such text broke a parser, but counts may be slightly high.
- A parse is not a picture. The audit proves every formula parses; it does
  not compare the drawn output. MathJax 4's new default font (mathjax-newcm)
  changes how formulas look, so B3 should eyeball a sample on the new font.
- The scripts and raw results stay outside the repo (they hold tutor
  content). The method above is enough to rerun it.

## Sources

- MathJax 4.1.3, npm `@mathjax/src`, installed 2026-11-16.
- MathJax 3.2.2, npm `mathjax-full`, installed 2026-11-16.
- KaTeX 0.19.1, npm `katex`, installed 2026-11-16.
- `src/lib/tex-delimiters.ts` and `src/app/components/markdown.tsx` on
  `main` at b9d6e72.
