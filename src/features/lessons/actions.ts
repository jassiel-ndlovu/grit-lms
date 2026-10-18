/**
 * Lesson Server Actions — typed mutations callable from forms.
 *
 * These replace the legacy /api/lessons (POST/PUT/DELETE) and
 * /api/lesson-completions (POST/DELETE) routes. Each action:
 *   1. Runs through tutorActionClient or studentActionClient (auth + role
 *      asserted in middleware).
 *   2. Validates input against a Zod schema (defined in ./schemas).
 *   3. Performs the mutation against Prisma.
 *   4. Calls revalidatePath on affected routes so RSC pages re-fetch.
 *   5. Returns a typed result the form can consume.
 *
 * Attachment uploads are handled out-of-band: the browser uploads each file
 * to Vercel Blob via /api/blob/upload-token first, then submits the
 * resulting `{ title, url }` pairs as part of the form. This bypasses the
 * 4.5 MB Vercel function body limit.
 */

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { deleteBlob } from "@/lib/blob/server";
import {
  tutorActionClient,
  studentActionClient,
} from "@/lib/safe-action";
import { emitNotification } from "@/features/notifications/server";

import {
  CreateLessonSchema,
  DeleteLessonSchema,
  MarkLessonCompleteSchema,
  ReorderLessonsSchema,
  UnmarkLessonCompleteSchema,
  UpdateLessonLabelSchemeSchema,
  UpdateLessonSchema,
  type LessonOrderNode,
} from "./schemas";
import { subtreeIds } from "./lib/lesson-tree";

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Best-effort cleanup of a list of blob URLs. Errors are swallowed —
 * cleanup failure should never abort the surrounding mutation.
 */
async function cleanupAttachmentBlobs(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (u) => {
      try {
        await deleteBlob(u);
      } catch {
        // Best-effort; log if needed but don't fail the action.
      }
    }),
  );
}

/** A parent must be a lesson in the same course. Throws otherwise. */
async function assertParentInCourse(parentId: string, courseId: string): Promise<void> {
  const parent = await prisma.lesson.findUnique({
    where: { id: parentId },
    select: { courseId: true },
  });
  if (!parent || parent.courseId !== courseId) {
    throw new Error("Parent lesson not found in this course");
  }
}

function revalidateCourseLessons(courseId: string): void {
  revalidatePath(`/dashboard/manage-courses/lessons/${courseId}`);
  revalidatePath(`/dashboard/courses/lessons/${courseId}`);
  revalidatePath(`/dashboard/manage-courses/${courseId}`);
  revalidatePath(`/dashboard/courses/${courseId}`);
}

/* ------------------------------------------------------------------------- */
/* createLesson                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Create a lesson under a course owned by the calling tutor.
 *
 * Side-effects preserved from the legacy /api/lessons POST:
 *   - Auto-creates a LESSON_CREATED notification linked to the course.
 *   - Nested-creates attachments via Prisma `attachmentUrls.create`.
 */
