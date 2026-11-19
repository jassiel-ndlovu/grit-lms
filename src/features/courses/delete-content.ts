/**
 * Deleting a course's learning content, for A's course deletion (issue #113,
 * option 1). A's code owns the whole delete and its transaction: it calls
 * deleteCourseContent first, then deletes what it owns (Course, CourseStaff,
 * Enrollment, billing rows, Notification) in the same transaction, and
 * deletes the returned Blob files only after the commit.
 *
 *   await prisma.$transaction(async (tx) => {
 *     const { blobUrls } = await deleteCourseContent(tx, courseId);
 *     // ... A's rows, then tx.course.delete ...
 *   });
 *   // then del(blobUrls)
 *
 * countCourseContent reads the same rows without deleting anything, for a
 * dry run. Both take a transaction client so they never commit by themselves.
 *
 * What goes, children first (Prisma's default for these relations is
 * Restrict, so the order matters):
 *   uploaded answer files, grades, question grades, assessment completions,
 *   test submissions, test questions (sub-questions too), tests,
 *   assignment entries, assignments, quizzes,
 *   lesson completions, lesson attachments, lessons (nested ones too),
 *   course events.
 *
 * Blob URLs come from every column of those rows and of the Course row, not
 * only the typed URL columns: covers, attachments, lesson videos, test and
 * assignment memos, assignment briefs, students' uploads, and files linked
 * from rich text or answers. No feature copies files between courses, but a
 * URL could have been pasted elsewhere by hand; A's cleanup may check for
 * other references before deleting a file (research 08).
 *
 * Not a server action: callers must authorise first.
 */

import type { Prisma } from "@/generated/prisma";
import { collectBlobUrls } from "./lib/blob-urls";

type Tx = Prisma.TransactionClient;

/** Rows per table: deleted by deleteCourseContent, or that would be by countCourseContent. */
export type CourseContentCounts = {
  uploadedFiles: number;
  grades: number;
  questionGrades: number;
  assessmentCompletions: number;
  testSubmissions: number;
  testQuestions: number;
  tests: number;
  assignmentEntries: number;
  assignments: number;
  quizzes: number;
  lessonCompletions: number;
  attachments: number;
  lessons: number;
  courseEvents: number;
};

export type CourseContentResult = {
  /** Blob files the deleted rows pointed to, de-duplicated. Delete after the commit. */
  blobUrls: string[];
  counts: CourseContentCounts;
};

/** One filter per table, shared by the count and the delete so they can't drift. */
function filters(courseId: string) {
  const test = { test: { courseId } };
  const assignment = { submission: { courseId } };
  return {
    uploadedFile: { OR: [{ submission: test }, { question: test }] } satisfies Prisma.UploadedFileWhereInput,
    grade: {
      OR: [{ courseId }, { testSubmission: test }, { submissionEntry: assignment }],
    } satisfies Prisma.GradeWhereInput,
    questionGrade: {
      OR: [{ testSubmission: test }, { submissionEntry: assignment }],
    } satisfies Prisma.QuestionGradeWhereInput,
    assessmentCompletion: {
      OR: [test, { quiz: { courseId } }],
    } satisfies Prisma.AssessmentCompletionWhereInput,
    testSubmission: test satisfies Prisma.TestSubmissionWhereInput,
    testQuestion: test satisfies Prisma.TestQuestionWhereInput,
    test: { courseId } satisfies Prisma.TestWhereInput,
    submissionEntry: assignment satisfies Prisma.SubmissionEntryWhereInput,
    submission: { courseId } satisfies Prisma.SubmissionWhereInput,
    quiz: { courseId } satisfies Prisma.QuizWhereInput,
    lessonCompletion: { lesson: { courseId } } satisfies Prisma.LessonCompletionWhereInput,
    attachment: { lesson: { courseId } } satisfies Prisma.AttachmentWhereInput,
    lesson: { courseId } satisfies Prisma.LessonWhereInput,
    courseEvent: { courseId } satisfies Prisma.CourseEventWhereInput,
  };
}

/** Every row that can hold a file link, whole, for collectBlobUrls. */
async function findBlobUrls(tx: Tx, courseId: string): Promise<string[]> {
  const w = filters(courseId);
  const rows = await Promise.all([
    tx.course.findUnique({ where: { id: courseId } }),
    tx.lesson.findMany({ where: w.lesson }),
    tx.attachment.findMany({ where: w.attachment }),
    tx.test.findMany({ where: w.test }),
    tx.testQuestion.findMany({ where: w.testQuestion }),
    tx.testSubmission.findMany({ where: w.testSubmission }),
    tx.uploadedFile.findMany({ where: w.uploadedFile }),
    tx.submission.findMany({ where: w.submission }),
    tx.submissionEntry.findMany({ where: w.submissionEntry }),
    tx.courseEvent.findMany({ where: w.courseEvent }),
  ]);
  return collectBlobUrls(rows);
}

