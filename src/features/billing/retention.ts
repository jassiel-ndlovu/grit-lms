/**
 * Data retention (design 03, section 5; owner approval 2026-11-19).
 * A workspace's data is kept until 2 months after its last payment
 * (`Subscription.deleteAfter`); a payment before then keeps everything.
 *
 * Built here:
 *   - Warnings 30 and 7 days before deleteAfter, to owners, admins and the
 *     billing email (once each per deleteAfter date).
 *   - `planRetention`: which workspaces are due and what would go.
 *
 *   - `deleteWorkspaceData`: the delete itself (or a dry run), using B's
 *     deleteCourseContent (issue #113). The billing job runs it only with
 *     RETENTION_DELETES=1; otherwise it reports the plan and deletes nothing.
 *
 * Kept for tax law: PlatformInvoice, lines, Payment, Refund, OffsitePayment
 * and AuditLog rows.
 */

import "server-only";

import { countCourseContent, deleteCourseContent, type CourseContentCounts } from "@/features/courses/delete-content";
import { deleteBlob } from "@/lib/blob/server";
import { prisma } from "@/lib/db";

import { dayLabel, queueBillingEmail } from "./emails";

const DAY = 24 * 60 * 60 * 1000;
export const RETENTION_WARNING_DAYS = [30, 7] as const;

/** Never deleted, whatever its dates say. */
const PROTECTED_WORKSPACES = new Set(["ws_nexa_legacy"]);

/** Which warning (30 or 7) is due at `daysLeft`, if any. */
export function retentionWarningDue(daysLeft: number): 30 | 7 | null {
  if (daysLeft <= 0) return null;
  const due = RETENTION_WARNING_DAYS.filter((d) => daysLeft <= d);
  return (due.at(-1) as 30 | 7 | undefined) ?? null;
}

export async function sendRetentionWarnings(now: Date, batch = 50): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: {
      deleteAfter: { gt: now, lte: new Date(now.getTime() + RETENTION_WARNING_DAYS[0] * DAY) },
      workspace: { billingState: { in: ["READ_ONLY", "CANCELLED"] } },
    },
    select: { workspaceId: true, deleteAfter: true, workspace: { select: { name: true, timezone: true } } },
    take: batch,
  });
  let queued = 0;
  for (const s of subs) {
    if (PROTECTED_WORKSPACES.has(s.workspaceId)) continue;
    const daysLeft = Math.ceil((s.deleteAfter!.getTime() - now.getTime()) / DAY);
    const mark = retentionWarningDue(daysLeft);
    if (mark == null) continue;
    queued += await queueBillingEmail(prisma, {
      workspaceId: s.workspaceId,
      template: "deletion-warning",
      // A later payment moves deleteAfter, so warnings start over for the new date.
      event: `${s.workspaceId}:${s.deleteAfter!.toISOString().slice(0, 10)}:${mark}`,
      data: { workspaceName: s.workspace.name, daysLeft, deleteOn: dayLabel(s.deleteAfter!, s.workspace.timezone) },
    });
  }
  return queued;
}

export type RetentionPlanItem = { workspaceId: string; courses: number; enrollments: number; learners: number; memberships: number };

/** Workspaces past deleteAfter and what deleting them would remove. Reads only. */
export async function planRetention(now: Date, batch = 20): Promise<RetentionPlanItem[]> {
  const due = await prisma.subscription.findMany({
    where: { deleteAfter: { lte: now }, workspace: { billingState: { in: ["READ_ONLY", "CANCELLED"] } } },
    select: { workspaceId: true },
    take: batch,
  });
  const out: RetentionPlanItem[] = [];
  for (const { workspaceId } of due) {
    if (PROTECTED_WORKSPACES.has(workspaceId)) continue;
    const [courses, enrollments, learners, memberships] = await Promise.all([
      prisma.course.count({ where: { workspaceId } }),
      prisma.enrollment.count({ where: { workspaceId } }),
      prisma.learner.count({ where: { workspaceId } }),
      prisma.membership.count({ where: { workspaceId } }),
    ]);
    out.push({ workspaceId, courses, enrollments, learners, memberships });
  }
  return out;
}

/* ------------------------------------------------------------------------- */
/* Deleting a workspace's data                                                */
/* ------------------------------------------------------------------------- */

export type RetentionCounts = CourseContentCounts & {
  courses: number;
  enrollments: number;
  learners: number;
  memberships: number;
  usageRows: number;
  /** B's question bank rows saved in this workspace (#228). */
  bankQuestions: number;
  files: number;
};

const ZERO_CONTENT: CourseContentCounts = {
  uploadedFiles: 0, grades: 0, questionGrades: 0, assessmentCompletions: 0, testSubmissions: 0, testQuestions: 0, tests: 0,
  assignmentEntries: 0, assignments: 0, quizzes: 0, lessonCompletions: 0, attachments: 0, lessons: 0, courseEvents: 0,
};

