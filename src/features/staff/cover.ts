/**
 * Cover for absent tutors (#216 phase 3, organisations). Contract:
 * viewer.md, "Timesheets and cover".
 *
 * A tutor (for their own class) or a manager with `cover.manage` asks for
 * cover for one class occurrence; the manager picks a free tutor; the cover
 * tutor gets course access until a day after the class, an email and an
 * in-app note, and the class moves from the absent tutor's timesheet to
 * theirs.
 */

import "server-only";

import { occurrencesFor } from "@/features/calendar/calendar";
import { emitNotification } from "@/features/notifications/server";
import { prisma } from "@/lib/db";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { assertManages, managedMemberships } from "./scope";
import { clashes, occurrenceKey } from "./timesheet-math";

const PERM = "cover.manage" as const;
const DAY = 86_400_000;

function whenLabel(start: Date, end: Date, timeZone: string) {
  const d = new Intl.DateTimeFormat("en-ZA", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(start);
  const t = (x: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(x);
  return `${d}, ${t(start)}–${t(end)}`;
}

/** The occurrence, checked against the calendar. */
async function occurrence(eventId: string, occurrenceStart: Date) {
  const ev = await prisma.courseEvent.findUnique({ where: { id: eventId }, select: { courseId: true, course: { select: { workspaceId: true, name: true } } } });
  if (!ev?.course.workspaceId) throw new UserError("That class no longer exists.");
  const occ = (await occurrencesFor({ courseIds: [ev.courseId], from: new Date(occurrenceStart.getTime() - DAY), to: new Date(occurrenceStart.getTime() + DAY) }))
    .find((o) => o.eventId === eventId && new Date(o.occurrenceStart).getTime() === occurrenceStart.getTime());
  if (!occ || occ.cancelled) throw new UserError("That class isn't on the calendar any more.");
  return { courseId: ev.courseId, courseName: ev.course.name, workspaceId: ev.course.workspaceId, start: new Date(occ.start), end: new Date(occ.end), title: occ.title };
}

/** Asks for cover. A tutor for their own class; a manager for anyone's they manage. */
export async function requestCover(viewer: Viewer, input: { eventId: string; occurrenceStart: Date; absentMembershipId?: string; reason?: string | null }, now: Date = new Date()) {
  if (!viewer.workspace || viewer.persona !== "staff") throw new ViewerError("FORBIDDEN");
  const o = await occurrence(input.eventId, input.occurrenceStart);
  if (o.workspaceId !== viewer.workspace.id) throw new ViewerError("FORBIDDEN");
  if (o.end <= now) throw new UserError("That class has already happened.");
  const absent = input.absentMembershipId ?? viewer.membership?.id;
  if (!absent) throw new ViewerError("FORBIDDEN");
  if (absent !== viewer.membership?.id && (await assertManages(viewer, absent, PERM)) !== "manager") throw new ViewerError("FORBIDDEN");
  if (!(await prisma.courseStaff.findFirst({ where: { courseId: o.courseId, membershipId: absent }, select: { courseId: true } }))) throw new UserError("That tutor doesn't teach this course.");
  const liveKey = occurrenceKey(input.eventId, input.occurrenceStart);
  const row = await prisma.coverRequest
    .create({
      data: {
        workspaceId: o.workspaceId, courseId: o.courseId, eventId: input.eventId, occurrenceStart: input.occurrenceStart, startsAt: o.start, endsAt: o.end,
        absentMembershipId: absent, liveKey, reason: input.reason?.trim().slice(0, 300) || null, createdById: viewer.user.id,
      },
      select: { id: true },
    })
    .catch((e: { code?: string }) => {
      if (e.code === "P2002") throw new UserError("Cover has already been asked for this class.");
      throw e;
    });
  return row;
}

/** Tutors free at that time, in the manager's scope: those who teach the same subject first. */
export async function coverCandidates(viewer: Viewer, input: { coverId: string }) {
  const c = await loadCover(viewer, input.coverId);
  const scope = await managedMemberships(viewer, PERM);
  const subject = (await prisma.course.findUnique({ where: { id: c.courseId }, select: { subject: true } }))?.subject ?? null;
  const members = await prisma.membership.findMany({
    where: { workspaceId: c.workspaceId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "TUTOR"] }, id: { not: c.absentMembershipId }, ...(scope === "ALL" ? {} : { id: { in: scope.filter((x) => x !== c.absentMembershipId) } }) },
    select: { id: true, user: { select: { name: true } }, courseStaff: { select: { courseId: true, course: { select: { subject: true } } } } },
  });
  const span = { start: c.startsAt, end: c.endsAt };
  const out = [];
  for (const m of members) {
    const courseIds = m.courseStaff.map((s) => s.courseId);
    const [classes, bookings, covering] = await Promise.all([
      occurrencesFor({ courseIds, from: new Date(span.start.getTime() - DAY), to: new Date(span.end.getTime() + DAY) }),
      prisma.booking.findMany({ where: { membershipId: m.id, status: "BOOKED", startsAt: { lt: span.end }, endsAt: { gt: span.start } }, select: { startsAt: true, endsAt: true } }),
      prisma.coverRequest.findMany({ where: { coverMembershipId: m.id, status: "ASSIGNED", startsAt: { lt: span.end }, endsAt: { gt: span.start } }, select: { startsAt: true, endsAt: true } }),
    ]);
    const busy = [
      ...classes.filter((o) => !o.cancelled).map((o) => ({ start: new Date(o.start), end: new Date(o.end) })),
      ...bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      ...covering.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ];
    if (clashes(span, busy)) continue;
    out.push({ membershipId: m.id, name: m.user.name, teachesCourse: courseIds.includes(c.courseId), sameSubject: !!subject && m.courseStaff.some((s) => s.course.subject === subject) });
  }
  return out.sort((a, b) => Number(b.teachesCourse) - Number(a.teachesCourse) || Number(b.sameSubject) - Number(a.sameSubject) || a.name.localeCompare(b.name));
}