/** What deleteCourseContent would remove. Reads only. */
export async function countCourseContent(tx: Tx, courseId: string): Promise<CourseContentResult> {
  const w = filters(courseId);
  const [
    uploadedFiles,
    grades,
    questionGrades,
    assessmentCompletions,
    testSubmissions,
    testQuestions,
    tests,
    assignmentEntries,
    assignments,
    quizzes,
    lessonCompletions,
    attachments,
    lessons,
    courseEvents,
    blobUrls,
  ] = await Promise.all([
    tx.uploadedFile.count({ where: w.uploadedFile }),
    tx.grade.count({ where: w.grade }),
    tx.questionGrade.count({ where: w.questionGrade }),
    tx.assessmentCompletion.count({ where: w.assessmentCompletion }),
    tx.testSubmission.count({ where: w.testSubmission }),
    tx.testQuestion.count({ where: w.testQuestion }),
    tx.test.count({ where: w.test }),
    tx.submissionEntry.count({ where: w.submissionEntry }),
    tx.submission.count({ where: w.submission }),
    tx.quiz.count({ where: w.quiz }),
    tx.lessonCompletion.count({ where: w.lessonCompletion }),
    tx.attachment.count({ where: w.attachment }),
    tx.lesson.count({ where: w.lesson }),
    tx.courseEvent.count({ where: w.courseEvent }),
    findBlobUrls(tx, courseId),
  ]);
  return {
    blobUrls,
    counts: {
      uploadedFiles,
      grades,
      questionGrades,
      assessmentCompletions,
      testSubmissions,
      testQuestions,
      tests,
      assignmentEntries,
      assignments,
      quizzes,
      lessonCompletions,
      attachments,
      lessons,
      courseEvents,
    },
  };
}

/**
 * Deletes everything in B's tables under the course, children first, inside
 * the caller's transaction. Leaves the Course row and A's rows. Returns the
 * Blob URLs to delete once the transaction has committed.
 */
export async function deleteCourseContent(tx: Tx, courseId: string): Promise<CourseContentResult> {
  const w = filters(courseId);
  // Read the links before the rows that hold them go.
  const blobUrls = await findBlobUrls(tx, courseId);

  // Sequential on purpose: one transaction runs one statement at a time, and
  // each step clears the rows the next one's foreign keys would block on.
  const uploadedFiles = (await tx.uploadedFile.deleteMany({ where: w.uploadedFile })).count;
  const grades = (await tx.grade.deleteMany({ where: w.grade })).count;
  const questionGrades = (await tx.questionGrade.deleteMany({ where: w.questionGrade })).count;
  const assessmentCompletions = (await tx.assessmentCompletion.deleteMany({ where: w.assessmentCompletion })).count;
  const testSubmissions = (await tx.testSubmission.deleteMany({ where: w.testSubmission })).count;
  // Sub-questions point at their parent with ON DELETE CASCADE; one
  // statement removing the whole test's tree is fine either way.
  const testQuestions = (await tx.testQuestion.deleteMany({ where: w.testQuestion })).count;
  const tests = (await tx.test.deleteMany({ where: w.test })).count;
  const assignmentEntries = (await tx.submissionEntry.deleteMany({ where: w.submissionEntry })).count;
  const assignments = (await tx.submission.deleteMany({ where: w.submission })).count;
  const quizzes = (await tx.quiz.deleteMany({ where: w.quiz })).count;
  const lessonCompletions = (await tx.lessonCompletion.deleteMany({ where: w.lessonCompletion })).count;
  const attachments = (await tx.attachment.deleteMany({ where: w.attachment })).count;
  // Nested lessons point at their parent with ON DELETE SET NULL, and every
  // one of them has the course's id, so a single statement takes them all.
  const lessons = (await tx.lesson.deleteMany({ where: w.lesson })).count;
  const courseEvents = (await tx.courseEvent.deleteMany({ where: w.courseEvent })).count;

  return {
    blobUrls,
    counts: {
      uploadedFiles,
      grades,
      questionGrades,
      assessmentCompletions,
      testSubmissions,
      testQuestions,
      tests,
      assignmentEntries,
      assignments,
      quizzes,
      lessonCompletions,
      attachments,
      lessons,
      courseEvents,
    },
  };
}
