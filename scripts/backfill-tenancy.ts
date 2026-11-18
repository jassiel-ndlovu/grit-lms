/**
 * Phase 1, part 1 backfill: moves today's users into tenancy
 * (docs/revamp/a/design/01-tenancy-roles.md, section 8).
 *
 *   npx tsx scripts/backfill-tenancy.ts                      # dry run: counts only
 *   npx tsx scripts/backfill-tenancy.ts --apply --owner-email=<owner>
 *
 * What it does (idempotent, safe to re-run):
 *   1. Workspace `ws_nexa_legacy` (ORGANISATION "Nexa", slug "nexa",
 *      billing COMPED), the id the Phase 0 viewer bridge already uses.
 *   2. Tutor.userId and Student.userId set by matching email
 *      (case-insensitive). Profiles with no matching user are reported, not
 *      guessed.
 *   3. Every TUTOR user becomes a Membership: OWNER for --owner-email,
 *      ADMIN for the rest (design 01 §8, step 2).
 *   4. Every STUDENT user becomes a Learner (isMinor true; tutors change it).
 *   5. Every ADMIN user gets platformRole NEXA_ADMIN.
 *   PARENT users need nothing: no guardian links exist yet.
 *
 * Part 2 (needs 6_tenancy_courses):
 *   6. Every Course gets workspaceId = the legacy workspace.
 *   7. Course.ownerMembershipId = its tutor's membership, plus a CourseStaff
 *      LEAD row (design 01 §8, step 3).
 *   8. Each student in the implicit CourseEnrollments join becomes an ACTIVE
 *      Enrollment starting at the course's createdAt (the real join date was
 *      never stored). Skipped when that course and learner already have one.
 *
 * Prints counts only, never names or emails. Refuses production's endpoint
 * unless --allow-production is given: running it there needs the owner's
 * approval (AGENTS.md section 4).
 */

import { PrismaClient } from "../src/generated/prisma";

const PRODUCTION_ENDPOINTS = ["ep-aged-scene-a4fhpg0t"];
const WORKSPACE_ID = "ws_nexa_legacy";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowProduction = args.includes("--allow-production");
const ownerEmail = args.find((a) => a.startsWith("--owner-email="))?.split("=")[1]?.toLowerCase() ?? null;

const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL is not set");
if (PRODUCTION_ENDPOINTS.some((e) => url.includes(e)) && !allowProduction) {
  throw new Error("This is production. Re-run with --allow-production once the owner has approved.");
}

