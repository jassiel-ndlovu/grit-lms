/**
 * Course event Server Actions.
 *
 * Replace /api/events POST/PUT/DELETE. Each change notifies the course's
 * students (EVENT_* — "Course & schedule updates" in their settings).
 */

"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma";

import { emitNotification } from "@/features/notifications/server";
import { prisma } from "@/lib/db";
import { courseAccessSelect } from "@/features/courses/lib/tenancy-where";
import { tutorActionClient, tutorReadActionClient } from "@/lib/safe-action";

import { eventChangeNotification } from "./notify";

import {
  CreateCourseEventSchema,
  UpdateCourseEventSchema,
} from "./schemas";
import { z } from "zod";

import { CuidSchema } from "../shared/primitives";
import { getCourseScope } from "@/features/courses/course-access";
import { managesCourse } from "@/features/courses/lib/course-access";

const DeleteCourseEventSchema = z.object({ id: CuidSchema });

export const createCourseEvent = tutorActionClient
  .schema(CreateCourseEventSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await prisma.course.findUnique({
      where: { id: parsedInput.courseId },
      select: { ...courseAccessSelect(ctx.session.user.email) },
    });
    if (!course) throw new Error("Course not found");
    if (!managesCourse(await getCourseScope(ctx.session.user.id), course)) {
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
        repeatFrequency: parsedInput.repeatFrequency,
        repeatInterval: parsedInput.repeatInterval,
        repeatWeekdays: parsedInput.repeatWeekdays,
        repeatUntil: parsedInput.repeatUntil,
        repeatCount: parsedInput.repeatCount,
        ...(parsedInput.timeZone ? { timeZone: parsedInput.timeZone } : {}),
      },
      select: { id: true, courseId: true, title: true, type: true },
    });

    await emitNotification(eventChangeNotification("created", created), { revalidate: false });

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
      include: { course: { select: { id: true, ...courseAccessSelect(ctx.session.user.email) } } },
    });
    if (!existing) throw new Error("Event not found");
    if (!managesCourse(await getCourseScope(ctx.session.user.id), existing.course)) {
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
    if (parsedInput.repeatFrequency !== undefined)
      data.repeatFrequency = parsedInput.repeatFrequency;
    if (parsedInput.repeatInterval !== undefined)
      data.repeatInterval = parsedInput.repeatInterval;
    if (parsedInput.repeatWeekdays !== undefined)
      data.repeatWeekdays = parsedInput.repeatWeekdays;
    if (parsedInput.repeatUntil !== undefined)
      data.repeatUntil = parsedInput.repeatUntil;
    if (parsedInput.repeatCount !== undefined)
      data.repeatCount = parsedInput.repeatCount;
    if (parsedInput.timeZone !== undefined) data.timeZone = parsedInput.timeZone;

    const updated = await prisma.courseEvent.update({
      where: { id: parsedInput.id },
      data,
      select: { id: true, courseId: true, title: true, type: true },
    });

    await emitNotification(eventChangeNotification("updated", updated), { revalidate: false });

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
      include: { course: { select: { id: true, ...courseAccessSelect(ctx.session.user.email) } } },
    });
    if (!existing) throw new Error("Event not found");
    if (!managesCourse(await getCourseScope(ctx.session.user.id), existing.course)) {
      throw new Error("You don't own this event");
    }

    const courseId = existing.course.id;
    await prisma.courseEvent.delete({ where: { id: parsedInput.id } });

    await emitNotification(eventChangeNotification("deleted", existing), { revalidate: false });

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath(`/dashboard/manage-courses/${courseId}`);
    revalidatePath("/dashboard/calendar");

    return { id: parsedInput.id, courseId };
  });

/**
 * The series behind an occurrence, for the edit form (#149): its first
 * start, time zone and repeat rule, which `listCalendarOccurrences` leaves
 * out.
 */
export const getCourseEventSeries = tutorReadActionClient
  .schema(z.object({ id: CuidSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const e = await prisma.courseEvent.findUnique({
      where: { id: parsedInput.id },
      select: {
        id: true, title: true, description: true, type: true, date: true, duration: true, location: true, link: true, timeZone: true,
        repeatFrequency: true, repeatInterval: true, repeatWeekdays: true, repeatUntil: true, repeatCount: true,
        course: { select: { id: true, ...courseAccessSelect(ctx.session.user.email) } },
      },
    });
    if (!e) throw new Error("Event not found");
    if (!managesCourse(await getCourseScope(ctx.session.user.id), e.course)) throw new Error("You don't own this event");
    const { course, ...series } = e;
    return { ...series, courseId: course.id, date: e.date.toISOString(), repeatUntil: e.repeatUntil?.toISOString() ?? null };
  });
