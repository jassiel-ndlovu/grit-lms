/**
 * The read-only REST API, /api/v1 (#216 phase 3, Pro). Contract:
 * contracts/api.md. Each route file is one line: `export const GET =
 * v1Route(scope, handler)`. Every list is newest first, paged with an
 * opaque `cursor` and `limit` (1–100, default 50), and scoped to the key's
 * workspace.
 */

import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

import { API_LIMITS, decodeCursor, encodeCursor, type ApiScope } from "./api-math";
import { authenticateApi } from "./manage";

export class ApiInputError extends Error {}

type Ctx = { workspaceId: string; params: URLSearchParams; limit: number; cursor: { at: Date; id: string } | null };
type Page<T> = { data: T[]; nextCursor: string | null };

function limitOf(p: URLSearchParams): number {
  const n = Number(p.get("limit") ?? API_LIMITS.defaultLimit);
  if (!Number.isInteger(n) || n < 1 || n > API_LIMITS.maxLimit) throw new ApiInputError(`limit must be a whole number from 1 to ${API_LIMITS.maxLimit}.`);
  return n;
}

export function dateParam(p: URLSearchParams, name: string): Date | null {
  const v = p.get(name);
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiInputError(`${name} must be an ISO date, e.g. 2026-11-01 or 2026-11-01T08:00:00Z.`);
  return d;
}

/** Newest-first paging on (at desc, id desc). */
export function page<T extends { id: string }>(rows: T[], limit: number, at: (r: T) => Date): Page<T> {
  const more = rows.length > limit;
  const data = rows.slice(0, limit);
  return { data, nextCursor: more ? encodeCursor(at(data[data.length - 1]), data[data.length - 1].id) : null };
}

/** The Prisma filter for "after the cursor" on (field desc, id desc). */
export function afterCursor(field: string, c: Ctx["cursor"]) {
  return c ? { OR: [{ [field]: { lt: c.at } }, { [field]: c.at, id: { lt: c.id } }] } : {};
}

export async function courseInWorkspace(workspaceId: string, courseId: string | null): Promise<string | null> {
  if (!courseId) return null;
  const c = await prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { id: true } });
  if (!c) throw new ApiInputError("No course with that id in this workspace.");
  return c.id;
}

export function v1Route<T>(scope: ApiScope, handler: (ctx: Ctx) => Promise<Page<T>>) {
  return async (req: Request): Promise<Response> => {
    const auth = await authenticateApi(req.headers.get("authorization"), scope);
    const base = { "Cache-Control": "no-store" };
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { ...base, ...(auth.resetSeconds ? { "Retry-After": String(auth.resetSeconds) } : {}) } });
    }
    const headers = { ...base, "X-RateLimit-Limit": String(API_LIMITS.perMinute), "X-RateLimit-Remaining": String(auth.remaining), "X-RateLimit-Reset": String(auth.resetSeconds) };
    try {
      const params = new URL(req.url).searchParams;
      const raw = params.get("cursor");
      const cursor = decodeCursor(raw);
      if (raw && !cursor) throw new ApiInputError("cursor isn't valid. Use nextCursor from the previous page.");
      const result = await handler({ workspaceId: auth.workspaceId, params, limit: limitOf(params), cursor });
      return NextResponse.json(result, { headers });
    } catch (e) {
      if (e instanceof ApiInputError) return NextResponse.json({ error: e.message }, { status: 400, headers });
      console.error("[api/v1] failed:", e);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500, headers });
    }
  };
}

/* ------------------------------------------------------------------------- */
/* Handlers                                                                  */
/* ------------------------------------------------------------------------- */

export const listCourses = async ({ workspaceId, limit, cursor }: Ctx) => {
  const rows = await prisma.course.findMany({
    where: { workspaceId, ...afterCursor("createdAt", cursor) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, name: true, curriculum: true, subject: true, gradeLevel: true, createdAt: true, _count: { select: { lessons: true } } },
  });
  return page(rows.map((c) => ({ id: c.id, name: c.name, curriculum: c.curriculum, subject: c.subject, gradeLevel: c.gradeLevel, lessons: c._count.lessons, createdAt: c.createdAt })), limit, (r) => r.createdAt);
};

