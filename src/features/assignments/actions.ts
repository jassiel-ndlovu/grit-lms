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
 *   - deleteEntry:       tutor removes one hand-in (replaces DELETE
 *                        /api/submission-entry/[id]); no notification, as
 *                        before.
 *
 * Links come from ../routes (assignmentRoutes).
 */

"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";

import { richColumnsFromInput } from "@/lib/content/columns";
import { prisma } from "@/lib/db";
import { staffFor, enrollmentFor } from "@/features/courses/lib/tenancy-where";
import {
  studentActionClient,
  tutorActionClient,
} from "@/lib/safe-action";
import { emitNotification, notifyHandIn } from "@/features/notifications/server";

import {
  CreateSubmissionInputSchema,
  DeleteEntrySchema,
  DeleteSubmissionSchema,
  GradeSubmissionEntrySchema,
  GradeSubmissionEntryWithSectionsSchema,
  SubmitSubmissionEntrySchema,
  UpdateSubmissionInputSchema,
} from "./schemas";
import {
  sectionQuestionId,
  stringifySectionFeedback,
} from "./lib/sections";
import { assignmentRoutes } from "./routes";

/* ------------------------------------------------------------------------- */
/* createSubmission                                                          */
/* ------------------------------------------------------------------------- */

export const createSubmission = tutorActionClient
  .schema(CreateSubmissionInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { id: true, staff: staffFor(ctx.session.user.email) },
    });
    if (!course) throw new Error("Course not found");
    if (course.staff.length === 0) {
      throw new Error("You don't own this course");
    }

    const brief =
      parsedInput.descriptionJson !== undefined
        ? richColumnsFromInput(parsedInput.descriptionJson, "assignments")
        : null;

    const created = await prisma.submission.create({
      data: {
        title: parsedInput.title,
        description: brief ? brief.markdown : parsedInput.description,
        ...(brief ? { descriptionJson: brief.json } : {}),
        courseId: parsedInput.courseId,
        dueDate: parsedInput.dueDate,
        lastDueDate: parsedInput.lastDueDate,
        fileType: parsedInput.fileType,
        maxAttempts: parsedInput.maxAttempts,
        totalPoints: parsedInput.totalPoints,
        isActive: parsedInput.isActive,
        descriptionFiles: parsedInput.descriptionFiles,
        memoFileUrls: parsedInput.memoFileUrls,
        createdAt: new Date(),
      },
      select: { id: true, title: true, courseId: true, isActive: true },
    });

    if (created.isActive) {
      await emitNotification(
        {
          title: "New Assignment",
          message: `Assignment "${created.title}" has been created.`,
          link: assignmentRoutes.detail(created.id),
          type: "SUBMISSION_CREATED",
          priority: "NORMAL",
          courseId: created.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath(assignmentRoutes.index);
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
      include: { course: { select: { id: true, staff: staffFor(ctx.session.user.email) } } },
    });
    if (!existing) throw new Error("Assignment not found");
    if (existing.course.staff.length === 0) {
      throw new Error("You don't own this assignment");
    }

    const data: Prisma.SubmissionUpdateInput = {};
    if (parsedInput.title !== undefined) data.title = parsedInput.title;
    if (parsedInput.descriptionJson !== undefined) {
      // Both columns from the validated document; browser markdown ignored.
      const brief = richColumnsFromInput(parsedInput.descriptionJson, "assignments");
      data.description = brief.markdown;
      data.descriptionJson = brief.json;
    } else if (parsedInput.description !== undefined) {
      // Markdown alone (no caller does this now): clear the JSON so it
      // can't go stale.
      data.description = parsedInput.description;
      data.descriptionJson = Prisma.DbNull;
    }
    if (parsedInput.dueDate !== undefined) data.dueDate = parsedInput.dueDate;
    if (parsedInput.lastDueDate !== undefined) data.lastDueDate = parsedInput.lastDueDate;
    if (parsedInput.fileType !== undefined) data.fileType = parsedInput.fileType;
    if (parsedInput.maxAttempts !== undefined) data.maxAttempts = parsedInput.maxAttempts;
    if (parsedInput.totalPoints !== undefined) data.totalPoints = parsedInput.totalPoints;
    if (parsedInput.isActive !== undefined) data.isActive = parsedInput.isActive;
    if (parsedInput.descriptionFiles !== undefined)
      data.descriptionFiles = parsedInput.descriptionFiles;
    if (parsedInput.memoFileUrls !== undefined)
      data.memoFileUrls = parsedInput.memoFileUrls;

    const updated = await prisma.submission.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true, courseId: true, title: true, isActive: true },
    });

    if (updated.isActive) {
      const dueChanged =
        parsedInput.dueDate !== undefined &&
        parsedInput.dueDate.getTime() !== existing.dueDate.getTime();
      await emitNotification(
        {
          title: dueChanged ? "Assignment Due Date Changed" : "Assignment Updated",
          // No date in the text: recipients are in different time zones,
          // and the assignment page shows it in each one's own.
          message: dueChanged
            ? `The due date for "${updated.title}" has changed.`
            : `The assignment "${updated.title}" has been updated.`,
          link: assignmentRoutes.detail(updated.id),
          type: "SUBMISSION_UPDATED",
          courseId: updated.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath(assignmentRoutes.detail(updated.id));
    revalidatePath(assignmentRoutes.index);
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
      include: { course: { select: { id: true, staff: staffFor(ctx.session.user.email) } } },
    });
    if (!existing) throw new Error("Assignment not found");
    if (existing.course.staff.length === 0) {
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

    revalidatePath(assignmentRoutes.index);
    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/notifications");

    return { id: parsedInput.id, courseId };
  });

