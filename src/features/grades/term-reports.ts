/**
 * Term reports: who may see what, and the marks, attendance and comments of
 * a term. Server-only. The contract is contracts/term-reports.md; the maths
 * is in ./lib/term-report.ts and the PDF is A's.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { ownerTutor, tutorOf } from "@/features/courses/lib/tenancy-where";
import type { TermReportPdfData } from "@/features/reports/term-report-pdf";
import { prisma } from "@/lib/db";
import { can, canIn, courseScopeOf, needsScope, scopedCourseWhere, type Viewer } from "@/lib/viewer";

import { assessmentKey } from "./gradebook";
import {
  achievementLevel, countAttendance, countsInTerm, courseReport, dayOf, pdfText, sharedGrade, termWindow,
  type AttendanceCounts, type ReportGrade, type ReportItem,
} from "./lib/term-report";

/* ───── Who ───── */

export interface ReportStaff {
  workspaceId: string;
  timeZone: string;
  /** Courses whose reports they may read. */
  readWhere: Prisma.CourseWhereInput;
  /** Courses they may comment on; null when they only read. */
  editWhere: Prisma.CourseWhereInput | null;
  /** Sets the terms and releases them: the owner and admins. */
  manages: boolean;
}

/** The signed-in staff member's reach, or null when reports aren't theirs to see. */
export function reportStaff(viewer: Viewer): ReportStaff | null {
  const { workspace, membership } = viewer;
  if (viewer.persona !== "staff" || !workspace || !membership || membership.id.startsWith("legacy_") || !can(viewer, "grades.view")) return null;
  const where = (permission: "grades.view" | "courses.edit"): Prisma.CourseWhereInput => {
    const scope = courseScopeOf(viewer, permission);
    return { workspaceId: workspace.id, ...(scope ? scopedCourseWhere(scope) : {}) };
  };
  return {
    workspaceId: workspace.id,
    timeZone: workspace.timezone,
    readWhere: where("grades.view"),
    editWhere: can(viewer, "courses.edit") ? where("courses.edit") : null,
    manages: can(viewer, "workspace.settings") && !needsScope(viewer, "grades.view"),
  };
}

/** Their parent, or the adult student. A child's own report goes to the parent. */
async function isFamily(viewer: Viewer, learner: { userId: string; isMinor: boolean }): Promise<boolean> {
  if (viewer.user.id === learner.userId) return !learner.isMinor;
  if (!viewer.children.some((c) => c.userId === learner.userId)) return false;
  return canIn(viewer, "grades.view", { childUserId: learner.userId });
}

/* ───── Terms ───── */

const termSelect = {
  id: true,
  title: true,
  startsOn: true,
  endsOn: true,
  releasedAt: true,
  workspace: { select: { id: true, name: true, timezone: true } },
} satisfies Prisma.ReportTermSelect;

export interface ReportTermView {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  releasedAt: Date | null;
  workspace: { id: string; name: string; timezone: string };
}

const toTerm = (t: Prisma.ReportTermGetPayload<{ select: typeof termSelect }>): ReportTermView => ({
  ...t,
  startsOn: dayOf(t.startsOn),
  endsOn: dayOf(t.endsOn),
});

export const windowOf = (t: ReportTermView) => termWindow(t.startsOn, t.endsOn, t.workspace.timezone);

export async function listTerms(workspaceId: string): Promise<ReportTermView[]> {
  const rows = await prisma.reportTerm.findMany({ where: { workspaceId }, select: termSelect, orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }] });
  return rows.map(toTerm);
}

export async function getTerm(id: string, workspaceId: string): Promise<ReportTermView | null> {
  const row = await prisma.reportTerm.findFirst({ where: { id, workspaceId }, select: termSelect });
  return row ? toTerm(row) : null;
}

/* ───── Enrolments in a term ───── */

const enrolmentSelect = {
  startedAt: true,
  endedAt: true,
  courseId: true,
  learnerId: true,
  learner: { select: { userId: true, isMinor: true, user: { select: { name: true, studentProfile: { select: { id: true } } } } } },
} satisfies Prisma.EnrollmentSelect;

