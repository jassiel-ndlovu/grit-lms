/**
 * Practice set reads (contracts/practice.md). Server only. Callers check
 * access first: course staff for the tutor shapes, enrolment for the
 * student ones, guardianship for the parent's.
 */

import "server-only";

import { cache } from "react";

import { hasService } from "@/features/billing/services";
import { enrolledStudent } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

import { summarise, type PracticeSummary } from "./lib/practice";

/** Practice sets draw on the bank, so they share its Plus service. */
export const hasPractice = cache(async (courseId: string): Promise<boolean> => {
  const viewer = await getViewer();
  return viewer ? hasService(viewer, courseId, "question-bank") : false;
});

/** The student's Practice tab: the service is on and something is published. */
export const studentHasPractice = cache(async (courseId: string): Promise<boolean> => {
  if (!(await hasPractice(courseId))) return false;
  return (await prisma.practiceSet.count({ where: { courseId, isPublished: true, items: { some: {} } } })) > 0;
});

const reviewSelect = {
  itemId: true, box: true, dueAt: true, lastAnsweredAt: true, answered: true, correct: true,
} as const;

/** A course's sets for its tutor, newest first, with how many students have practised. */
export async function listPracticeSets(courseId: string) {
  const sets = await prisma.practiceSet.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, isPublished: true, _count: { select: { items: true } } },
  });
  const reviews = await prisma.practiceReview.findMany({
    where: { item: { set: { courseId } } },
    select: { studentId: true, item: { select: { setId: true } } },
    distinct: ["itemId", "studentId"],
  });
  const students = new Map<string, Set<string>>();
  for (const r of reviews) {
    const seen = students.get(r.item.setId) ?? new Set<string>();
    seen.add(r.studentId);
    students.set(r.item.setId, seen);
  }
  return sets.map(({ _count, ...s }) => ({ ...s, questions: _count.items, students: students.get(s.id)?.size ?? 0 }));
}

/** One set with its questions, in order. */
export const getPracticeSet = cache(async (setId: string, courseId: string) =>
  prisma.practiceSet.findFirst({
    where: { id: setId, courseId },
    include: { items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  }),
);

/** Each student's standing on a set, for the tutor. */
export async function practiceByStudent(
  setId: string,
  items: Array<{ id: string }>,
  studentIds: string[],
  now: Date,
): Promise<Map<string, PracticeSummary>> {
  const reviews = await prisma.practiceReview.findMany({
    where: { item: { setId }, studentId: { in: studentIds } },
    select: { ...reviewSelect, studentId: true },
  });
  return new Map(studentIds.map((id) => [id, summarise(items, reviews.filter((r) => r.studentId === id), now)]));
}

/** Published sets on a course and where the student stands on each. */
export async function listPracticeForStudent(courseId: string, studentId: string, now: Date) {
  const sets = await prisma.practiceSet.findMany({
    where: { courseId, isPublished: true, items: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      items: { select: { id: true, reviews: { where: { studentId }, select: reviewSelect } } },
    },
  });
  return sets.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    summary: summarise(s.items, s.items.flatMap((i) => i.reviews), now),
  }));
}

/** A published set on a course the student is enrolled in, with their standing. */
export async function getPracticeForStudent(setId: string, courseId: string, studentId: string) {
  return prisma.practiceSet.findFirst({
    where: { id: setId, courseId, isPublished: true, course: enrolledStudent(studentId) },
    include: {
      items: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { reviews: { where: { studentId }, select: reviewSelect } },
      },
    },
  });
}

/** Practice per course for a parent: only courses the child has practised on. */
export async function practiceForChild(childUserId: string, now: Date) {
  const student = await prisma.student.findUnique({ where: { userId: childUserId }, select: { id: true } });
  if (!student) return [];
  const courses = await prisma.course.findMany({
    where: {
      ...enrolledStudent(student.id),
      practiceSets: { some: { isPublished: true, items: { some: { reviews: { some: { studentId: student.id } } } } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      practiceSets: {
        where: { isPublished: true },
        select: { items: { select: { id: true, reviews: { where: { studentId: student.id }, select: reviewSelect } } } },
      },
    },
  });
  return courses.map((c) => {
    const items = c.practiceSets.flatMap((s) => s.items);
    return { id: c.id, name: c.name, summary: summarise(items, items.flatMap((i) => i.reviews), now) };
  });
}
