/**
 * Session booking (#216 phase 2, Plus): tutors set weekly availability and
 * time off; students, parents and staff book free slots for a course;
 * lesson credits come from prepaid packs (./credits.ts) when the course
 * sells them. Actions: ./actions.ts. Contract: viewer.md, "Session booking".
 */

import "server-only";

import { occurrencesFor } from "@/features/calendar/calendar";
import { hasService } from "@/features/billing/services";
import { emitNotification } from "@/features/notifications/server";
import { getPreferencesForUsers } from "@/features/users/preferences";
import type { BookingStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { BookingEmailData, BookingTemplate } from "@/lib/email/booking-templates";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import { UserError } from "@/lib/user-error";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { BOOKING_DEFAULTS, freeSlots, isFreeSlot, refundsCredit, validateRules, type AvailabilityRule, type Span } from "./booking-math";
import { balanceFor, requiresCredit, syncLessonCredits } from "./credits";

const DAY = 86_400_000;
export const BOOKING_SERVICE = "session-booking";
export const BOOKING_UPSELL = "Session booking is part of the Plus plan for this course.";

/* ------------------------------------------------------------------------- */
/* Availability                                                              */
/* ------------------------------------------------------------------------- */

/** The membership whose availability the viewer may manage: their own, or anyone's with cover.manage. */
async function managedMembership(viewer: Viewer, membershipId?: string) {
  if (!viewer.workspace || !viewer.membership || viewer.persona !== "staff") throw new ViewerError("FORBIDDEN");
  const id = membershipId ?? viewer.membership.id;
  if (id !== viewer.membership.id && !can(viewer, "cover.manage")) throw new ViewerError("FORBIDDEN");
  const m = await prisma.membership.findUnique({ where: { id }, select: { id: true, workspaceId: true, user: { select: { name: true } } } });
  if (!m || m.workspaceId !== viewer.workspace.id) throw new UserError("That person isn't in this workspace.");
  return m;
}

export type AvailabilityInput = AvailabilityRule & { courseId?: string | null };

export async function getAvailability(viewer: Viewer, input: { membershipId?: string }) {
  const m = await managedMembership(viewer, input.membershipId);
  const [rules, timeOff, ws] = await Promise.all([
    prisma.bookingAvailability.findMany({ where: { membershipId: m.id }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }], select: { id: true, courseId: true, weekday: true, startMinute: true, endMinute: true, slotMinutes: true, bufferMinutes: true } }),
    prisma.bookingTimeOff.findMany({ where: { membershipId: m.id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, note: true } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: m.workspaceId }, select: { timezone: true, bookingCancelHours: true, bookingLeadHours: true, bookingHorizonDays: true } }),
  ]);
  return { membershipId: m.id, name: m.user.name, timeZone: ws.timezone, rules, timeOff, policy: { cancelHours: ws.bookingCancelHours, leadHours: ws.bookingLeadHours, horizonDays: ws.bookingHorizonDays } };
}

/** Replaces the weekly rules. A rule's courseId limits it to one course the tutor teaches; null means any. */
export async function setAvailability(viewer: Viewer, input: { membershipId?: string; rules: AvailabilityInput[] }) {
  const m = await managedMembership(viewer, input.membershipId);
  if (input.rules.length > 50) throw new UserError("That's too many times. Use 50 or fewer.");
  // Overlap is checked per course scope: the same hours for two courses would double-book.
  const problem = validateRules(input.rules);
  if (problem) throw new UserError(problem);
  const courseIds = [...new Set(input.rules.flatMap((r) => (r.courseId ? [r.courseId] : [])))];
  if (courseIds.length) {
    const taught = await prisma.courseStaff.count({ where: { membershipId: m.id, courseId: { in: courseIds } } });
    if (taught !== courseIds.length) throw new UserError("Times can only be limited to courses this tutor teaches.");
  }
  await prisma.$transaction([
    prisma.bookingAvailability.deleteMany({ where: { membershipId: m.id } }),
    prisma.bookingAvailability.createMany({
      data: input.rules.map((r) => ({ workspaceId: m.workspaceId, membershipId: m.id, courseId: r.courseId ?? null, weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute, slotMinutes: r.slotMinutes, bufferMinutes: r.bufferMinutes })),
    }),
  ]);
  return getAvailability(viewer, { membershipId: m.id });
}

