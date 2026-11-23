/**
 * POPIA data export (design 02, section 8): everything Nexa holds about one
 * person, as one JSON document. A user exports their own data; a tutor may
 * export a learner they teach (in v1 the tutor passes it to the parent).
 * Once per 24 hours per person exported. Built on request and streamed, so
 * nothing is stored. Never includes passwords, tokens or other people's
 * contact details. Server only.
 */

import "server-only";

import { prisma } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

/** The last export of this person, if within 24 hours. */
export async function recentExport(targetUserId: string, now: Date = new Date()) {
  return prisma.auditLog.findFirst({ where: { action: "user.export", targetId: targetUserId, at: { gte: new Date(now.getTime() - DAY) } }, select: { at: true } });
}

export async function exportUserData(targetUserId: string, actor: { userId: string; workspaceId: string | null }, now: Date = new Date()) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
    select: {
      id: true, name: true, email: true, emailIsPlaceholder: true, username: true, createdAt: true, emailVerified: true, platformRole: true, twoFactorEnabled: true,
      preferences: true,
      memberships: { select: { role: true, status: true, joinedAt: true, workspace: { select: { name: true } } } },
      learners: {
        select: {
          id: true, isMinor: true, paymentVisible: true, consentAttestedAt: true, createdAt: true, workspace: { select: { name: true } },
          enrollments: { select: { status: true, startedAt: true, endedAt: true, course: { select: { name: true } } } },
          attendance: { select: { occurrenceStart: true, status: true, note: true, event: { select: { title: true } } } },
          // B's term reports: the comments on this student's reports.
          reportComments: { select: { text: true, updatedAt: true, term: { select: { title: true } }, course: { select: { name: true } } } },
          reportOverallComments: { select: { text: true, updatedAt: true, term: { select: { title: true } } } },
        },
      },
      guardianOf: { select: { relationship: true, status: true, createdAt: true, student: { select: { name: true } } } },
      guardedBy: { select: { relationship: true, status: true, createdAt: true, guardian: { select: { name: true } } } },
      studentProfile: { select: { id: true } },
      notifications: { select: { title: true, message: true, createdAt: true, isRead: true }, orderBy: { createdAt: "desc" }, take: 2000 },
      activities: { select: { action: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 2000 },
    },
  });
  const studentId = u.studentProfile?.id;
  const [tests, assignments, grades, invoices, payments, bankQuestions, referralCodes, practice] = await Promise.all([
    studentId ? prisma.testSubmission.findMany({
      where: { studentId },
      select: { startedAt: true, submittedAt: true, status: true, score: true, feedback: true, answers: true, test: { select: { title: true, course: { select: { name: true } } } }, aiSuggestions: { select: { questionId: true, totalAwarded: true, outOf: true, feedbackToStudent: true, tutorAction: true, model: true } } },
    }) : [],
    studentId ? prisma.submissionEntry.findMany({
      where: { studentId },
      select: { submittedAt: true, attemptNumber: true, status: true, feedback: true, fileUrl: true, submission: { select: { title: true, course: { select: { name: true } } } } },
    }) : [],
    studentId ? prisma.grade.findMany({ where: { studentId }, select: { type: true, title: true, score: true, outOf: true, createdAt: true, course: { select: { name: true } } } }) : [],
    prisma.invoice.findMany({
      where: { OR: [{ studentUserId: targetUserId }, { payerUserId: targetUserId }] },
      select: { number: true, status: true, issuedAt: true, dueAt: true, totalCents: true, discountCents: true, paidAt: true, paidVia: true, workspace: { select: { name: true } }, lines: { select: { description: true, amountCents: true } } },
    }),
    prisma.payment.findMany({ where: { payerUserId: targetUserId }, select: { reference: true, purpose: true, status: true, amountCents: true, paidAt: true, createdAt: true } }),
    // B's question bank: questions this person saved (#228).
    prisma.bankQuestion.findMany({ where: { ownerUserId: targetUserId }, orderBy: { createdAt: "asc" }, select: { stem: true, type: true, points: true, topics: true, subject: true, gradeLevel: true, data: true, createdAt: true } }),
    // Referral links (#216): the code and how many families came through it.
    prisma.referralCode.findMany({ where: { userId: targetUserId }, select: { code: true, createdAt: true, workspace: { select: { name: true } }, _count: { select: { referrals: true } } } }),
    // B's practice sets (#236): progress on each practice item.
    studentId ? prisma.practiceReview.findMany({ where: { studentId }, select: { box: true, dueAt: true, lastAnsweredAt: true, answered: true, correct: true, item: { select: { stem: true, set: { select: { title: true } } } } } }) : [],
  ]);
  await prisma.auditLog.create({ data: { workspaceId: actor.workspaceId, actorUserId: actor.userId, action: "user.export", targetType: "User", targetId: targetUserId, data: { self: actor.userId === targetUserId } } });

  return {
    about: "Your data held by Nexa (nexa-lms.co.za), exported under POPIA. Amounts are in South African cents. Passwords and security keys are never included.",
    exportedAt: now.toISOString(),
    account: {
      name: u.name, email: u.emailIsPlaceholder ? null : u.email, username: u.username, createdAt: u.createdAt, emailVerifiedAt: u.emailVerified,
      nexaAdmin: u.platformRole === "NEXA_ADMIN", twoFactorEnabled: !!u.twoFactorEnabled,
    },
    preferences: u.preferences ? { ...u.preferences, id: undefined, userId: undefined } : null,
    workspaces: u.memberships.map((m) => ({ workspace: m.workspace.name, role: m.role, status: m.status, joinedAt: m.joinedAt })),
    asLearner: u.learners.map((l) => ({
      workspace: l.workspace.name, minor: l.isMinor, paysOwnFees: l.paymentVisible, parentConsentConfirmedByTutorAt: l.consentAttestedAt, since: l.createdAt,
      enrolments: l.enrollments.map((e) => ({ course: e.course.name, status: e.status, startedAt: e.startedAt, endedAt: e.endedAt })),
      attendance: l.attendance.map((a) => ({ class: a.event.title, at: a.occurrenceStart, status: a.status, note: a.note })),
      termReportComments: [
        ...l.reportComments.map((c) => ({ term: c.term.title, course: c.course.name, comment: c.text, at: c.updatedAt })),
        ...l.reportOverallComments.map((c) => ({ term: c.term.title, course: null, comment: c.text, at: c.updatedAt })),
      ],
    })),
    children: u.guardianOf.map((g) => ({ name: g.student.name, relationship: g.relationship, status: g.status, since: g.createdAt })),
    parents: u.guardedBy.map((g) => ({ name: g.guardian.name, relationship: g.relationship, status: g.status, since: g.createdAt })),
    tests: tests.map((t) => ({
      test: t.test.title, course: t.test.course.name, startedAt: t.startedAt, submittedAt: t.submittedAt, status: t.status, score: t.score, feedback: t.feedback, answers: t.answers,
      aiSuggestedMarks: t.aiSuggestions.map((s) => ({ questionId: s.questionId, suggested: s.totalAwarded, outOf: s.outOf, feedback: s.feedbackToStudent, tutorDecision: s.tutorAction, model: s.model })),
    })),
    assignments: assignments.map((a) => ({ assignment: a.submission.title, course: a.submission.course.name, submittedAt: a.submittedAt, attempt: a.attemptNumber, status: a.status, feedback: a.feedback, files: a.fileUrl })),
    grades: grades.map((g) => ({ course: g.course.name, type: g.type, title: g.title, score: g.score, outOf: g.outOf, at: g.createdAt })),
    feeInvoices: invoices.map((i) => ({ workspace: i.workspace.name, number: i.number, status: i.status, issuedAt: i.issuedAt, dueAt: i.dueAt, totalCents: i.totalCents, discountCents: i.discountCents, paidAt: i.paidAt, paidVia: i.paidVia, lines: i.lines })),
    paymentsMade: payments,
    savedQuestions: bankQuestions,
    practice: practice.map((p) => ({ set: p.item.set.title, item: p.item.stem, answered: p.answered, correct: p.correct, lastAnsweredAt: p.lastAnsweredAt, nextDueAt: p.dueAt, box: p.box })),
    referralLinks: referralCodes.map((r) => ({ workspace: r.workspace.name, code: r.code, since: r.createdAt, familiesReferred: r._count.referrals })),
    notifications: u.notifications,
    activity: u.activities,
  };
}
