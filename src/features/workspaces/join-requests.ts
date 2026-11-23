/**
 * Course listings and join requests (owner decision 2026-11-21, #206).
 *
 * Staff list a course so students and parents can find it. A student, or a
 * parent for their child, asks to join; staff approve or decline. Approving
 * adds the student to the workspace (a Learner) and enrols them. Tutors
 * can't search for self-registered students: this is the only way such a
 * student reaches a workspace, and it starts with the student.
 *
 * Server only; takes ids so scripts can test it. Permission checks that
 * need the viewer live in ./join-request-actions.ts.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { emitWebhook } from "@/features/api/webhooks";
import { scopedCourseWhere } from "@/lib/viewer-core";
import { enqueueEmail } from "@/lib/email/queue";

import { assertCanAddLearners } from "@/features/billing/caps";

import { markReferralJoined, recordReferral } from "./referrals";

export const JOIN = {
  /** Open requests one person may have at once. */
  maxPending: 5,
  /** Requests one person may make in 24 hours. */
  maxPerDay: 10,
  messageMax: 500,
  reasonMax: 300,
} as const;

export class JoinRequestError extends UserError {
  constructor(message: string) {
    super(message);
    this.name = "JoinRequestError";
  }
}

const CLOSED_STATES = ["READ_ONLY", "CANCELLED"] as const;

/* ------------------------------------------------------------------------- */
/* Listings                                                                  */
/* ------------------------------------------------------------------------- */

/** Lists or unlists a course. The caller checks the actor may edit it. */
export async function setCourseListedFor(actorUserId: string, workspaceId: string, courseId: string, listed: boolean) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { id: true } });
  if (!course) throw new JoinRequestError("Course not found");
  if (listed) {
    await prisma.courseListing.upsert({ where: { courseId }, create: { courseId, workspaceId, listedById: actorUserId }, update: {} });
  } else {
    await prisma.courseListing.deleteMany({ where: { courseId } });
  }
  await prisma.auditLog.create({ data: { workspaceId, actorUserId, action: listed ? "course.list" : "course.unlist", targetType: "Course", targetId: courseId, data: {} } });
  return { listed };
}

export type ListedCourse = {
  courseId: string;
  name: string;
  description: string | null;
  imageUrl: string;
  workspace: { id: string; name: string; kind: "ORGANISATION" | "SOLO"; logoUrl: string | null };
  tutors: string[];
  listedAt: string;
  /**
   * Who is already on the course among `forUserIds` (the viewer and their
   * children): show "You're on this course" or the child's name instead of
   * "Ask to join" (#223). Empty when no ids were given.
   */
  enrolledUserIds: string[];
};

/**
 * Listed courses anyone signed in can browse, newest first. Courses in a
 * read-only or cancelled workspace are hidden. `q` matches the course
 * name, its description or the workspace name.
 */
export async function listListedCourses(input: { q?: string; workspaceId?: string; take?: number; cursor?: string; forUserIds?: string[] } = {}): Promise<{ courses: ListedCourse[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(input.take ?? 24, 1), 50);
  const q = input.q?.trim().slice(0, 80);
  const rows = await prisma.courseListing.findMany({
    where: {
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      workspace: { billingState: { notIn: [...CLOSED_STATES] } },
      ...(q
        ? { OR: [
            { course: { name: { contains: q, mode: "insensitive" } } },
            { course: { description: { contains: q, mode: "insensitive" } } },
            { workspace: { name: { contains: q, mode: "insensitive" } } },
            // The tutor's name, as the card shows it (#223).
            { course: { staff: { some: { role: "LEAD", membership: { user: { name: { contains: q, mode: "insensitive" } } } } } } },
          ] }
        : {}),
    },
    orderBy: [{ listedAt: "desc" }, { courseId: "asc" }],
    take: take + 1,
    ...(input.cursor ? { cursor: { courseId: input.cursor }, skip: 1 } : {}),
    select: {
      courseId: true,
      listedAt: true,
      workspace: { select: { id: true, name: true, kind: true, logoUrl: true } },
      course: {
        select: {
          name: true, description: true, imageUrl: true,
          staff: { where: { role: "LEAD" }, select: { membership: { select: { user: { select: { name: true } } } } } },
          enrollments: { where: { endedAt: null, learner: { userId: { in: input.forUserIds?.length ? input.forUserIds : ["-"] } } }, select: { learner: { select: { userId: true } } } },
        },
      },
    },
  });
  const page = rows.slice(0, take);
  return {
    courses: page.map((r) => ({
      courseId: r.courseId,
      name: r.course.name,
      description: r.course.description,
      imageUrl: r.course.imageUrl,
      workspace: r.workspace,
      tutors: r.course.staff.map((s) => s.membership.user.name),
      listedAt: r.listedAt.toISOString(),
      enrolledUserIds: [...new Set(r.course.enrollments.map((e) => e.learner.userId))],
    })),
    nextCursor: rows.length > take ? page[page.length - 1].courseId : null,
  };
}

