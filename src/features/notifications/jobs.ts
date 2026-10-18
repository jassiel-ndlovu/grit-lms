/**
 * Scheduled notification jobs, run hourly by /api/cron/notifications.
 *
 *   - dueDateReminders   students: work due in the next 24h not yet handed in
 *   - studyReminders     students who opted in: no lesson opened for 3 days
 *   - gradingReminders   tutors: submitted work still waiting for a mark
 *   - emailDigests       DAILY / WEEKLY email summaries
 *
 * Every job is idempotent, so a retried or doubled run doesn't double-send:
 * reminders check for an earlier reminder of the same kind, and digests
 * only take rows that haven't been emailed yet. Jobs that should land at a
 * civil hour (study and grading reminders, digests) run for each user only
 * when it's that hour in the user's own time zone.
 */

import "server-only";

import type { NotificationType } from "@/features/shared/enums";
import { getPreferencesForUsers } from "@/features/users/preferences";
import { prisma } from "@/lib/db";
import { DEFAULT_TIME_ZONE, hourInZone } from "@/lib/datetime";
import { sendEmail } from "@/lib/email/send";
import { digestEmail } from "@/lib/email/templates";

import { emitNotification, wantsEmail } from "./server";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Hour (local) at which digests and daily reminders go out. */
const MORNING_HOUR = 7;
const STUDY_REMINDER_HOUR = 16;

function localHour(now: Date, timeZone: string | null) {
  return hourInZone(now, timeZone ?? DEFAULT_TIME_ZONE);
}

function localWeekday(now: Date, timeZone: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone ?? DEFAULT_TIME_ZONE,
    weekday: "short",
  }).format(now);
}

/** Users (by email, case-insensitive) for a set of Student rows. */
async function studentUsers(students: { id: string; email: string }[]) {
  if (students.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { OR: students.map((s) => ({ email: { equals: s.email, mode: "insensitive" as const } })) },
    select: { id: true, email: true },
  });
  return students.flatMap((s) => {
    const u = users.find((x) => x.email.toLowerCase() === s.email.toLowerCase());
    return u ? [{ studentId: s.id, userId: u.id }] : [];
  });
}

