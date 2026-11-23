/**
 * The weekly parent summary (Core, owner decision 22 Nov; #216 phase 1).
 * Monday morning, South African time: one email per parent covering each
 * linked child's past week (new marks, attendance) and the week ahead
 * (tests and assignments due, and whether they're done). Parents who switched
 * email off, unverified or placeholder addresses, and weeks with nothing
 * to say get nothing. Runs from the daily housekeeping job. Server only.
 */

import "server-only";

import { getPreferencesForUsers } from "@/features/users/preferences";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import type { WeeklySummaryData } from "@/lib/email/parent-templates";
import { RELEASED_GRADE } from "@/features/grades/lib/release";

const DAY = 24 * 60 * 60 * 1000;
const ZONE = "Africa/Johannesburg";

/** The date (YYYY-MM-DD) and weekday (0 = Sunday) in South Africa. */
function localDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}

const dayLabel = (d: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: ZONE, weekday: "short", day: "numeric", month: "short" }).format(d);

/** One child's week, or null when there's nothing to report. */
async function childWeek(child: { id: string; name: string; studentProfileId: string | null }, now: Date): Promise<WeeklySummaryData["children"][number] | null> {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const weekAhead = new Date(now.getTime() + 7 * DAY);
  const learners = await prisma.learner.findMany({
    where: { userId: child.id, status: "ACTIVE" },
    select: { id: true, enrollments: { where: { endedAt: null }, select: { courseId: true } } },
  });
  const courseIds = [...new Set(learners.flatMap((l) => l.enrollments.map((e) => e.courseId)))];
  if (!courseIds.length) return null;
  const sid = child.studentProfileId;
  const [grades, tests, assignments, attendance] = await Promise.all([
    sid ? prisma.grade.findMany({ where: { studentId: sid, courseId: { in: courseIds }, updatedAt: { gte: weekAgo }, ...RELEASED_GRADE }, orderBy: { updatedAt: "desc" }, take: 10, select: { title: true, score: true, outOf: true, course: { select: { name: true } } } }) : [],
    prisma.test.findMany({
      where: { courseId: { in: courseIds }, isActive: true, dueDate: { gte: now, lte: weekAhead } }, orderBy: { dueDate: "asc" }, take: 10,
      select: { title: true, dueDate: true, course: { select: { name: true } }, submissions: sid ? { where: { studentId: sid, status: { not: "IN_PROGRESS" } }, select: { id: true }, take: 1 } : false },
    }),
    prisma.submission.findMany({
      where: { courseId: { in: courseIds }, isActive: { not: false }, dueDate: { gte: now, lte: weekAhead } }, orderBy: { dueDate: "asc" }, take: 10,
      select: { title: true, dueDate: true, course: { select: { name: true } }, entries: sid ? { where: { studentId: sid }, select: { id: true }, take: 1 } : false },
    }),
    prisma.sessionAttendance.groupBy({ by: ["status"], where: { learnerId: { in: learners.map((l) => l.id) }, occurrenceStart: { gte: weekAgo, lt: now } }, _count: true }),
  ]);
  const due = [
    ...tests.map((t) => ({ kind: "test" as const, title: t.title, course: t.course.name, dueOn: dayLabel(t.dueDate), at: t.dueDate, done: Array.isArray(t.submissions) && t.submissions.length > 0 })),
    ...assignments.map((a) => ({ kind: "assignment" as const, title: a.title, course: a.course.name, dueOn: dayLabel(a.dueDate), at: a.dueDate, done: Array.isArray(a.entries) && a.entries.length > 0 })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime()).map((d) => ({ kind: d.kind, title: d.title, course: d.course, dueOn: d.dueOn, done: d.done }));
  const count = (s: string) => attendance.find((a) => a.status === s)?._count ?? 0;
  const att = { present: count("PRESENT"), late: count("LATE"), absent: count("ABSENT"), excused: count("EXCUSED") };
  const marks = grades.map((g) => ({ course: g.course.name, title: g.title, score: g.score, outOf: g.outOf }));
  if (!marks.length && !due.length && !(att.present + att.late + att.absent + att.excused)) return null;
  return { name: child.name, marks, due, attendance: att };
}

/**
 * Queues the week's summaries. Only on Mondays (South Africa) unless
 * `force`; one email per parent per week (idempotency key), so a second run
 * the same day queues nothing new.
 */
export async function queueWeeklyParentSummaries(now: Date = new Date(), opts: { force?: boolean; onlyGuardianIds?: string[] } = {}) {
  const today = localDay(now);
  if (today.weekday !== 1 && !opts.force) return { skipped: "not Monday", queued: 0 };
  const links = await prisma.guardianship.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.onlyGuardianIds ? { guardianUserId: { in: opts.onlyGuardianIds } } : {}),
      guardian: { deletedAt: null, deletionRequestedAt: null, emailIsPlaceholder: false, OR: [{ emailVerified: { not: null } }, { emailConfirmed: true }] },
    },
    select: {
      guardian: { select: { id: true, name: true, email: true } },
      student: { select: { id: true, name: true, studentProfile: { select: { id: true } } } },
    },
  });
  const byParent = new Map<string, { parent: { id: string; name: string; email: string }; children: Array<{ id: string; name: string; studentProfileId: string | null }> }>();
  for (const l of links) {
    const e = byParent.get(l.guardian.id) ?? { parent: l.guardian, children: [] };
    e.children.push({ id: l.student.id, name: l.student.name, studentProfileId: l.student.studentProfile?.id ?? null });
    byParent.set(l.guardian.id, e);
  }
  const prefs = await getPreferencesForUsers([...byParent.keys()]);
  let queued = 0;
  let quiet = 0;
  for (const { parent, children } of byParent.values()) {
    if (prefs.get(parent.id)?.emailNotifications === false) continue;
    const weeks = (await Promise.all(children.map((c) => childWeek(c, now)))).filter((w): w is NonNullable<typeof w> => !!w);
    if (!weeks.length) { quiet++; continue; }
    await enqueueEmail(prisma, {
      key: `parent:weekly:${parent.id}:${today.date}`, template: "parent:weekly", to: parent.email, userId: parent.id, workspaceId: null,
      category: "DIGEST", priority: "DIGEST",
      data: { parentName: parent.name, weekOf: dayLabel(now), children: weeks } satisfies WeeklySummaryData,
    });
    queued++;
  }
  return { queued, quiet, parents: byParent.size };
}
