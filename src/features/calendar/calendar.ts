/**
 * Calendar and attendance (A, #149; B research 10, "Recommendation", using
 * its fallback: today's recurrence columns stay, with a time zone and an
 * exceptions table; RRULE is written only for calendar feeds).
 *
 * Server only; each function takes ids so scripts can test it. Permissions
 * are checked in ./actions.ts and the feed routes.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { occurrencesOf } from "@/features/events/lib/recurrence";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";

import { applyExceptions, buildIcs, hashCode, newCheckInCode, untilBefore, type ExceptionRow, type Occurrence, type SeriesRow } from "./calendar-math";
import { UserError } from "@/lib/user-error";

const DAY = 24 * 60 * 60 * 1000;
const LATE_AFTER_MIN = 10;

const SERIES_SELECT = {
  id: true, title: true, description: true, type: true, date: true, duration: true, location: true, link: true, timeZone: true,
  repeatFrequency: true, repeatInterval: true, repeatWeekdays: true, repeatUntil: true, repeatCount: true, courseId: true,
  course: { select: { name: true } },
  exceptions: { select: { occurrenceStart: true, cancelled: true, title: true, description: true, start: true, duration: true, location: true, link: true } },
} as const;

/* ------------------------------------------------------------------------- */
/* Occurrences                                                                */
/* ------------------------------------------------------------------------- */