export const createLesson = tutorActionClient
  .schema(CreateLessonSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Ownership check — the tutor must own the course this lesson is for.
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { id: true, tutor: { select: { email: true } } },
    });
    if (!course) {
      throw new Error("Course not found");
    }
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }
    if (parsedInput.parentId) {
      await assertParentInCourse(parsedInput.parentId, parsedInput.courseId);
    }
    const isGroup = parsedInput.type === "NONE";

    const created = await prisma.lesson.create({
      data: {
        title: parsedInput.title,
        // A group heading carries no content of its own.
        description: isGroup ? null : parsedInput.description,
        order: parsedInput.order ?? 0,
        duration: isGroup ? null : parsedInput.duration ?? null,
        videoUrl: isGroup ? [] : parsedInput.videoUrl ?? [],
        type: parsedInput.type,
        ...(parsedInput.parentId ? { parent: { connect: { id: parsedInput.parentId } } } : {}),
        course: { connect: { id: parsedInput.courseId } },
        attachmentUrls: {
          create: (isGroup ? [] : parsedInput.attachments ?? []).map((a) => ({
            title: a.title,
            url: a.url,
          })),
        },
      },
      select: { id: true, title: true, courseId: true },
    });

    // Fan out to enrolled students via the notifications feature. We pass
    // `revalidate: false` because this action already revalidates
    // /dashboard below — letting emitNotification do it again would be
    // duplicate work. Group headings have nothing to read, so no alert.
    if (!isGroup) {
      await emitNotification(
        {
          title: "New Lesson Published",
          message: `Lesson "${created.title}" has been published.`,
          link: `/dashboard/courses/lessons/${created.courseId}`,
          type: "LESSON_CREATED",
          priority: "NORMAL",
          courseId: created.courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath(`/dashboard/manage-courses/lessons/${created.courseId}`);
    revalidatePath(`/dashboard/courses/lessons/${created.courseId}`);
    revalidatePath(`/dashboard/manage-courses/${created.courseId}`);
    revalidatePath(`/dashboard/courses/${created.courseId}`);
    // Fresh notifications also need to surface in the bell on /dashboard.
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");

    return { id: created.id, courseId: created.courseId };
  });

/* ------------------------------------------------------------------------- */
/* updateLesson                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Update a lesson. Only the tutor that owns the parent course may update it.
 *
 * `attachments`, when supplied, REPLACES the attachment set:
 *   1. The existing attachments are read so their blob URLs can be cleaned
 *      up after the swap.
 *   2. Prisma `deleteMany + create` swaps the rows atomically.
 *   3. Old blobs whose URLs aren't in the new set are deleted best-effort.
 */
export const updateLesson = tutorActionClient
  .schema(UpdateLessonSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.lesson.findUnique({
      where: { id: parsedInput.id },
      include: {
        attachmentUrls: { select: { url: true } },
        course: { select: { id: true, tutor: { select: { email: true } } } },
      },
    });

    if (!existing) {
      throw new Error("Lesson not found");
    }
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this lesson");
    }

    const data: Record<string, unknown> = {};
    if (parsedInput.title !== undefined) data.title = parsedInput.title;
    if (parsedInput.description !== undefined)
      data.description = parsedInput.description;
    if (parsedInput.order !== undefined) data.order = parsedInput.order;
    if (parsedInput.duration !== undefined) data.duration = parsedInput.duration;
    if (parsedInput.videoUrl !== undefined) data.videoUrl = parsedInput.videoUrl;
    if (parsedInput.type !== undefined) data.type = parsedInput.type;
    if (parsedInput.parentId !== undefined) {
      if (parsedInput.parentId === null) {
        data.parentId = null;
      } else {
        await assertParentInCourse(parsedInput.parentId, existing.course.id);
        // Nesting a lesson under itself or one of its own descendants
        // would cut the whole branch off the tree.
        const rows = await prisma.lesson.findMany({
          where: { courseId: existing.course.id },
          select: { id: true, parentId: true, order: true, createdAt: true },
        });
        if (subtreeIds(rows, existing.id).has(parsedInput.parentId)) {
          throw new Error("A lesson can't be placed inside itself");
        }
        data.parentId = parsedInput.parentId;
      }
    }
    if (parsedInput.attachments !== undefined) {
      data.attachmentUrls = {
        deleteMany: {},
        create: parsedInput.attachments.map((a) => ({
          title: a.title,
          url: a.url,
        })),
      };
    }

    const updated = await prisma.lesson.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true, courseId: true, title: true, type: true },
    });

    // Only content edits are news; moving a lesson around the tree isn't.
    const contentChanged =
      parsedInput.title !== undefined ||
      parsedInput.description !== undefined ||
      parsedInput.videoUrl !== undefined ||
      parsedInput.attachments !== undefined;
    if (contentChanged && updated.type !== "NONE") {
      await emitNotification(
        {
          title: "Lesson Updated",
          message: `Lesson "${updated.title}" has been updated.`,
          link: `/dashboard/courses/lessons/${updated.courseId}`,
          type: "LESSON_UPDATED",
          courseId: updated.courseId,
        },
        { revalidate: false },
      );
    }

    // Best-effort cleanup of orphaned attachment blobs.
    if (parsedInput.attachments !== undefined) {
      const newUrls = new Set(parsedInput.attachments.map((a) => a.url));
      const stale = existing.attachmentUrls
        .map((a) => a.url)
        .filter((u) => !newUrls.has(u));
      if (stale.length > 0) {
        await cleanupAttachmentBlobs(stale);
      }
    }

    revalidatePath(`/dashboard/manage-courses/lessons/${updated.courseId}`);
    revalidatePath(`/dashboard/courses/lessons/${updated.courseId}`);
    revalidatePath(`/dashboard/manage-courses/${updated.courseId}`);
    revalidatePath(`/dashboard/courses/${updated.courseId}`);

    return { id: updated.id, courseId: updated.courseId };
  });

/* ------------------------------------------------------------------------- */
/* deleteLesson                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Delete a lesson. Cleans up its attachment blobs after the row is removed.
 * Attachment rows themselves cascade via Prisma `onDelete: Cascade` on the
 * Attachment.lessonId relation.
 */
