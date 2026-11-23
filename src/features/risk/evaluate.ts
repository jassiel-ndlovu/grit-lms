/**
 * The daily at-risk run (#216 phase 2, Pro). For each course with the
 * `at-risk-alerts` service (every course while billing is off), it reads
 * each enrolled student's recent marks, missed work and attendance,
 * applies ./rules.ts, and opens, updates, escalates or resolves alerts.
 * Course staff get one in-app notification per course when alerts open or
 * escalate. Nothing goes to students or parents until staff share an alert.
 * Called from the housekeeping cron. Server only.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { emitNotification } from "@/features/notifications/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { emitWebhook } from "@/features/api/webhooks";

import { assessRisk, nextStep, RISK_RULES, riskSummary, type RiskInput, type RiskLevel } from "./rules";

const DAY = 86_400_000;
export const RISK_SERVICE = "at-risk-alerts";

/** Courses the run covers: live courses in workspaces that aren't closed, with the service on (when billing is on). */
async function coursesToCheck(onlyCourseIds?: string[]) {
  return prisma.course.findMany({
    where: {
      workspaceId: { not: null },
      ...(onlyCourseIds ? { id: { in: onlyCourseIds } } : {}),
      workspace: { billingState: { notIn: ["CANCELLED", "READ_ONLY"] } },
      ...(isBillingEnabled() ? { services: { some: { serviceKey: RISK_SERVICE, enabled: true } } } : {}),
    },
    select: { id: true, name: true, workspaceId: true },
  });
}

type Student = { userId: string; name: string; learnerId: string; profileId: string | null };

/** Everything the rules need for one course, in five queries. */
export async function gatherCourse(courseId: string, now: Date): Promise<Array<{ student: Student; input: RiskInput }>> {
  const windowStart = new Date(now.getTime() - RISK_RULES.windowDays * DAY);
  const marksStart = new Date(now.getTime() - RISK_RULES.marksLookbackDays * DAY);
  const enrolments = await prisma.enrollment.findMany({
    where: { courseId, endedAt: null, status: "ACTIVE", learner: { status: "ACTIVE" } },
    select: { learner: { select: { id: true, userId: true, user: { select: { name: true, studentProfile: { select: { id: true } } } } } } },
  });
  const students: Student[] = [];
  const seen = new Set<string>();
  for (const e of enrolments) {
    if (seen.has(e.learner.userId)) continue;
    seen.add(e.learner.userId);
    students.push({ userId: e.learner.userId, name: e.learner.user.name, learnerId: e.learner.id, profileId: e.learner.user.studentProfile?.id ?? null });
  }
  if (!students.length) return [];
  const profileIds = students.flatMap((s) => (s.profileId ? [s.profileId] : []));

  const [grades, tests, assignments, attendance] = await Promise.all([
    prisma.grade.findMany({ where: { courseId, studentId: { in: profileIds }, createdAt: { gte: marksStart }, outOf: { gt: 0 } }, select: { studentId: true, score: true, outOf: true, createdAt: true } }),
    prisma.test.findMany({
      where: { courseId, isActive: true, dueDate: { gte: windowStart, lt: now } },
      select: { title: true, dueDate: true, submissions: { where: { studentId: { in: profileIds }, status: { not: "IN_PROGRESS" } }, select: { studentId: true } } },
    }),
    prisma.submission.findMany({
      where: { courseId, isActive: { not: false }, dueDate: { gte: windowStart, lt: now } },
      select: { title: true, dueDate: true, lastDueDate: true, entries: { where: { studentId: { in: profileIds } }, select: { studentId: true } } },
    }),
    prisma.sessionAttendance.findMany({
      where: { learnerId: { in: students.map((s) => s.learnerId) }, occurrenceStart: { gte: windowStart, lt: now }, event: { courseId } },
      select: { learnerId: true, status: true },
    }),
  ]);

  return students.map((s) => {
    const marks = s.profileId ? grades.filter((g) => g.studentId === s.profileId).map((g) => ({ at: g.createdAt, percent: (g.score / g.outOf) * 100 })) : [];
    const missed = s.profileId
      ? [
          ...tests.filter((t) => !t.submissions.some((x) => x.studentId === s.profileId)).map((t) => ({ title: t.title, dueAt: t.dueDate })),
          // Late hand-ins still allowed: not missed yet.
          ...assignments
            .filter((a) => !(a.lastDueDate && a.lastDueDate > now) && !a.entries.some((x) => x.studentId === s.profileId))
            .map((a) => ({ title: a.title, dueAt: a.dueDate })),
        ]
      : [];
    const att = attendance.filter((a) => a.learnerId === s.learnerId).map((a) => ({ status: a.status as RiskInput["attendance"][number]["status"] }));
    return { student: s, input: { now, marks, missed, attendance: att } };
  });
}

