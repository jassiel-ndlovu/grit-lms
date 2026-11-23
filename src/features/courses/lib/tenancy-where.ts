/**
 * Prisma filters that read teaching and enrolment from the tenancy tables
 * (CourseStaff, Enrollment) instead of `Course.tutorId` and the implicit
 * `_CourseEnrollments` join (issue #93, step 4).
 *
 * They take the same ids the old filters took (Tutor and Student profile
 * ids, or a user's email), so call sites keep their signatures. Pure: no
 * database access, so scripts/check-tenancy-parity.ts can run them against
 * the old filters.
 *
 * Teaching means any active CourseStaff membership (LEAD today; ASSISTANT
 * later). Enrolment means an open Enrollment (endedAt null).
 */

import type { Prisma } from "@/generated/prisma";
import { ROLE_PRESETS, type PresetKey } from "@/lib/roles";

const activeStaff = (user: Prisma.UserWhereInput): Prisma.CourseWhereInput => ({
  staff: { some: { membership: { status: "ACTIVE", user } } },
});

/** Presets holding courses.edit. The base roles all do, so a null presetRole counts. */
const EDITING_PRESETS = (Object.keys(ROLE_PRESETS) as PresetKey[]).filter((k) => ROLE_PRESETS[k].permissions.includes("courses.edit"));

/**
 * Memberships whose effective role (viewer.md, "Roles and branches") holds
 * courses.edit: being on a course's staff is only teaching it with that.
 * Without it, a tutor moved to Finance or Support would keep marking.
 * Mirrors effectiveRole in @/lib/roles.
 */
export const editingMembership: Prisma.MembershipWhereInput = {
  OR: [
    { customRole: { is: { permissions: { has: "courses.edit" } } } },
    { customRoleId: null, OR: [{ presetRole: null }, { presetRole: { in: EDITING_PRESETS } }] },
  ],
};

/** Courses the tutor (Tutor profile id) teaches. Replaces `{ tutorId }`. */
export function taughtBy(tutorId: string): Prisma.CourseWhereInput {
  return activeStaff({ tutorProfile: { is: { id: tutorId } } });
}

/**
 * Courses the user teaches, by user id: any active CourseStaff membership.
 * B's teaching pages use this (with the signed-in user's id), so a tutor
 * made the tenancy way, with a Membership and no `Tutor` row, sees their
 * courses. `taughtBy` stays for callers that still hold a Tutor profile id.
 */
export function taughtByUser(userId: string): Prisma.CourseWhereInput {
  return { staff: { some: { membership: { status: "ACTIVE", user: { id: userId }, ...editingMembership } } } };
}

/** Courses the signed-in user (by email) teaches. Replaces `tutor.email === email`. */
export function taughtByEmail(email: string): Prisma.CourseWhereInput {
  return activeStaff({ email: { equals: email, mode: "insensitive" } });
}

/** Courses the student (Student profile id) is enrolled in. Replaces `{ students: { some: { id } } }`. */
export function enrolledStudent(studentId: string): Prisma.CourseWhereInput {
  return { enrollments: { some: { endedAt: null, learner: { user: { studentProfile: { is: { id: studentId } } } } } } };
}

/** Student profiles enrolled in the course. Replaces `course.students`. */
export function studentsOf(courseId: string): Prisma.StudentWhereInput {
  return { user: { is: { learners: { some: { enrollments: { some: { courseId, endedAt: null } } } } } } };
}

/** For `_count`: open enrolments. Replaces `_count: { select: { students: true } }`. */
export const openEnrollmentCount = { enrollments: { where: { endedAt: null } } } as const;

/**
 * Nested `staff` select that returns the signed-in user's own active staff
 * row on the course (with a role that edits courses): empty means they
 * don't teach it. Replaces selecting
 * `tutor: { select: { email: true } }` and comparing the email.
 */
export function staffFor(email: string): {
  where: Prisma.CourseStaffWhereInput;
  select: { membershipId: true };
} {
  return {
    where: { membership: { status: "ACTIVE", user: { email: { equals: email, mode: "insensitive" } }, ...editingMembership } },
    select: { membershipId: true },
  };
}

/** What `managesCourse` needs of a course row, for the signed-in user (by email). */
export function courseAccessSelect(email: string) {
  return { workspaceId: true, ownerMembershipId: true, team: { select: { branchId: true } }, staff: staffFor(email) } as const;
}

/**
 * Nested `enrollments` select that returns the student's own open
 * enrolment on the course: empty means not enrolled. Replaces selecting
 * `students: { where: { id } }`.
 */
export function enrollmentFor(studentId: string): {
  where: Prisma.EnrollmentWhereInput;
  select: { id: true };
} {
  return {
    where: { endedAt: null, learner: { user: { studentProfile: { is: { id: studentId } } } } },
    select: { id: true },
  };
}

/**
 * Nested select for a course's teacher, read through the owner membership
 * instead of `Course.tutor` (which goes with `tutorId` in step 5). Use
 * `tutorOf(course)` to get `{ id, fullName, email }` back.
 *
 * The role and the workspace's teaching flag come along so an organisation
 * that switched teaching off (#206) is never shown as a course's tutor.
 */
export const ownerTutor = {
  select: {
    role: true,
    workspace: { select: { kind: true, teachingOffAt: true } },
    user: { select: { id: true, name: true, tutorProfile: { select: { id: true, fullName: true, email: true } } } },
  },
} as const;

export interface CourseTutor {
  id: string | null;
  fullName: string;
  email: string | null;
}

/** The owner membership fields that decide whether it counts as a teacher. */
export interface TeachingMembership {
  role?: string;
  workspace?: { kind: string; teachingOffAt: Date | string | null } | null;
}

/**
 * False for an owner or admin of an organisation that doesn't teach (#206):
 * they run it and aren't anyone's tutor. Solo workspaces always teach.
 * Rows loaded without the role or workspace count as teaching.
 */
export function teachesAsOwner(m: TeachingMembership): boolean {
  if (!m.workspace || m.workspace.kind !== "ORGANISATION" || !m.workspace.teachingOffAt) return true;
  return m.role !== "OWNER" && m.role !== "ADMIN";
}

/**
 * The course's teacher from `ownerMembership: ownerTutor`, or null when it
 * has no owner, or its owner is an organisation's owner or admin while the
 * organisation doesn't teach.
 */
export function tutorOf(course: {
  ownerMembership: ({ user: { name: string; tutorProfile: { id: string; fullName: string; email: string } | null } } & TeachingMembership) | null;
}): CourseTutor | null {
  const user = course.ownerMembership?.user;
  if (!user || !teachesAsOwner(course.ownerMembership!)) return null;
  return {
    id: user.tutorProfile?.id ?? null,
    fullName: user.tutorProfile?.fullName || user.name,
    email: user.tutorProfile?.email ?? null,
  };
}
