/**
 * Tenancy integrity for courses. Read-only; safe on production.
 *
 *   npx tsx scripts/check-tenancy-parity.ts
 *
 * Until issue #93 step 5 this compared the new tables with the old
 * `Course.tutorId` column and the implicit `_CourseEnrollments` join. Its
 * last run, before those were dropped (10_drop_legacy_course_links), was
 * clean on production and Preview. Now that CourseStaff and Enrollment are
 * the only record, it checks that they are whole. For every course:
 *   - noWorkspace:        Course.workspaceId is set;
 *   - noOwner:            Course.ownerMembershipId is set, and that membership
 *                         is in the course's workspace;
 *   - noLeadStaff:        the owner has a LEAD CourseStaff row;
 *   - ownerNotTutor:      the owner's user has a Tutor profile, so tutorOf()
 *                         names a teacher on student pages;
 *   - enrolmentElsewhere: every open Enrollment is in the course's workspace,
 *                         for a learner of that workspace;
 *   - duplicateOpen:      no learner has two open Enrollments in one course.
 *
 * Prints counts and ids only, never names or emails. Exits 1 when anything
 * is wrong.
 */

import { PrismaClient } from "../src/generated/prisma";
import { ownerTutor, tutorOf } from "../src/features/courses/lib/tenancy-where";

const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ datasourceUrl: url });

async function main() {
  const [courses, memberships, learners, leads, openEnrollments] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, workspaceId: true, ownerMembershipId: true, ownerMembership: ownerTutor },
    }),
    prisma.membership.findMany({ select: { id: true, workspaceId: true } }),
    prisma.learner.findMany({ select: { id: true, workspaceId: true } }),
    prisma.courseStaff.findMany({ where: { role: "LEAD" }, select: { courseId: true, membershipId: true } }),
    prisma.enrollment.findMany({ where: { endedAt: null }, select: { courseId: true, learnerId: true, workspaceId: true } }),
  ]);

  const membershipWs = new Map(memberships.map((m) => [m.id, m.workspaceId]));
  const learnerWs = new Map(learners.map((l) => [l.id, l.workspaceId]));
  const leadSet = new Set(leads.map((s) => `${s.courseId}:${s.membershipId}`));
  const openByCourse = new Map<string, typeof openEnrollments>();
  for (const e of openEnrollments) openByCourse.set(e.courseId, [...(openByCourse.get(e.courseId) ?? []), e]);

  const problems = {
    noWorkspace: [] as string[],
    noOwner: [] as string[],
    noLeadStaff: [] as string[],
    ownerNotTutor: [] as string[],
    enrolmentElsewhere: [] as string[],
    duplicateOpen: [] as string[],
  };

  for (const c of courses) {
    if (!c.workspaceId) {
      problems.noWorkspace.push(c.id);
      continue;
    }
    const ws = c.workspaceId;
    if (!c.ownerMembershipId || membershipWs.get(c.ownerMembershipId) !== ws) problems.noOwner.push(c.id);
    if (!c.ownerMembershipId || !leadSet.has(`${c.id}:${c.ownerMembershipId}`)) problems.noLeadStaff.push(c.id);
    if (!tutorOf(c)) problems.ownerNotTutor.push(c.id);

    const open = openByCourse.get(c.id) ?? [];
    if (open.some((e) => e.workspaceId !== ws || learnerWs.get(e.learnerId) !== ws)) problems.enrolmentElsewhere.push(c.id);
    if (new Set(open.map((e) => e.learnerId)).size !== open.length) problems.duplicateOpen.push(c.id);
  }

  console.log(`courses ${courses.length}, open Enrollment rows ${openEnrollments.length}`);
  let bad = 0;
  for (const [name, ids] of Object.entries(problems)) {
    bad += ids.length;
    console.log(`${ids.length ? "BAD " : "OK  "}  ${name}: ${ids.length}${ids.length ? `  (${ids.join(", ")})` : ""}`);
  }
  console.log(bad ? "\nSome courses' tenancy rows are incomplete." : "\nEvery course has a workspace, an owner who teaches it and consistent enrolments.");
  return bad;
}

main()
  .then((bad) => prisma.$disconnect().then(() => process.exit(bad ? 1 : 0)))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(2);
  });
