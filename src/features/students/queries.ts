/**
 * Student queries — server-only data access for the students feature.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * All students, ordered by name. Used by the course form's enrol picker.
 */
export const listAllStudents = cache(async () => {
  return prisma.student.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      imageUrl: true,
    },
  });
});

export type StudentListItem = Awaited<ReturnType<typeof listAllStudents>>[number];