async function loadCover(viewer: Viewer, coverId: string) {
  if (!viewer.workspace || !can(viewer, PERM)) throw new ViewerError("FORBIDDEN");
  const c = await prisma.coverRequest.findUnique({ where: { id: coverId } });
  if (!c || c.workspaceId !== viewer.workspace.id) throw new UserError("That cover request no longer exists.");
  if ((await assertManages(viewer, c.absentMembershipId, PERM)) !== "manager") throw new ViewerError("FORBIDDEN");
  return c;
}

/** Assigns (or changes) the cover tutor. */
export async function assignCover(viewer: Viewer, input: { coverId: string; coverMembershipId: string }, now: Date = new Date()) {
  const c = await loadCover(viewer, input.coverId);
  if (c.status === "CANCELLED") throw new UserError("This cover request was cancelled.");
  if (c.endsAt <= now) throw new UserError("That class has already happened.");
  if (input.coverMembershipId === c.absentMembershipId) throw new UserError("Pick someone other than the absent tutor.");
  const free = await coverCandidates(viewer, { coverId: c.id });
  if (!free.some((f) => f.membershipId === input.coverMembershipId)) throw new UserError("That tutor isn't free then, or isn't someone you manage.");
  const teaches = await prisma.courseStaff.findFirst({ where: { courseId: c.courseId, membershipId: input.coverMembershipId }, select: { courseId: true } });
  await prisma.$transaction(async (tx) => {
    // Changing cover: take away access the previous cover tutor got only for this.
    if (c.coverMembershipId && c.addedCourseStaff && c.coverMembershipId !== input.coverMembershipId) {
      await tx.courseStaff.deleteMany({ where: { courseId: c.courseId, membershipId: c.coverMembershipId, role: "ASSISTANT" } });
    }
    if (!teaches) await tx.courseStaff.create({ data: { courseId: c.courseId, membershipId: input.coverMembershipId, role: "ASSISTANT" } });
    await tx.coverRequest.update({ where: { id: c.id }, data: { status: "ASSIGNED", coverMembershipId: input.coverMembershipId, assignedById: viewer.user.id, assignedAt: now, addedCourseStaff: !teaches } });
  });
  // Tell the cover tutor (email and in-app) and the absent tutor (in-app).
  const [cover, absent, course, ws] = await Promise.all([
    prisma.membership.findUniqueOrThrow({ where: { id: input.coverMembershipId }, select: { user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true } } } }),
    prisma.membership.findUniqueOrThrow({ where: { id: c.absentMembershipId }, select: { user: { select: { id: true, name: true } } } }),
    prisma.course.findUniqueOrThrow({ where: { id: c.courseId }, select: { name: true } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: c.workspaceId }, select: { name: true, timezone: true } }),
  ]);
  const when = whenLabel(c.startsAt, c.endsAt, ws.timezone);
  if (!cover.user.emailIsPlaceholder) {
    const key = `cover:assigned:${c.id}:${input.coverMembershipId}`;
    await enqueueEmail(prisma, {
      key, template: "staff:cover-assigned", to: cover.user.email, userId: cover.user.id, workspaceId: c.workspaceId, category: "staff",
      data: { recipientName: cover.user.name, absentName: absent.user.name, courseName: course.name, workspaceName: ws.name, when, reason: c.reason, courseId: c.courseId },
    });
    await sendQueuedNow([key]).catch(() => undefined);
  }
  await emitNotification({ title: `You're covering ${course.name}`.slice(0, 200), message: `${when}, for ${absent.user.name}.`, type: "SYSTEM", userIds: [cover.user.id], link: `/dashboard/courses/${c.courseId}` }, { revalidate: false, email: false }).catch(() => undefined);
  await emitNotification({ title: `Cover arranged: ${course.name}`.slice(0, 200), message: `${cover.user.name} is covering ${when}.`, type: "SYSTEM", userIds: [absent.user.id] }, { revalidate: false, email: false }).catch(() => undefined);
  return { ok: true as const, addedToCourse: !teaches };
}