export async function occurrencesFor(input: { courseIds: string[]; from: Date; to: Date }): Promise<Array<Occurrence & { courseId: string; courseName: string }>> {
  if (input.courseIds.length === 0) return [];
  const rows = await prisma.courseEvent.findMany({
    where: {
      courseId: { in: input.courseIds },
      date: { lte: input.to },
      OR: [{ date: { gte: input.from } }, { repeatFrequency: { not: "NONE" }, OR: [{ repeatUntil: null }, { repeatUntil: { gte: input.from } }] }],
    },
    select: SERIES_SELECT,
  });
  const out = [];
  for (const e of rows) {
    const starts = occurrencesOf(e, input.from, input.to, e.timeZone);
    for (const o of applyExceptions(e as SeriesRow, starts, e.exceptions as ExceptionRow[])) out.push({ ...o, courseId: e.courseId, courseName: e.course.name });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Whether `occurrenceStart` is a real occurrence of the event. */
async function isOccurrence(eventId: string, occurrenceStart: Date) {
  const e = await prisma.courseEvent.findUnique({ where: { id: eventId }, select: SERIES_SELECT });
  if (!e) return null;
  const hit = occurrencesOf(e, new Date(occurrenceStart.getTime() - 1000), new Date(occurrenceStart.getTime() + 1000), e.timeZone)
    .some((d) => d.getTime() === occurrenceStart.getTime());
  return hit ? e : null;
}

export type OccurrenceChanges = { title?: string; description?: string; start?: string; duration?: number; location?: string | null; link?: string | null; cancelled?: boolean };

/**
 * Edits a series at one occurrence.
 *   THIS       "this one only": an exception (or a cancellation)
 *   FOLLOWING  "this and following": the series stops before it, and a new
 *              series starts at it with the changes; later exceptions and
 *              attendance move with it when the times still match
 *   ALL        the whole series
 */
export async function editOccurrenceFor(actorUserId: string, input: { eventId: string; occurrenceStart: string; scope: "THIS" | "FOLLOWING" | "ALL"; changes: OccurrenceChanges }) {
  const occ = new Date(input.occurrenceStart);
  const e = await isOccurrence(input.eventId, occ);
  if (!e) throw new UserError("That occurrence isn't part of this event");
  const c = input.changes;
  const fields = {
    ...(c.title !== undefined ? { title: c.title } : {}),
    ...(c.description !== undefined ? { description: c.description } : {}),
    ...(c.duration !== undefined ? { duration: c.duration } : {}),
    ...(c.location !== undefined ? { location: c.location } : {}),
    ...(c.link !== undefined ? { link: c.link } : {}),
  };

  if (input.scope === "THIS" || e.repeatFrequency === "NONE" && input.scope !== "ALL") {
    const data = { ...fields, start: c.start ? new Date(c.start) : undefined, cancelled: c.cancelled ?? false };
    await prisma.courseEventException.upsert({
      where: { eventId_occurrenceStart: { eventId: e.id, occurrenceStart: occ } },
      create: { eventId: e.id, occurrenceStart: occ, createdByUserId: actorUserId, ...data },
      update: data,
    });
    return { eventId: e.id, scope: "THIS" as const };
  }

  if (input.scope === "ALL") {
    const shift = c.start ? new Date(c.start).getTime() - occ.getTime() : 0;
    await prisma.courseEvent.update({ where: { id: e.id }, data: { ...fields, ...(shift ? { date: new Date(e.date.getTime() + shift) } : {}) } });
    return { eventId: e.id, scope: "ALL" as const };
  }

  // FOLLOWING.
  const newStart = c.start ? new Date(c.start) : occ;
  const before = occurrencesOf(e, e.date, untilBefore(occ), e.timeZone).length;
  return prisma.$transaction(async (tx) => {
    await tx.courseEvent.update({ where: { id: e.id }, data: { repeatUntil: untilBefore(occ), repeatCount: null } });
    const next = await tx.courseEvent.create({
      data: {
        courseId: e.courseId, title: e.title, description: e.description, type: e.type, location: e.location, link: e.link, duration: e.duration,
        timeZone: e.timeZone, repeatFrequency: e.repeatFrequency, repeatInterval: e.repeatInterval, repeatWeekdays: e.repeatWeekdays,
        repeatUntil: e.repeatUntil, repeatCount: e.repeatCount ? Math.max(1, e.repeatCount - before) : null,
        ...fields, date: newStart,
      },
      select: { id: true },
    });
    if (newStart.getTime() === occ.getTime()) {
      await tx.courseEventException.updateMany({ where: { eventId: e.id, occurrenceStart: { gte: occ } }, data: { eventId: next.id } });
      await tx.sessionAttendance.updateMany({ where: { eventId: e.id, occurrenceStart: { gte: occ } }, data: { eventId: next.id } });
    } else {
      await tx.courseEventException.deleteMany({ where: { eventId: e.id, occurrenceStart: { gte: occ } } });
    }
    return { eventId: next.id, scope: "FOLLOWING" as const };
  }, { timeout: 30_000 });
}

/* ------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* ------------------------------------------------------------------------- */

/** Learners enrolled at the occurrence, with their attendance. */
export async function attendanceSheetFor(eventId: string, occurrenceStart: string) {
  const occ = new Date(occurrenceStart);
  const e = await isOccurrence(eventId, occ);
  if (!e) throw new UserError("That occurrence isn't part of this event");
  const enrolled = await prisma.enrollment.findMany({
    where: { courseId: e.courseId, startedAt: { lte: occ }, OR: [{ endedAt: null }, { endedAt: { gt: occ } }] },
    select: { learner: { select: { id: true, user: { select: { name: true } } } } },
    distinct: ["learnerId"],
  });
  const marks = await prisma.sessionAttendance.findMany({ where: { eventId, occurrenceStart: occ }, select: { learnerId: true, status: true, method: true, note: true, markedAt: true } });
  const byLearner = new Map(marks.map((m) => [m.learnerId, m]));
  const code = await prisma.attendanceCode.findUnique({ where: { eventId_occurrenceStart: { eventId, occurrenceStart: occ } }, select: { expiresAt: true } });
  return {
    eventId, occurrenceStart: occ.toISOString(), title: e.title, courseId: e.courseId,
    checkInOpenUntil: code && code.expiresAt > new Date() ? code.expiresAt.toISOString() : null,
    learners: enrolled.map((x) => {
      const m = byLearner.get(x.learner.id);
      return { learnerId: x.learner.id, name: x.learner.user.name, status: m?.status ?? null, method: m?.method ?? null, note: m?.note ?? null, markedAt: m?.markedAt.toISOString() ?? null };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

type Mark = { learnerId: string; status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED"; note?: string | null };

export async function markAttendanceFor(actorUserId: string, input: { eventId: string; occurrenceStart: string; marks: Mark[] }) {
  const sheet = await attendanceSheetFor(input.eventId, input.occurrenceStart);
  const allowed = new Set(sheet.learners.map((l) => l.learnerId));
  const occ = new Date(input.occurrenceStart);
  let absences = 0;
  for (const m of input.marks) {
    if (!allowed.has(m.learnerId)) throw new UserError("A learner on this sheet isn't enrolled in the course");
    const row = await prisma.sessionAttendance.upsert({
      where: { eventId_occurrenceStart_learnerId: { eventId: input.eventId, occurrenceStart: occ, learnerId: m.learnerId } },
      create: { eventId: input.eventId, occurrenceStart: occ, learnerId: m.learnerId, status: m.status, note: m.note ?? null, markedByUserId: actorUserId, method: "TUTOR" },
      update: { status: m.status, note: m.note ?? null, markedByUserId: actorUserId, markedAt: new Date(), method: "TUTOR" },
      select: { id: true, guardianNotifiedAt: true },
    });
    if (m.status === "ABSENT" && !row.guardianNotifiedAt) absences += await notifyGuardiansOfAbsence(row.id, sheet.title, occ);
  }
  return { marked: input.marks.length, guardiansEmailed: absences };
}

/** One email per absence to each active guardian (decision taken here: per absence, not a digest). */
async function notifyGuardiansOfAbsence(attendanceId: string, title: string, occ: Date): Promise<number> {
  const a = await prisma.sessionAttendance.findUniqueOrThrow({
    where: { id: attendanceId },
    select: { learner: { select: { workspaceId: true, user: { select: { id: true, name: true, guardedBy: { where: { status: "ACTIVE" }, select: { guardian: { select: { id: true, email: true } } } } } } } }, event: { select: { timeZone: true, course: { select: { name: true } } } } },
  });
  const guardians = a.learner.user.guardedBy.map((g) => g.guardian);
  const when = new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: a.event.timeZone }).format(occ);
  for (const g of guardians) {
    await enqueueEmail(prisma, {
      key: `attendance:absence:${attendanceId}:${g.id}`, template: "attendance:absence", to: g.email, userId: g.id, workspaceId: a.learner.workspaceId,
      category: "ATTENDANCE", priority: "NORMAL",
      data: { studentName: a.learner.user.name, title, courseName: a.event.course.name, when },
    });
  }
  await prisma.sessionAttendance.update({ where: { id: attendanceId }, data: { guardianNotifiedAt: new Date() } });
  return guardians.length;
}

/** Opens (or rotates) a check-in code for an occurrence. The code is returned once; only its hash is kept. */
export async function openCheckInFor(actorUserId: string, input: { eventId: string; occurrenceStart: string; minutes?: number }) {
  const occ = new Date(input.occurrenceStart);
  if (!(await isOccurrence(input.eventId, occ))) throw new UserError("That occurrence isn't part of this event");
  const code = newCheckInCode();
  const expiresAt = new Date(Date.now() + Math.min(Math.max(input.minutes ?? 15, 1), 120) * 60 * 1000);
  await prisma.attendanceCode.upsert({
    where: { eventId_occurrenceStart: { eventId: input.eventId, occurrenceStart: occ } },
    create: { eventId: input.eventId, occurrenceStart: occ, codeHash: hashCode(code), expiresAt, createdByUserId: actorUserId },
    update: { codeHash: hashCode(code), expiresAt, createdByUserId: actorUserId },
  });
  return { code, expiresAt: expiresAt.toISOString() };
}

/** A learner checks in with the code. PRESENT, or LATE after 10 minutes. A tutor's mark is never overwritten, except ABSENT. */
export async function checkInFor(userId: string, rawCode: string, now: Date = new Date()) {
  const codes = await prisma.attendanceCode.findMany({
    where: { codeHash: hashCode(rawCode), expiresAt: { gt: now } },
    select: { eventId: true, occurrenceStart: true, event: { select: { title: true, courseId: true } } },
  });
  for (const c of codes) {
    const enr = await prisma.enrollment.findFirst({ where: { courseId: c.event.courseId, endedAt: null, learner: { userId } }, select: { learnerId: true } });
    if (!enr) continue;
    const status = now.getTime() > c.occurrenceStart.getTime() + LATE_AFTER_MIN * 60 * 1000 ? "LATE" : "PRESENT";
    const key = { eventId_occurrenceStart_learnerId: { eventId: c.eventId, occurrenceStart: c.occurrenceStart, learnerId: enr.learnerId } };
    const existing = await prisma.sessionAttendance.findUnique({ where: key, select: { status: true } });
    if (existing && existing.status !== "ABSENT") return { ok: true as const, title: c.event.title, status: existing.status };
    await prisma.sessionAttendance.upsert({
      where: key,
      create: { eventId: c.eventId, occurrenceStart: c.occurrenceStart, learnerId: enr.learnerId, status, method: "CHECK_IN_CODE" },
      update: { status, method: "CHECK_IN_CODE", markedAt: now },
    });
    return { ok: true as const, title: c.event.title, status };
  }
  return { ok: false as const };
}

/** Attendance history for learners (a student's own, or a guardian's children). */
export async function attendanceHistoryFor(learnerIds: string[], since: Date = new Date(Date.now() - 180 * DAY)) {
  const rows = await prisma.sessionAttendance.findMany({
    where: { learnerId: { in: learnerIds }, occurrenceStart: { gte: since } },
    orderBy: { occurrenceStart: "desc" },
    take: 500,
    select: { learnerId: true, occurrenceStart: true, status: true, note: true, event: { select: { id: true, title: true, course: { select: { id: true, name: true } } } } },
  });
  return rows.map((r) => ({ learnerId: r.learnerId, eventId: r.event.id, title: r.event.title, courseId: r.event.course.id, courseName: r.event.course.name, occurrenceStart: r.occurrenceStart.toISOString(), status: r.status, note: r.note }));
}

/* ------------------------------------------------------------------------- */
/* Calendar feeds (ICS)                                                       */
/* ------------------------------------------------------------------------- */

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** A new feed link for the user; the old one stops working. */
export async function rotateFeedTokenFor(userId: string) {
  const token = randomBytes(24).toString("base64url");
  await prisma.calendarFeedToken.upsert({ where: { userId }, create: { userId, tokenHash: sha(token) }, update: { tokenHash: sha(token), createdAt: new Date(), lastUsedAt: null } });
  return token;
}

/** The courses a user's calendar covers, and whether their feed may carry full detail. */
async function calendarScope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      memberships: { where: { status: "ACTIVE" }, select: { id: true } },
      learners: { select: { isMinor: true, enrollments: { where: { endedAt: null }, select: { courseId: true } } } },
      guardianOf: { where: { status: "ACTIVE" }, select: { student: { select: { learners: { select: { enrollments: { where: { endedAt: null }, select: { courseId: true } } } } } } } },
    },
  });
  if (!user) return null;
  const staffCourses = user.memberships.length
    ? (await prisma.courseStaff.findMany({ where: { membershipId: { in: user.memberships.map((m) => m.id) } }, select: { courseId: true } })).map((c) => c.courseId)
    : [];
  const learnerCourses = user.learners.flatMap((l) => l.enrollments.map((e) => e.courseId));
  const childCourses = user.guardianOf.flatMap((g) => g.student.learners.flatMap((l) => l.enrollments.map((e) => e.courseId)));
  const minorOrGuardian = user.learners.some((l) => l.isMinor) || user.guardianOf.length > 0;
  return { name: user.name, courseIds: [...new Set([...staffCourses, ...learnerCourses, ...childCourses])], detail: (staffCourses.length && !minorOrGuardian) || (!minorOrGuardian && learnerCourses.length) ? "full" as const : "basic" as const };
}

export async function feedIcsForToken(token: string): Promise<string | null> {
  const row = await prisma.calendarFeedToken.findUnique({ where: { tokenHash: sha(token) }, select: { id: true, userId: true } });
  if (!row) return null;
  await prisma.calendarFeedToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  const scope = await calendarScope(row.userId);
  if (!scope) return null;
  const from = new Date(Date.now() - 60 * DAY);
  const events = scope.courseIds.length
    ? await prisma.courseEvent.findMany({
        where: { courseId: { in: scope.courseIds }, OR: [{ date: { gte: from } }, { repeatFrequency: { not: "NONE" }, OR: [{ repeatUntil: null }, { repeatUntil: { gte: from } }] }] },
        select: SERIES_SELECT,
        take: 2000,
      })
    : [];
  return buildIcs(events.map((e) => ({ series: e as SeriesRow, exceptions: e.exceptions as ExceptionRow[], courseName: e.course.name })), { name: "Nexa", detail: scope.detail });
}

/** One event as a downloadable .ics (full detail: the person downloading is signed in and allowed to see it). */
export async function eventIcsFor(eventId: string): Promise<{ ics: string; title: string } | null> {
  const e = await prisma.courseEvent.findUnique({ where: { id: eventId }, select: SERIES_SELECT });
  if (!e) return null;
  return { ics: buildIcs([{ series: e as SeriesRow, exceptions: e.exceptions as ExceptionRow[], courseName: e.course.name }], { name: e.title, detail: "full" }), title: e.title };
}
