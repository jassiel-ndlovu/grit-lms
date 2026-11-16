/**
 * Fill a NON-production database with obviously fake data.
 *
 *   SEED_USER_PASSWORD=... npx tsx scripts/seed-fake.ts           # empty database only
 *   SEED_USER_PASSWORD=... npx tsx scripts/seed-fake.ts --reset   # wipe fake data first
 *
 * What it creates: one tutor, 8 students ("Test Student 1" to 8), 2 courses,
 * 3 lessons each (one is a group heading), one test per course with three
 * questions, test submissions (graded and in progress) and one assignment per
 * course with a few entries. Every email ends in `@example.test`.
 *
 * Guards, checked before any query:
 *   1. Refuses when VERCEL_ENV is "production".
 *   2. Refuses when the database host is production's Neon endpoint, always.
 *   3. Runs when the host is the Neon `preview` branch's endpoint, or when
 *      SEED_FAKE_ALLOW=1 is set (any other non-production database, for
 *      example a local Postgres or the `dev` branch).
 *   4. Refuses if the database holds any user whose email is not
 *      `@example.test`, so a real database is never wiped by mistake.
 *
 * The password for every seeded user comes from SEED_USER_PASSWORD; it is
 * never in the repo. See docs/revamp/a/ops/preview-environment.md.
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

// Neon endpoint ids (not secrets). Project `grit-lms-sb`, wandering-leaf-52822886.
const PRODUCTION_ENDPOINTS = ["ep-aged-scene-a4fhpg0t"];
const PREVIEW_ENDPOINT = "ep-wandering-sea-a4bvyaiw";
const FAKE_DOMAIN = "@example.test";

export function checkTarget(
  url: string | undefined,
  env: Record<string, string | undefined>,
): { ok: true; host: string } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: "DATABASE_URL is not set." };
  if (env.VERCEL_ENV === "production") {
    return { ok: false, reason: "VERCEL_ENV is production." };
  }
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a valid URL." };
  }
  if (PRODUCTION_ENDPOINTS.some((ep) => host.includes(ep))) {
    return { ok: false, reason: `${host} is the production database.` };
  }
  if (host.includes(PREVIEW_ENDPOINT)) return { ok: true, host };
  if (env.SEED_FAKE_ALLOW === "1") return { ok: true, host };
  return {
    ok: false,
    reason: `${host} is not the preview branch. Set SEED_FAKE_ALLOW=1 to seed another non-production database.`,
  };
}

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day);

async function wipe(prisma: PrismaClient) {
  // Children first. Only reached after the "every user is fake" check.
  await prisma.questionGrade.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.uploadedFile.deleteMany();
  await prisma.assessmentCompletion.deleteMany();
  await prisma.testSubmission.deleteMany();
  await prisma.testQuestion.deleteMany();
  await prisma.test.deleteMany();
  await prisma.submissionEntry.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.lessonCompletion.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.lesson.updateMany({ data: { parentId: null } });
  await prisma.lesson.deleteMany();
  await prisma.courseEvent.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.user.deleteMany();
}

async function seed(prisma: PrismaClient, password: string) {
  const hash = await bcrypt.hash(password, 10);
  const verified = new Date();

  const tutorEmail = `test.tutor${FAKE_DOMAIN}`;
  await prisma.user.create({
    data: { name: "Test Tutor", email: tutorEmail, password: hash, role: "TUTOR", emailVerified: verified },
  });
  const tutor = await prisma.tutor.create({
    data: { fullName: "Test Tutor", email: tutorEmail, bio: "Fake tutor for preview deployments." },
  });

  const students = [];
  for (let i = 1; i <= 8; i++) {
    const email = `test.student${i}${FAKE_DOMAIN}`;
    await prisma.user.create({
      data: { name: `Test Student ${i}`, email, password: hash, role: "STUDENT", emailVerified: verified },
    });
    students.push(await prisma.student.create({ data: { fullName: `Test Student ${i}`, email } }));
  }

  const courseSpecs = [
    { name: "Test Course: Maths Grade 10", subject: "maths", enrol: students.slice(0, 6) },
    { name: "Test Course: Physical Sciences Grade 11", subject: "science", enrol: students.slice(3, 8) },
  ];

  for (const spec of courseSpecs) {
    const course = await prisma.course.create({
      data: {
        name: spec.name,
        description: "Fake course for preview deployments. Not real content.",
        imageUrl: "",
        tutorId: tutor.id,
        students: { connect: spec.enrol.map((s) => ({ id: s.id })) },
      },
    });

    const heading = await prisma.lesson.create({
      data: { title: "Test Unit 1", order: 0, courseId: course.id, type: "NONE" },
    });
    const lessons = [];
    for (let l = 1; l <= 2; l++) {
      lessons.push(
        await prisma.lesson.create({
          data: {
            title: `Test Lesson ${l}`,
            description: `Fake lesson ${l} for ${spec.subject}. Inline maths: \\(x^2 + ${l}x = 0\\).`,
            order: l - 1,
            courseId: course.id,
            parentId: heading.id,
            duration: 30,
          },
        }),
      );
    }
    for (const s of spec.enrol.slice(0, 3)) {
      await prisma.lessonCompletion.create({ data: { studentId: s.id, lessonId: lessons[0].id, completedAt: at(-1) } });
    }

    const test = await prisma.test.create({
      data: {
        title: "Test Quiz 1",
        description: "Fake test for preview deployments.",
        courseId: course.id,
        dueDate: at(7),
        timeLimit: 30,
        totalPoints: 6,
        releaseAutoMarksToStudent: true,
        questions: {
          create: [
            { order: 0, question: "What is 2 + 2?", type: "MULTIPLE_CHOICE", points: 2, options: ["3", "4", "5"], answer: "4", reorderItems: [] },
            { order: 1, question: "The sky is green.", type: "TRUE_FALSE", points: 2, options: [], answer: "false", reorderItems: [] },
            { order: 2, question: "Solve \\(2x = 10\\).", type: "NUMERIC", points: 2, options: [], answer: "5", reorderItems: [] },
          ],
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    const [q1, q2, q3] = test.questions;

    for (const [idx, s] of spec.enrol.entries()) {
      if (idx >= 4) break; // the rest have not started
      const graded = idx < 3;
      const right = idx; // 0..2 wrong answers, so scores differ
      const answers = { [q1.id]: right > 0 ? "3" : "4", [q2.id]: "false", [q3.id]: right > 1 ? "4" : "5" };
      const score = 6 - 2 * Math.min(right, 2);
      const sub = await prisma.testSubmission.create({
        data: {
          testId: test.id,
          studentId: s.id,
          startedAt: at(-2),
          submittedAt: graded ? at(-2 + 0.02) : null,
          answers,
          score: graded ? score : null,
          status: graded ? "GRADED" : "IN_PROGRESS",
        },
      });
      if (graded) {
        await prisma.grade.create({
          data: {
            studentId: s.id,
            courseId: course.id,
            type: "TEST",
            title: test.title,
            outOf: 6,
            score,
            testSubmissionId: sub.id,
          },
        });
      }
    }

    const assignment = await prisma.submission.create({
      data: {
        title: "Test Assignment 1",
        courseId: course.id,
        dueDate: at(3),
        createdAt: at(-5),
        fileType: "pdf",
        description: "Fake assignment for preview deployments.",
        descriptionFiles: [],
        totalPoints: 10,
      },
    });
    for (const s of spec.enrol.slice(0, 2)) {
      await prisma.submissionEntry.create({
        data: {
          studentId: s.id,
          submissionId: assignment.id,
          submittedAt: at(-1),
          attemptNumber: 1,
          status: "SUBMITTED",
          feedback: "",
          fileUrl: [],
        },
      });
    }
  }
}

async function main() {
  const reset = process.argv.includes("--reset");
  const target = checkTarget(process.env.DATABASE_URL, process.env);
  if (!target.ok) {
    console.error(`seed-fake: refusing to run. ${target.reason}`);
    process.exit(1);
  }
  const password = process.env.SEED_USER_PASSWORD;
  if (!password || password.length < 8) {
    console.error("seed-fake: set SEED_USER_PASSWORD (8 characters or more).");
    process.exit(1);
  }
  console.log(`seed-fake: target ${target.host}`);

  const prisma = new PrismaClient();
  try {
    const realUsers = await prisma.user.count({ where: { NOT: { email: { endsWith: FAKE_DOMAIN } } } });
    if (realUsers > 0) {
      console.error(`seed-fake: refusing. ${realUsers} user(s) without an ${FAKE_DOMAIN} email exist here.`);
      process.exit(1);
    }
    const existing = await prisma.user.count();
    if (existing > 0 && !reset) {
      console.error(`seed-fake: ${existing} fake user(s) already exist. Re-run with --reset to wipe and reseed.`);
      process.exit(1);
    }
    if (reset) await wipe(prisma);
    await seed(prisma, password);
    const counts = {
      users: await prisma.user.count(),
      courses: await prisma.course.count(),
      lessons: await prisma.lesson.count(),
      tests: await prisma.test.count(),
      testSubmissions: await prisma.testSubmission.count(),
      assignmentEntries: await prisma.submissionEntry.count(),
    };
    console.log("seed-fake: done", counts);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