export async function addTimeOff(viewer: Viewer, input: { membershipId?: string; startsAt: Date; endsAt: Date; note?: string | null }) {
  const m = await managedMembership(viewer, input.membershipId);
  if (!(input.endsAt > input.startsAt)) throw new UserError("Time off must end after it starts.");
  if (input.endsAt.getTime() - input.startsAt.getTime() > 366 * DAY) throw new UserError("Time off can be at most a year.");
  const clash = await prisma.booking.count({ where: { membershipId: m.id, status: "BOOKED", startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } });
  const row = await prisma.bookingTimeOff.create({ data: { workspaceId: m.workspaceId, membershipId: m.id, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note?.slice(0, 200) ?? null }, select: { id: true } });
  // Existing bookings stay: the tutor cancels them (which returns the credit and tells the family).
  return { id: row.id, bookingsInside: clash };
}

export async function removeTimeOff(viewer: Viewer, input: { id: string }) {
  const row = await prisma.bookingTimeOff.findUnique({ where: { id: input.id }, select: { membershipId: true } });
  if (!row) return { ok: true as const };
  await managedMembership(viewer, row.membershipId);
  await prisma.bookingTimeOff.delete({ where: { id: input.id } });
  return { ok: true as const };
}

/** Workspace booking rules: owners and admins (`workspace.settings`). */
export async function setBookingPolicy(viewer: Viewer, input: { cancelHours: number; leadHours: number; horizonDays: number }) {
  if (!viewer.workspace || !can(viewer, "workspace.settings")) throw new ViewerError("FORBIDDEN");
  const ok = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
  if (!ok(input.cancelHours, 0, 168) || !ok(input.leadHours, 0, 168) || !ok(input.horizonDays, 1, 180)) throw new UserError("Cancel notice and booking notice are 0 to 168 hours; booking ahead is 1 to 180 days.");
  await prisma.workspace.update({ where: { id: viewer.workspace.id }, data: { bookingCancelHours: input.cancelHours, bookingLeadHours: input.leadHours, bookingHorizonDays: input.horizonDays } });
  return { ok: true as const };
}

/* ------------------------------------------------------------------------- */
/* Who is booking                                                            */
/* ------------------------------------------------------------------------- */

type BookingContext = { course: { id: string; name: string; workspaceId: string }; learnerId: string; actor: "learner" | "guardian" | "staff" };

/** Checks the viewer may book (or see slots) for this course and learner, and returns the learner. */
async function bookingContext(viewer: Viewer, courseId: string, learnerId?: string): Promise<BookingContext> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, workspaceId: true } });
  if (!course?.workspaceId) throw new UserError("That course no longer exists.");
  const enrolled = (lid: string) => prisma.enrollment.findFirst({ where: { courseId, learnerId: lid, endedAt: null, status: "ACTIVE" }, select: { id: true } });
  if (viewer.persona === "learner") {
    const l = await prisma.learner.findFirst({ where: { userId: viewer.user.id, workspaceId: course.workspaceId, status: "ACTIVE" }, select: { id: true } });
    if (!l || !(await enrolled(l.id))) throw new ViewerError("FORBIDDEN");
    return { course: { ...course, workspaceId: course.workspaceId }, learnerId: l.id, actor: "learner" };
  }
  if (viewer.persona === "guardian") {
    if (!learnerId) throw new UserError("Choose which child the lesson is for.");
    const l = await prisma.learner.findUnique({ where: { id: learnerId }, select: { userId: true, workspaceId: true, status: true } });
    if (!l || l.workspaceId !== course.workspaceId || l.status !== "ACTIVE" || !viewer.children.some((c) => c.userId === l.userId) || !(await enrolled(learnerId))) throw new ViewerError("FORBIDDEN");
    return { course: { ...course, workspaceId: course.workspaceId }, learnerId, actor: "guardian" };
  }
  if (viewer.persona === "staff" || viewer.persona === "admin") {
    if (!(await canIn(viewer, "content.view", { courseId }))) throw new ViewerError("FORBIDDEN");
    if (!learnerId) throw new UserError("Choose the student.");
    if (!(await enrolled(learnerId))) throw new UserError("That student isn't in this course.");
    return { course: { ...course, workspaceId: course.workspaceId }, learnerId, actor: "staff" };
  }
  throw new ViewerError("FORBIDDEN");
}