/** Cancels a request (the tutor is back, or the class moved). Removes access added only for cover. */
export async function cancelCover(viewer: Viewer, input: { coverId: string }) {
  if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
  const c = await prisma.coverRequest.findUnique({ where: { id: input.coverId } });
  if (!c || c.workspaceId !== viewer.workspace.id) throw new UserError("That cover request no longer exists.");
  const own = c.absentMembershipId === viewer.membership?.id && c.status === "OPEN";
  if (!own) await loadCover(viewer, input.coverId);
  await prisma.$transaction(async (tx) => {
    if (c.addedCourseStaff && c.coverMembershipId && !c.accessEndedAt) await tx.courseStaff.deleteMany({ where: { courseId: c.courseId, membershipId: c.coverMembershipId, role: "ASSISTANT" } });
    await tx.coverRequest.update({ where: { id: c.id }, data: { status: "CANCELLED", liveKey: null, accessEndedAt: c.addedCourseStaff ? new Date() : null } });
  });
  return { ok: true as const };
}

/** Cover between two dates: a manager sees what they manage; a tutor sees requests for them and by them. */
export async function listCover(viewer: Viewer, input: { from: Date; to: Date; status?: "OPEN" | "ASSIGNED" | "CANCELLED" }) {
  if (!viewer.workspace || viewer.persona !== "staff") throw new ViewerError("FORBIDDEN");
  const to = new Date(Math.min(input.to.getTime(), input.from.getTime() + 93 * DAY));
  const scope = can(viewer, PERM) ? await managedMemberships(viewer, PERM) : null;
  const me = viewer.membership?.id ?? "-";
  const who = scope === "ALL" ? {} : scope ? { OR: [{ absentMembershipId: { in: scope } }, { coverMembershipId: me }] } : { OR: [{ absentMembershipId: me }, { coverMembershipId: me }] };
  const rows = await prisma.coverRequest.findMany({
    where: { workspaceId: viewer.workspace.id, startsAt: { gte: input.from, lt: to }, ...(input.status ? { status: input.status } : {}), ...who },
    orderBy: { startsAt: "asc" },
    take: 300,
  });
  const ids = [...new Set(rows.flatMap((r) => [r.absentMembershipId, r.coverMembershipId ?? ""]).filter(Boolean))];
  const names = new Map((await prisma.membership.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true } } } })).map((m) => [m.id, m.user.name]));
  const courses = new Map((await prisma.course.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courseId))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id, courseId: r.courseId, courseName: courses.get(r.courseId) ?? "", eventId: r.eventId, occurrenceStart: r.occurrenceStart, startsAt: r.startsAt, endsAt: r.endsAt,
    status: r.status, reason: r.reason, absent: { membershipId: r.absentMembershipId, name: names.get(r.absentMembershipId) ?? "" },
    cover: r.coverMembershipId ? { membershipId: r.coverMembershipId, name: names.get(r.coverMembershipId) ?? "" } : null,
  }));
}

/** Housekeeping: removes course access given only for cover, a day after the class. */
export async function endCoverAccess(now: Date = new Date()): Promise<number> {
  const due = await prisma.coverRequest.findMany({ where: { status: "ASSIGNED", addedCourseStaff: true, accessEndedAt: null, endsAt: { lt: new Date(now.getTime() - DAY) } }, select: { id: true, courseId: true, coverMembershipId: true } });
  let n = 0;
  for (const c of due) {
    if (!c.coverMembershipId) continue;
    // Keep access while they cover another class of this course that hasn't finished.
    const more = await prisma.coverRequest.count({ where: { courseId: c.courseId, coverMembershipId: c.coverMembershipId, status: "ASSIGNED", endsAt: { gte: new Date(now.getTime() - DAY) } } });
    if (!more) await prisma.courseStaff.deleteMany({ where: { courseId: c.courseId, membershipId: c.coverMembershipId, role: "ASSISTANT" } });
    await prisma.coverRequest.update({ where: { id: c.id }, data: { accessEndedAt: now } });
    n++;
  }
  return n;
}

