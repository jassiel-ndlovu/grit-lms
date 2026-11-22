/**
 * Accounts tutors create (design 02, section 5.1; ux/01, sections 6 and 7).
 *
 *   createStudentAccountFor  User + Student profile + Learner + enrolments,
 *                            with a username and a one-time sign-in code
 *   issueSignInCodeFor       a new code (also the v1 reset for students
 *                            without email); signs them out everywhere
 *   linkParentFor            an existing account by email gets the child;
 *                            otherwise a parent account with its own code
 *   setOwnPasswordFor        the first password, replacing the code
 *
 * The tutor vouches for the account, so it may sign in at once
 * (emailConfirmed); a real email still gets no mail until the user verifies
 * it (emailVerified stays empty). The code is the password until changed: bcrypt of the normalised code in
 * User.password and the credential Account, with mustChangePassword and a
 * 14-day expiry. Server only; permissions are checked in ./account-actions.ts.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import bcrypt from "bcryptjs";

import { syncCredentialAccount } from "@/features/auth/credential";
import { assertCanAddLearners } from "@/features/billing/caps";
import { newSignInCode, normaliseCode, pickUsername, placeholderEmail, usernameBase, USERNAME_RE } from "@/features/auth/codes";
import { passwordProblem } from "@/features/auth/password-reset";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";

const ROUNDS = 10;
const CODE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const RESETS_PER_HOUR = 10;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function freeUsername(tx: Tx, wanted: string | undefined, fullName: string): Promise<string> {
  if (wanted) {
    const u = wanted.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) throw new UserError("Usernames are 3 to 30 lower-case letters, digits, dots or underscores");
    if (await tx.user.findUnique({ where: { username: u }, select: { id: true } })) throw new UserError("That username is taken");
    return u;
  }
  const base = usernameBase(fullName);
  const taken = new Set((await tx.user.findMany({ where: { username: { startsWith: base } }, select: { username: true } })).map((r) => r.username!));
  return pickUsername(base, taken);
}

async function setCode(tx: Tx, userId: string, now: Date) {
  const code = newSignInCode();
  const hash = await bcrypt.hash(normaliseCode(code), ROUNDS);
  await tx.user.update({ where: { id: userId }, data: { password: hash, mustChangePassword: true, initialCodeExpiresAt: new Date(now.getTime() + CODE_DAYS * DAY) } });
  await syncCredentialAccount(tx, userId, hash);
  return { code, expiresAt: new Date(now.getTime() + CODE_DAYS * DAY).toISOString() };
}

export type NewStudent = { fullName: string; email?: string | null; username?: string; isMinor: boolean; courseIds: string[]; consentAttested: boolean };

export async function createStudentAccountFor(actorUserId: string, workspaceId: string, input: NewStudent, now: Date = new Date()) {
  const fullName = input.fullName.trim();
  if (fullName.length < 2) throw new UserError("Enter the student's full name");
  if (input.isMinor && !input.consentAttested) throw new UserError("Confirm you have a parent's or guardian's consent for this student");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) throw new UserError("An account with that email already exists. Ask them to find your course on Nexa and request to join");
  const courses = await prisma.course.findMany({ where: { id: { in: input.courseIds }, workspaceId }, select: { id: true } });
  if (courses.length !== new Set(input.courseIds).size) throw new UserError("One of the courses isn't in this workspace");

  return prisma.$transaction(async (tx) => {
    // A new learner enrolled in a course counts against a hard-stop student limit (the trial's 20).
    if (courses.length) await assertCanAddLearners(tx, workspaceId, ["new-learner"]);
    const username = await freeUsername(tx, input.username, fullName);
    const user = await tx.user.create({
      data: { name: fullName, email: email ?? `pending-${username}@${"students.nexa-lms.invalid"}`, username, displayUsername: username, role: "STUDENT", emailIsPlaceholder: !email, emailConfirmed: true, managedByWorkspaceId: workspaceId },
      select: { id: true },
    });
    if (!email) await tx.user.update({ where: { id: user.id }, data: { email: placeholderEmail(user.id) } });
    const { code, expiresAt } = await setCode(tx, user.id, now);
    const finalEmail = email ?? placeholderEmail(user.id);
    await tx.student.create({ data: { fullName, email: finalEmail, userId: user.id } });
    const learner = await tx.learner.create({
      data: { workspaceId, userId: user.id, isMinor: input.isMinor, ...(input.consentAttested ? { consentAttestedAt: now, consentAttestedBy: actorUserId } : {}) },
      select: { id: true },
    });
    if (courses.length) {
      await tx.enrollment.createMany({ data: courses.map((c) => ({ workspaceId, courseId: c.id, learnerId: learner.id, status: "ACTIVE" as const, startedAt: now })) });
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "learner.create", targetType: "User", targetId: user.id, data: { username, isMinor: input.isMinor, courses: courses.length, consentAttested: input.consentAttested } } });
    return { userId: user.id, learnerId: learner.id, username, email, code, codeExpiresAt: expiresAt };
  }, { timeout: 30_000 });
}

/** A new sign-in code for an account a tutor manages. Old code and sessions stop working. */
export async function issueSignInCodeFor(actorUserId: string, workspaceId: string, userId: string, now: Date = new Date()) {
  const recent = await prisma.auditLog.count({ where: { actorUserId, action: "learner.code_reset", at: { gte: new Date(now.getTime() - 60 * 60 * 1000) } } });
  if (recent >= RESETS_PER_HOUR) throw new UserError("Too many new codes in the last hour. Try again later");
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, email: true, emailIsPlaceholder: true } });
    const out = await setCode(tx, userId, now);
    await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "learner.code_reset", targetType: "User", targetId: userId, data: {} } });
    return { username: u.username, email: u.emailIsPlaceholder ? null : u.email, ...out };
  }, { timeout: 30_000 });
}

