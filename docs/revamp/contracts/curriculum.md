# Contract: curriculum topics

Owner: Agent B. Reader: Agent A. Status: **Draft 2, 2026-11-23** (#216, phase 2). A asks for changes in an issue labelled `needs-b`.

**Answer first.**
- A course names its **curriculum** (CAPS, IEB or something else), **subject** and **grade**.
- Its lessons and test questions carry **topic codes** from a catalogue that lives in code.
- The **coverage map** counts, per topic, the lessons and questions that cover it, and the marks those questions are worth. A topic with no lessons or no questions is a gap.

## Data (B's schema, migration `27_curriculum_topics`, additive)

| Model | Field | Type | Notes |
| --- | --- | --- | --- |
| `Course` | `curriculum` | `Curriculum?` (`CAPS`, `IEB`, `OTHER`) | Null: not set. |
| `Course` | `subject` | `String?` | A catalogue key, e.g. `mathematics`. Null for `OTHER`. |
| `Course` | `gradeLevel` | `Int?` | 10, 11 or 12 today. Null for `OTHER`. |
| `Lesson` | `topics` | `String[]`, default `[]` | Topic codes. |
| `TestQuestion` | `topics` | `String[]`, default `[]` | Topic codes. Sub-questions carry their own. |

The code format is `caps:<subject>:<grade>:<topic-slug>`, for example `caps:mathematics:10:functions`. Topics only the IEB lists use `ieb:` in place of `caps:`. **Codes never change once shipped.** A retired topic stays readable, but isn't offered.

## Catalogue

`@/features/courses/lib/curriculum` (pure, client-safe):

| Export | What |
| --- | --- |
| `topicsFor({ curriculum, subject, gradeLevel })` | The course's topics, in teaching order. Empty when there's no catalogue. |
| `topicByCode(code)` | One topic `{ code, title, subject, grade, order }`, or null. |
| `topicsToStore(raw)` | Known codes only, no repeats, at most 10. |
| `curriculumToStore(raw)` | Cleans a course's three fields; anything incomplete becomes null. |
| `subjectOptions(curriculum)` | The subjects that curriculum offers, with their grades. Replaces `SUBJECT_OPTIONS`. |
| `curriculumLabel(course)` | "CAPS · Mathematics · Grade 10". |
| `coverage(topics, lessons, questions)` | Rows of `{ topic, lessons, questions, marks }`. |

**Today:** Grades 10 to 12.
- **CAPS:** Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences, Accounting, Business Studies, Economics, Geography, History and Computer Applications Technology. Topics follow each subject's CAPS document.
- **IEB:** the same subjects, plus Advanced Programme Mathematics.

**How an IEB list is made.** The IEB examines the national curriculum, so its list is the CAPS list with that subject's differences (`IEB_CHANGES`). Shared topics keep their `caps:` codes, so a tag or a bank question works in both. A topic the IEB leaves out still reads; it isn't offered on IEB courses.

| Subject | IEB difference (Grade 12) |
| --- | --- |
| Physical Sciences | Without Doppler effect and Fertilisers. Adds Newton's laws, Gravitational and electric fields, Chemical bonding, Energy changes in reactions. |
| Life Sciences | Adds Environmental studies. |
| Accounting | Adds Published financial statements, Professional bodies and codes of conduct. |
| Advanced Programme Mathematics | IEB only. One programme, so every grade lists all of it: ten core topics and three electives. A school teaches one elective, so the other two show as gaps. |

These differences come from public IEB papers, the Umalusi comparison of IEB papers (2013 to 2015) and the IEB's 2019 Advanced Programme Mathematics handbook page. The current Subject Assessment Guidelines sit behind a sign-in and weren't read, so **the owner reviews this table** before it's relied on.

**Next:** Information Technology, Senior Phase grades, and topics a workspace adds itself. A workspace's own topics would need a table; that comes as Draft 3.

## What A might use

These are reads only; nothing here needs A to change anything.
- **AI generation and "missing CAPS topics" (phase 3):** the course's `topicsFor(...)` list, and each question's `topics`, are the context. A topic with zero questions in `coverage(...)` is a missing topic.
- **At-risk alerts and term reports:** marks per topic come from `QuestionGrade` joined to `TestQuestion.topics`.
- **Imports (QTI, Common Cartridge):** an imported question's topics go through `topicsToStore`.
