/**
 * User queries — RSC helpers for the manage-users page. Reads only; all
 * writes flow through actions.ts.
 */

import { prisma } from "@/lib/db";
import type { Persona, Viewer } from "@/lib/viewer-core";

/**
 * What the dashboard shell shows about the signed-in user (header, nav,
 * account menu). Built from the viewer, which already loaded the name,
 * email and avatar, so it costs no extra query.
 *
 * Replaces `ProfileContext` and `/api/profile` for the shell (design 07,
 * Batch 2). The pages pass these fields down as props.
 */
export interface OwnProfile {
  name: string;
  email: string;
  avatarUrl: string | null;
  persona: Persona;
  /** Plain-language label for the account menu. */
  roleLabel: string;
}

const ROLE_LABEL: Record<Persona, string> = {
  staff: "Tutor",
  learner: "Student",
  guardian: "Parent or guardian",
  admin: "Nexa admin",
  none: "Account",
};

export function getOwnProfile(viewer: Viewer): OwnProfile {
  const staffRole = viewer.membership?.role;
  return {
    name: viewer.user.name,
    email: viewer.user.email,
    avatarUrl: viewer.user.imageUrl,
    persona: viewer.persona,
    roleLabel:
      staffRole === "OWNER" ? "Owner" : staffRole === "ADMIN" ? "Admin" : ROLE_LABEL[viewer.persona],
  };
}

export interface ManagedUserRow {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TUTOR" | "ADMIN" | "PARENT";
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
