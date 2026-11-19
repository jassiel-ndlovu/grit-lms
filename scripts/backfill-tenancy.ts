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
 * Part 2 (courses, CourseStaff and enrolments from `Course.tutorId` and the
 * implicit CourseEnrollments join) ran on production and Preview and was
 * removed when those columns were dropped (10_drop_legacy_course_links,
 * issue #93 step 5). New courses get their tenancy rows from
 * createCourse/updateCourse.
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

  const plan = {
    workspace: (await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } })) ? "exists" : "create",
    tutorProfilesToLink: tutorLinks.length,
    studentProfilesToLink: studentLinks.length,
    unmatchedProfiles: unmatched,
    membershipsToCreate: tutorUsers.filter((u) => !existingMembers.has(u.id)).length,
    learnersToCreate: studentUsers.filter((u) => !existingLearners.has(u.id)).length,
    adminsToMark: adminUsers.length,
    owner: ownerEmail ? "set" : "none (every tutor becomes ADMIN)",
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