/* ------------------------------------------------------------------------- */
/* Asking                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * A student asks for themself, or a parent for a child they're linked to
 * (an ACTIVE guardianship). Refused when the course isn't listed, the
 * student is already on it, a request is already open, or the requester
 * is over the limits in JOIN.
 */
export async function requestToJoinFor(requesterUserId: string, input: { courseId: string; studentUserId?: string | null; message?: string | null; referralCode?: string | null }, now: Date = new Date()) {
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterUserId }, select: { role: true, roleUnconfirmed: true, deletionRequestedAt: true } });
  if (requester.roleUnconfirmed || requester.deletionRequestedAt) throw new JoinRequestError("Finish setting up your account first.");
  const studentUserId = input.studentUserId && input.studentUserId !== requesterUserId ? input.studentUserId : requesterUserId;
  const forChild = studentUserId !== requesterUserId;
  if (forChild) {
    const g = await prisma.guardianship.findFirst({ where: { guardianUserId: requesterUserId, studentUserId, status: "ACTIVE" }, select: { id: true } });
    if (!g) throw new JoinRequestError("You can only ask for a child linked to your account.");
  } else if (requester.role !== "STUDENT") {
    throw new JoinRequestError("Only students, or parents for their children, can ask to join a course.");
  }

  const listing = await prisma.courseListing.findUnique({
    where: { courseId: input.courseId },
    select: { workspaceId: true, workspace: { select: { billingState: true } } },
  });
  if (!listing || (CLOSED_STATES as readonly string[]).includes(listing.workspace.billingState)) throw new JoinRequestError("This course isn't taking requests.");
  const workspaceId = listing.workspaceId;

  const enrolled = await prisma.enrollment.findFirst({ where: { courseId: input.courseId, endedAt: null, learner: { userId: studentUserId } }, select: { id: true } });
  if (enrolled) throw new JoinRequestError(forChild ? "Your child is already on this course." : "You're already on this course.");

  const [pending, today] = await Promise.all([
    prisma.joinRequest.count({ where: { requesterUserId, status: "PENDING" } }),
    prisma.joinRequest.count({ where: { requesterUserId, createdAt: { gt: new Date(now.getTime() - 24 * 3600_000) } } }),
  ]);
  if (pending >= JOIN.maxPending) throw new JoinRequestError(`You have ${JOIN.maxPending} requests waiting. Wait for an answer, or cancel one, before asking again.`);
  if (today >= JOIN.maxPerDay) throw new JoinRequestError("You've made a lot of requests today. Try again tomorrow.");

  const message = input.message?.trim().slice(0, JOIN.messageMax) || null;
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.joinRequest.create({
        data: { workspaceId, courseId: input.courseId, requesterUserId, studentUserId, message, createdAt: now },
        select: { id: true, course: { select: { name: true } }, student: { select: { name: true } } },
      });
      // Tell the course's lead staff (verified, real addresses only).
      const leads = await tx.courseStaff.findMany({
        where: { courseId: input.courseId, role: "LEAD", membership: { status: "ACTIVE" } },
        select: { membership: { select: { user: { select: { id: true, email: true, emailIsPlaceholder: true, emailConfirmed: true } } } } },
      });
      for (const { membership: { user } } of leads) {
        if (user.emailIsPlaceholder || !user.emailConfirmed) continue;
        await enqueueEmail(tx, {
          key: `join:requested:${r.id}:${user.id}`, template: "join:requested", to: user.email, userId: user.id, workspaceId,
          category: "NOTIFICATION", priority: "NORMAL",
          data: { studentName: r.student.name, courseName: r.course.name, byParent: forChild },
        });
      }
      // Came through someone's referral link (#216): credit them.
      await recordReferral(tx, { code: input.referralCode, workspaceId, requesterUserId, studentUserId, joinRequestId: r.id });
      return { id: r.id, status: "PENDING" as const };
    }, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new JoinRequestError("You've already asked to join this course.");
    throw e;
  }
}

