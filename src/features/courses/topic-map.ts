import "server-only";

/**
 * The topic map's data. Callers have checked who may see the course (and,
 * for a learner, that they are enrolled). A learner's marks are released
 * ones only (grades/lib/release.ts); a class's are the marked scripts.
 */

import { cache } from "react";

import { prisma } from "@/lib/db";

import { topicsFor } from "./lib/curriculum";
import { classTopics, learnerTopics, type TopicNode } from "./lib/topic-map";

const courseTopics = cache(async (courseId: string) => {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { curriculum: true, subject: true, gradeLevel: true } });
  return course ? topicsFor(course) : [];
});

/** Whether the course has a curriculum, so the Topics view shows. */
export async function courseHasTopics(courseId: string): Promise<boolean> {
  return (await courseTopics(courseId)).length > 0;
}

async function taggedWork(courseId: string) {
  const [lessons, questions] = await Promise.all([
    prisma.lesson.findMany({ where: { courseId, type: "CONTENT" }, select: { id: true, topics: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.testQuestion.findMany({ where: { test: { courseId }, type: { not: "NONE" } }, select: { id: true, topics: true } }),
  ]);
  return { lessons, questions };
}

type Where = NonNullable<Parameters<typeof prisma.questionGrade.findMany>[0]>["where"];

async function marksFor(where: Where, questions: ReadonlyArray<{ id: string; topics: string[] }>) {
  const topicsOf = new Map(questions.filter((q) => q.topics.length > 0).map((q) => [q.id, q.topics]));
  if (topicsOf.size === 0) return [];
  const rows = await prisma.questionGrade.findMany({
    where: { ...where, questionId: { in: [...topicsOf.keys()] } },
    select: { questionId: true, score: true, outOf: true },
  });
  return rows.map((r) => ({ topics: topicsOf.get(r.questionId!) ?? [], score: r.score, outOf: r.outOf }));
}

/** One learner's map, and their next lesson on each topic. */
export async function learnerTopicMap(studentId: string, courseId: string): Promise<{ nodes: TopicNode[]; nextLesson: Record<string, string | undefined> }> {
  const topics = await courseTopics(courseId);
  if (topics.length === 0) return { nodes: [], nextLesson: {} };
  const [{ lessons, questions }, completions] = await Promise.all([
    taggedWork(courseId),
    prisma.lessonCompletion.findMany({ where: { studentId, lesson: { courseId } }, select: { lessonId: true } }),
  ]);
  const marks = await marksFor(
    { testSubmission: { studentId, OR: [{ status: "GRADED" }, { test: { releaseAutoMarksToStudent: true } }] } },
    questions,
  );
  const done = new Set(completions.map((c) => c.lessonId));
  const nextLesson = Object.fromEntries(
    topics.map((t) => {
      const ls = lessons.filter((l) => l.topics.includes(t.code));
      return [t.code, (ls.find((l) => !done.has(l.id)) ?? ls[0])?.id];
    }),
  );
  return { nodes: learnerTopics(topics, lessons, done, marks), nextLesson };
}

/** The class's map, for the course's staff. */
export async function classTopicMap(courseId: string): Promise<TopicNode[]> {
  const topics = await courseTopics(courseId);
  if (topics.length === 0) return [];
  const { lessons, questions } = await taggedWork(courseId);
  const marks = await marksFor({ testSubmission: { status: "GRADED" } }, questions);
  return classTopics(topics, lessons, questions, marks);
}
