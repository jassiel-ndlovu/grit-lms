/**
 * Checks deleteCourseContent and countCourseContent (issue #113).
 *
 *   npx tsx --env-file=<preview env file> scripts/check-course-delete.ts
 *
 * Part 1 is pure: collectBlobUrls on sample values.
 *
 * Part 2 needs a database; run it on Preview. Everything happens inside ONE
 * transaction that the script always rolls back, so nothing it writes is
 * kept, even when a check passes. In it, the script:
 *   - builds a fake course with one of everything: nested lessons with an
 *     attachment and a completion, a test with a sub-question, a submission
 *     with an uploaded file, question grade, grade and completion, an
 *     assignment with an entry, question grade and grade, a quiz with a
 *     completion, and an event, with fake Blob URLs in typed columns, in
 *     rich text and in answers;
 *   - counts it, deletes it, and counts again;
 *   - checks the Course row is still there (A deletes it), and that another
 *     course's content was not touched, and that the Course row then
 *     deletes cleanly (A's last step).
 * After the rollback it checks the fake course is gone.
 *
 * Prints counts and pass/fail only. Exits 1 on any failure.
 */

import { PrismaClient } from "../src/generated/prisma";
import { cleanBlobUrl, collectBlobUrls } from "../src/features/courses/lib/blob-urls";
import { countCourseContent, deleteCourseContent, type CourseContentCounts } from "../src/features/courses/delete-content";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${g}`);
    console.log(`        want: ${w}`);
  }
}

/* ── Part 1: collectBlobUrls ───────────────────────────────────────────── */

const H = "https://fakestore0000.public.blob.vercel-storage.com";

check("plain URL", cleanBlobUrl(`${H}/a.png`), `${H}/a.png`);
check("query string dropped", cleanBlobUrl(`${H}/a.pdf?download=1`), `${H}/a.pdf`);
check("trailing punctuation dropped", cleanBlobUrl(`${H}/a.pdf.`), `${H}/a.pdf`);
check("host lower-cased", cleanBlobUrl("https://FakeStore0000.Public.blob.vercel-storage.com/A.png"), `${H}/A.png`);
check("YouTube is not a blob", cleanBlobUrl("https://youtu.be/x"), null);
check("lookalike host rejected", cleanBlobUrl("https://blob.vercel-storage.com.evil.test/a.png"), null);
check("http rejected", cleanBlobUrl("http://fakestore0000.public.blob.vercel-storage.com/a.png"), null);
check(
  "walks strings, arrays, JSON and markdown; de-duplicates; sorts",
  collectBlobUrls([
    { imageUrl: `${H}/z.png`, createdAt: new Date(0), n: 3, nil: null },
    [`${H}/b.pdf`, `${H}/b.pdf?download=1`],
    { doc: { content: [{ type: "image", attrs: { src: `${H}/c.png` } }] } },
    `See [the brief](${H}/d.pdf), and ${H}/e.pdf.`,
    "https://www.youtube.com/watch?v=x",
  ]),
  [`${H}/b.pdf`, `${H}/c.png`, `${H}/d.pdf`, `${H}/e.pdf`, `${H}/z.png`],
);

/* ── Part 2: the delete, on a fake course, rolled back ─────────────────── */

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.log("\nDATABASE_URL is not set: skipped the database part.");
  console.log(failures === 0 ? "ALL PASS (pure part only)" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

const prisma = new PrismaClient({ datasourceUrl: url });
const ROLLBACK = new Error("rollback (expected)");
const tag = `zz-check-course-delete-${Date.now()}`;
const zero: CourseContentCounts = {
  uploadedFiles: 0,
  grades: 0,
  questionGrades: 0,
  assessmentCompletions: 0,
  testSubmissions: 0,
  testQuestions: 0,
  tests: 0,
  assignmentEntries: 0,
  assignments: 0,
  quizzes: 0,
  lessonCompletions: 0,
  attachments: 0,
  lessons: 0,
  courseEvents: 0,
};

async function main() {
  let courseId = "";

  try {
    await prisma.$transaction(
      async (tx) => {
        const other = await tx.course.findFirst({ select: { id: true } });
        const otherBefore = other ? (await countCourseContent(tx, other.id)).counts : null;

        const student = await tx.student.create({
          data: { fullName: "ZZ check student", email: `${tag}@example.invalid` },
        });
        const course = await tx.course.create({
          data: { name: "ZZ check course (rolled back)", imageUrl: `${H}/cover.png` },
        });
        courseId = course.id;
        const sid = student.id;

        // Lessons: a group with a child, an attachment, a video and a completion.
        const group = await tx.lesson.create({
          data: { courseId, title: "Group", order: 0, type: "NONE" },
        });
        const child = await tx.lesson.create({
          data: {
            courseId,
            title: "Child",
            order: 0,
            parentId: group.id,
            videoUrl: [`${H}/video.mp4`, "https://youtu.be/x"],
            descriptionJson: { schemaVersion: 1, doc: { content: [{ type: "image", attrs: { src: `${H}/inline.png` } }] } },
            attachmentUrls: { create: { title: "Notes", url: `${H}/notes.pdf` } },
          },
        });
        await tx.lessonCompletion.create({ data: { lessonId: child.id, studentId: sid, completedAt: new Date() } });

        // A test: a question with a sub-question, one submission with everything hanging off it.
        const test = await tx.test.create({
          data: {
            courseId,
            title: "Test",
            description: "",
            dueDate: new Date(),
            totalPoints: 2,
            memoFileUrls: [`${H}/test-memo.pdf`],
          },
        });
        const parent = await tx.testQuestion.create({
          data: { testId: test.id, question: "Parent", type: "NONE", points: 0, order: 0 },
        });
        const sub = await tx.testQuestion.create({
          data: { testId: test.id, parentId: parent.id, question: "Upload", type: "FILE_UPLOAD", points: 2, order: 0 },
        });
        const ts = await tx.testSubmission.create({
          data: {
            testId: test.id,
            studentId: sid,
            startedAt: new Date(),
            status: "SUBMITTED",
            answers: { [sub.id]: `${H}/answer.pdf` },
          },
        });
        await tx.uploadedFile.create({
          data: { submissionId: ts.id, questionId: sub.id, fileType: "PDF", fileUrl: `${H}/answer.pdf` },
        });
        await tx.questionGrade.create({ data: { testSubmissionId: ts.id, questionId: sub.id, score: 1, outOf: 2 } });
        await tx.grade.create({
          data: { courseId, studentId: sid, type: "TEST", title: "Test", outOf: 2, score: 1, testSubmissionId: ts.id },
        });
        await tx.assessmentCompletion.create({ data: { testId: test.id, studentId: sid, startedAt: new Date() } });

        // An assignment with an entry, a question grade and a grade.
        const assignment = await tx.submission.create({
          data: {
            courseId,
            title: "Assignment",
            dueDate: new Date(),
            createdAt: new Date(),
            fileType: "PDF",
            description: `Read [this](${H}/brief-inline.pdf).`,
            descriptionFiles: [`${H}/brief.pdf`],
            memoFileUrls: [`${H}/assignment-memo.pdf`],
          },
        });
        const entry = await tx.submissionEntry.create({
          data: {
            submissionId: assignment.id,
            studentId: sid,
            submittedAt: new Date(),
            attemptNumber: 1,
            status: "SUBMITTED",
            feedback: "",
            fileUrl: [`${H}/work.pdf`],
          },
        });
        await tx.questionGrade.create({ data: { submissionEntryId: entry.id, score: 1, outOf: 1 } });
        await tx.grade.create({
          data: { courseId, studentId: sid, type: "ASSIGNMENT", title: "Assignment", outOf: 1, score: 1, submissionEntryId: entry.id },
        });

        // A quiz with a completion, and an event.
        const quiz = await tx.quiz.create({ data: { courseId, title: "Quiz", dueDate: new Date() } });
        await tx.assessmentCompletion.create({ data: { quizId: quiz.id, studentId: sid, startedAt: new Date() } });
        await tx.courseEvent.create({
          data: { courseId, title: "Event", description: "", type: "LECTURE", date: new Date(), link: "https://example.invalid/meet" },
        });

        const expected: CourseContentCounts = {
          uploadedFiles: 1,
          grades: 2,
          questionGrades: 2,
          assessmentCompletions: 2,
          testSubmissions: 1,
          testQuestions: 2,
          tests: 1,
          assignmentEntries: 1,
          assignments: 1,
          quizzes: 1,
          lessonCompletions: 1,
          attachments: 1,
          lessons: 2,
          courseEvents: 1,
        };
        const expectedUrls = [
          "answer.pdf",
          "assignment-memo.pdf",
          "brief-inline.pdf",
          "brief.pdf",
          "cover.png",
          "inline.png",
          "notes.pdf",
          "test-memo.pdf",
          "video.mp4",
          "work.pdf",
        ].map((f) => `${H}/${f}`);

        const before = await countCourseContent(tx, courseId);
        check("count: one of everything", before.counts, expected);
        check("count: every Blob URL, once", before.blobUrls, expectedUrls);

        const deleted = await deleteCourseContent(tx, courseId);
        check("delete: removed what the count said", deleted.counts, expected);
        check("delete: returned the same Blob URLs", deleted.blobUrls, expectedUrls);

        const after = await countCourseContent(tx, courseId);
        check("after: nothing left under the course", after.counts, zero);
        check("after: Course row kept, cover still listed (A deletes both)", after.blobUrls, [`${H}/cover.png`]);
        check("after: Course row still there", !!(await tx.course.findUnique({ where: { id: courseId } })), true);
        check("after: the student is untouched", !!(await tx.student.findUnique({ where: { id: sid } })), true);

        if (other && otherBefore) {
          check("another course's content is untouched", (await countCourseContent(tx, other.id)).counts, otherBefore);
        } else {
          console.log("SKIP  another course's content is untouched (no other course)");
        }

        // A's last step. The fake course has none of A's rows, so if this
        // fails, one of B's tables still holds the course.
        await tx.course.delete({ where: { id: courseId } });
        check("A's final Course delete is not blocked by B's tables", await tx.course.count({ where: { id: courseId } }), 0);

        throw ROLLBACK;
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }

  check("rolled back: the fake course is gone", await prisma.course.count({ where: { id: courseId } }), 0);
  check("rolled back: the fake student is gone", await prisma.student.count({ where: { email: `${tag}@example.invalid` } }), 0);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error("\nERROR:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(2);
  });