/* ------------------------------------------------------------------------- */
/* deleteEntry                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Tutor deletes one student's hand-in. Tutors keep this by the owner's
 * decision (2026-11-16, design 07 open question 1). Only the tutor who owns
 * the assignment's course may. The entry's grade and section grades cascade.
 * Uploaded files stay in Blob, as with the route this replaces: deleting
 * Blob items is a separate, owner-approved clean-up (AGENTS.md section 4).
 */
export const deleteEntry = tutorActionClient
  .schema(DeleteEntrySchema)
  .action(async ({ parsedInput, ctx }) => {
    const entry = await prisma.submissionEntry.findUnique({
      where: { id: parsedInput.id },
      select: {
        id: true,
        studentId: true,
        submission: { select: { id: true, course: { select: { id: true, staff: staffFor(ctx.session.user.email) } } } },
      },
    });
    if (!entry) throw new Error("Hand-in not found");
    if (entry.submission.course.staff.length === 0) {
      throw new Error("You don't own this assignment");
    }

    await prisma.submissionEntry.delete({ where: { id: entry.id } });

    const submissionId = entry.submission.id;
    revalidatePath(assignmentRoutes.detail(submissionId));
    revalidatePath(assignmentRoutes.student(submissionId, entry.studentId));
    revalidatePath(`/dashboard/gradebook/${entry.submission.course.id}`);

    return { id: entry.id, submissionId };
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
          select: { enrollments: enrollmentFor(student.id) },
        },
      },
    });
    if (!submission) throw new Error("Assignment not found");
    if (!submission.isActive) throw new Error("Assignment is not currently open");
    if (submission.course.enrollments.length === 0) {
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

    await notifyHandIn({
      kind: "assignment",
      title: submission.title,
      courseId: submission.courseId,
      studentId: student.id,
      studentLink: assignmentRoutes.detail(submission.id),
      tutorLink: assignmentRoutes.student(submission.id, student.id),
    });

    revalidatePath(assignmentRoutes.detail(submission.id));
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
            course: { select: { staff: staffFor(ctx.session.user.email) } },
          },
        },
      },
    });
    if (!entry) throw new Error("Entry not found");
    if (entry.submission.course.staff.length === 0) {
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
        link: assignmentRoutes.detail(entry.submission.id),
        type: "SUBMISSION_GRADED",
        priority: "NORMAL",
        studentId,
        courseId: entry.submission.courseId,
      },
      { revalidate: false, email: parsedInput.notifyByEmail },
    );

    revalidatePath(assignmentRoutes.detail(entry.submission.id));
    revalidatePath(
      assignmentRoutes.student(entry.submission.id, studentId),
    );
    revalidatePath(`/dashboard/courses/${entry.submission.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { gradeId: result.gradeId, entryId: entry.id };
  });

/* ------------------------------------------------------------------------- */
/* gradeEntryWithSections                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Extended grading path. Accepts an optional list of sections; each is
 * stored as a QuestionGrade row keyed to the entry. Sections replace any
 * previously-stored sections for this entry (wipe-and-recreate — safe
 * because section rows carry no downstream references).
 *
 * If `sections` is empty, this behaves exactly like `gradeEntry` — the
 * tutor gets to skip section-level breakdown entirely.
 */
export const gradeEntryWithSections = tutorActionClient
  .schema(GradeSubmissionEntryWithSectionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const entry = await prisma.submissionEntry.findUnique({
      where: { id: parsedInput.entryId },
      include: {
        submission: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: { select: { staff: staffFor(ctx.session.user.email) } },
          },
        },
      },
    });
    if (!entry) throw new Error("Entry not found");
    if (entry.submission.course.staff.length === 0) {
      throw new Error("You don't own this assignment");
    }

    const studentId = entry.studentId;

    const result = await prisma.$transaction(async (tx) => {
      // Wipe & recreate the section rows for this entry. Section rows are
      // scoped tightly (questionId like `sec:N`, submissionEntryId set), so
      // there's no risk of collateral loss.
      await tx.questionGrade.deleteMany({
        where: { submissionEntryId: entry.id },
      });

      if (parsedInput.sections.length > 0) {
        await tx.questionGrade.createMany({
          data: parsedInput.sections.map((s, i) => ({
            questionId: sectionQuestionId(i),
            submissionEntryId: entry.id,
            score: s.score,
            outOf: s.outOf,
            feedback: stringifySectionFeedback(s),
          })),
        });
      }

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
        link: assignmentRoutes.detail(entry.submission.id),
        type: "SUBMISSION_GRADED",
        priority: "NORMAL",
        studentId,
        courseId: entry.submission.courseId,
      },
      { revalidate: false, email: parsedInput.notifyByEmail },
    );

    revalidatePath(assignmentRoutes.detail(entry.submission.id));
    revalidatePath(
      assignmentRoutes.student(entry.submission.id, studentId),
    );
    revalidatePath(`/dashboard/courses/${entry.submission.courseId}`);
    revalidatePath("/dashboard/notifications");

    return { gradeId: result.gradeId, entryId: entry.id };
  });
