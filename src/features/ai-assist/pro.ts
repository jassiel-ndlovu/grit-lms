/**
 * Pro AI drafts (#216 phase 3; owner, 22 Nov: "Pro gets all of it").
 * Everything is a draft for the tutor; nothing here writes to courses,
 * lessons, tests, grades or reports. Gates, caps, credits and run records
 * are shared with ./assist.ts. Contract: viewer.md, "AI help for tutors".
 */

import "server-only";

import { scrubIdentifiers } from "@/features/ai-marking/rules";
import { topicsFor } from "@/features/courses/lib/curriculum";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import type { Viewer } from "@/lib/viewer";

import { contextFor, failed, gate, newRunId, readUpload, record } from "./assist";
import { AI_ASSIST_INPUT, uncoveredTopics, type Allowance } from "./limits";
import { draftFeedback, draftGaps, draftLessons, draftReportComments, type DraftLessons, type ReportStudentData } from "./model-pro";

const after = (a: Allowance): Allowance => ({ ...a, used: a.used + 1, left: Math.max(0, a.left - 1) });

/* ------------------------------------------------------------------------- */

export type LessonsDraft = { runId: string; drafts: DraftLessons; allowance: Allowance };

/** Lessons (and optionally tests and assignments) from pasted text or an uploaded PDF. */
export async function lessonsFromDocument(
  viewer: Viewer,
  input: { courseId: string; text?: string; fileUrl?: string; lessons: number; tests: number; questionsPerTest: number; assignments: number; focus?: string },
  now: Date = new Date(),
): Promise<LessonsDraft> {
  if (!input.text?.trim() && !input.fileUrl) throw new UserError("Paste the document's text or upload a PDF.");
  if (input.text && input.text.length > AI_ASSIST_INPUT.documentChars) throw new UserError("That's too much text at once. Use one chapter or unit.");
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.trunc(n), lo), hi);
  const lessons = clamp(input.lessons, 1, 8), tests = clamp(input.tests, 0, 2), per = clamp(input.questionsPerTest, 1, 10), assignments = clamp(input.assignments, 0, 2);
  const { course, allowance: a } = await gate(viewer, input.courseId, "LESSONS", now);
  const file = input.fileUrl ? await readUpload(input.fileUrl) : { pdfBase64: null, text: null };
  const runId = newRunId();
  const ctx = contextFor(course);
  const r = await draftLessons(runId, {
    context: ctx, text: [input.text?.trim(), file.text].filter(Boolean).join("\n\n") || null, pdfBase64: file.pdfBase64,
    lessons, tests, questionsPerTest: per, assignments, focus: input.focus?.trim().slice(0, 300) || null,
  });
  await record(viewer, course, "LESSONS", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const codes = new Set(ctx.topics.map((t) => t.code));
  const d = r.data;
  const drafts: DraftLessons = {
    lessons: d.lessons.slice(0, lessons).map((l) => ({ ...l, topicCodes: l.topicCodes.filter((c) => codes.has(c)) })),
    tests: d.tests.slice(0, tests).map((t) => ({
      ...t,
      questions: t.questions.slice(0, per).map((q) => ({
        ...q,
        points: Math.min(Math.max(Math.round(q.points), 1), 20),
        topicCodes: q.topicCodes.filter((c) => codes.has(c)),
        correctOptions: q.correctOptions.filter((i) => i >= 0 && i < q.options.length),
      })),
    })),
    assignments: d.assignments.slice(0, assignments).map((x) => ({ ...x, rubric: x.rubric.slice(0, 10).map((c) => ({ ...c, points: Math.min(Math.max(Math.round(c.points), 0), 100) })) })),
    note: d.note,
  };
  return { runId, drafts, allowance: after(a) };
}

/* ------------------------------------------------------------------------- */

export type FeedbackDraft = { runId: string; feedback: string; strengths: string[]; nextSteps: string[]; suggestedMark: number | null; allowance: Allowance };

/**
 * Feedback on one long answer. B passes the text the tutor is looking at;
 * names, emails, phone and ID numbers are scrubbed before it is sent
 * (`studentUserId` gives the name to scrub).
 */
