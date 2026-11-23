/**
 * Account deletion (design 02, section 8).
 *
 *   requestAccountDeletionFor  sole owners must hand over first; otherwise
 *                              sign-in is blocked, every session ends, and
 *                              an email carries a cancel link (14 days)
 *   cancelAccountDeletion      by that link, or by the tutor who asked
 *   anonymiseDueAccounts       the daily job, after the grace: name "Former
 *                              user", sign-in data, preferences, learner
 *                              work and grades deleted; financial records
 *                              and audit rows kept with the name only.
 *                              Deletes only with ACCOUNT_DELETIONS=1
 *                              (production's first run needs the owner's
 *                              OK); otherwise it reports what is due.
 *
 * Tutors delete a student's account on a parent's request (v1). Server only.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";

const DAY = 24 * 60 * 60 * 1000;
export const DELETION_GRACE_DAYS = 14;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function accountDeletionsEnabled(): boolean {
  return process.env.ACCOUNT_DELETIONS === "1";
}

/** Workspaces where this user is the only active owner. */
export async function soleOwnerOf(userId: string) {
  const owned = await prisma.membership.findMany({ where: { userId, role: "OWNER", status: "ACTIVE" }, select: { workspaceId: true, workspace: { select: { name: true } } } });
  const out: string[] = [];
  for (const m of owned) {
    const others = await prisma.membership.count({ where: { workspaceId: m.workspaceId, role: "OWNER", status: "ACTIVE", userId: { not: userId } } });
    if (others === 0) out.push(m.workspace.name);
  }
  return out;
}

export async function requestAccountDeletionFor(userId: string, by: { actorUserId: string; workspaceId: string | null }, now: Date = new Date()) {
  const sole = await soleOwnerOf(userId);
  if (sole.length) throw new Error(`Hand over ownership of ${sole.join(", ")} first, or close it`);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, emailIsPlaceholder: true, deletionRequestedAt: true, deletedAt: true } });
  if (u.deletedAt) throw new UserError("This account was already deleted");
  if (u.deletionRequestedAt) return { deleteOn: new Date(u.deletionRequestedAt.getTime() + DELETION_GRACE_DAYS * DAY).toISOString(), alreadyRequested: true };
  const token = randomBytes(32).toString("base64url");
  const deleteOn = new Date(now.getTime() + DELETION_GRACE_DAYS * DAY);
  const key = `account:deletion:${userId}:${now.getTime()}`;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: now, deletionCancelTokenHash: sha(token) } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { workspaceId: by.workspaceId, actorUserId: by.actorUserId, action: "user.deletion_requested", targetType: "User", targetId: userId, data: { self: by.actorUserId === userId } } });
    if (!u.emailIsPlaceholder) {
      await enqueueEmail(tx, {
        key, template: "account:deletion", to: u.email, userId, workspaceId: by.workspaceId, category: "ACCOUNT", priority: "AUTH",
        data: { name: u.name, deleteOn: new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(deleteOn), tokenSealed: sealForQueue(token) },
      });
    }
  }, { timeout: 30_000 });
  if (!u.emailIsPlaceholder) await sendQueuedNow([key]);
  return { deleteOn: deleteOn.toISOString(), alreadyRequested: false };
}

/** By the emailed link. True when a pending deletion was cancelled. */
export async function cancelDeletionByToken(token: string): Promise<boolean> {
  const r = await prisma.user.updateMany({ where: { deletionCancelTokenHash: sha(token), deletedAt: null }, data: { deletionRequestedAt: null, deletionCancelTokenHash: null } });
  return r.count === 1;
}

/** By the tutor (or the user's own staff) who manages the account. */
export async function cancelDeletionFor(userId: string, actorUserId: string, workspaceId: string | null) {
  const r = await prisma.user.updateMany({ where: { id: userId, deletedAt: null, deletionRequestedAt: { not: null } }, data: { deletionRequestedAt: null, deletionCancelTokenHash: null } });
  if (r.count) await prisma.auditLog.create({ data: { workspaceId, actorUserId, action: "user.deletion_cancelled", targetType: "User", targetId: userId, data: {} } });
  return { cancelled: r.count === 1 };
}

