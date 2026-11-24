/**
 * The course study assistant (#216 phase 3, Pro service `study-assistant`).
 * Paid by the student, never the tutor (owner, 24 Nov): each answer spends
 * the student's own STUDY credits, bought by them (an adult who pays) or a
 * parent (ai-credits/topups.ts). Needs billing on, so it opens in January.
 * Students (and parents, for a child) ask questions about a course; answers
 * come only from its lessons, with citations. Tutors of the course can read
 * every chat; a wellbeing or safety concern flags the chat and alerts them.
 * Contract: viewer.md, "Study assistant".
 */

import "server-only";

import { spendStudentCredits, studentCredits } from "@/features/ai-credits/topups";
import { creditsForCost } from "@/features/ai-credits/credits-math";
import { plainText } from "@/features/ai-assist/limits";
import { costMicroUsd } from "@/features/ai-marking/rules";
import { isBillingEnabled } from "@/features/billing/errors";
import { hasService } from "@/features/billing/services";
import { CURRICULUM_LABEL, subjectTitle } from "@/features/courses/lib/curriculum";
import { emitNotification } from "@/features/notifications/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";

import { askStudyModel, STUDY_MODEL } from "./study-model";
import { concernAction, pickMaterial, STUDY_LIMITS, validCitations, type LessonText } from "./study-rules";

const ZAR_PER_USD = Number(process.env.AI_USD_TO_ZAR ?? 18.5);
const DAY = 86_400_000;
export const STUDY_SERVICE = "study-assistant";
export const STUDY_UPSELL = "The study assistant is part of the Pro plan for this course.";
export const STUDY_NO_CREDITS = "You need study credits to ask the assistant. A parent (or you, if you pay your own fees) can buy them.";
export const STUDY_OFF = "Your tutor has switched the study assistant off for you on this course.";
export const STUDY_OFF_CHILD = "Their tutor has switched the study assistant off for them on this course.";
/** Credits an answer needs before it is asked (a typical answer costs less). */
const ANSWER_ESTIMATE = 40;

export function studyAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** The student the viewer is asking for: themselves, or a child (guardian). Must be enrolled. */
async function studentFor(viewer: Viewer, courseId: string, studentUserId?: string): Promise<string> {
  if (viewer.persona === "learner") {
    if (studentUserId && studentUserId !== viewer.user.id) throw new ViewerError("FORBIDDEN");
    if (!(await canIn(viewer, "content.view", { courseId }))) throw new ViewerError("FORBIDDEN");
    return viewer.user.id;
  }
  if (viewer.persona === "guardian") {
    if (!studentUserId || !viewer.children.some((c) => c.userId === studentUserId)) throw new ViewerError("FORBIDDEN");
    const e = await prisma.enrollment.findFirst({ where: { courseId, endedAt: null, learner: { userId: studentUserId } }, select: { id: true } });
    if (!e) throw new ViewerError("FORBIDDEN");
    return studentUserId;
  }
  throw new ViewerError("FORBIDDEN");
}

async function courseRow(courseId: string) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, workspaceId: true, curriculum: true, subject: true, gradeLevel: true } });
  if (!c?.workspaceId) throw new UserError("That course no longer exists.");
  return { ...c, workspaceId: c.workspaceId };
}

/** A tutor switched the assistant off for this student on this course (features/courses/study-switch.ts). */
async function isBlocked(courseId: string, studentUserId: string): Promise<boolean> {
  return (await prisma.studyAssistantBlock.count({ where: { courseId, studentUserId } })) > 0;
}

async function lessonsOf(courseId: string): Promise<LessonText[]> {
  const rows = await prisma.lesson.findMany({ where: { courseId }, orderBy: { order: "asc" }, take: 300, select: { id: true, title: true, description: true, order: true } });
  return rows.map((l, i) => ({ ref: `L${i + 1}`, id: l.id, title: l.title, text: plainText(l.description), order: l.order }));
}

/** Whether the viewer can use the assistant on this course, and how many questions are left today. */
export async function studyStatus(viewer: Viewer, input: { courseId: string; studentUserId?: string }, now: Date = new Date()) {
  const student = await studentFor(viewer, input.courseId, input.studentUserId);
  const onPlan = studyAssistantConfigured() && (await hasService(viewer, input.courseId, STUDY_SERVICE));
  const course = await courseRow(input.courseId);
  const credits = isBillingEnabled() ? Math.max(0, await studentCredits(course.workspaceId, student)) : 0;
  const used = await prisma.studyMessage.count({ where: { role: "USER", createdAt: { gte: new Date(now.getTime() - DAY) }, chat: { courseId: input.courseId, studentUserId: student } } });
  const blocked = onPlan && (await isBlocked(input.courseId, student));
  // Not before billing is on: students pay for their own answers.
  const reason = !onPlan ? "NOT_ON_PLAN" : blocked ? "OFF_FOR_STUDENT" : !isBillingEnabled() ? "COMING_SOON" : credits < ANSWER_ESTIMATE ? "NO_CREDITS" : null;
  return { available: reason === null, reason, credits, perDay: STUDY_LIMITS.perStudentDay, leftToday: Math.max(0, STUDY_LIMITS.perStudentDay - used), visibleToTutors: true };
}