export type RiskRunResult = { courses: number; opened: number; escalated: number; updated: number; resolved: number };

export async function runRiskAlerts(now: Date = new Date(), opts: { onlyCourseIds?: string[]; notify?: boolean } = {}): Promise<RiskRunResult> {
  const out: RiskRunResult = { courses: 0, opened: 0, escalated: 0, updated: 0, resolved: 0 };
  const courses = await coursesToCheck(opts.onlyCourseIds);
  for (const course of courses) {
    out.courses++;
    const rows = await gatherCourse(course.id, now);
    const userIds = rows.map((r) => r.student.userId);
    const existing = await prisma.riskAlert.findMany({
      where: { courseId: course.id, studentUserId: { in: userIds }, OR: [{ openKey: { not: null } }, { status: "DISMISSED", quietUntil: { gt: now } }] },
      select: { id: true, studentUserId: true, level: true, openKey: true, quietUntil: true },
    });
    const news: string[] = [];
    for (const { student, input } of rows) {
      const result = assessRisk(input);
      const open = existing.find((e) => e.studentUserId === student.userId && e.openKey) ?? null;
      const quiet = existing.filter((e) => e.studentUserId === student.userId && !e.openKey && e.quietUntil).map((e) => e.quietUntil!).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const step = nextStep(result, open ? { level: open.level as RiskLevel } : null, quiet, now);
      if (step === "none") continue;
      if (step === "resolve") {
        await prisma.riskAlert.update({ where: { id: open!.id }, data: { status: "RESOLVED", openKey: null, closedAt: now, closedByUserId: null } });
        out.resolved++;
        continue;
      }
      const data = { level: result!.level, reasons: result!.reasons as unknown as Prisma.InputJsonValue, summary: riskSummary(student.name, course.name, result!.reasons).slice(0, 2000), lastSeenAt: now };
      if (step === "open") {
        // openKey is unique: a concurrent run creating the same alert fails quietly here.
        const created = await prisma.riskAlert
          .create({ data: { ...data, workspaceId: course.workspaceId!, courseId: course.id, studentUserId: student.userId, openKey: `${course.id}:${student.userId}`, firstSeenAt: now } })
          .catch(() => null);
        if (created) {
          out.opened++;
          news.push(student.name);
          await emitWebhook(prisma, course.workspaceId!, "risk_alert.opened", { alertId: created.id, courseId: course.id, studentUserId: student.userId, level: result!.level, reasons: result!.reasons });
        }
      } else {
        await prisma.riskAlert.update({ where: { id: open!.id }, data: { ...data, level: step === "escalate" ? "AT_RISK" : open!.level === "AT_RISK" ? "AT_RISK" : data.level } });
        if (step === "escalate") { out.escalated++; news.push(student.name); } else out.updated++;
      }
    }
    if (news.length && opts.notify !== false) {
      const names = news.slice(0, 3).map((n) => n.split(" ")[0]).join(", ") + (news.length > 3 ? ` and ${news.length - 3} more` : "");
      await emitNotification(
        {
          title: `${news.length === 1 ? "A student needs" : `${news.length} students need`} attention in ${course.name}`.slice(0, 200),
          message: `${names}: see the at-risk list for what changed, and share it with parents if it helps.`,
          link: `/dashboard/courses/${course.id}/at-risk`,
          type: "SYSTEM",
          courseId: course.id,
          audience: "tutor",
        },
        { revalidate: false, email: false },
      ).catch((e) => console.error("[risk] notify failed:", e));
    }
  }
  return out;
}