/** The first password, replacing a sign-in code. Only while mustChangePassword is set. */
export async function setOwnPasswordFor(userId: string, newPassword: string) {
  const problem = passwordProblem(newPassword);
  if (problem) throw new Error(problem);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mustChangePassword: true } });
  if (!u.mustChangePassword) throw new UserError("Change your password in settings instead");
  const hash = await bcrypt.hash(newPassword, ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { password: hash, mustChangePassword: false, initialCodeExpiresAt: null } });
    await syncCredentialAccount(tx, userId, hash);
  }, { timeout: 30_000 });
  return { ok: true as const };
}

export type ParentInput = { learnerId: string; name: string; email?: string | null; relationship: "PARENT" | "GUARDIAN" | "OTHER" };

/**
 * Links a parent to a learner. An existing account with that email gets the
 * child (and an email saying so); otherwise a parent account is created with
 * a username and sign-in code, like a student's.
 */
export async function linkParentFor(actor: { userId: string; name: string }, workspaceId: string, input: ParentInput, now: Date = new Date()) {
  const learner = await prisma.learner.findFirst({ where: { id: input.learnerId, workspaceId }, select: { userId: true, user: { select: { name: true } }, workspace: { select: { name: true } } } });
  if (!learner) throw new UserError("Student not found");
  const email = input.email?.trim().toLowerCase() || null;
  const existing = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }) : null;
  if (existing?.id === learner.userId) throw new UserError("That's the student's own email");

  return prisma.$transaction(async (tx) => {
    let parentId: string;
    let created: { username: string; code: string; codeExpiresAt: string } | null = null;
    if (existing) {
      parentId = existing.id;
    } else {
      const name = input.name.trim();
      if (name.length < 2) throw new UserError("Enter the parent's name");
      const username = await freeUsername(tx, undefined, name);
      const user = await tx.user.create({
        data: { name, email: email ?? `pending-${username}@students.nexa-lms.invalid`, username, displayUsername: username, role: "PARENT", emailIsPlaceholder: !email, emailConfirmed: true, managedByWorkspaceId: workspaceId },
        select: { id: true },
      });
      if (!email) await tx.user.update({ where: { id: user.id }, data: { email: placeholderEmail(user.id) } });
      const { code, expiresAt } = await setCode(tx, user.id, now);
      parentId = user.id;
      created = { username, code, codeExpiresAt: expiresAt };
    }
    const g = await tx.guardianship.upsert({
      where: { guardianUserId_studentUserId: { guardianUserId: parentId, studentUserId: learner.userId } },
      create: { guardianUserId: parentId, studentUserId: learner.userId, relationship: input.relationship, status: "ACTIVE" },
      update: { relationship: input.relationship, status: "ACTIVE" },
      select: { id: true },
    });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: actor.userId, action: "guardian.link", targetType: "Guardianship", targetId: g.id, data: { newAccount: !existing } } });
    if (existing) {
      await enqueueEmail(tx, {
        key: `guardian:linked:${g.id}`, template: "guardian:linked", to: existing.email, userId: existing.id, workspaceId, category: "ACCOUNT", priority: "NORMAL",
        data: { tutorName: actor.name, studentName: learner.user.name, workspaceName: learner.workspace.name },
      });
    }
    return { guardianshipId: g.id, newAccount: !existing, ...(created ?? {}) };
  }, { timeout: 30_000 });
}

export async function revokeGuardianshipFor(actorUserId: string, workspaceId: string, guardianshipId: string) {
  return prisma.$transaction(async (tx) => {
    const g = await tx.guardianship.update({ where: { id: guardianshipId }, data: { status: "REVOKED" }, select: { id: true } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "guardian.revoke", targetType: "Guardianship", targetId: g.id, data: {} } });
    return { status: "REVOKED" as const };
  });
}

/** For the student profile: parents linked to a learner. */
export async function parentsOf(learnerUserId: string) {
  const rows = await prisma.guardianship.findMany({
    where: { studentUserId: learnerUserId, status: "ACTIVE" },
    select: { id: true, relationship: true, createdAt: true, guardian: { select: { name: true, email: true, emailIsPlaceholder: true, username: true } } },
  });
  return rows.map((r) => ({ guardianshipId: r.id, name: r.guardian.name, email: r.guardian.emailIsPlaceholder ? null : r.guardian.email, username: r.guardian.username, relationship: r.relationship, linkedAt: r.createdAt.toISOString() }));
}
