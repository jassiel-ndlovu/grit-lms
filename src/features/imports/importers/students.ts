/**
 * Students, with their parents, from a CSV (#216, phase 1). One row per
 * student. New students get a username and a sign-in code (printed on the
 * cards); a parent is linked by email, or made with a code of their own.
 *
 * A student who already has a Nexa account this workspace made is updated
 * (added to the listed courses, parent linked). Anyone else with an account
 * (they signed up themselves, or another workspace made them) is skipped:
 * they join by asking (join requests), never by import.
 */

import "server-only";

import { USERNAME_RE } from "@/features/auth/codes";
import { assertCanAddLearners } from "@/features/billing/caps";
import { createStudentAccountFor, linkParentFor } from "@/features/users/accounts";
import { prisma } from "@/lib/db";
import { emitWebhook } from "@/features/api/webhooks";
import { scopedCourseWhere } from "@/lib/viewer-core";
import { UserError } from "@/lib/user-error";

import { mapHeaders, parseYesNo, splitList } from "../csv";
import type { ApplyResult, ImportContext, Importer, ImportRow, Issue, RowAction } from "../types";

export type StudentRow = {
  full_name: string;
  email: string;
  username: string;
  minor: string;
  courses: string;
  parent_name: string;
  parent_email: string;
  parent_relationship: string;
};

const ALIASES: Record<keyof StudentRow, readonly string[]> = {
  full_name: ["full name", "name", "student name", "learner name", "student", "learner"],
  email: ["email", "email address", "student email", "learner email"],
  username: ["username", "user name"],
  minor: ["minor", "under 18", "is minor", "under eighteen"],
  courses: ["courses", "course", "classes", "class", "subjects", "subject"],
  parent_name: ["parent name", "guardian name", "parent", "guardian", "parent full name"],
  parent_email: ["parent email", "guardian email", "parent email address", "guardian email address"],
  parent_relationship: ["relationship", "parent relationship", "guardian relationship"],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIONSHIPS = { parent: "PARENT", mother: "PARENT", father: "PARENT", mom: "PARENT", mum: "PARENT", dad: "PARENT", guardian: "GUARDIAN", other: "OTHER" } as const;
const relationshipOf = (v: string) => (v.trim() ? RELATIONSHIPS[v.trim().toLowerCase() as keyof typeof RELATIONSHIPS] ?? null : "PARENT");

type Undo = { kind: "created"; userId: string; parent?: ParentUndo } | { kind: "updated"; enrollmentIds: string[]; parent?: ParentUndo };
type ParentUndo = { guardianshipId: string; parentUserId: string; newAccount: boolean };

/** Courses the actor may enrol into, by lower-case name. Two courses with one name can't be told apart. */
async function courseNames(ctx: ImportContext) {
  const courses = await prisma.course.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(ctx.teachingMembershipId ? scopedCourseWhere({ membershipId: ctx.teachingMembershipId, branchIds: ctx.branchIds }) : {}),
    },
    select: { id: true, name: true },
  });
  const byName = new Map<string, string | "ambiguous">();
  for (const c of courses) {
    const k = c.name.trim().toLowerCase();
    byName.set(k, byName.has(k) ? "ambiguous" : c.id);
  }
  return byName;
}

