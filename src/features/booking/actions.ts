"use server";

/**
 * Session booking (#216 phase 2, Plus). Contract: viewer.md, "Session booking".
 *
 * Tutors and managers:  getBookingAvailability, setBookingAvailability,
 *                       addBookingTimeOff, removeBookingTimeOff,
 *                       setBookingPolicyAction (workspace.settings),
 *                       markBookingAction, setBookingLinkAction,
 *                       adjustLessonCreditsAction (fees.manage)
 * Everyone who books:   getBookingSlots, bookSessionAction,
 *                       cancelBookingAction, listBookingsAction,
 *                       getLessonCredits, buyLessonPackAction (billing on)
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";

import {
  addTimeOff, availableSlots, bookSession, cancelBooking, getAvailability, listBookings, markBooking, removeTimeOff,
  setAvailability, setBookingLink, setBookingPolicy,
} from "./bookings";
import { adjustCredits, buyPack, creditSummary } from "./credits";

const id = z.string().min(1).max(64);
const date = z.coerce.date();
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
function done<T>(r: T): T {
  revalidatePath("/dashboard", "layout");
  return r;
}

const rule = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  slotMinutes: z.number().int().min(15).max(240).default(60),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  courseId: id.nullable().optional(),
});

export const getBookingAvailability = viewerActionClient
  .schema(z.object({ membershipId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => getAvailability(v(ctx), parsedInput));

export const setBookingAvailability = writableViewerActionClient
  .schema(z.object({ membershipId: id.optional(), rules: z.array(rule).max(50) }))
  .action(async ({ parsedInput, ctx }) => done(await setAvailability(v(ctx), parsedInput)));

export const addBookingTimeOff = writableViewerActionClient
  .schema(z.object({ membershipId: id.optional(), startsAt: date, endsAt: date, note: z.string().max(200).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await addTimeOff(v(ctx), parsedInput)));

export const removeBookingTimeOff = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => done(await removeTimeOff(v(ctx), parsedInput)));

export const setBookingPolicyAction = writableViewerActionClient
  .schema(z.object({ cancelHours: z.number().int(), leadHours: z.number().int(), horizonDays: z.number().int() }))
  .action(async ({ parsedInput, ctx }) => done(await setBookingPolicy(v(ctx), parsedInput)));

export const getBookingSlots = viewerActionClient
  .schema(z.object({ courseId: id, learnerId: id.optional(), membershipId: id.optional(), from: date, to: date }))
  .action(async ({ parsedInput, ctx }) => availableSlots(v(ctx), parsedInput));

export const bookSessionAction = writableViewerActionClient
  .schema(z.object({ courseId: id, membershipId: id, startsAt: date, learnerId: id.optional(), note: z.string().max(500).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await bookSession(v(ctx), parsedInput)));

export const cancelBookingAction = writableViewerActionClient
  .schema(z.object({ bookingId: id, reason: z.string().max(300).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await cancelBooking(v(ctx), parsedInput)));

export const markBookingAction = writableViewerActionClient
  .schema(z.object({ bookingId: id, status: z.enum(["COMPLETED", "NO_SHOW"]) }))
  .action(async ({ parsedInput, ctx }) => done(await markBooking(v(ctx), parsedInput)));

export const setBookingLinkAction = writableViewerActionClient
  .schema(z.object({ bookingId: id, meetingLink: z.string().max(500).nullable() }))
  .action(async ({ parsedInput, ctx }) => done(await setBookingLink(v(ctx), parsedInput)));

export const listBookingsAction = viewerActionClient
  .schema(z.object({ from: date, to: date, courseId: id.optional(), membershipId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => listBookings(v(ctx), parsedInput));

/** A learner's lesson credits and the packs on sale, per course. Staff pass learnerId; students and parents may too (their own or their child's). */
async function learnerFor(viewer: Viewer, learnerId?: string) {
  if (viewer.persona === "learner") {
    const own = await prisma.learner.findMany({ where: { userId: viewer.user.id, status: "ACTIVE" }, select: { id: true } });
    const pick = learnerId ? own.find((l) => l.id === learnerId) : own.find((l) => l.id === viewer.learner?.id) ?? own[0];
    if (!pick) throw new ViewerError("FORBIDDEN");
    return pick.id;
  }
  if (!learnerId) throw new UserError("Choose the student.");
  const l = await prisma.learner.findUnique({ where: { id: learnerId }, select: { userId: true, workspaceId: true } });
  if (!l) throw new ViewerError("FORBIDDEN");
  if (viewer.persona === "guardian" && viewer.children.some((c) => c.userId === l.userId)) return learnerId;
  if ((viewer.persona === "staff" || viewer.persona === "admin") && viewer.workspace?.id === l.workspaceId) return learnerId;
  throw new ViewerError("FORBIDDEN");
}

export const getLessonCredits = viewerActionClient
  .schema(z.object({ learnerId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const viewer = v(ctx);
    const learnerId = await learnerFor(viewer, parsedInput.learnerId);
    const courseIds = (await prisma.enrollment.findMany({ where: { learnerId, endedAt: null }, select: { courseId: true } })).map((e) => e.courseId);
    let visible = courseIds;
    if (viewer.persona === "staff") {
      const ok = await Promise.all(courseIds.map((c) => canIn(viewer, "content.view", { courseId: c })));
      visible = courseIds.filter((_, i) => ok[i]);
    }
    return { learnerId, courses: await creditSummary(learnerId, visible) };
  });

export const adjustLessonCreditsAction = writableViewerActionClient
  .schema(z.object({ learnerId: id, courseId: id, lessons: z.number().int(), note: z.string().trim().min(3).max(300) }))
  .action(async ({ parsedInput, ctx }) => {
    const viewer = v(ctx);
    if (!viewer.workspace || !(await canIn(viewer, "fees.manage", { courseId: parsedInput.courseId }))) throw new ViewerError("FORBIDDEN");
    return done(await adjustCredits({ ...parsedInput, workspaceId: viewer.workspace.id, byUserId: viewer.user.id }));
  });

export const buyLessonPackAction = writableViewerActionClient
  .schema(z.object({ feeScheduleId: id, learnerId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const viewer = v(ctx);
    if (viewer.persona !== "learner" && viewer.persona !== "guardian") throw new ViewerError("FORBIDDEN");
    if (viewer.persona === "learner" && !viewer.learner?.paymentVisible) throw new UserError("Ask your parent to buy the lesson pack.");
    const learnerId = await learnerFor(viewer, parsedInput.learnerId);
    const l = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId }, select: { workspaceId: true } });
    return done(await buyPack({ workspaceId: l.workspaceId, learnerId, feeScheduleId: parsedInput.feeScheduleId }));
  });
