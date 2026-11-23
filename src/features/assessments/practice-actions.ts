"use server";

/**
 * Practice set actions (contracts/practice.md). Tutors build sets from
 * their question bank; students answer and the server marks and schedules.
 * Plus service "question-bank", checked on the course. Nothing here touches
 * the gradebook.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCourseScope } from "@/features/courses/course-access";
import { managesCourse } from "@/features/courses/lib/course-access";
import { enrolledStudent, courseAccessSelect } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { studentActionClient, tutorActionClient } from "@/lib/safe-action";
import { UserError } from "@/lib/user-error";

import { checkMaths } from "./lib/maths-check";
import { canPractise, markPractice, nextReview, practiceKeys, withSelfMark } from "./lib/practice";
import { readBankNode } from "./lib/question-bank";
import { hasPractice } from "./practice-queries";

const NOT_ON_PLAN = "Practice sets are part of the Plus plan for this course";
const GONE = "This practice set is no longer there";
/** Questions in one set. */
const MAX_ITEMS = 200;

const id = z.string().min(1).max(40);
const title = z.string().trim().min(1, "Give the set a name").max(120);
const description = z.string().trim().max(500).nullable();

// Outside the action: Next reads a function inside an exported action as another action.
function shortEnough(answers: Record<string, unknown>): boolean {
  return JSON.stringify(answers).length <= 20_000;
}
const answersSchema = z.record(z.string().max(60), z.unknown()).refine(shortEnough, "That answer is too long");

type User = { id: string; email: string };

/** The course, when the user manages it and it has practice sets. */
async function practiceCourse(courseId: string, user: User) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, ...courseAccessSelect(user.email) },
  });
  if (!course || !course.workspaceId || !managesCourse(await getCourseScope(user.id), course)) {
    throw new UserError("Course not found");
  }
  if (!(await hasPractice(course.id))) throw new UserError(NOT_ON_PLAN);
  return { id: course.id, workspaceId: course.workspaceId };
}

/** A set on a course the user manages. */
async function ownSet(setId: string, user: User) {
  const set = await prisma.practiceSet.findUnique({ where: { id: setId }, select: { id: true, courseId: true } });
  if (!set) throw new UserError(GONE);
  const course = await practiceCourse(set.courseId, user);
  return { ...set, workspaceId: course.workspaceId };
}

function refresh(courseId: string) {
  revalidatePath(`/dashboard/manage-courses/${courseId}/practice`, "layout");
  revalidatePath(`/dashboard/courses/${courseId}/practice`, "layout");
}

export const createPracticeSet = tutorActionClient
  .schema(z.object({ courseId: id, title }))
  .action(async ({ parsedInput, ctx }) => {
    const course = await practiceCourse(parsedInput.courseId, ctx.session.user);
    const set = await prisma.practiceSet.create({
      data: { courseId: course.id, title: parsedInput.title, createdByUserId: ctx.session.user.id },
      select: { id: true },
    });
    refresh(course.id);
    return set;
  });