export type StudyReply = {
  chatId: string;
  message: { id: string; content: string; citations: Array<{ ref: string; lessonId: string; title: string }>; outOfScope: boolean; createdAt: Date };
  leftToday: number;
};

/** Asks a question, in a new chat or an existing one (theirs). */
export async function askStudy(viewer: Viewer, input: { courseId: string; question: string; chatId?: string; studentUserId?: string }, now: Date = new Date()): Promise<StudyReply> {
  const question = input.question.trim();
  if (question.length < 2) throw new UserError("Ask a question first.");
  if (question.length > STUDY_LIMITS.questionChars) throw new UserError("That's a long question. Ask it in parts.");
  const student = await studentFor(viewer, input.courseId, input.studentUserId);
  if (!studyAssistantConfigured()) throw new UserError("The study assistant isn't switched on yet.");
  if (!(await hasService(viewer, input.courseId, STUDY_SERVICE))) throw new UserError(STUDY_UPSELL);
  if (await isBlocked(input.courseId, student)) throw new UserError(viewer.persona === "guardian" ? STUDY_OFF_CHILD : STUDY_OFF);
  const course = await courseRow(input.courseId);
  const used = await prisma.studyMessage.count({ where: { role: "USER", createdAt: { gte: new Date(now.getTime() - DAY) }, chat: { courseId: course.id, studentUserId: student } } });
  if (used >= STUDY_LIMITS.perStudentDay) throw new UserError(`That's ${STUDY_LIMITS.perStudentDay} questions in a day for this course. Try again tomorrow, or ask your tutor.`);
  if (!isBillingEnabled()) throw new UserError("The study assistant opens in January.");
  if ((await studentCredits(course.workspaceId, student)) < ANSWER_ESTIMATE) throw new UserError(STUDY_NO_CREDITS);

  let chat = input.chatId ? await prisma.studyChat.findUnique({ where: { id: input.chatId }, select: { id: true, courseId: true, studentUserId: true } }) : null;
  if (input.chatId && (!chat || chat.courseId !== course.id || chat.studentUserId !== student)) throw new UserError("That chat no longer exists.");
  chat ??= await prisma.studyChat.create({ data: { workspaceId: course.workspaceId, courseId: course.id, studentUserId: student, title: question.slice(0, 120) }, select: { id: true, courseId: true, studentUserId: true } });

  const [history, lessons, graded] = await Promise.all([
    prisma.studyMessage.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "desc" }, take: STUDY_LIMITS.historyTurns * 2, select: { role: true, content: true } }),
    lessonsOf(course.id),
    Promise.all([
      prisma.test.findMany({ where: { courseId: course.id, isActive: true, dueDate: { gte: new Date(now.getTime() - 7 * DAY) } }, select: { title: true }, take: 30 }),
      prisma.submission.findMany({ where: { courseId: course.id, isActive: { not: false }, dueDate: { gte: new Date(now.getTime() - 7 * DAY) } }, select: { title: true }, take: 30 }),
    ]),
  ]);
  const turns = history.reverse().map((h) => ({ role: h.role === "USER" ? ("user" as const) : ("assistant" as const), content: h.content }));
  const picked = pickMaterial(lessons, [question, ...turns.filter((t) => t.role === "user").map((t) => t.content)].join(" "));
  const level = [course.gradeLevel ? `Grade ${course.gradeLevel}` : null, course.curriculum ? CURRICULUM_LABEL[course.curriculum as keyof typeof CURRICULUM_LABEL] : null, subjectTitle(course.subject)].filter(Boolean).join(", ") || null;

  const userMsg = await prisma.studyMessage.create({ data: { chatId: chat.id, role: "USER", content: question }, select: { id: true } });
  const r = await askStudyModel({
    chatId: chat.id, courseName: course.name, level, lessons: picked.lessons,
    gradedWork: [...graded[0], ...graded[1]].map((g) => `- ${g.title}`), history: turns, question,
  });
  const micro = costMicroUsd(r.model, r.usage);
  const credits = micro > 0 ? creditsForCost(micro, ZAR_PER_USD) : 0;
  if (credits > 0) {
    await spendStudentCredits({ workspaceId: course.workspaceId, studentUserId: student, credits, ref: userMsg.id }).catch((e) => console.error("[study] spend failed:", e));
  }
  if (!r.ok) {
    const content = r.refused ? "I can't help with that one. Try asking about the course, or ask your tutor." : "Sorry, I couldn't answer just now. Try again in a moment.";
    const m = await prisma.studyMessage.create({ data: { chatId: chat.id, role: "ASSISTANT", content, credits, outOfScope: true }, select: { id: true, createdAt: true } });
    return { chatId: chat.id, message: { id: m.id, content, citations: [], outOfScope: true, createdAt: m.createdAt }, leftToday: STUDY_LIMITS.perStudentDay - used - 1 };
  }
  const citations = validCitations(r.data.citedRefs, picked.lessons);
  const m = await prisma.studyMessage.create({
    data: { chatId: chat.id, role: "ASSISTANT", content: r.data.answer.slice(0, 8000), citations: citations as unknown as Prisma.InputJsonValue, outOfScope: r.data.outOfScope, concern: r.data.concern, credits },
    select: { id: true, createdAt: true },
  });
  if (r.data.concern !== "none") await prisma.studyMessage.update({ where: { id: userMsg.id }, data: { concern: r.data.concern } });
  if (concernAction(r.data.concern) === "alert") {
    await prisma.studyChat.update({ where: { id: chat.id }, data: { flaggedAt: now } });
    const tutors = await prisma.courseStaff.findMany({ where: { courseId: course.id }, select: { membership: { select: { userId: true } } } });
    const ids = [...new Set(tutors.map((t) => t.membership.userId))];
    if (ids.length) {
      await emitNotification(
        { title: `A study chat in ${course.name} needs a look`.slice(0, 200), message: "Something a student wrote to the study assistant may mean they need support. Please read the chat.", type: "SYSTEM", userIds: ids, courseId: course.id, link: `/dashboard/courses/${course.id}/study-chats/${chat.id}`, priority: "HIGH" },
        { revalidate: false, email: true },
      ).catch(() => undefined);
    }
  }
  return { chatId: chat.id, message: { id: m.id, content: r.data.answer, citations, outOfScope: r.data.outOfScope, createdAt: m.createdAt }, leftToday: STUDY_LIMITS.perStudentDay - used - 1 };
}

