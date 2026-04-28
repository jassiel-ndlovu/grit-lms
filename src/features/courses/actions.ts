/**
 * Course Server Actions — typed mutations callable from forms.
 *
 * These replace the legacy /api/courses POST/PUT/DELETE routes. Each action:
 *   1. Runs through the tutorActionClient (auth + role asserted in middleware)
 *   2. Validates input against a Zod schema (defined in ./schemas)
 *   3. Performs the mutation against Prisma
 *   4. Calls revalidatePath on affected routes so RSC pages re-fetch
 *   5. Returns a typed result the form can consume
 *
 * Cover image uploads are handled out-of-band: the browser uploads to Blob
 * via /api/blob/upload-token first, then submits the resulting public URL
 * as part of the form. This bypasses the 4.5 MB Vercel function body limit.
 */

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";
import { deleteBlob } from "@/lib/blob/server";

import {
  CreateCourseSchema,
  DeleteCourseSchema,
  UpdateCourseSchema,
} from "./schemas";

/**
 * Create a course.
 * Tutor is inferred from the session (joined to the Tutor row by email).
 * Auto-creates a COURSE_UPDATE notification — preserves legacy side-effect.
 */
export const createCourse = tutorActionClient
  .schema(CreateCourseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const created = await prisma.course.create({
      data: {
        name: parsedInput.name,
        description: parsedInput.description,
        imageUrl: parsedInput.imageUrl,
        tutor: { connect: { email: ctx.session.user.email } },
        students: {
          connect: (parsedInput.studentIds || []).map((id) => ({ id })),
        },
      },
      select: { id: true, name: true },
    });

    await prisma.notification.create({
      data: {
        title: "New Course Available",
        message: `A new course "${created.name}" is available.`,
        link: `/dashboard/courses/${created.id}`,
        type: "COURSE_UPDATE",
        courseId: created.id,
      },
    });

    revalidatePath("/dashboard/manage-courses");
    revalidatePath("/dashboard/browse-courses");
    revalidatePath("/dashboard/courses");

    return { id: created.id };
  });

/**
 * Update a course. Only the tutor that owns the course may update it.
 * `studentIds`, when supplied, replaces the enrolment set (`set:`).
 * If `imageUrl` is supplied AND differs from the existing cover, the old
 * blob is deleted to avoid orphaned uploads.
 */
export const updateCourse = tutorActionClient
  .schema(UpdateCourseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.course.findUnique({
      where: { id: parsedInput.id },
      include: { tutor: { select: { email: true } } },
    });

    if (!existing) {
      throw new Error("Course not found");
    }
    if (existing.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    const data: Record<string, unknown> = {};
    if (parsedInput.name !== undefined) data.name = parsedInput.name;
    if (parsedInput.description !== undefined)
      data.description = parsedInput.description;
    if (parsedInput.imageUrl !== undefined) data.imageUrl = parsedInput.imageUrl;
    if (parsedInput.studentIds !== undefined) {
      data.students = { set: parsedInput.studentIds.map((id) => ({ id })) };
    }

    const updated = await prisma.course.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true },
    });

    // Best-effort cleanup of the previous cover blob.
    if (
      parsedInput.imageUrl !== undefined &&
      parsedInput.imageUrl !== existing.imageUrl
    ) {
      await deleteBlob(existing.imageUrl);
    }

    revalidatePath(`/dashboard/manage-courses/${updated.id}`);
    revalidatePath("/dashboard/manage-courses");
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/browse-courses");

    return { id: updated.id };
  });

/**
 * Delete a course. Cleans up the cover blob; child rows cascade per Prisma
 * relations (or fail if the schema disallows cascade — the action surfaces
 * that error to the form).
 */
export const deleteCourse = tutorActionClient
  .schema(DeleteCourseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.course.findUnique({
      where: { id: parsedInput.id },
      include: { tutor: { select: { email: true } } },
    });

    if (!existing) {
      throw new Error("Course not found");
    }
    if (existing.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    await prisma.course.delete({ where: { id: parsedInput.id } });
    await deleteBlob(existing.imageUrl);

    revalidatePath("/dashboard/manage-courses");
    revalidatePath("/dashboard/browse-courses");
    revalidatePath("/dashboard/courses");

    return { id: parsedInput.id };
  });
