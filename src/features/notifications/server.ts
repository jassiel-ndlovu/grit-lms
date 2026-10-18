/**
 * Notification server-only helpers.
 *
 * `emitNotification` is the single typed entry point feature actions (and
 * the remaining legacy API routes) use to write notifications. It:
 *   1. validates the input against the same Zod schema every time
 *   2. resolves the recipients (explicit users, one student, or a course's
 *      students / tutor) to User rows
 *   3. drops recipients whose preferences turn this kind of alert off
 *   4. writes one row per recipient, so read state is per user
 *   5. emails recipients who want immediate email and have a verified
 *      address; DAILY / WEEKLY recipients are picked up by the digest cron
 *      (see ./digest.ts) and NONE recipients get no email
 *
 * Emitting is best-effort: failures are logged, never thrown, so a broken
 * notification can't fail the lesson/test/grade write that triggered it.
 */

import "server-only";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import type { NotificationType } from "@/features/shared/enums";
import {
  getPreferencesForUsers,
  type ResolvedPreferences,
} from "@/features/users/preferences";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { notificationEmail } from "@/lib/email/templates";

import {
  CreateNotificationInputSchema,
  type CreateNotificationInput,
} from "./schemas";

export interface EmitNotificationOptions {
  /**
   * Whether to revalidate the notification surfaces. Default true. Pass
   * `false` from inside a feature action that already triggers
   * revalidation for the same routes (avoid double work).
   */
  revalidate?: boolean;
  /**
   * Whether this notification may be emailed at all. Default true. False
   * keeps it in-app only (and out of digests), whatever the recipient's
   * email settings say.
   */
  email?: boolean;
}

/* ------------------------------------------------------------------------- */
/* Preferences                                                               */
/* ------------------------------------------------------------------------- */

type PreferenceToggle = {
  [K in keyof ResolvedPreferences]: ResolvedPreferences[K] extends boolean ? K : never;
}[keyof ResolvedPreferences];

/**
 * The settings toggle that controls each notification type. `null` means
 * the notification is always delivered in-app (receipts, system notices).
 */
const PREFERENCE_BY_TYPE: Record<NotificationType, PreferenceToggle | null> = {
  COURSE_UPDATE: "notifyOnCourseUpdate",
  EVENT_CREATED: "notifyOnCourseUpdate",
  EVENT_UPDATED: "notifyOnCourseUpdate",
  EVENT_DELETED: "notifyOnCourseUpdate",
  LESSON_CREATED: "notifyOnNewLesson",
  LESSON_UPDATED: "notifyOnNewLesson",
  LESSON_DELETED: "notifyOnNewLesson",
  TEST_CREATED: "notifyOnNewTest",
  TEST_UPDATED: "notifyOnNewTest",
  TEST_DELETED: "notifyOnNewTest",
  QUIZ_CREATED: "notifyOnNewTest",
  SUBMISSION_CREATED: "notifyOnNewTest",
  SUBMISSION_UPDATED: "notifyOnNewTest",
  SUBMISSION_DELETED: "notifyOnNewTest",
  SUBMISSION_DUE: "notifyOnDueDateReminder",
  TEST_DUE: "notifyOnDueDateReminder",
  SUBMISSION_GRADED: "notifyOnGrades",
  TEST_GRADED: "notifyOnGrades",
  STUDY_REMINDER: "studyReminders",
  MESSAGE: "notifyOnMessages",
  // TEST_SUBMITTED / SUBMISSION_RECEIVED go to two audiences: the tutor
  // (controlled by notifyOnSubmissions) and the student as a receipt.
  // `allowedFor` below special-cases the receipt.
  TEST_SUBMITTED: "notifyOnSubmissions",
  SUBMISSION_RECEIVED: "notifyOnSubmissions",
  GRADING_REMINDER: "notifyOnGradingQueue",
  SYSTEM: null,
};

function allowedFor(
  type: NotificationType,
  role: string,
  prefs: ResolvedPreferences,
): boolean {
  if ((type === "TEST_SUBMITTED" || type === "SUBMISSION_RECEIVED") && role === "STUDENT") {
    return true; // the student's own receipt
  }
  const key = PREFERENCE_BY_TYPE[type];
  return key === null ? true : Boolean(prefs[key]);
}

export function wantsEmail(type: NotificationType, role: string): boolean {
  // Receipts for a student's own hand-ins stay in-app.
  if ((type === "TEST_SUBMITTED" || type === "SUBMISSION_RECEIVED") && role === "STUDENT") {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------------- */
/* Recipient resolution                                                      */
/* ------------------------------------------------------------------------- */

interface Recipient {
  id: string;
  email: string;
  role: string;
  emailVerified: Date | null;
  studentId: string | null;
}

const recipientSelect = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
} as const;

/** Student and Tutor rows link to User by email, compared case-insensitively. */
async function usersByEmails(emails: string[]) {
  if (emails.length === 0) return [];
  return prisma.user.findMany({
    where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
    select: recipientSelect,
  });
}

async function resolveRecipients(
  input: ReturnType<typeof CreateNotificationInputSchema.parse>,
): Promise<Recipient[]> {
  if (input.userIds?.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: input.userIds } },
      select: recipientSelect,
    });
    const emails = users.filter((u) => u.role === "STUDENT").map((u) => u.email);
    const students = emails.length
      ? await prisma.student.findMany({
          where: { OR: emails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
          select: { id: true, email: true },
        })
      : [];
    return users.map((u) => ({
      ...u,
      studentId:
        students.find((s) => s.email.toLowerCase() === u.email.toLowerCase())?.id ?? null,
    }));
  }

  if (input.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, email: true },
    });
    if (!student) return [];
    const [user] = await usersByEmails([student.email]);
    return user ? [{ ...user, studentId: student.id }] : [];
  }

  if (input.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: {
        tutor: { select: { email: true } },
        students: { select: { id: true, email: true } },
      },
    });
    if (!course) return [];

    if (input.audience === "tutor") {
      const [user] = await usersByEmails([course.tutor.email]);
      return user ? [{ ...user, studentId: null }] : [];
    }

    const users = await usersByEmails(course.students.map((s) => s.email));
    return users.map((u) => ({
      ...u,
      studentId:
        course.students.find((s) => s.email.toLowerCase() === u.email.toLowerCase())?.id ??
        null,
    }));
  }

  return [];
}