/** Every https URL inside a JSON value (question data holds image links in text). */
export function blobUrlsIn(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(/https:\/\/[^\s"'()<>\]]+/g)) out.push(m[0]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

/** Only files in our Blob store are ours to delete. */
export function isOwnBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Deletes are switched on only by RETENTION_DELETES=1 (owner's call after a dry run). */
export function retentionDeletesEnabled(): boolean {
  return process.env.RETENTION_DELETES === "1";
}

async function assertDue(workspaceId: string, now: Date) {
  if (PROTECTED_WORKSPACES.has(workspaceId)) throw new Error(`${workspaceId} is protected`);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingState: true, subscription: { select: { deleteAfter: true } } },
  });
  if (!ws) throw new Error(`${workspaceId} not found`);
  if (ws.billingState !== "READ_ONLY" && ws.billingState !== "CANCELLED") throw new Error(`${workspaceId} is ${ws.billingState}, not due`);
  if (!ws.subscription?.deleteAfter || ws.subscription.deleteAfter > now) throw new Error(`${workspaceId} is not past its retention date`);
}

/**
 * What deleting the workspace's data removes, or (dryRun false) removes it.
 * Each course goes in its own transaction: B's content (deleteCourseContent),
 * the course's notifications, then the Course, which takes its staff,
 * enrolments and billing settings with it. Then learners, memberships, usage
 * rows and the logo. Files go after each commit, only from our Blob store.
 *
 * Kept: the Workspace row (renamed to its legal name or "Deleted workspace"),
 * Subscription, invoices and their lines, seat charges, payments, refunds,
 * off-site payments and AuditLog, for tax law. User accounts are kept: a
 * person may belong to other workspaces, and account deletion is separate.
 */
export async function deleteWorkspaceData(
  workspaceId: string,
  opts: { dryRun: boolean; now?: Date; deleteFiles?: (urls: string[]) => Promise<void> },
): Promise<RetentionCounts> {
  const now = opts.now ?? new Date();
  await assertDue(workspaceId, now);
  const TX = { timeout: 60_000, maxWait: 10_000 };
  const counts: RetentionCounts = { ...ZERO_CONTENT, courses: 0, enrollments: 0, learners: 0, memberships: 0, usageRows: 0, bankQuestions: 0, files: 0 };
  const add = (c: CourseContentCounts) => {
    for (const k of Object.keys(ZERO_CONTENT) as Array<keyof CourseContentCounts>) counts[k] += c[k];
  };
  const removeFiles = opts.deleteFiles ?? (async (urls: string[]) => {
    for (const u of urls) await deleteBlob(u);
  });

  const courses = await prisma.course.findMany({ where: { workspaceId }, select: { id: true } });
  counts.courses = courses.length;
  [counts.enrollments, counts.learners, counts.memberships, counts.usageRows] = await Promise.all([
    prisma.enrollment.count({ where: { workspaceId } }),
    prisma.learner.count({ where: { workspaceId } }),
    prisma.membership.count({ where: { workspaceId } }),
    prisma.usageRecord.count({ where: { workspaceId } }),
  ]);

  for (const { id: courseId } of courses) {
    if (opts.dryRun) {
      const r = await prisma.$transaction((tx) => countCourseContent(tx, courseId), TX);
      add(r.counts);
      counts.files += r.blobUrls.filter(isOwnBlobUrl).length;
      continue;
    }
    const r = await prisma.$transaction(async (tx) => {
      const content = await deleteCourseContent(tx, courseId);
      await tx.notification.deleteMany({ where: { courseId } });
      await tx.course.delete({ where: { id: courseId } });
      return content;
    }, TX);
    add(r.counts);
    const files = r.blobUrls.filter(isOwnBlobUrl);
    counts.files += files.length;
    await removeFiles(files);
  }

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { logoUrl: true, subscription: { select: { legalName: true } } },
  });
  if (ws.logoUrl && isOwnBlobUrl(ws.logoUrl)) counts.files++;
  // B's question bank (#228): rows carry the workspace id without a foreign
  // key, so they go here; images they point to go with them.
  const bank = await prisma.bankQuestion.findMany({ where: { workspaceId }, select: { data: true } });
  const bankFiles = [...new Set(bank.flatMap((b) => blobUrlsIn(b.data)))].filter(isOwnBlobUrl);
  counts.bankQuestions = bank.length;
  counts.files += bankFiles.length;
  if (opts.dryRun) return counts;

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.deleteMany({ where: { workspaceId } });
    await tx.learner.deleteMany({ where: { workspaceId } });
    await tx.membership.deleteMany({ where: { workspaceId } });
    await tx.usageRecord.deleteMany({ where: { workspaceId } });
    await tx.usageCap.deleteMany({ where: { workspaceId } });
    await tx.bankQuestion.deleteMany({ where: { workspaceId } });
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { name: ws.subscription?.legalName || "Deleted workspace", logoUrl: null, accentColor: null },
    });
    // No longer due: the retention date is cleared once the data is gone.
    await tx.subscription.update({ where: { workspaceId }, data: { deleteAfter: null } });
  }, TX);
  if (ws.logoUrl && isOwnBlobUrl(ws.logoUrl)) await removeFiles([ws.logoUrl]);
  if (bankFiles.length) await removeFiles(bankFiles);
  return counts;
}