/* ------------------------------------------------------------------------- */
/* Slots                                                                     */
/* ------------------------------------------------------------------------- */

/** Tutors of the course who have availability for it. */
async function bookableTutors(courseId: string) {
  return prisma.membership.findMany({
    where: { courseStaff: { some: { courseId } }, bookingAvailability: { some: { OR: [{ courseId: null }, { courseId }] } } },
    select: { id: true, userId: true, workspaceId: true, user: { select: { name: true } } },
  });
}

/** Busy time for a tutor: their bookings and the classes of every course they teach. */
async function busyFor(membershipId: string, from: Date, to: Date, exceptBookingId?: string): Promise<Span[]> {
  const [bookings, taught] = await Promise.all([
    prisma.booking.findMany({ where: { membershipId, status: "BOOKED", startsAt: { lt: to }, endsAt: { gt: from }, ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}) }, select: { startsAt: true, endsAt: true } }),
    prisma.courseStaff.findMany({ where: { membershipId }, select: { courseId: true } }),
  ]);
  const classes = taught.length ? await occurrencesFor({ courseIds: taught.map((t) => t.courseId), from, to }) : [];
  return [
    ...bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ...classes.filter((o) => !o.cancelled).map((o) => ({ start: new Date(o.start), end: new Date(o.end) })),
  ];
}

async function slotsForTutor(tutor: { id: string }, courseId: string, ws: { timezone: string; bookingLeadHours: number; bookingHorizonDays: number }, from: Date, to: Date, now: Date) {
  const [rules, timeOff, busy] = await Promise.all([
    prisma.bookingAvailability.findMany({ where: { membershipId: tutor.id, OR: [{ courseId: null }, { courseId }] }, select: { weekday: true, startMinute: true, endMinute: true, slotMinutes: true, bufferMinutes: true } }),
    prisma.bookingTimeOff.findMany({ where: { membershipId: tutor.id, startsAt: { lt: to }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } }),
    busyFor(tutor.id, from, to),
  ]);
  return freeSlots({ from, to, now, timeZone: ws.timezone, rules, timeOff: timeOff.map((t) => ({ start: t.startsAt, end: t.endsAt })), busy, leadHours: ws.bookingLeadHours, horizonDays: ws.bookingHorizonDays });
}

export type SlotsResult = {
  timeZone: string;
  tutors: Array<{ membershipId: string; name: string; slots: Array<{ start: Date; end: Date }> }>;
  credits: { needed: boolean; balance: number };
  policy: { cancelHours: number; leadHours: number; horizonDays: number };
};

/** Free slots for a course between two dates (at most 31 days), per tutor. */
export async function availableSlots(viewer: Viewer, input: { courseId: string; learnerId?: string; membershipId?: string; from: Date; to: Date }, now: Date = new Date()): Promise<SlotsResult> {
  const ctx = await bookingContext(viewer, input.courseId, input.learnerId);
  if (!(await hasService(viewer, input.courseId, BOOKING_SERVICE))) throw new UserError(BOOKING_UPSELL);
  if (!(input.to > input.from)) throw new UserError("Pick an end date after the start date.");
  const to = new Date(Math.min(input.to.getTime(), input.from.getTime() + 31 * DAY));
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.course.workspaceId }, select: { timezone: true, bookingCancelHours: true, bookingLeadHours: true, bookingHorizonDays: true } });
  const tutors = (await bookableTutors(input.courseId)).filter((t) => !input.membershipId || t.id === input.membershipId);
  const out: SlotsResult["tutors"] = [];
  for (const t of tutors) out.push({ membershipId: t.id, name: t.user.name, slots: await slotsForTutor(t, input.courseId, ws, input.from, to, now) });
  await syncLessonCredits(ctx.learnerId);
  const needed = await requiresCredit(input.courseId, ctx.learnerId, now);
  return {
    timeZone: ws.timezone,
    tutors: out,
    credits: { needed, balance: await balanceFor(ctx.learnerId, input.courseId) },
    policy: { cancelHours: ws.bookingCancelHours, leadHours: ws.bookingLeadHours, horizonDays: ws.bookingHorizonDays },
  };
}

