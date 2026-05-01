/**
 * Submission (assignment) Server Actions.
 *
 * Replaces /api/submissions and /api/submission-entry routes. Side-effects
 * preserved:
 *   - createSubmission:  emits SUBMISSION_CREATED to the course.
 *   - submitEntry:       writes ASSIGNMENT_SUBMITTED activity log + emits
 *                        SUBMISSION_DUE to the student (legacy "we got it"
 *                        receipt).
 *   - gradeEntry:        upserts Grade + emits SUBMISSION_GRADED with score.
 *
 * Note: legacy notif link `/dashboard//submissions/...` had a double-slash
 * bug — we fix it here to `/dashboard/submissions/...`.
 */

"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";
import {
  studentActionClient,
  tutorActionClient,
} from "@/lib/safe-action";
import { emitNotification } from "@/features/notifications/server";

import {
  CreateSubmissionInputSchema,
  DeleteSubmissionSchema,
  GradeSubmissionEntrySchema,
  SubmitSubmissionEntrySchema,
  UpdateSubmissionInputSchema,
} from "./schemas";

/* ------------------------------------------------------------------------- */
/* createSubmission                                                          */
/* ------------------------------------------------------------------------- */

export const createSubmission = tutorActionClient
  .schema(CreateSubmissionInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { id: true, tutor: { select: { email: true } } },
    });
    if (!course) throw new Error("Course not found");
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    const created = await prisma.submission.create({
      data: {
        title: parsedInput.title,
        description: parsedInput.description,
        courseId: parsedInput.courseId,
        dueDate: parsedInput.dueDate,
        lastDueDate: parsedInput.lastDueDate,
        fileType: parsedInput.fileType,
        maxAttempts: parsedInput.maxAttempts,
        totalPoints: parsedInput.totalPoints,
        isActive: parsedInput.isActive,
        descriptionFiles: parsedInput.descriptionFiles,
        createdAt: new Date(),
      },
      select: { id: true, title: true, courseId: true, isActive: true },
    });

    if (created.isActive) {
      await emitNotification(
        {
          title: "New Assignment",
          message: `Assignment "${created.title}" has been created.`,
          link: `/dashboard/submissions/${created.id}`,
          type: "SUBMISSION_CREATED",
          priority: "NORMAL",
          courseId: created.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath("/dashboard/submissions");
    revalidatePath(`/dashboard/courses/${created.courseId}`);
    revalidatePath(`/dashboard/manage-courses/${created.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { id: created.id, courseId: created.courseId };
  });

/* ------------------------------------------------------------------------- */
/* updateSubmission                                                          */
/* ------------------------------------------------------------------------- */

export const updateSubmission = tutorActionClient
  .schema(UpdateSubmissionInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.submission.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Assignment not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this assignment");
    }

    const data: Prisma.SubmissionUpdateInput = {};
    if (parsedInput.title !== undefined) data.title = parsedInput.title;
    if (parsedInput.description !== undefined) data.description = parsedInput.description;
    if (parsedInput.dueDate !== undefined) data.dueDate = parsedInput.dueDate;
    if (parsedInput.lastDueDate !== undefined) data.lastDueDate = parsedInput.lastDueDate;
    if (parsedInput.fileType !== undefined) data.fileType = parsedInput.fileType;
    if (parsedInput.maxAttempts !== undefined) data.maxAttempts = parsedInput.maxAttempts;
    if (parsedInput.totalPoints !== undefined) data.totalPoints = parsedInput.totalPoints;
    if (parsedInput.isActive !== undefined) data.isActive = parsedInput.isActive;
    if (parsedInput.descriptionFiles !== undefined)
      data.descriptionFiles = parsedInput.descriptionFiles;

    const updated = await prisma.submission.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true, courseId: true },
    });

    revalidatePath(`/dashboard/submissions/${updated.id}`);
    revalidatePath("/dashboard/submissions");
    revalidatePath(`/dashboard/courses/${updated.courseId}`);

    return { id: updated.id, courseId: updated.courseId };
  });

/* ------------------------------------------------------------------------- */
/* deleteSubmission                                                          */
/* ------------------------------------------------------------------------- */

export const deleteSubmission = tutorActionClient
  .schema(DeleteSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.submission.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Assignment not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this assignment");
    }

    const courseId = existing.course.id;
    const title = existing.title;

    await prisma.submission.delete({ where: { id: parsedInput.id } });

    await emitNotification(
      {
        title: "Assignment Deleted",
        message: `The assignment "${title}" has been removed.`,
        type: "SUBMISSION_DELETED",
        priority: "NORMAL",
        courseId,
      },
      { revalidate: false },
    );

    revalidatePath("/dashboard/submissions");
    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/notifications");

    return { id: parsedInput.id, courseId };
  });

/* ------------------------------------------------------------------------- */
/* submitEntry                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Student submits a SubmissionEntry. Idempotent on (submissionId, studentId)
 * — bumps `attemptNumber` if the student is resubmitting under a
 * `maxAttempts` policy, otherwise updates the existing row.
 */
export const submitEntry = studentActionClient
  .schema(SubmitSubmissionEntrySchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) throw new Error("Student profile not found");

    const submission = await prisma.submission.findUnique({
      where: { id: parsedInput.submissionId },
      select: {
        id: true,
        title: true,
        courseId: true,
        maxAttempts: true,
        isActive: true,
        course: {
          select: { students: { where: { id: student.id }, select: { id: true } } },
        },
      },
    });
    if (!submission) throw new Error("Assignment not found");
    if (!submission.isActive) throw new Error("Assignment is not currently open");
    if (submission.course.students.length === 0) {
      throw new Error("You're not enrolled in this course");
    }

    const existing = await prisma.submissionEntry.findFirst({
      where: { studentId: student.id, submissionId: submission.id },
      orderBy: { attemptNumber: "desc" },
      select: { id: true, attemptNumber: true },
    });

    let entry: { id: string; attemptNumber: number };
    if (existing) {
      // Bump attempt only if the assignment allows multiple attempts.
      const next =
        submission.maxAttempts && submission.maxAttempts > 1
          ? existing.attemptNumber + 1
          : existing.attemptNumber;
      entry = await prisma.submissionEntry.update({
        where: { id: existing.id },
        data: {
          submittedAt: new Date(),
          status: "SUBMITTED",
          fileUrl: parsedInput.fileUrl,
          attemptNumber: next,
        },
        select: { id: true, attemptNumber: true },
      });
    } else {
      entry = await prisma.submissionEntry.create({
        data: {
          studentId: student.id,
          submissionId: submission.id,
          submittedAt: new Date(),
          attemptNumber: 1,
          status: "SUBMITTED",
          feedback: "",
          fileUrl: parsedInput.fileUrl,
        },
        select: { id: true, attemptNumber: true },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        action: "ASSIGNMENT_SUBMITTED",
        targetId: submission.id,
      },
    });

    await emitNotification(
      {
        title: "Assignment Submitted",
        message: `Your submission for "${submission.title}" has been received.`,
        link: `/dashboard/submissions/${submission.id}`,
        type: "SUBMISSION_DUE",
        priority: "NORMAL",
        studentId: student.id,
        courseId: submission.courseId,
      },
      { revalidate: false },
    );

    revalidatePath(`/dashboard/submissions/${submission.id}`);
    revalidatePath(`/dashboard/courses/${submission.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { id: entry.id, submissionId: submission.id };
  });

/* ------------------------------------------------------------------------- */
/* gradeEntry                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Tutor grades an entry. Mirrors gradeTestSubmission in features/assessments
 * — upserts the Grade row by submissionEntryId unique, and emits
 * SUBMISSION_GRADED with the score in the message.
 */
export const gradeEntry = tutorActionClient
  .schema(GradeSubmissionEntrySchema)
  .action(async ({ parsedInput, ctx }) => {
    const entry = await prisma.submissionEntry.findUnique({
      where: { id: parsedInput.entryId },
      include: {
        submission: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: { select: { tutor: { select: { email: true } } } },
          },
        },
      },
    });
    if (!entry) throw new Error("Entry not found");
    if (entry.submission.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this assignment");
    }

    const studentId = entry.studentId;
    const result = await prisma.$transaction(async (tx) => {
      const grade = await tx.grade.upsert({
        where: { submissionEntryId: entry.id },
        update: {
          score: parsedInput.score,
          outOf: parsedInput.outOf,
          finalComments: parsedInput.feedback,
          updatedAt: new Date(),
        },
        create: {
          studentId,
          courseId: entry.submission.courseId,
          type: "SUBMISSION",
          title: entry.submission.title,
          score: parsedInput.score,
          outOf: parsedInput.outOf,
          finalComments: parsedInput.feedback,
          submissionEntryId: entry.id,
        },
        select: { id: true },
      });

      await tx.submissionEntry.update({
        where: { id: entry.id },
        data: { status: "GRADED", feedback: parsedInput.feedback ?? "" },
      });

      return { gradeId: grade.id };
    });

    await emitNotification(
      {
        title: "Grade Released",
        message: `You received ${parsedInput.score}/${parsedInput.outOf} for "${entry.submission.title}".`,
        link: `/dashboard/submissions/${entry.submission.id}`,
        type: "SUBMISSION_GRADED",
        priority: "NORMAL",
        studentId,
      },
      { revalidate: false },
    );

    revalidatePath(`/dashboard/submissions/${entry.submission.id}`);
    revalidatePath(`/dashboard/courses/${entry.submission.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { gradeId: result.gradeId, entryId: entry.id };
  });