/** The requester withdraws an open request. */
export async function cancelJoinRequestFor(requesterUserId: string, requestId: string, now: Date = new Date()) {
  const r = await prisma.joinRequest.updateMany({ where: { id: requestId, requesterUserId, status: "PENDING" }, data: { status: "CANCELLED", decidedAt: now } });
  if (r.count === 0) throw new JoinRequestError("That request is no longer open.");
  return { status: "CANCELLED" as const };
}

/** Requests a person made, or that were made for them, newest first. */
export async function listMyJoinRequests(userId: string) {
  const rows = await prisma.joinRequest.findMany({
    where: { OR: [{ requesterUserId: userId }, { studentUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, status: true, message: true, declineReason: true, createdAt: true, decidedAt: true, requesterUserId: true,
      course: { select: { id: true, name: true, imageUrl: true } },
      workspace: { select: { name: true } },
      student: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, status: r.status, message: r.message, declineReason: r.declineReason,
    createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null,
    course: r.course, workspaceName: r.workspace.name, student: r.student,
    madeByMe: r.requesterUserId === userId,
  }));
}

/* ------------------------------------------------------------------------- */
/* Deciding                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Staff's inbox. `teachingMembershipId` narrows it to the courses that
 * membership teaches or owns (a tutor, or an owner in tutor mode); null shows the
 * whole workspace.
 */
export async function listJoinRequestsForStaff(workspaceId: string, teachingMembershipId: string | null, status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED" = "PENDING", branchIds: string[] = []) {
  const rows = await prisma.joinRequest.findMany({
    where: { workspaceId, status, ...(teachingMembershipId ? { course: scopedCourseWhere({ membershipId: teachingMembershipId, branchIds }) } : {}) },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
    select: {
      id: true, status: true, message: true, declineReason: true, createdAt: true, decidedAt: true, requesterUserId: true, studentUserId: true,
      course: { select: { id: true, name: true } },
      student: { select: { name: true } },
      requester: { select: { name: true } },
      decidedById: true,
    },
  });
  const deciders = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.decidedById).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id, status: r.status, message: r.message, declineReason: r.declineReason,
    createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null,
    course: r.course,
    studentName: r.student.name,
    /** Set when a parent asked for their child. */
    parentName: r.requesterUserId !== r.studentUserId ? r.requester.name : null,
    /** Who approved or declined it (#223), so a decline note isn't shown as the viewer's own. */
    decidedBy: r.decidedById ? { id: r.decidedById, name: deciders.get(r.decidedById) ?? "Former staff member" } : null,
  }));
}

/** The request, for a permission check before deciding it. Null when it isn't in this workspace. */
export async function joinRequestCourse(workspaceId: string, requestId: string) {
  return prisma.joinRequest.findFirst({ where: { id: requestId, workspaceId }, select: { courseId: true } });
}

/**
 * Approves a request: adds the student to the workspace (or reactivates
 * them) and enrols them. A parent's request counts as their consent for a
 * minor. A minor who asked for themself needs the staff member to confirm
 * they hold a parent's consent, as when a tutor adds a student.
 */