export const deleteLesson = tutorActionClient
  .schema(DeleteLessonSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.lesson.findUnique({
      where: { id: parsedInput.id },
      include: {
        attachmentUrls: { select: { url: true } },
        course: { select: { id: true, tutor: { select: { email: true } } } },
      },
    });

    if (!existing) {
      throw new Error("Lesson not found");
    }
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this lesson");
    }

    const courseId = existing.course.id;
    const attachmentUrls = existing.attachmentUrls.map((a) => a.url);

    // Deleting a group must not delete its lessons: hand them to the
    // deleted lesson's own parent, after its position.
    await prisma.$transaction([
      prisma.lesson.updateMany({
        where: { parentId: parsedInput.id },
        data: { parentId: existing.parentId, order: { increment: existing.order + 1 } },
      }),
      prisma.lesson.delete({ where: { id: parsedInput.id } }),
    ]);

    // Best-effort cleanup of all attachment blobs.
    if (attachmentUrls.length > 0) {
      await cleanupAttachmentBlobs(attachmentUrls);
    }

    if (existing.type !== "NONE") {
      await emitNotification(
        {
          title: "Lesson Removed",
          message: `Lesson "${existing.title}" has been removed.`,
          link: `/dashboard/courses/lessons/${courseId}`,
          type: "LESSON_DELETED",
          courseId,
        },
        { revalidate: false },
      );
    }

    revalidatePath(`/dashboard/manage-courses/lessons/${courseId}`);
    revalidatePath(`/dashboard/courses/lessons/${courseId}`);
    revalidatePath(`/dashboard/manage-courses/${courseId}`);
    revalidatePath(`/dashboard/courses/${courseId}`);

    return { id: parsedInput.id, courseId };
  });

/* ------------------------------------------------------------------------- */
/* reorderLessons / updateLessonLabelScheme                                  */
/* ------------------------------------------------------------------------- */

/**
 * Apply a whole arrangement from the reorder dialog: every lesson's parent
 * and sibling position in one transaction.
 */
export const reorderLessons = tutorActionClient
  .schema(ReorderLessonsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { tutor: { select: { email: true } }, lessons: { select: { id: true } } },
    });
    if (!course) throw new Error("Course not found");
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    const updates: Array<{ id: string; parentId: string | null; order: number }> = [];
    const walk = (list: LessonOrderNode[], parentId: string | null) =>
      list.forEach((n, i) => {
        updates.push({ id: n.id, parentId, order: i });
        walk(n.children, n.id);
      });
    walk(parsedInput.tree, null);

    const known = new Set(course.lessons.map((l) => l.id));
    const seen = new Set(updates.map((u) => u.id));
    if (
      seen.size !== updates.length ||
      seen.size !== known.size ||
      updates.some((u) => !known.has(u.id))
    ) {
      throw new Error("The lesson list changed while you were arranging it — reload and try again.");
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.lesson.update({
          where: { id: u.id },
          data: { parentId: u.parentId, order: u.order },
        }),
      ),
    );

    revalidateCourseLessons(parsedInput.courseId);
    return { count: updates.length };
  });

export const updateLessonLabelScheme = tutorActionClient
  .schema(UpdateLessonLabelSchemeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { tutor: { select: { email: true } } },
    });
    if (!course) throw new Error("Course not found");
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }
    await prisma.course.update({
      where: { id: parsedInput.courseId },
      data: { lessonLabelScheme: parsedInput.scheme },
    });
    revalidateCourseLessons(parsedInput.courseId);
    return { ok: true };
  });

/* ------------------------------------------------------------------------- */
/* markLessonComplete                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Mark a lesson complete for the calling student.
 *
 * The studentId is resolved from the session — the client never supplies it.
 * Idempotent: if a (studentId, lessonId) row already exists, this returns
 * the existing row instead of failing on the unique constraint.
 *
 * Side-effect preserved from the legacy POST: writes a LESSON_COMPLETED
 * ActivityLog row.
 */
export const markLessonComplete = studentActionClient
  .schema(MarkLessonCompleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) {
      throw new Error("Student profile not found");
    }

    // Look up the lesson so we know which course to revalidate.
    const lesson = await prisma.lesson.findUnique({
      where: { id: parsedInput.lessonId },
      select: { id: true, courseId: true },
    });
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    // Idempotent create — return existing row if already marked.
    const existing = await prisma.lessonCompletion.findFirst({
      where: { studentId: student.id, lessonId: lesson.id },
    });
    const completion =
      existing ??
      (await prisma.lessonCompletion.create({
        data: {
          studentId: student.id,
          lessonId: lesson.id,
          completedAt: new Date(),
        },
      }));

    if (!existing) {
      await prisma.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "LESSON_COMPLETED",
          targetId: lesson.id,
        },
      });
    }

    revalidatePath(`/dashboard/courses/lessons/${lesson.courseId}`);
    revalidatePath(`/dashboard/courses/${lesson.courseId}`);

    return { id: completion.id, lessonId: lesson.id };
  });

/* ------------------------------------------------------------------------- */
/* unmarkLessonComplete                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Unmark a lesson — deletes the (studentId, lessonId) completion if it
 * exists. No-op if there's no completion to remove.
 */
export const unmarkLessonComplete = studentActionClient
  .schema(UnmarkLessonCompleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) {
      throw new Error("Student profile not found");
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: parsedInput.lessonId },
      select: { id: true, courseId: true },
    });
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    await prisma.lessonCompletion.deleteMany({
      where: { studentId: student.id, lessonId: lesson.id },
    });

    revalidatePath(`/dashboard/courses/lessons/${lesson.courseId}`);
    revalidatePath(`/dashboard/courses/${lesson.courseId}`);

    return { lessonId: lesson.id };
  });
