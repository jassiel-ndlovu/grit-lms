/**
 * Assessment (Test) Server Actions — typed mutations callable from forms.
 *
 * Replace the legacy /api/tests + /api/test-submission + /api/grades routes.
 *
 * Side-effects preserved from the legacy routes:
 *   - createTest:  emits TEST_CREATED when isActive (no notification on draft).
 *   - updateTest:  emits TEST_UPDATED when isActive.
 *   - deleteTest:  emits TEST_DELETED unconditionally.
 *   - submitTest:  flips submission status + writes TEST_COMPLETED activity log.
 *   - gradeTest:   upserts Grade + replaces QuestionGrades + emits TEST_GRADED.
 *
 * The TestQuestion tree is created in one Prisma transaction. Sub-questions
 * are stored via the self-relation parentId; we walk the input tree depth
 * first, creating each level then recursing with the freshly-minted id as
 * the parent for the next level.
 */

"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";
import {
  studentActionClient,
  tutorActionClient,
} from "@/lib/safe-action";
import { emitNotification } from "@/features/notifications/server";

import {
  CreateTestWithQuestionsSchema,
  DeleteTestSchema,
  GradeTestSubmissionSchema,
  StartTestSubmissionSchema,
  SaveTestAnswersDraftSchema,
  SubmitTestAnswersSchema,
  UpdateTestWithQuestionsSchema,
  type CreateTestQuestionTree,
} from "./schemas";

/* ------------------------------------------------------------------------- */
/* Question tree helper                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Insert a question tree under a test. Walks the tree depth-first; for each
 * level we create rows with the inherited parentId, then recurse using
 * each new row's id as the parent for the next level.
 *
 * Runs inside a Prisma transaction (caller passes the tx client) so the
 * whole tree commits or rolls back atomically.
 */
async function createQuestionTree(
  tx: Prisma.TransactionClient,
  testId: string,
  nodes: CreateTestQuestionTree[],
  parentId: string | null = null,
): Promise<void> {
  for (const node of nodes) {
    const created = await tx.testQuestion.create({
      data: {
        testId,
        parentId,
        order: node.order ?? null,
        question: node.question,
        type: node.type,
        points: node.points,
        options: node.options ?? [],
        answer:
          node.answer === undefined
            ? Prisma.JsonNull
            : (node.answer as Prisma.InputJsonValue),
        language: node.language ?? null,
        matchPairs:
          node.matchPairs === undefined
            ? Prisma.JsonNull
            : (node.matchPairs as Prisma.InputJsonValue),
        reorderItems: node.reorderItems ?? [],
        blankCount: node.blankCount ?? null,
      },
      select: { id: true },
    });

    if (node.subQuestions && node.subQuestions.length > 0) {
      await createQuestionTree(tx, testId, node.subQuestions, created.id);
    }
  }
}

/* ------------------------------------------------------------------------- */
/* createTest                                                                 */
/* ------------------------------------------------------------------------- */

