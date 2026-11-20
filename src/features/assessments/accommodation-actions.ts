"use server";

/**
 * Set a student's extra time on a course's timed tests (owner decision 7).
 * Only the course's teaching staff, and only for an enrolled student. The
 * change also reaches any attempt the student has open on the course, so
 * extra time granted mid-sitting counts at once.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { courseRoutes } from "@/features/courses/components/course-frame";
import { enrollmentFor, staffFor } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";

import { CuidSchema } from "../shared/primitives";
import { EXTRA_TIME_CHOICES, choiceToExtraTime } from "./lib/extra-time";

const SetExtraTimeSchema = z.object({
  courseId: CuidSchema,
  studentId: CuidSchema,
  choice: z.enum(EXTRA_TIME_CHOICES),
});

export const setExtraTime = tutorActionClient
  .schema(SetExtraTimeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { courseId, studentId, choice } = parsedInput;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        staff: staffFor(ctx.session.user.email),
        enrollments: enrollmentFor(studentId),
      },
    });
    if (!course) throw new Error("Course not found");
    if (course.staff.length === 0) throw new Error("You don't teach this course");
    if (course.enrollments.length === 0) throw new Error("That student isn't enrolled on this course");

    const value = choiceToExtraTime(choice);
    const [, open] = await prisma.$transaction([
      prisma.timeAccommodation.upsert({
        where: { courseId_studentId: { courseId, studentId } },
        create: { courseId, studentId, ...value, updatedByUserId: ctx.session.user.id },
        update: { ...value, updatedByUserId: ctx.session.user.id },
      }),
      prisma.testSubmission.updateMany({
        where: { studentId, status: "IN_PROGRESS", test: { courseId } },
        data: value,
      }),
    ]);

    revalidatePath(courseRoutes.settings(courseId));
    return { choice, openAttempts: open.count };
  });