/* ------------------------------------------------------------------------- */
/* Booking and cancelling                                                    */
/* ------------------------------------------------------------------------- */

export function whenLabel(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-ZA", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(start);
  const t = (d: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day}, ${t(start)}–${t(end)}`;
}

type Party = { id: string; name: string; email: string; role: "tutor" | "student" | "parent" };

/** Who hears about a booking: the tutor, the student (with a real email) and their parents. */
async function partiesOf(bookingId: string): Promise<{ parties: Party[]; base: Omit<BookingEmailData, "recipientName" | "role">; workspaceId: string }> {
  const b = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      startsAt: true, endsAt: true, note: true, meetingLink: true, workspaceId: true,
      course: { select: { name: true } }, workspace: { select: { name: true, timezone: true } },
      membership: { select: { user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true } } } },
      learner: { select: { user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true } } } },
    },
  });
  const student = b.learner.user;
  const guardians = await prisma.guardianship.findMany({
    where: { studentUserId: student.id, status: "ACTIVE", guardian: { deletedAt: null, emailIsPlaceholder: false } },
    select: { guardian: { select: { id: true, name: true, email: true } } },
  });
  const tutor = b.membership.user;
  const parties: Party[] = [
    ...(tutor.emailIsPlaceholder ? [] : [{ id: tutor.id, name: tutor.name, email: tutor.email, role: "tutor" as const }]),
    ...(student.emailIsPlaceholder ? [] : [{ id: student.id, name: student.name, email: student.email, role: "student" as const }]),
    ...guardians.map((g) => ({ ...g.guardian, role: "parent" as const })),
  ];
  return {
    parties,
    workspaceId: b.workspaceId,
    base: {
      studentName: student.name, tutorName: tutor.name, courseName: b.course.name, workspaceName: b.workspace.name,
      when: whenLabel(b.startsAt, b.endsAt, b.workspace.timezone), meetingLink: b.meetingLink, note: b.note,
    },
  };
}

async function tell(bookingId: string, template: BookingTemplate, extra: Partial<BookingEmailData> = {}, skipUserId?: string) {
  const { parties, base, workspaceId } = await partiesOf(bookingId);
  const prefs = await getPreferencesForUsers(parties.map((p) => p.id));
  const keys: string[] = [];
  for (const p of parties) {
    if (p.id === skipUserId && template !== "reminder") continue;
    if (prefs.get(p.id)?.emailNotifications === false) continue;
    const key = `booking:${template}:${bookingId}:${p.id}`;
    keys.push(key);
    await enqueueEmail(prisma, {
      key, template: `booking:${template}`, to: p.email, userId: p.id, workspaceId, category: "booking",
      data: { ...base, ...extra, recipientName: p.name, role: p.role } satisfies BookingEmailData,
    });
  }
  if (template !== "reminder") await sendQueuedNow(keys).catch(() => undefined);
  return keys.length;
}

export type BookResult = { id: string; startsAt: Date; endsAt: Date; usedCredit: boolean; creditsLeft: number | null };

export async function bookSession(
  viewer: Viewer,
  input: { courseId: string; membershipId: string; startsAt: Date; learnerId?: string; note?: string | null },
  now: Date = new Date(),
): Promise<BookResult> {
  const ctx = await bookingContext(viewer, input.courseId, input.learnerId);
  if (!(await hasService(viewer, input.courseId, BOOKING_SERVICE))) throw new UserError(BOOKING_UPSELL);
  const tutor = (await bookableTutors(input.courseId)).find((t) => t.id === input.membershipId);
  if (!tutor) throw new UserError("That tutor doesn't take bookings for this course.");
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.course.workspaceId }, select: { timezone: true, bookingLeadHours: true, bookingHorizonDays: true } });
  const dayFrom = new Date(input.startsAt.getTime() - DAY);
  const dayTo = new Date(input.startsAt.getTime() + DAY);
  const free = await slotsForTutor(tutor, input.courseId, ws, dayFrom, dayTo, now);
  const slot = free.find((s) => s.start.getTime() === input.startsAt.getTime());
  if (!slot || !isFreeSlot(slot, free)) throw new UserError("That time isn't free any more. Pick another.");
  // The learner can't be in two lessons at once either.
  const clash = await prisma.booking.count({ where: { learnerId: ctx.learnerId, status: "BOOKED", startsAt: { lt: slot.end }, endsAt: { gt: slot.start } } });
  if (clash) throw new UserError("There's already a lesson booked at that time.");

  await syncLessonCredits(ctx.learnerId);
  const needsCredit = await requiresCredit(input.courseId, ctx.learnerId, now);
  const created = await prisma.$transaction(async (tx) => {
    if (needsCredit) {
      const left = await balanceFor(ctx.learnerId, input.courseId, tx);
      if (left < 1) throw new UserError("There are no lessons left on the pack for this course. Buy a pack to book.");
    }
    const b = await tx.booking
      .create({
        data: {
          workspaceId: ctx.course.workspaceId, courseId: input.courseId, membershipId: tutor.id, learnerId: ctx.learnerId,
          startsAt: slot.start, endsAt: slot.end, slotKey: `${tutor.id}:${slot.start.getTime()}`, bookedByUserId: viewer.user.id,
          note: input.note?.trim() ? input.note.trim().slice(0, 500) : null, usedCredit: needsCredit,
        },
        select: { id: true },
      })
      .catch((e: { code?: string }) => {
        if (e.code === "P2002") throw new UserError("Someone has just booked that time. Pick another.");
        throw e;
      });
    if (needsCredit) {
      await tx.lessonCredit.create({ data: { workspaceId: ctx.course.workspaceId, learnerId: ctx.learnerId, courseId: input.courseId, kind: "BOOKING", lessons: -1, bookingId: b.id, byUserId: viewer.user.id } });
    }
    return b;
  });
  await tell(created.id, "confirmed", {}, viewer.user.id).catch((e) => console.error("[booking] confirm email failed:", e));
  if (ctx.actor !== "staff") {
    await emitNotification(
      { title: `New booking: ${ctx.course.name}`, message: `A lesson was booked for ${whenLabel(slot.start, slot.end, ws.timezone)}.`, type: "SYSTEM", userIds: [tutor.userId], courseId: input.courseId, link: "/dashboard/bookings" },
      { revalidate: false, email: false },
    ).catch(() => undefined);
  }
  return { id: created.id, startsAt: slot.start, endsAt: slot.end, usedCredit: needsCredit, creditsLeft: needsCredit ? await balanceFor(ctx.learnerId, input.courseId) : null };
}

/** May the viewer act on this booking, and as whom? */
async function bookingAccess(viewer: Viewer, bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, workspaceId: true, courseId: true, membershipId: true, learnerId: true, startsAt: true, endsAt: true, status: true, usedCredit: true, learner: { select: { userId: true } }, workspace: { select: { bookingCancelHours: true } } },
  });
  if (!b) throw new UserError("That booking no longer exists.");
  let as: "tutor" | "staff" | "learner" | "guardian" | null = null;
  if ((viewer.persona === "staff" || viewer.persona === "admin") && viewer.workspace?.id === b.workspaceId) {
    if (viewer.membership?.id === b.membershipId) as = "tutor";
    else if (await canIn(viewer, "courses.edit", { courseId: b.courseId })) as = "staff";
  } else if (viewer.persona === "learner" && b.learner.userId === viewer.user.id) as = "learner";
  else if (viewer.persona === "guardian" && viewer.children.some((c) => c.userId === b.learner.userId)) as = "guardian";
  if (!as) throw new ViewerError("FORBIDDEN");
  return { b, as };
}

/**
 * Cancels a booking. The lesson credit comes back when the tutor or staff
 * cancel, or when the family cancels at least `bookingCancelHours` before.
 */
export async function cancelBooking(viewer: Viewer, input: { bookingId: string; reason?: string | null }, now: Date = new Date()) {
  const { b, as } = await bookingAccess(viewer, input.bookingId);
  if (b.status !== "BOOKED") throw new UserError("This booking isn't active any more.");
  if (b.startsAt <= now && (as === "learner" || as === "guardian")) throw new UserError("This lesson has already started. Ask the tutor.");
  const giveBack = b.usedCredit && (as === "tutor" || as === "staff" || refundsCredit(b.startsAt, now, b.workspace.bookingCancelHours));
  const reason = input.reason?.trim() ? input.reason.trim().slice(0, 300) : null;
  await prisma.$transaction(async (tx) => {
    const r = await tx.booking.updateMany({
      where: { id: b.id, status: "BOOKED" },
      data: { status: "CANCELLED", slotKey: null, cancelledAt: now, cancelledByUserId: viewer.user.id, cancelReason: reason, creditReturned: giveBack },
    });
    if (r.count !== 1) throw new UserError("This booking isn't active any more.");
    if (giveBack) {
      await tx.lessonCredit.create({ data: { workspaceId: b.workspaceId, learnerId: b.learnerId, courseId: b.courseId, kind: "CANCEL_RETURN", lessons: 1, bookingId: b.id, byUserId: viewer.user.id } });
    }
  });
  await tell(b.id, "cancelled", { cancelledBy: viewer.user.name, reason, creditReturned: b.usedCredit ? giveBack : undefined }, viewer.user.id).catch((e) => console.error("[booking] cancel email failed:", e));
  return { ok: true as const, creditReturned: giveBack };
}

/** After the lesson: the tutor or staff mark it done or a no-show (a no-show keeps the credit used). */
export async function markBooking(viewer: Viewer, input: { bookingId: string; status: "COMPLETED" | "NO_SHOW" }, now: Date = new Date()) {
  const { b, as } = await bookingAccess(viewer, input.bookingId);
  if (as !== "tutor" && as !== "staff") throw new ViewerError("FORBIDDEN");
  if (b.status === "CANCELLED") throw new UserError("This booking was cancelled.");
  if (b.startsAt > now) throw new UserError("You can mark a lesson once it has started.");
  await prisma.booking.update({ where: { id: b.id }, data: { status: input.status, slotKey: null } });
  return { ok: true as const };
}

/** The tutor adds or changes the online meeting link. */
export async function setBookingLink(viewer: Viewer, input: { bookingId: string; meetingLink: string | null }) {
  const { b, as } = await bookingAccess(viewer, input.bookingId);
  if (as !== "tutor" && as !== "staff") throw new ViewerError("FORBIDDEN");
  const link = input.meetingLink?.trim() || null;
  if (link && !/^https:\/\/[^\s]+$/.test(link)) throw new UserError("Use a full https:// link.");
  await prisma.booking.update({ where: { id: b.id }, data: { meetingLink: link } });
  return { ok: true as const };
}

export type BookingRow = {
  id: string; course: { id: string; name: string }; tutor: { membershipId: string; name: string }; student: { learnerId: string; userId: string; name: string };
  startsAt: Date; endsAt: Date; status: BookingStatus; note: string | null; meetingLink: string | null; usedCredit: boolean;
  cancelledAt: Date | null; cancelReason: string | null; creditReturned: boolean;
  /** For the viewer: can they cancel, and would the credit come back? */
  canCancel: boolean; cancelReturnsCredit: boolean;
};

/**
 * Bookings the viewer can see between two dates (at most 93 days): a tutor
 * their own (or, with courseId, the course's if they may edit it), staff
 * with `cover.manage` the workspace's, a student their own, a parent their
 * children's.
 */
export async function listBookings(viewer: Viewer, input: { from: Date; to: Date; courseId?: string; membershipId?: string }, now: Date = new Date()): Promise<BookingRow[]> {
  const to = new Date(Math.min(input.to.getTime(), input.from.getTime() + 93 * DAY));
  const when = { startsAt: { lt: to }, endsAt: { gt: input.from } };
  let where: Record<string, unknown>;
  let family = false;
  if (viewer.persona === "staff" || viewer.persona === "admin") {
    if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
    if (input.courseId) {
      if (!(await canIn(viewer, "courses.edit", { courseId: input.courseId })) && !(await canIn(viewer, "content.view", { courseId: input.courseId }))) throw new ViewerError("FORBIDDEN");
      const manage = await canIn(viewer, "courses.edit", { courseId: input.courseId });
      where = { courseId: input.courseId, ...(manage ? {} : { membershipId: viewer.membership?.id ?? "-" }) };
    } else if (input.membershipId && input.membershipId !== viewer.membership?.id) {
      if (!can(viewer, "cover.manage")) throw new ViewerError("FORBIDDEN");
      where = { workspaceId: viewer.workspace.id, membershipId: input.membershipId };
    } else {
      where = { membershipId: viewer.membership?.id ?? "-" };
    }
  } else if (viewer.persona === "learner") {
    where = { learner: { userId: viewer.user.id } };
    family = true;
  } else if (viewer.persona === "guardian") {
    where = { learner: { userId: { in: viewer.children.map((c) => c.userId) } } };
    family = true;
  } else throw new ViewerError("FORBIDDEN");
  const rows = await prisma.booking.findMany({
    where: { ...where, ...when },
    orderBy: { startsAt: "asc" },
    take: 500,
    select: {
      id: true, startsAt: true, endsAt: true, status: true, note: true, meetingLink: true, usedCredit: true, cancelledAt: true, cancelReason: true, creditReturned: true, membershipId: true,
      course: { select: { id: true, name: true } }, membership: { select: { id: true, user: { select: { name: true } } } },
      learner: { select: { id: true, userId: true, user: { select: { name: true } } } }, workspace: { select: { bookingCancelHours: true } },
    },
  });
  return rows.map((r) => {
    const active = r.status === "BOOKED";
    const canCancel = active && (family ? r.startsAt > now : true);
    return {
      id: r.id, course: r.course, tutor: { membershipId: r.membership.id, name: r.membership.user.name },
      student: { learnerId: r.learner.id, userId: r.learner.userId, name: r.learner.user.name },
      startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, note: r.note, meetingLink: r.meetingLink, usedCredit: r.usedCredit,
      cancelledAt: r.cancelledAt, cancelReason: r.cancelReason, creditReturned: r.creditReturned,
      canCancel, cancelReturnsCredit: canCancel && r.usedCredit && (!family || refundsCredit(r.startsAt, now, r.workspace.bookingCancelHours)),
    };
  });
}

/* ------------------------------------------------------------------------- */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------- */

/** From the notifications cron: one reminder for each lesson starting within the next 24 hours. */
export async function sendBookingReminders(now: Date = new Date()): Promise<number> {
  const due = await prisma.booking.findMany({
    where: { status: "BOOKED", remindedAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + DAY) }, createdAt: { lt: new Date(now.getTime() - 60 * 60_000) } },
    take: 200,
    select: { id: true },
  });
  let n = 0;
  for (const b of due) {
    // Claim first, so two runs never both send.
    const claimed = await prisma.booking.updateMany({ where: { id: b.id, remindedAt: null }, data: { remindedAt: now } });
    if (claimed.count !== 1) continue;
    await tell(b.id, "reminder").catch((e) => console.error("[booking] reminder failed:", e));
    n++;
  }
  return n;
}

export { BOOKING_DEFAULTS };