export const createTest = tutorActionClient
  .schema(CreateTestWithQuestionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Ownership: the tutor must own the course this test is for.
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { id: true, tutor: { select: { email: true } } },
    });
    if (!course) throw new Error("Course not found");
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    const created = await prisma.$transaction(async (tx) => {
      const test = await tx.test.create({
        data: {
          title: parsedInput.title,
          description: parsedInput.description,
          preTestInstructions: parsedInput.preTestInstructions,
          courseId: parsedInput.courseId,
          dueDate: parsedInput.dueDate,
          timeLimit: parsedInput.timeLimit,
          totalPoints: parsedInput.totalPoints,
          isActive: parsedInput.isActive,
        },
        select: { id: true, title: true, courseId: true, isActive: true },
      });

      if (parsedInput.questions.length > 0) {
        await createQuestionTree(tx, test.id, parsedInput.questions);
      }

      return test;
    });

    if (created.isActive) {
      await emitNotification(
        {
          title: "New Test Created",
          message: `A new test "${created.title}" has been published.`,
          link: `/dashboard/tests/${created.id}`,
          type: "TEST_CREATED",
          priority: "NORMAL",
          courseId: created.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath("/dashboard/tutor-tests");
    revalidatePath(`/dashboard/courses/${created.courseId}`);
    revalidatePath("/dashboard/tests");
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");

    return { id: created.id, courseId: created.courseId };
  });

/* ------------------------------------------------------------------------- */
/* updateTest                                                                 */
/* ------------------------------------------------------------------------- */

export const updateTest = tutorActionClient
  .schema(UpdateTestWithQuestionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.test.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Test not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this test");
    }

    const data: Prisma.TestUpdateInput = {};
    if (parsedInput.title !== undefined) data.title = parsedInput.title;
    if (parsedInput.description !== undefined) data.description = parsedInput.description;
    if (parsedInput.preTestInstructions !== undefined)
      data.preTestInstructions = parsedInput.preTestInstructions;
    if (parsedInput.dueDate !== undefined) data.dueDate = parsedInput.dueDate;
    if (parsedInput.timeLimit !== undefined) data.timeLimit = parsedInput.timeLimit;
    if (parsedInput.totalPoints !== undefined) data.totalPoints = parsedInput.totalPoints;
    if (parsedInput.isActive !== undefined) data.isActive = parsedInput.isActive;

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.test.update({
        where: { id: parsedInput.id },
        data,
        select: { id: true, title: true, courseId: true, isActive: true },
      });

      if (parsedInput.questions !== undefined) {
        // Replace the tree atomically. Cascade deletes the sub-question rows.
        await tx.testQuestion.deleteMany({ where: { testId: t.id } });
        if (parsedInput.questions.length > 0) {
          await createQuestionTree(tx, t.id, parsedInput.questions);
        }
      }

      return t;
    });

    if (updated.isActive) {
      await emitNotification(
        {
          title: "Test Updated",
          message: `The test "${updated.title}" has been updated.`,
          link: `/dashboard/tests/${updated.id}`,
          type: "TEST_UPDATED",
          priority: "NORMAL",
          courseId: updated.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath("/dashboard/tutor-tests");
    revalidatePath(`/dashboard/tutor-tests/create/${updated.id}`);
    revalidatePath(`/dashboard/courses/${updated.courseId}`);
    revalidatePath("/dashboard/tests");
    revalidatePath("/dashboard/notifications");

    return { id: updated.id, courseId: updated.courseId };
  });

/* ------------------------------------------------------------------------- */
/* deleteTest                                                                 */
/* ------------------------------------------------------------------------- */

export const deleteTest = tutorActionClient
  .schema(DeleteTestSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.test.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Test not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this test");
    }

    const courseId = existing.course.id;
    const title = existing.title;

    await prisma.test.delete({ where: { id: parsedInput.id } });

    await emitNotification(
      {
        title: "Test Deleted",
        message: `The test "${title}" has been removed.`,
        type: "TEST_DELETED",
        priority: "NORMAL",
        courseId,
      },
      { revalidate: false },
    );

    revalidatePath("/dashboard/tutor-tests");
    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/tests");
    revalidatePath("/dashboard/notifications");

    return { id: parsedInput.id, courseId };
  });

/* ------------------------------------------------------------------------- */
/* startTestSubmission                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Begin a fresh test attempt for the calling student. Idempotent — if the
 * student already has an IN_PROGRESS row, returns it instead of creating
 * a duplicate.
 */
export const startTestSubmission = studentActionClient
  .schema(StartTestSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) throw new Error("Student profile not found");

    // Enrolment + active check.
    const test = await prisma.test.findUnique({
      where: { id: parsedInput.testId },
      select: {
        id: true,
        isActive: true,
        course: { select: { students: { where: { id: student.id }, select: { id: true } } } },
      },
    });
    if (!test) throw new Error("Test not found");
    if (!test.isActive) throw new Error("Test is not currently available");
    if (test.course.students.length === 0) {
      throw new Error("You're not enrolled in this course");
    }

    const existing = await prisma.testSubmission.findFirst({
      where: { studentId: student.id, testId: test.id, status: "IN_PROGRESS" },
      select: { id: true },
    });

    const submission =
      existing ??
      (await prisma.testSubmission.create({
        data: {
          studentId: student.id,
          testId: test.id,
          startedAt: new Date(),
          status: "IN_PROGRESS",
          answers: Prisma.JsonNull,
        },
        select: { id: true },
      }));

    revalidatePath(`/dashboard/tests/${test.id}`);

    return { id: submission.id, testId: test.id };
  });

/* ------------------------------------------------------------------------- */
/* submitTestAnswers                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Final submission — flips the row to SUBMITTED, stamps submittedAt, writes
 * a TEST_COMPLETED activity log, and emits a TEST_DUE notification linking
 * back to the review page. Tutor grades from there.
 */