const prisma = new PrismaClient({ datasourceUrl: url });
const lower = (s: string) => s.trim().toLowerCase();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, platformRole: true } });
  const byEmail = new Map(users.map((u) => [lower(u.email), u]));
  if (ownerEmail && !byEmail.has(ownerEmail)) throw new Error("--owner-email does not match any user");

  const tutors = await prisma.tutor.findMany({ select: { id: true, email: true, userId: true } });
  const students = await prisma.student.findMany({ select: { id: true, email: true, userId: true } });

  const tutorLinks = tutors.filter((t) => !t.userId && byEmail.has(lower(t.email)));
  const studentLinks = students.filter((s) => !s.userId && byEmail.has(lower(s.email)));
  const unmatched = {
    tutors: tutors.filter((t) => !byEmail.has(lower(t.email))).length,
    students: students.filter((s) => !byEmail.has(lower(s.email))).length,
  };

  const tutorUsers = users.filter((u) => u.role === "TUTOR");
  const studentUsers = users.filter((u) => u.role === "STUDENT");
  const adminUsers = users.filter((u) => u.role === "ADMIN" && u.platformRole !== "NEXA_ADMIN");

  const existingMembers = new Set(
    (await prisma.membership.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { userId: true } })).map((m) => m.userId),
  );
  const existingLearners = new Set(
    (await prisma.learner.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { userId: true } })).map((l) => l.userId),
  );

  // Part 2: courses, staff and enrollments
  const courses = await prisma.course.findMany({
    select: { id: true, createdAt: true, workspaceId: true, ownerMembershipId: true, tutor: { select: { userId: true, email: true } }, students: { select: { userId: true, email: true } } },
  });
  const memberships = new Map(
    (await prisma.membership.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true, userId: true } })).map((m) => [m.userId, m.id]),
  );
  const learnerIds = new Map(
    (await prisma.learner.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true, userId: true } })).map((l) => [l.userId, l.id]),
  );
  const existingEnrollments = new Set(
    (await prisma.enrollment.findMany({ select: { courseId: true, learnerId: true } })).map((e) => `${e.courseId}:${e.learnerId}`),
  );
  const existingStaff = new Set(
    (await prisma.courseStaff.findMany({ select: { courseId: true, membershipId: true } })).map((c) => `${c.courseId}:${c.membershipId}`),
  );
  // Users are resolved by email here too, so a dry run before the part 1
  // links works; after --apply the userId links and learners exist.
  const userIdOf = (p: { userId: string | null; email: string }) => p.userId ?? byEmail.get(lower(p.email))?.id ?? null;
  const coursePlan = courses.map((c) => {
    const tutorUserId = userIdOf(c.tutor);
    return { c, tutorUserId, students: c.students.map((st) => userIdOf(st)) };
  });
  const coursesWithoutOwner = coursePlan.filter((p) => !p.tutorUserId || !tutorUsers.some((u) => u.id === p.tutorUserId)).length;
  const unmatchedEnrolments = coursePlan.reduce((n, p) => n + p.students.filter((id) => !id || !studentUsers.some((u) => u.id === id)).length, 0);
  const enrolmentsToCreate = coursePlan.reduce(
    (n, p) => n + p.students.filter((id) => id && learnerIds.has(id) && !existingEnrollments.has(`${p.c.id}:${learnerIds.get(id)}`)).length,
    0,
  );

  const plan = {
    workspace: (await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } })) ? "exists" : "create",
    tutorProfilesToLink: tutorLinks.length,
    studentProfilesToLink: studentLinks.length,
    unmatchedProfiles: unmatched,
    membershipsToCreate: tutorUsers.filter((u) => !existingMembers.has(u.id)).length,
    learnersToCreate: studentUsers.filter((u) => !existingLearners.has(u.id)).length,
    adminsToMark: adminUsers.length,
    owner: ownerEmail ? "set" : "none (every tutor becomes ADMIN)",
    coursesToPlace: courses.filter((c) => !c.workspaceId).length,
    coursesWithoutOwner,
    enrolmentsToCreate: learnerIds.size ? enrolmentsToCreate : "after learners exist (run --apply)",
    implicitEnrolmentsUnmatched: unmatchedEnrolments,
  };
  console.log(apply ? "Applying:" : "Dry run (nothing written):", JSON.stringify(plan, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    await tx.workspace.upsert({
      where: { id: WORKSPACE_ID },
      create: { id: WORKSPACE_ID, kind: "ORGANISATION", name: "Nexa", slug: "nexa", billingState: "COMPED" },
      update: {},
    });
    for (const t of tutorLinks) {
      await tx.tutor.update({ where: { id: t.id }, data: { userId: byEmail.get(lower(t.email))!.id } });
    }
    for (const s of studentLinks) {
      await tx.student.update({ where: { id: s.id }, data: { userId: byEmail.get(lower(s.email))!.id } });
    }
    for (const u of tutorUsers) {
      const role = ownerEmail && lower(u.email) === ownerEmail ? "OWNER" : "ADMIN";
      await tx.membership.upsert({
        where: { workspaceId_userId: { workspaceId: WORKSPACE_ID, userId: u.id } },
        create: { workspaceId: WORKSPACE_ID, userId: u.id, role },
        update: ownerEmail && role === "OWNER" ? { role } : {},
      });
    }
    for (const u of studentUsers) {
      await tx.learner.upsert({
        where: { workspaceId_userId: { workspaceId: WORKSPACE_ID, userId: u.id } },
        create: { workspaceId: WORKSPACE_ID, userId: u.id },
        update: {},
      });
    }
    if (adminUsers.length > 0) {
      await tx.user.updateMany({ where: { id: { in: adminUsers.map((u) => u.id) } }, data: { platformRole: "NEXA_ADMIN" } });
    }
  }, { timeout: 60_000 });

  // Part 2, after part 1 so memberships and learners exist.
  const memberOf = new Map(
    (await prisma.membership.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true, userId: true } })).map((m) => [m.userId, m.id]),
  );
  const learnerOf = new Map(
    (await prisma.learner.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true, userId: true } })).map((l) => [l.userId, l.id]),
  );
  await prisma.$transaction(async (tx) => {
    for (const { c, tutorUserId, students } of coursePlan) {
      const ownerId = tutorUserId ? memberOf.get(tutorUserId) : undefined;
      if (!c.workspaceId || (ownerId && !c.ownerMembershipId)) {
        await tx.course.update({
          where: { id: c.id },
          data: { workspaceId: c.workspaceId ?? WORKSPACE_ID, ...(ownerId && !c.ownerMembershipId ? { ownerMembershipId: ownerId } : {}) },
        });
      }
      if (ownerId && !existingStaff.has(`${c.id}:${ownerId}`)) {
        await tx.courseStaff.create({ data: { courseId: c.id, membershipId: ownerId, role: "LEAD" } });
      }
      for (const uid of students) {
        const learnerId = uid ? learnerOf.get(uid) : undefined;
        if (!learnerId || existingEnrollments.has(`${c.id}:${learnerId}`)) continue;
        await tx.enrollment.create({ data: { workspaceId: WORKSPACE_ID, courseId: c.id, learnerId, status: "ACTIVE", startedAt: c.createdAt } });
        existingEnrollments.add(`${c.id}:${learnerId}`);
      }
    }
  }, { timeout: 120_000 });

  const after = {
    memberships: await prisma.membership.count({ where: { workspaceId: WORKSPACE_ID } }),
    learners: await prisma.learner.count({ where: { workspaceId: WORKSPACE_ID } }),
    tutorsLinked: await prisma.tutor.count({ where: { userId: { not: null } } }),
    studentsLinked: await prisma.student.count({ where: { userId: { not: null } } }),
    nexaAdmins: await prisma.user.count({ where: { platformRole: "NEXA_ADMIN" } }),
    coursesPlaced: await prisma.course.count({ where: { workspaceId: WORKSPACE_ID } }),
    coursesWithOwner: await prisma.course.count({ where: { ownerMembershipId: { not: null } } }),
    courseStaff: await prisma.courseStaff.count(),
    enrollments: await prisma.enrollment.count({ where: { workspaceId: WORKSPACE_ID } }),
  };
  console.log("Done:", JSON.stringify(after));
}

main()
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e).slice(0, 400));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