export const listLearners = async ({ workspaceId, params, limit, cursor }: Ctx) => {
  const courseId = await courseInWorkspace(workspaceId, params.get("courseId"));
  const rows = await prisma.learner.findMany({
    where: { workspaceId, ...(courseId ? { enrollments: { some: { courseId, endedAt: null } } } : {}), ...afterCursor("createdAt", cursor) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true, userId: true, status: true, createdAt: true,
      user: { select: { name: true, email: true, emailIsPlaceholder: true } },
      enrollments: { where: { endedAt: null }, select: { courseId: true, startedAt: true } },
    },
  });
  return page(rows.map((l) => ({
    id: l.id, userId: l.userId, name: l.user.name, email: l.user.emailIsPlaceholder ? null : l.user.email, status: l.status,
    courses: l.enrollments.map((e) => ({ courseId: e.courseId, since: e.startedAt })), createdAt: l.createdAt,
  })), limit, (r) => r.createdAt);
};

export const listGrades = async ({ workspaceId, params, limit, cursor }: Ctx) => {
  const courseId = await courseInWorkspace(workspaceId, params.get("courseId"));
  const since = dateParam(params, "since");
  const rows = await prisma.grade.findMany({
    where: { course: { workspaceId }, ...(courseId ? { courseId } : {}), ...(since ? { updatedAt: { gte: since } } : {}), ...afterCursor("updatedAt", cursor) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, courseId: true, type: true, title: true, score: true, outOf: true, createdAt: true, updatedAt: true, student: { select: { userId: true } } },
  });
  return page(rows.map((g) => ({
    id: g.id, courseId: g.courseId, studentUserId: g.student.userId, type: g.type, title: g.title, score: g.score, outOf: g.outOf,
    percent: g.outOf > 0 ? Math.round((g.score / g.outOf) * 1000) / 10 : null, markedAt: g.createdAt, updatedAt: g.updatedAt,
  })), limit, (r) => r.updatedAt);
};

export const listAttendance = async ({ workspaceId, params, limit, cursor }: Ctx) => {
  const courseId = await courseInWorkspace(workspaceId, params.get("courseId"));
  const from = dateParam(params, "from");
  const to = dateParam(params, "to");
  const rows = await prisma.sessionAttendance.findMany({
    where: {
      learner: { workspaceId }, ...(courseId ? { event: { courseId } } : {}),
      ...(from || to ? { occurrenceStart: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      ...afterCursor("markedAt", cursor),
    },
    orderBy: [{ markedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, occurrenceStart: true, learnerId: true, status: true, method: true, markedAt: true, event: { select: { id: true, courseId: true, title: true } } },
  });
  return page(rows.map((a) => ({
    id: a.id, courseId: a.event.courseId, eventId: a.event.id, eventTitle: a.event.title, occurrenceStart: a.occurrenceStart, learnerId: a.learnerId, status: a.status, method: a.method, markedAt: a.markedAt,
  })), limit, (r) => r.markedAt);
};

export const listInvoices = async ({ workspaceId, params, limit, cursor }: Ctx) => {
  const status = params.get("status");
  const allowed = ["OPEN", "PAID", "VOID", "REFUNDED", "PARTIALLY_REFUNDED"];
  if (status && !allowed.includes(status)) throw new ApiInputError(`status must be one of ${allowed.join(", ")}.`);
  const since = dateParam(params, "since");
  const rows = await prisma.invoice.findMany({
    where: { workspaceId, status: status ? (status as never) : { not: "DRAFT" }, ...(since ? { issuedAt: { gte: since } } : {}), ...afterCursor("issuedAt", cursor) },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, number: true, learnerId: true, studentUserId: true, status: true, issuedAt: true, dueAt: true, paidAt: true, paidVia: true, subtotalCents: true, discountCents: true, totalCents: true, lines: { select: { courseId: true, description: true, quantity: true, unitAmountCents: true, amountCents: true } } },
  });
  return page(rows.map((i) => ({ ...i, currency: "ZAR" })), limit, (r) => r.issuedAt);
};

export const listBookings = async ({ workspaceId, params, limit, cursor }: Ctx) => {
  const courseId = await courseInWorkspace(workspaceId, params.get("courseId"));
  const from = dateParam(params, "from");
  const to = dateParam(params, "to");
  const rows = await prisma.booking.findMany({
    where: { workspaceId, ...(courseId ? { courseId } : {}), ...(from || to ? { startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}), ...afterCursor("startsAt", cursor) },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, courseId: true, membershipId: true, learnerId: true, startsAt: true, endsAt: true, status: true, usedCredit: true, cancelledAt: true, createdAt: true },
  });
  return page(rows.map((b) => ({ ...b, tutorMembershipId: b.membershipId, membershipId: undefined })), limit, (r) => r.startsAt);
};