export const submitTestAnswers = studentActionClient
  .schema(SubmitTestAnswersSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) throw new Error("Student profile not found");

    const submission = await prisma.testSubmission.findUnique({
      where: { id: parsedInput.submissionId },
      include: { test: { select: { id: true, title: true, courseId: true } } },
    });
    if (!submission) throw new Error("Submission not found");
    if (submission.studentId !== student.id) {
      throw new Error("This submission isn't yours");
    }
    if (submission.status === "SUBMITTED" || submission.status === "GRADED") {
      throw new Error("This submission has already been submitted");
    }

    const updated = await prisma.testSubmission.update({
      where: { id: submission.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        answers: parsedInput.answers as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        action: "TEST_COMPLETED",
        targetId: submission.test.id,
      },
    });

    await emitNotification(
      {
        title: "Test Submitted",
        message: `Your test "${submission.test.title}" has been submitted.`,
        link: `/dashboard/tests/review/${submission.test.id}`,
        type: "TEST_DUE",
        priority: "NORMAL",
        studentId: student.id,
        courseId: submission.test.courseId,
      },
      { revalidate: false },
    );

    revalidatePath(`/dashboard/tests/${submission.test.id}`);
    revalidatePath(`/dashboard/tests/review/${submission.test.id}`);
    revalidatePath(`/dashboard/courses/${submission.test.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { id: updated.id, testId: submission.test.id };
  });

/* ------------------------------------------------------------------------- */
/* gradeTestSubmission                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Tutor grades a submitted test. Creates or updates the single Grade row
 * for the submission (unique by testSubmissionId) and replaces all
 * QuestionGrade rows. Emits TEST_GRADED to the student.
 */
export const gradeTestSubmission = tutorActionClient
  .schema(GradeTestSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const submission = await prisma.testSubmission.findUnique({
      where: { id: parsedInput.submissionId },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: { select: { tutor: { select: { email: true } } } },
          },
        },
      },
    });
    if (!submission) throw new Error("Submission not found");
    if (submission.test.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this test");
    }

    const studentId = submission.studentId;
    const result = await prisma.$transaction(async (tx) => {
      // Upsert the course-level Grade row.
      const grade = await tx.grade.upsert({
        where: { testSubmissionId: submission.id },
        update: {
          score: parsedInput.score,
          outOf: parsedInput.outOf,
          finalComments: parsedInput.feedback,
          updatedAt: new Date(),
        },
        create: {
          studentId,
          courseId: submission.test.courseId,
          type: "TEST",
          title: submission.test.title,
          score: parsedInput.score,
          outOf: parsedInput.outOf,
          finalComments: parsedInput.feedback,
          testSubmissionId: submission.id,
        },
        select: { id: true },
      });

      // Replace per-question grades for this submission.
      await tx.questionGrade.deleteMany({
        where: { testSubmissionId: submission.id },
      });

      if (parsedInput.questionGrades.length > 0) {
        await tx.questionGrade.createMany({
          data: parsedInput.questionGrades.map((qg) => ({
            questionId: qg.questionId,
            score: qg.score,
            outOf: qg.outOf,
            feedback: qg.feedback,
            testSubmissionId: submission.id,
          })),
        });
      }

      // Mark the submission GRADED + persist the rolled-up score/feedback
      // so the student review page can read it without joining Grade.
      await tx.testSubmission.update({
        where: { id: submission.id },
        data: {
          status: "GRADED",
          score: parsedInput.score,
          feedback: parsedInput.feedback,
        },
      });

      return { gradeId: grade.id };
    });

    await emitNotification(
      {
        title: "Grade Released",
        message: `You received ${parsedInput.score}/${parsedInput.outOf} for "${submission.test.title}".`,
        link: `/dashboard/tests/review/${submission.test.id}`,
        type: "TEST_GRADED",
        priority: "NORMAL",
        studentId,
      },
      { revalidate: false },
    );

    revalidatePath(`/dashboard/tutor-tests/submissions/${submission.test.id}`);
    revalidatePath(
      `/dashboard/tutor-tests/submissions/${submission.test.id}/${studentId}`,
    );
    revalidatePath(`/dashboard/tests/review/${submission.test.id}`);
    revalidatePath("/dashboard/notifications");

    return { gradeId: result.gradeId, submissionId: submission.id };
  });

/* ------------------------------------------------------------------------- */
/* saveTestAnswersDraft                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Periodic in-progress save while the student is mid-test. Validates that
 * the submission belongs to the calling student and that it's still
 * IN_PROGRESS (refuses to overwrite SUBMITTED / GRADED rows). Doesn't emit
 * notifications or revalidate the bell — this fires on a debounce.
 */
export const saveTestAnswersDraft = studentActionClient
  .schema(SaveTestAnswersDraftSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) throw new Error("Student profile not found");

    const submission = await prisma.testSubmission.findUnique({
      where: { id: parsedInput.submissionId },
      select: { studentId: true, status: true },
    });
    if (!submission) throw new Error("Submission not found");
    if (submission.studentId !== student.id) {
      throw new Error("This submission isn't yours");
    }
    if (submission.status !== "IN_PROGRESS") {
      throw new Error("This submission is no longer editable");
    }

    await prisma.testSubmission.update({
      where: { id: parsedInput.submissionId },
      data: { answers: parsedInput.answers as Prisma.InputJsonValue },
      select: { id: true },
    });

    return { ok: true };
  });
