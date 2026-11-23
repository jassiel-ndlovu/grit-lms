# Contract: term reports

Owner: Agent B. Reader: Agent A. Status: **Draft 1, 2026-11-23** (#216, phase 1). A asks for changes in an issue labelled `needs-b`. The PDF itself is A's (viewer.md, "Term report PDFs").

**Answer first.**
- A workspace has **terms** with a first and a last day. Each student's report for a term has marks, attendance, a comment per course and a general comment.
- Families can download a report once its term is **released**.
- Core: no plan check.
- Only terms and comments are stored. Marks and attendance are read each time, so a later correction shows in the next download.

## Data (B's schema, migration `33_term_reports`, additive)

| Model | Field | Notes |
| --- | --- | --- |
| `ReportTerm` | `workspaceId` | Goes with the workspace (cascade). |
| | `startsOn`, `endsOn` | Days, read in the workspace's time zone. At most a year. |
| | `releasedAt` | Null = staff only. Taking a term back sets it to null. |
| `ReportCourseComment` | term, learner, course | One per student and course. Up to 600 characters. |
| `ReportOverallComment` | term, learner | One per student. |

Both comment tables go with the term and the `Learner` (cascade), and course comments with the course. An anonymised account loses the comments about it, and they are in the person's export (`features/users/{deletion,export}.ts`).

## Who

| Action | Who |
| --- | --- |
| See terms, students and course comments | Staff with `grades.view`, narrowed to their courses (`courseScopeOf`) |
| Comment on a course | `courses.edit` on that course |
| General comment | `courses.edit` on all of the student's courses in the term |
| Download as staff | `grades.view` on all of the student's courses in the term |
| Add, edit, release, take back, delete a term | `workspace.settings`, not in tutor mode (owner and admins) |
| Download once released | The student's linked parents, and the student if they're an adult. A minor's report goes to the parent. |

Anyone else gets a 404. Writes are refused in a read-only workspace.

## What a report holds

- **Courses:** those the student was enrolled on to the end of the term, or for a week or more of it.
- **Work:** assessments due in the term that are marked, or published and due. Drafts stay out.
- **Marks:** released marks only, the same rule as the parent's page. Work without one shows a dash.
- **Course mark:** the weighted mark to date over that work, with the gradebook's weights.
- **Level:** South Africa's levels 1 to 7, on CAPS and IEB courses.
- **Attendance:** the classes marked in the term.
- **Grade:** shown when the student's courses share one.
- **Not shown:** the student's username (they sign in with it), and a logo (workspaces can't upload one yet).

`pdfText` puts text in the characters the PDF's font has: typographic marks become plain, other letters lose their accents, emoji go.

## Pages

| Path | What |
| --- | --- |
| `/dashboard/reports` | Terms. From the Gradebook. |
| `/dashboard/reports/[termId]` | Courses, with comments written, and students |
| `.../course/[courseId]` | A comment box per student. Saves as you write. |
| `.../student/[learnerId]` | The report on screen, the general comment, the download |
| `.../student/[learnerId]/pdf` | The PDF (GET) |
| `/dashboard/children/[userId]`, `/dashboard/grades` | Released reports, for parents and adult students |

## Not here yet

- Telling families when a term is released (no notification is sent).
- Downloading a whole class at once.