export async function feedbackDraft(
  viewer: Viewer,
  input: { courseId: string; question: string; answer: string; memo?: string; maxPoints?: number; tone?: "warm" | "direct"; studentUserId?: string },
  now: Date = new Date(),
): Promise<FeedbackDraft> {
  const answer = input.answer.trim();
  if (answer.length < 10) throw new UserError("The answer is too short for feedback.");
  if (answer.length > AI_ASSIST_INPUT.answerChars) throw new UserError("That answer is too long for one draft.");
  const { course, allowance: a } = await gate(viewer, input.courseId, "FEEDBACK", now);
  const names = [viewer.user.name];
  if (input.studentUserId) {
    const s = await prisma.user.findUnique({ where: { id: input.studentUserId }, select: { name: true } });
    if (s) names.push(s.name);
  }
  const runId = newRunId();
  const max = input.maxPoints != null && Number.isFinite(input.maxPoints) && input.maxPoints > 0 ? input.maxPoints : null;
  const r = await draftFeedback(runId, {
    context: contextFor(course), question: input.question.slice(0, 6000), memo: input.memo?.slice(0, 6000) || null,
    answer: scrubIdentifiers(answer, names), maxPoints: max, tone: input.tone ?? "warm",
  });
  await record(viewer, course, "FEEDBACK", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const mark = max != null && r.data.suggestedMark != null ? Math.min(Math.max(r.data.suggestedMark, 0), max) : null;
  return { runId, feedback: r.data.feedback, strengths: r.data.strengths.slice(0, 3), nextSteps: r.data.nextSteps.slice(0, 3), suggestedMark: mark, allowance: after(a) };
}

/* ------------------------------------------------------------------------- */

export type ReportCommentDraft = { learnerId: string; studentUserId: string; name: string; comment: string };

/**
 * One comment per student for a term, from their marks, attendance and
 * missed work in the course between `from` and `to`. Students are sent as
 * S1, S2… and the comment comes back with [NAME], which is replaced here
 * with their first name. Up to 40 students a run.
 */
export async function reportCommentDrafts(
  viewer: Viewer,
  input: { courseId: string; from: Date; to: Date; term: string; learnerIds?: string[]; notes?: Record<string, string>; tone?: "warm" | "formal" },
  now: Date = new Date(),
): Promise<{ runId: string; comments: ReportCommentDraft[]; allowance: Allowance }> {
  if (!(input.to > input.from)) throw new UserError("The term must end after it starts.");
  const { course, allowance: a } = await gate(viewer, input.courseId, "REPORT_COMMENTS", now);
  const enrolments = await prisma.enrollment.findMany({
    where: { courseId: course.id, endedAt: null, ...(input.learnerIds?.length ? { learnerId: { in: input.learnerIds } } : {}) },
    select: { learner: { select: { id: true, userId: true, user: { select: { name: true, studentProfile: { select: { id: true } } } } } } },
    take: AI_ASSIST_INPUT.reportStudents + 1,
  });
  if (!enrolments.length) throw new UserError("There are no students to write comments for.");
  if (enrolments.length > AI_ASSIST_INPUT.reportStudents) throw new UserError(`Choose up to ${AI_ASSIST_INPUT.reportStudents} students at a time.`);
  const students = enrolments.map((e, i) => ({ ref: `S${i + 1}`, learnerId: e.learner.id, userId: e.learner.userId, name: e.learner.user.name, profileId: e.learner.user.studentProfile?.id ?? null }));
  const profileIds = students.flatMap((s) => (s.profileId ? [s.profileId] : []));
  const range = { gte: input.from, lt: input.to };
  const [grades, attendance, tests, assignments] = await Promise.all([
    prisma.grade.findMany({ where: { courseId: course.id, studentId: { in: profileIds }, createdAt: range, outOf: { gt: 0 } }, orderBy: { createdAt: "asc" }, select: { studentId: true, title: true, score: true, outOf: true } }),
    prisma.sessionAttendance.groupBy({ by: ["learnerId", "status"], where: { learnerId: { in: students.map((s) => s.learnerId) }, occurrenceStart: range, event: { courseId: course.id } }, _count: true }),
    prisma.test.findMany({ where: { courseId: course.id, isActive: true, dueDate: { ...range, lt: new Date(Math.min(input.to.getTime(), now.getTime())) } }, select: { submissions: { where: { studentId: { in: profileIds }, status: { not: "IN_PROGRESS" } }, select: { studentId: true } } } }),
    prisma.submission.findMany({ where: { courseId: course.id, isActive: { not: false }, dueDate: { ...range, lt: new Date(Math.min(input.to.getTime(), now.getTime())) } }, select: { entries: { where: { studentId: { in: profileIds } }, select: { studentId: true } } } }),
  ]);
  const scrubNames = [viewer.user.name, ...students.map((s) => s.name)];
  const data: ReportStudentData[] = students.map((s) => {
    const marks = s.profileId ? grades.filter((g) => g.studentId === s.profileId).map((g) => ({ title: scrubIdentifiers(g.title, scrubNames).slice(0, 80), percent: Math.round((g.score / g.outOf) * 100) })) : [];
    const count = (st: string) => attendance.find((x) => x.learnerId === s.learnerId && x.status === st)?._count ?? 0;
    const missed = s.profileId ? tests.filter((t) => !t.submissions.some((x) => x.studentId === s.profileId)).length + assignments.filter((x) => !x.entries.some((e) => e.studentId === s.profileId)).length : 0;
    const note = input.notes?.[s.learnerId]?.trim();
    return {
      ref: s.ref,
      average: marks.length ? Math.round(marks.reduce((n, m) => n + m.percent, 0) / marks.length) : null,
      marks: marks.slice(-12),
      attendance: { present: count("PRESENT"), late: count("LATE"), absent: count("ABSENT"), excused: count("EXCUSED") },
      missed,
      tutorNote: note ? scrubIdentifiers(note, scrubNames).slice(0, 300) : null,
    };
  });
  const runId = newRunId();
  const r = await draftReportComments(runId, { context: contextFor(course), term: input.term.slice(0, 80), students: data, tone: input.tone ?? "warm" });
  await record(viewer, course, "REPORT_COMMENTS", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const byRef = new Map(r.data.comments.map((c) => [c.ref, c.comment]));
  const comments = students.map((s) => ({
    learnerId: s.learnerId, studentUserId: s.userId, name: s.name,
    comment: (byRef.get(s.ref) ?? "").replace(/\[NAME\]/g, s.name.trim().split(/\s+/)[0] || s.name),
  }));
  return { runId, comments, allowance: after(a) };
}

/* ------------------------------------------------------------------------- */

export type GapsDraft = {
  runId: string | null;
  curriculum: boolean;
  covered: number;
  total: number;
  missing: Array<{ code: string; title: string; suggestion: string; lessonId: string | null; lessonTitle: string | null; newLessonTitle: string | null }>;
  restructure: Array<{ suggestion: string; why: string }>;
  note: string;
  allowance: Allowance;
};

/**
 * Which curriculum topics the course's lessons and questions don't tag yet,
 * and where the AI suggests covering them, plus up to five ordering changes.
 * Needs the course's curriculum, subject and grade (contracts/curriculum.md).
 */
export async function curriculumGaps(viewer: Viewer, input: { courseId: string }, now: Date = new Date()): Promise<GapsDraft> {
  const { course, allowance: a } = await gate(viewer, input.courseId, "GAPS", now);
  const all = topicsFor({ curriculum: course.curriculum as never, subject: course.subject, gradeLevel: course.gradeLevel });
  if (!all.length) throw new UserError("Set the course's curriculum, subject and grade first.");
  const [lessons, questions] = await Promise.all([
    prisma.lesson.findMany({ where: { courseId: course.id }, orderBy: { order: "asc" }, take: 200, select: { id: true, title: true, topics: true } }),
    prisma.testQuestion.findMany({ where: { test: { courseId: course.id } }, select: { topics: true } }),
  ]);
  const uncovered = uncoveredTopics(all, [...lessons.map((l) => l.topics), ...questions.map((q) => q.topics)]);
  const refs = lessons.map((l, i) => ({ ref: `L${i + 1}`, id: l.id, title: l.title, topics: l.topics }));
  const runId = newRunId();
  const r = await draftGaps(runId, { context: contextFor(course), lessons: refs.map((l) => ({ ref: l.ref, title: l.title, topics: l.topics })), uncovered: uncovered.map((t) => ({ code: t.code, title: t.title })) });
  await record(viewer, course, "GAPS", a.tier, runId, r, now);
  if (!r.ok) failed(r);
  const byCode = new Map(uncovered.map((t) => [t.code, t]));
  const missing = r.data.missing.flatMap((m) => {
    const t = byCode.get(m.code);
    if (!t) return [];
    const lesson = m.lessonRef ? refs.find((l) => l.ref === m.lessonRef) ?? null : null;
    return [{ code: t.code, title: t.title, suggestion: m.suggestion, lessonId: lesson?.id ?? null, lessonTitle: lesson?.title ?? null, newLessonTitle: lesson ? null : m.newLessonTitle }];
  });
  // Any uncovered topic the model skipped still shows, without a suggestion.
  for (const t of uncovered) if (!missing.some((m) => m.code === t.code)) missing.push({ code: t.code, title: t.title, suggestion: "", lessonId: null, lessonTitle: null, newLessonTitle: null });
  return { runId, curriculum: true, covered: all.length - uncovered.length, total: all.length, missing, restructure: r.data.restructure.slice(0, 5), note: r.data.note, allowance: after(a) };
}
