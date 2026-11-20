import "server-only";

/**
 * Reads of TimeAccommodation (extra time per student per course, owner
 * decision 7). The setter is in accommodation-actions.ts.
 */

import { prisma } from "@/lib/db";

import { NO_EXTRA_TIME, type ExtraTime } from "./lib/extra-time";

/** The student's extra time on a course, or none. */
export async function getExtraTime(courseId: string, studentId: string): Promise<ExtraTime> {
  const row = await prisma.timeAccommodation.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    select: { extraTimePercent: true, noTimeLimit: true },
  });
  return row ?? NO_EXTRA_TIME;
}

/** Every student's extra time on a course, by student id. */
export async function listExtraTime(courseId: string): Promise<Map<string, ExtraTime>> {
  const rows = await prisma.timeAccommodation.findMany({
    where: { courseId },
    select: { studentId: true, extraTimePercent: true, noTimeLimit: true },
  });
  return new Map(rows.map((r) => [r.studentId, { extraTimePercent: r.extraTimePercent, noTimeLimit: r.noTimeLimit }]));
}
