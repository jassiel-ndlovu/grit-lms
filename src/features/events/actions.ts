/**
 * Course event Server Actions.
 *
 * Replace /api/events POST/PUT/DELETE. No notification side-effects (legacy
 * routes didn't emit notifications either) — events are passive calendar
 * markers; if reminder logic returns later, hook it into emitNotification.
 */

"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";

import {
  CreateCourseEventSchema,
  UpdateCourseEventSchema,
} from "./schemas";
import { z } from "zod";

import { CuidSchema } from "../shared/primitives";

const DeleteCourseEventSchema = z.object({ id: CuidSchema });

export const createCourseEvent = tutorActionClient
  .schema(CreateCourseEventSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { tutor: { select: { email: true } } },
    });
    if (!course) throw new Error("Course not found");
    if (course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this course");
    }

    const created = await prisma.courseEvent.create({
      data: {
        title: parsedInput.title,
        description: parsedInput.description,
        type: parsedInput.type,
        date: parsedInput.date,
        location: parsedInput.location,
        duration: parsedInput.duration,
        link: parsedInput.link,
        courseId: parsedInput.courseId,
      },
      select: { id: true, courseId: true },
    });

    revalidatePath(`/dashboard/courses/${created.courseId}`);
    revalidatePath(`/dashboard/manage-courses/${created.courseId}`);
    revalidatePath("/dashboard/calendar");

    return { id: created.id, courseId: created.courseId };
  });

export const updateCourseEvent = tutorActionClient
  .schema(UpdateCourseEventSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.courseEvent.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Event not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this event");
    }

    const data: Prisma.CourseEventUpdateInput = {};
    if (parsedInput.title !== undefined) data.title = parsedInput.title;
    if (parsedInput.description !== undefined) data.description = parsedInput.description;
    if (parsedInput.type !== undefined) data.type = parsedInput.type;
    if (parsedInput.date !== undefined) data.date = parsedInput.date;
    if (parsedInput.location !== undefined) data.location = parsedInput.location;
    if (parsedInput.duration !== undefined) data.duration = parsedInput.duration;
    if (parsedInput.link !== undefined) data.link = parsedInput.link;

    const updated = await prisma.courseEvent.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true, courseId: true },
    });

    revalidatePath(`/dashboard/courses/${updated.courseId}`);
    revalidatePath(`/dashboard/manage-courses/${updated.courseId}`);
    revalidatePath("/dashboard/calendar");

    return { id: updated.id, courseId: updated.courseId };
  });

export const deleteCourseEvent = tutorActionClient
  .schema(DeleteCourseEventSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.courseEvent.findUnique({
      where: { id: parsedInput.id },
      include: { course: { select: { id: true, tutor: { select: { email: true } } } } },
    });
    if (!existing) throw new Error("Event not found");
    if (existing.course.tutor.email !== ctx.session.user.email) {
      throw new Error("You don't own this event");
    }

    const courseId = existing.course.id;
    await prisma.courseEvent.delete({ where: { id: parsedInput.id } });

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath(`/dashboard/manage-courses/${courseId}`);
    revalidatePath("/dashboard/calendar");

    return { id: parsedInput.id, courseId };
  });