/* ------------------------------------------------------------------------- */
/* emitNotification                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Validate, fan out and persist a notification, then email whoever wants
 * it immediately. Returns how many in-app rows were written.
 */
export async function emitNotification(
  input: CreateNotificationInput,
  options: EmitNotificationOptions = {},
): Promise<{ delivered: number }> {
  try {
    const parsed = CreateNotificationInputSchema.parse(input);
    const recipients = await resolveRecipients(parsed);
    if (recipients.length === 0) return { delivered: 0 };

    const prefsByUser = await getPreferencesForUsers(recipients.map((r) => r.id));
    const targets = recipients.filter((r) =>
      allowedFor(parsed.type, r.role, prefsByUser.get(r.id)!),
    );
    if (targets.length === 0) return { delivered: 0 };

    const rows = await prisma.notification.createManyAndReturn({
      data: targets.map((r) => ({
        title: parsed.title,
        message: parsed.message,
        link: parsed.link ?? null,
        type: parsed.type,
        priority: parsed.priority,
        userId: r.id,
        studentId: r.studentId,
        courseId: parsed.courseId ?? null,
        suppressEmail: options.email === false,
      })),
      select: { id: true, userId: true },
    });

    const emailNow = rows.flatMap((row) => {
      const r = targets.find((t) => t.id === row.userId)!;
      const prefs = prefsByUser.get(r.id)!;
      const immediate =
        options.email !== false &&
        prefs.emailNotifications &&
        prefs.notificationFrequency === "IMMEDIATE" &&
        r.emailVerified !== null &&
        wantsEmail(parsed.type, r.role);
      return immediate ? [{ notificationId: row.id, to: r.email }] : [];
    });

    if (emailNow.length > 0) {
      runAfterResponse(() =>
        deliverImmediateEmails(emailNow, {
          title: parsed.title,
          message: parsed.message,
          link: parsed.link ?? null,
        }),
      );
    }

    if (options.revalidate ?? true) {
      // The bell self-fetches on mount, but RSC pages that read the full
      // list / unread count need to re-render after a new emit.
      revalidatePath("/dashboard/notifications");
      revalidatePath("/dashboard");
    }

    return { delivered: rows.length };
  } catch (e) {
    console.error("[notifications] emit failed:", e);
    return { delivered: 0 };
  }
}

async function deliverImmediateEmails(
  sends: { notificationId: string; to: string }[],
  item: { title: string; message: string; link: string | null },
) {
  const results = await Promise.all(
    sends.map(async (s) => ({
      ...s,
      result: await sendEmail(notificationEmail({ to: s.to, item })),
    })),
  );
  const sent = results.filter((r) => r.result.ok).map((r) => r.notificationId);
  if (sent.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: sent } },
      data: { emailedAt: new Date() },
    });
  }
}

/**
 * Run work after the response has been sent (Vercel keeps the function
 * alive for it). Outside a request scope, e.g. a script, `after` throws,
 * so fall back to running the work now.
 */
function runAfterResponse(task: () => Promise<void>) {
  const guarded = () =>
    task().catch((e) => console.error("[notifications] email delivery failed:", e));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

/* ------------------------------------------------------------------------- */
/* Hand-ins                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * A student handed in a test or assignment: a receipt to the student and
 * an alert to the course tutor (subject to their notifyOnSubmissions).
 */
export async function notifyHandIn(input: {
  kind: "test" | "assignment";
  title: string;
  courseId: string;
  studentId: string;
  /** Where the student reviews their work. */
  studentLink: string;
  /** Where the tutor grades it. */
  tutorLink: string;
}) {
  const type = input.kind === "test" ? "TEST_SUBMITTED" : "SUBMISSION_RECEIVED";
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { fullName: true },
  });
  const noun = input.kind === "test" ? "test" : "assignment";

  await Promise.all([
    emitNotification(
      {
        title: input.kind === "test" ? "Test Submitted" : "Assignment Submitted",
        message:
          input.kind === "test"
            ? `Your test "${input.title}" has been submitted.`
            : `Your submission for "${input.title}" has been received.`,
        link: input.studentLink,
        type,
        studentId: input.studentId,
        courseId: input.courseId,
      },
      { revalidate: false },
    ),
    emitNotification(
      {
        title: `New ${noun} submission`,
        message: `${student?.fullName ?? "A student"} submitted the ${noun} "${input.title}".`,
        link: input.tutorLink,
        type,
        courseId: input.courseId,
        audience: "tutor",
      },
      { revalidate: false },
    ),
  ]);
}