async function enrolmentsIn(term: ReportTermView, where: { course?: Prisma.CourseWhereInput; learnerId?: string }) {
  const w = windowOf(term);
  const rows = await prisma.enrollment.findMany({
    where: {
      ...(where.learnerId ? { learnerId: where.learnerId } : {}),
      course: { AND: [{ workspaceId: term.workspace.id }, where.course ?? {}] },
      learner: { workspaceId: term.workspace.id, user: { deletedAt: null } },
      startedAt: { lt: w.before },
      OR: [{ endedAt: null }, { endedAt: { gt: w.from } }],
    },
    select: enrolmentSelect,
    orderBy: { startedAt: "asc" },
  });
  // Someone who left and came back has two rows; one is enough.
  const seen = new Set<string>();
  return rows.filter((e) => {
    const key = `${e.courseId}:${e.learnerId}`;
    if (seen.has(key) || !countsInTerm(e, w)) return false;
    seen.add(key);
    return true;
  });
}

export interface TermCourseRow {
  id: string;
  name: string;
  tutorName: string | null;
  students: number;
  written: number;
}

export interface TermStudentRow {
  learnerId: string;
  name: string;
  courses: string[];
}

/** A term's courses with how many comments are written, and its students. */
export async function termOverview(term: ReportTermView, staff: ReportStaff): Promise<{ courses: TermCourseRow[]; students: TermStudentRow[] }> {
  const enrolments = await enrolmentsIn(term, { course: staff.readWhere });
  const courseIds = [...new Set(enrolments.map((e) => e.courseId))];
  const [courses, comments] = await Promise.all([
    prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true, ownerMembership: ownerTutor }, orderBy: { name: "asc" } }),
    prisma.reportCourseComment.findMany({ where: { termId: term.id, courseId: { in: courseIds } }, select: { courseId: true, learnerId: true } }),
  ]);
  const commented = new Set(comments.map((c) => `${c.courseId}:${c.learnerId}`));
  const nameOf = new Map(courses.map((c) => [c.id, c.name]));
  const students = new Map<string, TermStudentRow>();
  for (const e of enrolments) {
    const row = students.get(e.learnerId) ?? { learnerId: e.learnerId, name: e.learner.user.name, courses: [] };
    row.courses.push(nameOf.get(e.courseId) ?? "");
    students.set(e.learnerId, row);
  }
  return {
    courses: courses.map((c) => {
      const own = enrolments.filter((e) => e.courseId === c.id);
      return {
        id: c.id,
        name: c.name,
        tutorName: tutorOf(c)?.fullName ?? null,
        students: own.length,
        written: own.filter((e) => commented.has(`${c.id}:${e.learnerId}`)).length,
      };
    }),
    students: [...students.values()]
      .map((s) => ({ ...s, courses: s.courses.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ───── The reports ───── */

export interface ReportComment {
  text: string;
  by: string | null;
}

export interface ReportCourse {
  courseId: string;
  name: string;
  tutorName: string | null;
  gradeLevel: number | null;
  percent: number | null;
  symbol: string | null;
  items: ReportItem[];
  attendance: AttendanceCounts | null;
  comment: ReportComment | null;
}

export interface LearnerReport {
  learnerId: string;
  userId: string;
  isMinor: boolean;
  name: string;
  courses: ReportCourse[];
}

/** Display names of the people who wrote comments. */
async function namesOf(userIds: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] }, deletedAt: null }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

/**
 * Reports for the enrolments asked for. The caller has checked access: this
 * reads marks, attendance and comments of whatever it's given.
 */
async function buildReports(term: ReportTermView, where: { course?: Prisma.CourseWhereInput; learnerId?: string }, now: Date): Promise<LearnerReport[]> {
  const enrolments = await enrolmentsIn(term, where);
  if (enrolments.length === 0) return [];
  const w = windowOf(term);
  const courseIds = [...new Set(enrolments.map((e) => e.courseId))];
  const learnerIds = [...new Set(enrolments.map((e) => e.learnerId))];
  const studentIds = [...new Set(enrolments.flatMap((e) => (e.learner.user.studentProfile ? [e.learner.user.studentProfile.id] : [])))];

  const assessmentSelect = { id: true, courseId: true, title: true, totalPoints: true, weight: true, dueDate: true, isActive: true } as const;
  const [courses, tests, assignments, grades, attendance, comments] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, curriculum: true, gradeLevel: true, ownerMembership: ownerTutor },
      orderBy: { name: "asc" },
    }),
    prisma.test.findMany({ where: { courseId: { in: courseIds } }, select: assessmentSelect }),
    prisma.submission.findMany({ where: { courseId: { in: courseIds } }, select: assessmentSelect }),
    prisma.grade.findMany({
      where: { courseId: { in: courseIds }, studentId: { in: studentIds } },
      select: {
        studentId: true,
        courseId: true,
        score: true,
        outOf: true,
        updatedAt: true,
        testSubmission: { select: { testId: true, status: true, test: { select: { releaseAutoMarksToStudent: true } } } },
        submissionEntry: { select: { submissionId: true, status: true } },
      },
    }),
    prisma.sessionAttendance.findMany({
      where: { learnerId: { in: learnerIds }, occurrenceStart: { gte: w.from, lt: w.before }, event: { courseId: { in: courseIds } } },
      select: { learnerId: true, status: true, event: { select: { courseId: true } } },
    }),
    prisma.reportCourseComment.findMany({
      where: { termId: term.id, learnerId: { in: learnerIds }, courseId: { in: courseIds } },
      select: { learnerId: true, courseId: true, text: true, authorUserId: true },
    }),
  ]);
  const authors = await namesOf(comments.map((c) => c.authorUserId));

  const reports = new Map<string, LearnerReport>();
  for (const e of enrolments) {
    if (reports.has(e.learnerId)) continue;
    reports.set(e.learnerId, { learnerId: e.learnerId, userId: e.learner.userId, isMinor: e.learner.isMinor, name: e.learner.user.name, courses: [] });
  }
  for (const course of courses) {
    const assessments = [
      ...tests.filter((t) => t.courseId === course.id).map((t) => ({ ...t, id: assessmentKey("test", t.id), kind: "test" as const })),
      ...assignments.filter((s) => s.courseId === course.id).map((s) => ({ ...s, id: assessmentKey("assignment", s.id), kind: "assignment" as const, isActive: s.isActive ?? true })),
    ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    for (const e of enrolments) {
      if (e.courseId !== course.id) continue;
      const studentId = e.learner.user.studentProfile?.id;
      const own: ReportGrade[] = grades
        .filter((g) => g.courseId === course.id && g.studentId === studentId)
        .flatMap((g) => {
          const assessmentId = g.testSubmission ? assessmentKey("test", g.testSubmission.testId) : g.submissionEntry ? assessmentKey("assignment", g.submissionEntry.submissionId) : null;
          return assessmentId ? [{ ...g, assessmentId }] : [];
        });
      const { percent, items } = courseReport(assessments, own, w, now);
      const comment = comments.find((c) => c.learnerId === e.learnerId && c.courseId === course.id);
      reports.get(e.learnerId)!.courses.push({
        courseId: course.id,
        name: course.name,
        tutorName: tutorOf(course)?.fullName ?? null,
        gradeLevel: course.gradeLevel,
        percent,
        symbol: achievementLevel(percent, course.curriculum),
        items,
        attendance: countAttendance(attendance.filter((a) => a.learnerId === e.learnerId && a.event.courseId === course.id).map((a) => a.status)),
        comment: comment ? { text: comment.text, by: authors.get(comment.authorUserId) ?? null } : null,
      });
    }
  }
  return [...reports.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** One course's students, for writing its comments. Null when the course isn't theirs. */
export async function courseReports(term: ReportTermView, courseId: string, staff: ReportStaff, now: Date = new Date()) {
  const course = await prisma.course.findFirst({ where: { AND: [{ id: courseId }, staff.readWhere] }, select: { id: true, name: true } });
  if (!course) return null;
  const canEdit = staff.editWhere != null && (await prisma.course.count({ where: { AND: [{ id: courseId }, staff.editWhere] } })) > 0;
  return { course, canEdit, reports: await buildReports(term, { course: { id: courseId } }, now) };
}

export interface StudentReportView {
  report: LearnerReport;
  /** False when the student has courses this person may not see: no general comment and no download. */
  complete: boolean;
  overall: ReportComment | null;
  /** The general comment is for whoever edits all of the student's courses. */
  canEditOverall: boolean;
}

async function overallComment(termId: string, learnerId: string): Promise<ReportComment | null> {
  const row = await prisma.reportOverallComment.findUnique({ where: { termId_learnerId: { termId, learnerId } }, select: { text: true, authorUserId: true } });
  if (!row) return null;
  return { text: row.text, by: (await namesOf([row.authorUserId])).get(row.authorUserId) ?? null };
}

/** The courses of `ids` that match. */
async function matching(ids: string[], where: Prisma.CourseWhereInput): Promise<Set<string>> {
  const rows = await prisma.course.findMany({ where: { AND: [{ id: { in: ids } }, where] }, select: { id: true } });
  return new Set(rows.map((c) => c.id));
}

/** One student's report for staff, narrowed to the courses they may see. Null when there are none. */
export async function studentReport(term: ReportTermView, learnerId: string, staff: ReportStaff, now: Date = new Date()): Promise<StudentReportView | null> {
  const [report] = await buildReports(term, { learnerId }, now);
  if (!report) return null;
  const ids = report.courses.map((c) => c.courseId);
  const [readable, editable] = await Promise.all([matching(ids, staff.readWhere), staff.editWhere ? matching(ids, staff.editWhere) : new Set<string>()]);
  const courses = report.courses.filter((c) => readable.has(c.courseId));
  if (courses.length === 0) return null;
  const complete = courses.length === report.courses.length;
  return {
    report: { ...report, courses },
    complete,
    overall: complete ? await overallComment(term.id, learnerId) : null,
    canEditOverall: complete && editable.size === ids.length,
  };
}

/** Is this learner on this course for this term? */
export async function isOnReport(term: ReportTermView, learnerId: string, courseId: string): Promise<boolean> {
  return (await enrolmentsIn(term, { learnerId, course: { id: courseId } })).length > 0;
}

/* ───── The PDF ───── */

/**
 * The data of one report's PDF, or null when the viewer may not have it:
 * staff who see all of the student's courses, and once it's released the
 * student's parents and an adult student.
 */
export async function termReportPdfFor(viewer: Viewer, termId: string, learnerId: string, now: Date = new Date()): Promise<TermReportPdfData | null> {
  const row = await prisma.reportTerm.findUnique({ where: { id: termId }, select: termSelect });
  if (!row) return null;
  const term = toTerm(row);
  const staff = reportStaff(viewer);
  let report: LearnerReport | null = null;
  let overall: ReportComment | null = null;

  if (staff && staff.workspaceId === term.workspace.id) {
    const view = await studentReport(term, learnerId, staff, now);
    if (view?.complete) ({ report, overall } = view);
  }
  if (!report && term.releasedAt) {
    const learner = await prisma.learner.findFirst({ where: { id: learnerId, workspaceId: term.workspace.id }, select: { userId: true, isMinor: true } });
    if (learner && (await isFamily(viewer, learner))) {
      report = (await buildReports(term, { learnerId }, now))[0] ?? null;
      overall = report ? await overallComment(term.id, learnerId) : null;
    }
  }
  if (!report) return null;

  const w = windowOf(term);
  return {
    workspace: { name: pdfText(term.workspace.name) },
    term: { title: pdfText(term.title), from: w.from, to: new Date(w.before.getTime() - 1) },
    student: { name: pdfText(report.name), grade: sharedGrade(report.courses.map((c) => c.gradeLevel)) },
    courses: report.courses.map((c) => ({
      name: pdfText(c.name),
      tutor: c.tutorName ? pdfText(c.tutorName) : null,
      percent: c.percent,
      symbol: c.symbol,
      items: c.items.map((i) => ({ title: pdfText(i.title), kind: i.kind === "test" ? "test" : "assignment", score: i.score, outOf: i.outOf })),
      attendance: c.attendance,
      comment: c.comment ? pdfText(c.comment.text) : null,
    })),
    overall: overall ? { comment: pdfText(overall.text), by: overall.by ? pdfText(overall.by) : null } : null,
    generatedAt: now,
    timeZone: term.workspace.timezone,
  };
}

/* ───── Families ───── */

export interface FamilyReport {
  termId: string;
  learnerId: string;
  title: string;
  startsOn: string;
  endsOn: string;
  workspaceName: string;
}

/** A student's released reports, newest first. Empty unless the viewer is their parent or the adult student. */
export async function releasedReportsFor(viewer: Viewer, userId: string): Promise<FamilyReport[]> {
  const learners = await prisma.learner.findMany({ where: { userId }, select: { id: true, workspaceId: true, userId: true, isMinor: true } });
  const allowed: typeof learners = [];
  for (const l of learners) if (await isFamily(viewer, l)) allowed.push(l);
  if (allowed.length === 0) return [];
  const terms = await prisma.reportTerm.findMany({
    where: { workspaceId: { in: allowed.map((l) => l.workspaceId) }, releasedAt: { not: null } },
    select: termSelect,
    orderBy: { startsOn: "desc" },
    take: 24,
  });
  const out = await Promise.all(
    terms.map(toTerm).flatMap((t) =>
      allowed
        .filter((l) => l.workspaceId === t.workspace.id)
        .map(async (l): Promise<FamilyReport | null> =>
          (await enrolmentsIn(t, { learnerId: l.id })).length > 0
            ? { termId: t.id, learnerId: l.id, title: t.title, startsOn: t.startsOn, endsOn: t.endsOn, workspaceName: t.workspace.name }
            : null,
        ),
    ),
  );
  return out.filter((r): r is FamilyReport => r !== null);
}
