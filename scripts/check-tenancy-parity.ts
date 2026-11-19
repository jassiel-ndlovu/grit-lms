/**
 * Tenancy parity (issue #93, step 3): do the new tables say the same as
 * the old columns? Read-only; safe on production.
 *
 *   npx tsx scripts/check-tenancy-parity.ts
 *
 * For every course it compares:
 *   - workspace:  Course.workspaceId is set;
 *   - owner:      Course.ownerMembershipId is the tutor's membership in that
 *                 workspace, and that membership has a LEAD CourseStaff row;
 *   - enrolments: the students in the implicit `_CourseEnrollments` join,
 *                 mapped Student → User → Learner (in the course's
 *                 workspace), equal the learners with an open Enrollment.
 *
 * Prints counts and course ids only, never names or emails. Exits 1 when
 * any course differs, so it can gate step 4 (moving the reads).
 */

import { PrismaClient } from "../src/generated/prisma";

const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ datasourceUrl: url });
const lower = (s: string) => s.trim().toLowerCase();

async function main() {
  const [courses, users, memberships, learners, staff, openEnrollments] = await Promise.all([
    prisma.course.findMany({
      select: {
        id: true,
        workspaceId: true,
        ownerMembershipId: true,
        tutor: { select: { userId: true, email: true } },
        students: { select: { id: true, userId: true, email: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.membership.findMany({ select: { id: true, workspaceId: true, userId: true } }),
    prisma.learner.findMany({ select: { id: true, workspaceId: true, userId: true } }),
    prisma.courseStaff.findMany({ where: { role: "LEAD" }, select: { courseId: true, membershipId: true } }),
    prisma.enrollment.findMany({ where: { endedAt: null }, select: { courseId: true, learnerId: true } }),
  ]);

  const userByEmail = new Map(users.map((u) => [lower(u.email), u.id]));
  const userOf = (p: { userId: string | null; email: string }) => p.userId ?? userByEmail.get(lower(p.email)) ?? null;
  const membershipOf = new Map(memberships.map((m) => [`${m.workspaceId}:${m.userId}`, m.id]));
  const learnerOf = new Map(learners.map((l) => [`${l.workspaceId}:${l.userId}`, l.id]));
  const leads = new Set(staff.map((s) => `${s.courseId}:${s.membershipId}`));
  const openByCourse = new Map<string, string[]>();
  for (const e of openEnrollments) openByCourse.set(e.courseId, [...(openByCourse.get(e.courseId) ?? []), e.learnerId]);

  const totals = { courses: courses.length, oldEnrolments: 0, openEnrollments: openEnrollments.length };
  const problems = {
    noWorkspace: [] as string[],
    ownerMismatch: [] as string[],
    noLeadStaff: [] as string[],
    studentWithoutLearner: [] as string[],
    missingEnrollment: [] as string[],
    extraEnrollment: [] as string[],
    duplicateOpen: [] as string[],
  };

  for (const c of courses) {
    totals.oldEnrolments += c.students.length;
    if (!c.workspaceId) {
      problems.noWorkspace.push(c.id);
      continue;
    }
    const ws = c.workspaceId;

    const tutorUser = userOf(c.tutor);
    const tutorMembership = tutorUser ? membershipOf.get(`${ws}:${tutorUser}`) ?? null : null;
    if (!tutorMembership || c.ownerMembershipId !== tutorMembership) problems.ownerMismatch.push(c.id);
    if (!c.ownerMembershipId || !leads.has(`${c.id}:${c.ownerMembershipId}`)) problems.noLeadStaff.push(c.id);

    const expected = new Set<string>();
    for (const s of c.students) {
      const u = userOf(s);
      const learner = u ? learnerOf.get(`${ws}:${u}`) : undefined;
      if (learner) expected.add(learner);
      else problems.studentWithoutLearner.push(c.id);
    }
    const open = openByCourse.get(c.id) ?? [];
    const openSet = new Set(open);
    if (openSet.size !== open.length) problems.duplicateOpen.push(c.id);
    if ([...expected].some((l) => !openSet.has(l))) problems.missingEnrollment.push(c.id);
    if ([...openSet].some((l) => !expected.has(l))) problems.extraEnrollment.push(c.id);
  }

  console.log(`courses ${totals.courses}, old enrolments ${totals.oldEnrolments}, open Enrollment rows ${totals.openEnrollments}`);
  let bad = 0;
  for (const [name, ids] of Object.entries(problems)) {
    const unique = [...new Set(ids)];
    bad += unique.length;
    console.log(`${unique.length ? "DIFF" : "OK  "}  ${name}: ${unique.length}${unique.length ? `  (${unique.join(", ")})` : ""}`);
  }
  console.log(bad ? "\nThe new tables differ from the old columns." : "\nParity: the new tables match the old columns.");
  return bad;
}

main()
  .then((bad) => prisma.$disconnect().then(() => process.exit(bad ? 1 : 0)))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(2);
  });