/** The student's (or a parent's child's) chats in a course, newest first. */
export async function myStudyChats(viewer: Viewer, input: { courseId: string; studentUserId?: string }) {
  const student = await studentFor(viewer, input.courseId, input.studentUserId);
  return prisma.studyChat.findMany({ where: { courseId: input.courseId, studentUserId: student }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, updatedAt: true, createdAt: true } });
}

/** One chat: the student it belongs to, a parent of theirs, or a tutor of the course. */
export async function getStudyChat(viewer: Viewer, input: { chatId: string }) {
  const chat = await prisma.studyChat.findUnique({ where: { id: input.chatId }, select: { id: true, courseId: true, studentUserId: true, title: true, flaggedAt: true, createdAt: true } });
  if (!chat) throw new UserError("That chat no longer exists.");
  const own = viewer.user.id === chat.studentUserId || (viewer.persona === "guardian" && viewer.children.some((c) => c.userId === chat.studentUserId));
  const staff = (viewer.persona === "staff" || viewer.persona === "admin") && (await canIn(viewer, "content.view", { courseId: chat.courseId }));
  if (!own && !staff) throw new ViewerError("FORBIDDEN");
  const messages = await prisma.studyMessage.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, citations: true, outOfScope: true, concern: true, createdAt: true } });
  return { ...chat, flaggedAt: staff ? chat.flaggedAt : null, messages: messages.map((m) => ({ ...m, concern: staff ? m.concern : undefined })) };
}

/** Tutors: the course's chats, flagged first, with each student's name. */
export async function courseStudyChats(viewer: Viewer, input: { courseId: string; flaggedOnly?: boolean; limit?: number }) {
  if ((viewer.persona !== "staff" && viewer.persona !== "admin") || !(await canIn(viewer, "content.view", { courseId: input.courseId }))) throw new ViewerError("FORBIDDEN");
  const rows = await prisma.studyChat.findMany({
    where: { courseId: input.courseId, ...(input.flaggedOnly ? { flaggedAt: { not: null } } : {}) },
    orderBy: [{ flaggedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    take: Math.min(Math.max(input.limit ?? 100, 1), 300),
    select: { id: true, studentUserId: true, title: true, flaggedAt: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  const names = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentUserId))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({ id: r.id, studentUserId: r.studentUserId, studentName: names.get(r.studentUserId) ?? "", title: r.title, flaggedAt: r.flaggedAt, updatedAt: r.updatedAt, messages: r._count.messages }));
}

/** A tutor clears a flag after following up. */
export async function clearStudyFlag(viewer: Viewer, input: { chatId: string }) {
  const chat = await prisma.studyChat.findUnique({ where: { id: input.chatId }, select: { courseId: true } });
  if (!chat || (viewer.persona !== "staff" && viewer.persona !== "admin") || !(await canIn(viewer, "content.view", { courseId: chat.courseId }))) throw new ViewerError("FORBIDDEN");
  await prisma.studyChat.update({ where: { id: input.chatId }, data: { flaggedAt: null } });
  return { ok: true as const };
}

/** Housekeeping: chats older than a year are deleted. */
export async function pruneStudyChats(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.studyChat.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - STUDY_LIMITS.keepDays * DAY) } } });
  return count;
}

export { STUDY_MODEL };