export const updatePracticeSet = tutorActionClient
  .schema(z.object({ id, title: title.optional(), description: description.optional(), isPublished: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const set = await ownSet(parsedInput.id, ctx.session.user);
    if (parsedInput.isPublished && (await prisma.practiceItem.count({ where: { setId: set.id } })) === 0) {
      throw new UserError("Add a question before publishing the set");
    }
    await prisma.practiceSet.update({
      where: { id: set.id },
      data: {
        title: parsedInput.title,
        description: parsedInput.description === undefined ? undefined : parsedInput.description || null,
        isPublished: parsedInput.isPublished,
      },
    });
    refresh(set.courseId);
    return { ok: true };
  });

/** Deletes the set, its questions and students' progress on them. */
export const deletePracticeSet = tutorActionClient.schema(z.object({ id })).action(async ({ parsedInput, ctx }) => {
  const set = await ownSet(parsedInput.id, ctx.session.user);
  await prisma.practiceSet.delete({ where: { id: set.id } });
  refresh(set.courseId);
  return { courseId: set.courseId };
});

/** Copies bank questions into the set. Ones already in it, or that can't be marked automatically, are skipped. */
export const addPracticeItems = tutorActionClient
  .schema(z.object({ setId: id, bankIds: z.array(id).min(1).max(100) }))
  .action(async ({ parsedInput, ctx }) => {
    const set = await ownSet(parsedInput.setId, ctx.session.user);
    const [bank, existing] = await Promise.all([
      prisma.bankQuestion.findMany({
        where: { id: { in: parsedInput.bankIds }, workspaceId: set.workspaceId, ownerUserId: ctx.session.user.id },
      }),
      prisma.practiceItem.findMany({ where: { setId: set.id }, select: { order: true, bankQuestionId: true } }),
    ]);
    const have = new Set(existing.map((i) => i.bankQuestionId));
    const byId = new Map(bank.map((b) => [b.id, b]));
    let order = existing.reduce((n, i) => Math.max(n, i.order + 1), 0);
    const data = parsedInput.bankIds.flatMap((bankId) => {
      const b = byId.get(bankId);
      const node = b ? readBankNode(b.data) : null;
      if (!b || !node || have.has(b.id) || !canPractise(node)) return [];
      have.add(b.id);
      return [{ setId: set.id, order: order++, stem: b.stem, topics: b.topics, data: node as object, bankQuestionId: b.id }];
    });
    if (existing.length + data.length > MAX_ITEMS) throw new UserError(`A practice set holds at most ${MAX_ITEMS} questions`);
    if (data.length) await prisma.practiceItem.createMany({ data });
    refresh(set.courseId);
    return { added: data.length, skipped: new Set(parsedInput.bankIds).size - data.length };
  });

/** Removes a question and students' progress on it. Unpublishes a set left empty. */
export const removePracticeItem = tutorActionClient.schema(z.object({ id })).action(async ({ parsedInput, ctx }) => {
  const item = await prisma.practiceItem.findUnique({ where: { id: parsedInput.id }, select: { id: true, setId: true } });
  if (!item) throw new UserError("That question is already gone");
  const set = await ownSet(item.setId, ctx.session.user);
  await prisma.practiceItem.delete({ where: { id: item.id } });
  if ((await prisma.practiceItem.count({ where: { setId: set.id } })) === 0) {
    await prisma.practiceSet.update({ where: { id: set.id }, data: { isPublished: false } });
  }
  refresh(set.courseId);
  return { ok: true };
});

/**
 * Marks a student's answer and schedules the question's return. A maths
 * answer the checker can't decide is not saved: the student compares it
 * with the answer and sends it again with `selfMark`.
 */
export const answerPractice = studentActionClient
  .schema(
    z.object({
      itemId: id,
      answers: answersSchema,
      selfMark: z.boolean().optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const student = await prisma.student.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!student) throw new UserError("No student profile found for this account");
    const item = await prisma.practiceItem.findFirst({
      where: { id: parsedInput.itemId, set: { isPublished: true, course: enrolledStudent(student.id) } },
      select: { id: true, data: true, set: { select: { courseId: true } } },
    });
    const node = item ? readBankNode(item.data) : null;
    if (!item || !node) throw new UserError("This question is no longer in the practice set");
    if (!(await hasPractice(item.set.courseId))) throw new UserError("Practice isn't available on this course right now");

    let mark = markPractice(node, parsedInput.answers, checkMaths);
    const keys = practiceKeys(node);
    if (mark.undecided) {
      if (parsedInput.selfMark === undefined) return { ...mark, keys, saved: false as const };
      mark = withSelfMark(node, mark, parsedInput.selfMark);
    }

    const now = new Date();
    const where = { itemId_studentId: { itemId: item.id, studentId: student.id } };
    const prev = await prisma.practiceReview.findUnique({ where, select: { box: true, dueAt: true } });
    const next = nextReview(prev, mark.share, now);
    const right = mark.share >= 1 ? 1 : 0;
    await prisma.practiceReview.upsert({
      where,
      create: {
        itemId: item.id, studentId: student.id, ...next, lastAnsweredAt: now, lastShare: mark.share, answered: 1, correct: right,
      },
      update: { ...next, lastAnsweredAt: now, lastShare: mark.share, answered: { increment: 1 }, correct: { increment: right } },
    });
    return { ...mark, keys, saved: true as const, dueAt: next.dueAt.toISOString() };
  });
