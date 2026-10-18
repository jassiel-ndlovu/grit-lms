/**
 * Auth helpers for the legacy `/api/*` Route Handlers.
 *
 * The Server Actions in `src/features/*\/actions.ts` get their session and
 * role checks from the next-safe-action clients in `@/lib/safe-action`.
 * Route Handlers can't use those, so this file gives them the same checks
 * in a Response-returning shape:
 *
 *   const guard = await requireApiRole("TUTOR");
 *   if (!guard.ok) return guard.response;
 *   const { session } = guard;
 *
 * Ownership follows the actions: a tutor owns a course when the course's
 * tutor has the session's email; a student is the Student row with the
 * session's email.
 *
 * TODO[chapter-3-cleanup]: delete alongside the last legacy route.
 */

import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import type { Prisma } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/features/shared/enums";

type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** 410 Gone for a retired legacy handler, pointing at its replacement. */
export function gone(replacement: string) {
  return NextResponse.json({ error: `Gone. ${replacement}` }, { status: 410 });
}

/** Any signed-in user. 401 otherwise. */
export async function requireApiSession(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, response: unauthorized() };
  return { ok: true, session };
}

/** Signed-in user holding one of `roles`. 401 / 403 otherwise. */
export async function requireApiRole(...roles: Role[]): Promise<GuardResult> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard;
  if (!roles.includes(guard.session.user.role as Role)) {
    return { ok: false, response: forbidden(`Requires role: ${roles.join(" or ")}`) };
  }
  return guard;
}

/** True when the course exists and its tutor is the session user. */
export async function tutorOwnsCourse(session: Session, courseId: unknown): Promise<boolean> {
  if (typeof courseId !== "string" || !courseId) return false;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { tutor: { select: { email: true } } },
  });
  return course?.tutor.email === session.user.email;
}

/** The Student row for the session user, or null. */
export function studentForSession(session: Session) {
  return prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
}

/**
 * Course filter limiting reads to what the session user may see: a tutor's
 * own courses, a student's enrolled courses, everything for an admin.
 * Returns null for any other role.
 */
export function visibleCoursesWhere(session: Session): Prisma.CourseWhereInput | null {
  const email = session.user.email;
  switch (session.user.role as Role) {
    case "TUTOR":
      return { tutor: { email } };
    case "STUDENT":
      return { students: { some: { email } } };
    case "ADMIN":
      return {};
    default:
      return null;
  }
}