export async function approveJoinRequestFor(actorUserId: string, workspaceId: string, requestId: string, input: { isMinor: boolean; consentAttested?: boolean }, now: Date = new Date()) {
  const req = await prisma.joinRequest.findFirst({
    where: { id: requestId, workspaceId },
    select: {
      status: true, courseId: true, studentUserId: true, requesterUserId: true,
      course: { select: { name: true } }, workspace: { select: { name: true } },
      student: { select: { name: true, email: true, studentProfile: { select: { id: true } } } },
      requester: { select: { id: true, email: true, emailIsPlaceholder: true } },
    },
  });
  if (!req) throw new JoinRequestError("Request not found");
  if (req.status !== "PENDING") throw new JoinRequestError("That request is no longer open.");
  const byParent = req.requesterUserId !== req.studentUserId;
  if (input.isMinor && !byParent && !input.consentAttested) {
    throw new JoinRequestError("Confirm you have a parent's or guardian's consent for this student, or ask a parent to make the request.");
  }

  return prisma.$transaction(async (tx) => {
    const won = await tx.joinRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "APPROVED", decidedById: actorUserId, decidedAt: now } });
    if (won.count === 0) throw new JoinRequestError("That request is no longer open.");

    const consent = input.isMinor ? { consentAttestedAt: now, consentAttestedBy: byParent ? req.requesterUserId : actorUserId } : {};
    const learner = await tx.learner.upsert({
      where: { workspaceId_userId: { workspaceId, userId: req.studentUserId } },
      create: { workspaceId, userId: req.studentUserId, isMinor: input.isMinor, ...consent },
      update: { status: "ACTIVE" },
      select: { id: true },
    });
    // Older pages read the Student profile; make sure there is one.
    if (!req.student.studentProfile) {
      await tx.student.create({ data: { fullName: req.student.name, email: req.student.email.toLowerCase(), userId: req.studentUserId } });
    }
    const open = await tx.enrollment.findFirst({ where: { courseId: req.courseId, learnerId: learner.id, endedAt: null }, select: { id: true } });
    if (!open) {
      await assertCanAddLearners(tx, workspaceId, [learner.id]);
      await tx.enrollment.create({ data: { workspaceId, courseId: req.courseId, learnerId: learner.id, status: "ACTIVE", startedAt: now } });
      await emitWebhook(tx, workspaceId, "enrolment.created", { courseId: req.courseId, learnerId: learner.id, studentUserId: req.studentUserId, source: "join-request", startedAt: now.toISOString() });
    }
    await markReferralJoined(tx, { workspaceId, studentUserId: req.studentUserId }, now);
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "join.approve", targetType: "JoinRequest", targetId: requestId, data: { courseId: req.courseId, learnerId: learner.id, isMinor: input.isMinor, byParent } } });
    if (!req.requester.emailIsPlaceholder) {
      await enqueueEmail(tx, {
        key: `join:approved:${requestId}`, template: "join:approved", to: req.requester.email, userId: req.requester.id, workspaceId,
        category: "NOTIFICATION", priority: "NORMAL",
        data: { studentName: req.student.name, courseName: req.course.name, workspaceName: req.workspace.name, forChild: byParent },
      });
    }
    return { status: "APPROVED" as const, learnerId: learner.id };
  }, { timeout: 30_000 });
}

/** Declines a request, with an optional note the requester sees. */
export async function declineJoinRequestFor(actorUserId: string, workspaceId: string, requestId: string, reason: string | null, now: Date = new Date()) {
  const note = reason?.trim().slice(0, JOIN.reasonMax) || null;
  return prisma.$transaction(async (tx) => {
    const won = await tx.joinRequest.updateMany({ where: { id: requestId, workspaceId, status: "PENDING" }, data: { status: "DECLINED", decidedById: actorUserId, decidedAt: now, declineReason: note } });
    if (won.count === 0) throw new JoinRequestError("That request is no longer open.");
    const req = await tx.joinRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { requesterUserId: true, studentUserId: true, courseId: true, course: { select: { name: true } }, workspace: { select: { name: true } }, student: { select: { name: true } }, requester: { select: { id: true, email: true, emailIsPlaceholder: true } } },
    });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "join.decline", targetType: "JoinRequest", targetId: requestId, data: { courseId: req.courseId, withNote: note != null } } });
    if (!req.requester.emailIsPlaceholder) {
      await enqueueEmail(tx, {
        key: `join:declined:${requestId}`, template: "join:declined", to: req.requester.email, userId: req.requester.id, workspaceId,
        category: "NOTIFICATION", priority: "NORMAL",
        data: { studentName: req.student.name, courseName: req.course.name, workspaceName: req.workspace.name, forChild: req.requesterUserId !== req.studentUserId, reason: note },
      });
    }
    return { status: "DECLINED" as const };
  }, { timeout: 30_000 });
}