/** Of these users, the ones not yet sent a `type` notification for `link`. */
async function notYetNotified(
  userIds: string[],
  type: NotificationType,
  link: string,
  since?: Date,
) {
  if (userIds.length === 0) return [];
  const done = await prisma.notification.findMany({
    where: {
      type,
      link,
      userId: { in: userIds },
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    select: { userId: true },
  });
  const seen = new Set(done.map((d) => d.userId));
  return userIds.filter((id) => !seen.has(id));
}

/* ------------------------------------------------------------------------- */

export async function dueDateReminders(now: Date) {
  const until = new Date(now.getTime() + DAY);
  let sent = 0;

  const assignments = await prisma.submission.findMany({
    where: { isActive: true, dueDate: { gt: now, lte: until } },
    select: {
      id: true,
      title: true,
      courseId: true,
      course: { select: { students: { select: { id: true, email: true } } } },
      entries: { select: { studentId: true, status: true } },
    },
  });
  for (const a of assignments) {
    const handedIn = new Set(
      a.entries.filter((e) => e.status !== "NOT_SUBMITTED" && e.status !== "IN_PROGRESS").map((e) => e.studentId),
    );
    const pending = await studentUsers(a.course.students.filter((s) => !handedIn.has(s.id)));
    const link = `/dashboard/submissions/${a.id}`;
    const userIds = await notYetNotified(pending.map((p) => p.userId), "SUBMISSION_DUE", link);
    if (userIds.length === 0) continue;
    const r = await emitNotification(
      {
        title: "Assignment due soon",
        message: `"${a.title}" is due within 24 hours.`,
        link,
        type: "SUBMISSION_DUE",
        priority: "HIGH",
        courseId: a.courseId,
        userIds,
      },
      { revalidate: false },
    );
    sent += r.delivered;
  }

  const tests = await prisma.test.findMany({
    where: { isActive: true, dueDate: { gt: now, lte: until } },
    select: {
      id: true,
      title: true,
      courseId: true,
      course: { select: { students: { select: { id: true, email: true } } } },
      submissions: { select: { studentId: true, status: true } },
    },
  });
  for (const t of tests) {
    const done = new Set(
      t.submissions.filter((s) => s.status !== "IN_PROGRESS" && s.status !== "NOT_STARTED").map((s) => s.studentId),
    );
    const pending = await studentUsers(t.course.students.filter((s) => !done.has(s.id)));
    const link = `/dashboard/tests/pre-test/${t.id}`;
    const userIds = await notYetNotified(pending.map((p) => p.userId), "TEST_DUE", link);
    if (userIds.length === 0) continue;
    const r = await emitNotification(
      {
        title: "Test closes soon",
        message: `"${t.title}" closes within 24 hours.`,
        link,
        type: "TEST_DUE",
        priority: "HIGH",
        courseId: t.courseId,
        userIds,
      },
      { revalidate: false },
    );
    sent += r.delivered;
  }

  return sent;
}

/* ------------------------------------------------------------------------- */

export async function studyReminders(now: Date) {
  // studyReminders defaults to off, so only users with a saved row qualify.
  const opted = await prisma.userPreferences.findMany({
    where: { studyReminders: true, user: { role: "STUDENT" } },
    select: { userId: true, timeZone: true, user: { select: { email: true } } },
  });
  let sent = 0;

  for (const p of opted) {
    if (localHour(now, p.timeZone) !== STUDY_REMINDER_HOUR) continue;

    const student = await prisma.student.findFirst({
      where: { email: { equals: p.user.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!student) continue;

    const recentCompletion = await prisma.lessonCompletion.findFirst({
      where: { studentId: student.id, completedAt: { gt: new Date(now.getTime() - 3 * DAY) } },
      select: { id: true },
    });
    if (recentCompletion) continue;

    const remaining = await prisma.lesson.count({
      where: {
        type: "CONTENT",
        course: { students: { some: { id: student.id } } },
        completions: { none: { studentId: student.id } },
      },
    });
    if (remaining === 0) continue;

    const link = "/dashboard/courses";
    const [userId] = await notYetNotified(
      [p.userId],
      "STUDY_REMINDER",
      link,
      new Date(now.getTime() - 3 * DAY),
    );
    if (!userId) continue;

    const r = await emitNotification(
      {
        title: "Time for a study session?",
        message: `You have ${remaining} lesson${remaining === 1 ? "" : "s"} left to work through. Pick up where you left off.`,
        link,
        type: "STUDY_REMINDER",
        priority: "LOW",
        userIds: [userId],
      },
      { revalidate: false },
    );
    sent += r.delivered;
  }
  return sent;
}

/* ------------------------------------------------------------------------- */

export async function gradingReminders(now: Date) {
  const tutors = await prisma.user.findMany({
    where: { role: "TUTOR" },
    select: { id: true, email: true },
  });
  const prefs = await getPreferencesForUsers(tutors.map((t) => t.id));
  let sent = 0;

  for (const tutor of tutors) {
    const p = prefs.get(tutor.id)!;
    if (!p.notifyOnGradingQueue || localHour(now, p.timeZone) !== MORNING_HOUR) continue;

    const ownCourse = {
      course: { tutor: { email: { equals: tutor.email, mode: "insensitive" as const } } },
    };
    const [entries, tests] = await Promise.all([
      prisma.submissionEntry.count({
        where: { status: { in: ["SUBMITTED", "LATE"] }, submission: ownCourse },
      }),
      prisma.testSubmission.count({
        where: { status: { in: ["SUBMITTED", "LATE"] }, test: ownCourse },
      }),
    ]);
    const total = entries + tests;
    if (total === 0) continue;

    const link = "/dashboard/submissions";
    const [userId] = await notYetNotified(
      [tutor.id],
      "GRADING_REMINDER",
      link,
      new Date(now.getTime() - 20 * HOUR),
    );
    if (!userId) continue;

    const parts = [
      entries > 0 ? `${entries} assignment${entries === 1 ? "" : "s"}` : null,
      tests > 0 ? `${tests} test${tests === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const r = await emitNotification(
      {
        title: `${total} submission${total === 1 ? "" : "s"} waiting for a mark`,
        message: `${parts.join(" and ")} handed in and not yet graded.`,
        link,
        type: "GRADING_REMINDER",
        userIds: [userId],
      },
      { revalidate: false },
    );
    sent += r.delivered;
  }
  return sent;
}

/* ------------------------------------------------------------------------- */

export async function emailDigests(now: Date) {
  const subscribers = await prisma.userPreferences.findMany({
    where: {
      emailNotifications: true,
      notificationFrequency: { in: ["DAILY", "WEEKLY"] },
      user: { emailVerified: { not: null } },
    },
    select: {
      userId: true,
      timeZone: true,
      notificationFrequency: true,
      lastDigestSentAt: true,
      user: { select: { email: true, role: true } },
    },
  });
  let sent = 0;

  for (const s of subscribers) {
    const weekly = s.notificationFrequency === "WEEKLY";
    if (localHour(now, s.timeZone) !== MORNING_HOUR) continue;
    if (weekly && localWeekday(now, s.timeZone) !== "Mon") continue;

    const period = weekly ? 7 * DAY : DAY;
    // Guard against a second run in the same morning (minus some slack).
    if (s.lastDigestSentAt && now.getTime() - s.lastDigestSentAt.getTime() < period - 4 * HOUR) {
      continue;
    }
    // Only what arrived since the last digest; never the whole backlog for
    // someone who just switched to digests.
    const since = new Date(
      Math.max(s.lastDigestSentAt?.getTime() ?? 0, now.getTime() - period),
    );

    const rows = await prisma.notification.findMany({
      where: { userId: s.userId, emailedAt: null, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, message: true, link: true, type: true },
      take: 50,
    });
    const items = rows.filter((r) => wantsEmail(r.type, s.user.role));
    if (items.length === 0) continue;

    const result = await sendEmail(
      digestEmail({ to: s.user.email, period: weekly ? "weekly" : "daily", items }),
    );
    if (!result.ok) continue;

    await prisma.$transaction([
      prisma.notification.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { emailedAt: now },
      }),
      prisma.userPreferences.update({
        where: { userId: s.userId },
        data: { lastDigestSentAt: now },
      }),
    ]);
    sent += 1;
  }
  return sent;
}

export async function runNotificationJobs(now = new Date()) {
  const run = async (name: string, job: (now: Date) => Promise<number>) => {
    try {
      return [name, await job(now)] as const;
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e);
      return [name, "failed"] as const;
    }
  };
  return Object.fromEntries([
    await run("dueDateReminders", dueDateReminders),
    await run("studyReminders", studyReminders),
    await run("gradingReminders", gradingReminders),
    // Last, so this run's reminders make it into this morning's digest.
    await run("emailDigests", emailDigests),
  ]);
}
