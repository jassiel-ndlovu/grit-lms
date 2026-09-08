/**
 * User queries — RSC helpers for the manage-users page. Reads only; all
 * writes flow through actions.ts.
 */

import { prisma } from "@/lib/db";

export interface ManagedUserRow {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TUTOR" | "ADMIN";
  createdAt: Date;
  hasStudentProfile: boolean;
  hasTutorProfile: boolean;
}

/**
 * List every user with role labels + a flag for whether the linked
 * profile (Student/Tutor) exists. Sorted newest-first so freshly-created
 * users bubble to the top of the tutor's table.
 */
export async function listAllUsers(): Promise<ManagedUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (users.length === 0) return [];

  const emails = users.map((u) => u.email.toLowerCase());
  const [studentEmails, tutorEmails] = await Promise.all([
    prisma.student.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
    prisma.tutor.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
  ]);

  const studentSet = new Set(studentEmails.map((s) => s.email.toLowerCase()));
  const tutorSet = new Set(tutorEmails.map((t) => t.email.toLowerCase()));

  return users.map((u) => ({
    ...u,
    hasStudentProfile: studentSet.has(u.email.toLowerCase()),
    hasTutorProfile: tutorSet.has(u.email.toLowerCase()),
  }));
}