/** Anonymises one account now. Exported for the job and for tests. */
export async function anonymiseAccount(userId: string, now: Date = new Date()) {
  const gone = `deleted+${userId}@deleted.nexa-lms.invalid`;
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { userId }, select: { id: true } });
    if (student) {
      const subs = (await tx.testSubmission.findMany({ where: { studentId: student.id }, select: { id: true } })).map((s) => s.id);
      const entries = (await tx.submissionEntry.findMany({ where: { studentId: student.id }, select: { id: true } })).map((s) => s.id);
      await tx.questionGrade.deleteMany({ where: { OR: [{ testSubmissionId: { in: subs } }, { submissionEntryId: { in: entries } }] } });
      await tx.grade.deleteMany({ where: { studentId: student.id } });
      await tx.testSubmission.deleteMany({ where: { id: { in: subs } } });
      await tx.submissionEntry.deleteMany({ where: { id: { in: entries } } });
      await tx.lessonCompletion.deleteMany({ where: { studentId: student.id } });
      // B's practice sets (#236): the student's spaced-repetition progress.
      await tx.practiceReview.deleteMany({ where: { studentId: student.id } });
      await tx.assessmentCompletion.deleteMany({ where: { studentId: student.id } });
      await tx.student.update({ where: { id: student.id }, data: { fullName: "Former user", email: gone, imageUrl: null } });
    }
    // B's term reports: the comments written about this student.
    await tx.reportCourseComment.deleteMany({ where: { learner: { userId } } });
    await tx.reportOverallComment.deleteMany({ where: { learner: { userId } } });
    await tx.tutor.updateMany({ where: { userId }, data: { fullName: "Former user", email: gone, profileImageUrl: null, bio: null } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.twoFactor.deleteMany({ where: { userId } });
    await tx.calendarFeedToken.deleteMany({ where: { userId } });
    await tx.userPreferences.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    // At-risk alerts about this student (#216 phase 2).
    await tx.riskAlert.deleteMany({ where: { studentUserId: userId } });
    await tx.activityLog.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.outboundEmail.deleteMany({ where: { userId } });
    // B's question bank: questions this person saved (#228). Images stay: tests may use them too.
    await tx.bankQuestion.deleteMany({ where: { ownerUserId: userId } });
    await tx.guardianship.updateMany({ where: { OR: [{ guardianUserId: userId }, { studentUserId: userId }] }, data: { status: "REVOKED" } });
    await tx.membership.updateMany({ where: { userId }, data: { status: "SUSPENDED" } });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Former user", email: gone, emailIsPlaceholder: true, password: "", username: null, displayUsername: null, image: null,
        emailVerified: null, emailConfirmed: false, twoFactorEnabled: false, mustChangePassword: false, initialCodeExpiresAt: null,
        deletionCancelTokenHash: null, deletedAt: now,
      },
    });
    await tx.auditLog.create({ data: { workspaceId: null, actorUserId: userId, action: "user.anonymised", targetType: "User", targetId: userId, data: {} } });
  }, { timeout: 60_000 });
}

export async function anonymiseDueAccounts(now: Date = new Date()) {
  const due = await prisma.user.findMany({
    where: { deletedAt: null, deletionRequestedAt: { lte: new Date(now.getTime() - DELETION_GRACE_DAYS * DAY) } },
    select: { id: true },
    take: 20,
  });
  if (!accountDeletionsEnabled()) {
    if (due.length) console.warn(`[accounts] ${due.length} account deletion(s) due; ACCOUNT_DELETIONS is off`);
    return { due: due.length, anonymised: 0 };
  }
  let anonymised = 0;
  for (const u of due) {
    try {
      await anonymiseAccount(u.id, now);
      anonymised++;
    } catch (e) {
      console.error("[accounts] anonymise failed:", u.id, (e as Error).message);
    }
  }
  return { due: due.length, anonymised };
}