function resolveCourses(byName: Map<string, string | "ambiguous">, cell: string, issues: Issue[]): string[] {
  const ids: string[] = [];
  for (const name of splitList(cell)) {
    const id = byName.get(name.toLowerCase());
    if (id === undefined) issues.push({ field: "courses", level: "error", message: `No course called "${name}" that you can enrol into.` });
    else if (id === "ambiguous") issues.push({ field: "courses", level: "error", message: `Two courses are called "${name}". Rename one first.` });
    else if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export const studentsImporter: Importer<StudentRow> = {
  kind: "students",
  title: "Students and parents",
  template: {
    headers: ["Full name", "Email", "Username", "Minor", "Courses", "Parent name", "Parent email", "Relationship"],
    examples: [
      ["Thandi Mokoena", "", "", "yes", "Maths Grade 10; Physical Science Grade 10", "Lerato Mokoena", "lerato@example.com", "mother"],
      ["Sipho Dlamini", "sipho@example.com", "", "no", "Maths Grade 12", "", "", ""],
    ],
  },

  read(table) {
    const { columns } = mapHeaders(table.headers, ALIASES);
    const fileIssues: Issue[] = [];
    if (columns.full_name < 0) fileIssues.push({ level: "error", message: 'The file needs a "Full name" column. Download the template to see the columns.' });
    const rows = table.rows.map((r) => {
      const get = (f: keyof StudentRow) => (columns[f] >= 0 ? r[columns[f]] ?? "" : "");
      return {
        full_name: get("full_name"), email: get("email").toLowerCase(), username: get("username").toLowerCase(), minor: get("minor"),
        courses: get("courses"), parent_name: get("parent_name"), parent_email: get("parent_email").toLowerCase(), parent_relationship: get("parent_relationship"),
      };
    });
    return { rows, fileIssues };
  },

  async check(ctx, rows) {
    const byName = await courseNames(ctx);
    const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
    const usernames = [...new Set(rows.map((r) => r.username.trim().toLowerCase()).filter(Boolean))];
    const [existing, taken] = await Promise.all([
      emails.length
        ? prisma.user.findMany({
            where: { email: { in: emails } },
            select: { id: true, email: true, platformRole: true, managedByWorkspaceId: true, deletedAt: true, memberships: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 }, learners: { where: { workspaceId: ctx.workspaceId }, select: { id: true } } },
          })
        : [],
      usernames.length ? prisma.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true } }) : [],
    ]);
    const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
    const usernameOwner = new Map(taken.map((u) => [u.username!, u.id]));
    const seenEmail = new Map<string, number>();
    const seenUsername = new Map<string, number>();
    rows.forEach((r, i) => {
      const e = r.email.trim().toLowerCase();
      const u = r.username.trim().toLowerCase();
      if (e) seenEmail.set(e, (seenEmail.get(e) ?? 0) + 1);
      if (u) seenUsername.set(u, (seenUsername.get(u) ?? 0) + 1);
      void i;
    });

    return rows.map((r) => {
      const issues: Issue[] = [];
      let action: RowAction = "create";
      const name = r.full_name.trim();
      const email = r.email.trim().toLowerCase();
      const username = r.username.trim().toLowerCase();
      if (name.length < 2) issues.push({ field: "full_name", level: "error", message: "Enter the student's full name." });
      if (email && !EMAIL_RE.test(email)) issues.push({ field: "email", level: "error", message: "That email address doesn't look right." });
      if (email && (seenEmail.get(email) ?? 0) > 1) issues.push({ field: "email", level: "error", message: "This email is on more than one row." });
      if (username && (seenUsername.get(username) ?? 0) > 1) issues.push({ field: "username", level: "error", message: "This username is on more than one row." });
      if (parseYesNo(r.minor) === null && r.minor.trim()) issues.push({ field: "minor", level: "error", message: 'Write "yes" or "no" for Minor.' });

      const owner = email ? byEmail.get(email) : undefined;
      if (owner) {
        if (owner.deletedAt || owner.platformRole !== "USER" || owner.memberships.length) {
          issues.push({ field: "email", level: "error", message: "This email belongs to a staff account. Use another email for the student." });
        } else if (owner.managedByWorkspaceId === ctx.workspaceId && owner.learners.length) {
          action = "update";
          issues.push({ field: "email", level: "warning", message: "Already one of your students: they'll be added to the listed courses." });
        } else {
          action = "skip";
          issues.push({ field: "email", level: "warning", message: "Has their own Nexa account. Ask them to find your course and request to join." });
        }
      }
      if (username && action === "create") {
        if (!USERNAME_RE.test(username)) issues.push({ field: "username", level: "error", message: "Usernames are 3 to 30 lower-case letters, digits, dots or underscores." });
        else if (usernameOwner.has(username)) issues.push({ field: "username", level: "error", message: "That username is taken. Leave it empty to make one from the name." });
      }

      const courseIds = resolveCourses(byName, r.courses, issues);
      if (!courseIds.length && !issues.some((i) => i.field === "courses")) {
        if (ctx.teachingMembershipId) issues.push({ field: "courses", level: "error", message: "List at least one course you can enrol into." });
        else issues.push({ field: "courses", level: "warning", message: "Not enrolled on any course yet." });
      }

      const pEmail = r.parent_email.trim().toLowerCase();
      const pName = r.parent_name.trim();
      if (pEmail && !EMAIL_RE.test(pEmail)) issues.push({ field: "parent_email", level: "error", message: "The parent's email address doesn't look right." });
      if (pEmail && pEmail === email) issues.push({ field: "parent_email", level: "error", message: "The parent's email is the same as the student's." });
      if ((pEmail || pName) && relationshipOf(r.parent_relationship) === null) issues.push({ field: "parent_relationship", level: "error", message: 'Relationship can be parent, mother, father, guardian or other.' });
      if (pEmail && !pName && !byEmail.has(pEmail)) issues.push({ field: "parent_name", level: "warning", message: "No parent name: the email will be used until they change it." });

      return { action, issues };
    });
  },

  needs(rows) {
    const minors = rows.some((r) => r.action === "create" && (parseYesNo(r.data.minor) ?? true));
    return minors ? [{ option: "consentAttested", message: "Confirm you have a parent's or guardian's consent for every student under 18 in this file." }] : [];
  },

  async apply(ctx, row: ImportRow<StudentRow>, options): Promise<ApplyResult> {
    const r = row.data;
    const issues: Issue[] = [];
    const courseIds = resolveCourses(await courseNames(ctx), r.courses, issues);
    if (issues.some((i) => i.level === "error")) throw new UserError(issues[0].message);
    const isMinor = parseYesNo(r.minor) ?? true;
    const cards: ApplyResult["cards"] = [];
    let undo: Undo;
    let learnerId: string;
    let result: string;

    if (row.action === "create") {
      const s = await createStudentAccountFor(ctx.actor.userId, ctx.workspaceId, {
        fullName: r.full_name, email: r.email || null, username: r.username || undefined, isMinor, courseIds, consentAttested: !!options.consentAttested,
      });
      learnerId = s.learnerId;
      cards.push({ kind: "student", name: r.full_name.trim(), username: s.username, code: s.code, expiresAt: s.codeExpiresAt });
      undo = { kind: "created", userId: s.userId };
      result = `Created ${s.username}`;
    } else {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: r.email.trim().toLowerCase() }, select: { id: true, managedByWorkspaceId: true, learners: { where: { workspaceId: ctx.workspaceId }, select: { id: true } } } });
      if (user.managedByWorkspaceId !== ctx.workspaceId || !user.learners.length) throw new UserError("This student manages their own account now.");
      learnerId = user.learners[0].id;
      const open = new Set((await prisma.enrollment.findMany({ where: { learnerId, endedAt: null, courseId: { in: courseIds } }, select: { courseId: true } })).map((e) => e.courseId));
      const add = courseIds.filter((c) => !open.has(c));
      const enrollmentIds: string[] = [];
      if (add.length) {
        await prisma.$transaction(async (tx) => {
          await tx.learner.update({ where: { id: learnerId }, data: { status: "ACTIVE" } });
          await assertCanAddLearners(tx, ctx.workspaceId, [learnerId]);
          for (const courseId of add) {
            const e = await tx.enrollment.create({ data: { workspaceId: ctx.workspaceId, courseId, learnerId, status: "ACTIVE" }, select: { id: true } });
            enrollmentIds.push(e.id);
            await emitWebhook(tx, ctx.workspaceId, "enrolment.created", { courseId, learnerId, source: "import" });
          }
        }, { timeout: 30_000 });
      }
      undo = { kind: "updated", enrollmentIds };
      result = add.length ? `Added to ${add.length} ${add.length === 1 ? "course" : "courses"}` : "Already on these courses";
    }

    if (r.parent_email.trim() || r.parent_name.trim()) {
      const p = await linkParentFor(ctx.actor, ctx.workspaceId, {
        learnerId, name: r.parent_name.trim() || r.parent_email.trim(), email: r.parent_email.trim() || null,
        relationship: (relationshipOf(r.parent_relationship) ?? "PARENT") as "PARENT" | "GUARDIAN" | "OTHER",
      });
      const g = await prisma.guardianship.findUniqueOrThrow({ where: { id: p.guardianshipId }, select: { guardianUserId: true } });
      undo.parent = { guardianshipId: p.guardianshipId, parentUserId: g.guardianUserId, newAccount: p.newAccount };
      if (p.newAccount && "code" in p && p.code && p.username) {
        cards.push({ kind: "parent", name: r.parent_name.trim() || r.parent_email.trim(), username: p.username, code: p.code, expiresAt: p.codeExpiresAt!, forStudent: r.full_name.trim() });
      }
      result += p.newAccount ? "; parent account made" : "; parent linked";
    }
    return { outcome: "done", result, undo, cards };
  },

  async undo(_ctx, raw) {
    const u = raw as Undo;
    const notes: string[] = [];
    if (u.parent) {
      const parent = await prisma.user.findUnique({ where: { id: u.parent.parentUserId }, select: { mustChangePassword: true, _count: { select: { authSessions: true, guardianOf: true } } } });
      if (u.parent.newAccount && parent && parent.mustChangePassword && parent._count.authSessions === 0 && parent._count.guardianOf <= 1) {
        await prisma.user.delete({ where: { id: u.parent.parentUserId } });
      } else {
        await prisma.guardianship.updateMany({ where: { id: u.parent.guardianshipId }, data: { status: "REVOKED" } });
        if (u.parent.newAccount) notes.push("the parent has signed in, so their account stays (unlinked)");
      }
    }
    if (u.kind === "updated") {
      if (u.enrollmentIds.length) await prisma.enrollment.deleteMany({ where: { id: { in: u.enrollmentIds } } });
      return { undone: true, note: notes.join("; ") || undefined };
    }
    const user = await prisma.user.findUnique({ where: { id: u.userId }, select: { mustChangePassword: true, _count: { select: { authSessions: true } } } });
    if (!user) return { undone: true };
    if (!user.mustChangePassword || user._count.authSessions > 0) return { undone: false, note: "the student has already signed in" };
    await prisma.$transaction(async (tx) => {
      await tx.student.deleteMany({ where: { userId: u.userId } });
      await tx.userPreferences.deleteMany({ where: { userId: u.userId } });
      await tx.user.delete({ where: { id: u.userId } });
    }, { timeout: 30_000 });
    return { undone: true, note: notes.join("; ") || undefined };
  },
};
