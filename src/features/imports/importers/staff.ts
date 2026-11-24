/**
 * Staff from a CSV (#216, phase 1): one email invitation per row, exactly as
 * the Members page sends them (7-day link, role, optional courses). Only
 * owners invite admins. People already in the workspace are skipped.
 */

import "server-only";

import { createStaffInvitesFor } from "@/features/auth/invites";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";

import { mapHeaders, splitList } from "../csv";
import type { Importer, Issue, RowAction } from "../types";

export type StaffRow = { email: string; full_name: string; role: string; courses: string; teams: string };

const ALIASES: Record<keyof StaffRow, readonly string[]> = {
  email: ["email", "email address", "work email"],
  full_name: ["full name", "name", "tutor name", "staff name"],
  role: ["role", "position", "type"],
  courses: ["courses", "course", "classes", "class", "subjects", "subject"],
  teams: ["teams", "team", "branch team", "group"],
};

/** Team names in the workspace: "Team" alone when unique, or "Branch / Team". */
async function teamIdsByName(workspaceId: string) {
  const teams = await prisma.team.findMany({ where: { workspaceId }, select: { id: true, name: true, branch: { select: { name: true } } } });
  const m = new Map<string, string | "ambiguous">();
  const put = (k: string, id: string) => m.set(k, m.has(k) && m.get(k) !== id ? "ambiguous" : id);
  for (const t of teams) {
    put(t.name.trim().toLowerCase(), t.id);
    if (t.branch) put(`${t.branch.name.trim().toLowerCase()} / ${t.name.trim().toLowerCase()}`, t.id);
  }
  return m;
}

function resolveTeams(byName: Map<string, string | "ambiguous">, cell: string, issues: Issue[]) {
  const ids: string[] = [];
  for (const raw of splitList(cell)) {
    const name = raw.replace(/\s*\/\s*/g, " / ").toLowerCase();
    const id = byName.get(name);
    if (id === undefined) issues.push({ field: "teams", level: "error", message: `No team called "${raw}". Import branches and teams first.` });
    else if (id === "ambiguous") issues.push({ field: "teams", level: "error", message: `More than one team is called "${raw}". Write it as "Branch / Team".` });
    else if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roleOf = (v: string): "TUTOR" | "ADMIN" | null => {
  const s = v.trim().toLowerCase();
  if (!s || s === "tutor" || s === "teacher" || s === "trainer") return "TUTOR";
  if (s === "admin" || s === "administrator") return "ADMIN";
  return null;
};

async function courseIdsByName(workspaceId: string) {
  const courses = await prisma.course.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const m = new Map<string, string | "ambiguous">();
  for (const c of courses) {
    const k = c.name.trim().toLowerCase();
    m.set(k, m.has(k) ? "ambiguous" : c.id);
  }
  return m;
}

function resolve(byName: Map<string, string | "ambiguous">, cell: string, issues: Issue[]) {
  const ids: string[] = [];
  for (const name of splitList(cell)) {
    const id = byName.get(name.toLowerCase());
    if (id === undefined) issues.push({ field: "courses", level: "error", message: `No course called "${name}".` });
    else if (id === "ambiguous") issues.push({ field: "courses", level: "error", message: `Two courses are called "${name}". Rename one first.` });
    else if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export const staffImporter: Importer<StaffRow> = {
  kind: "staff",
  title: "Tutors and admins",
  template: {
    headers: ["Email", "Full name", "Role", "Courses", "Teams"],
    examples: [
      ["ayanda@example.com", "Ayanda Zulu", "tutor", "Maths Grade 10; Maths Grade 11", "Soweto / Maths"],
      ["naledi@example.com", "Naledi Khumalo", "admin", "", ""],
    ],
  },

  read(table) {
    const { columns } = mapHeaders(table.headers, ALIASES);
    const fileIssues: Issue[] = [];
    if (columns.email < 0) fileIssues.push({ level: "error", message: 'The file needs an "Email" column. Download the template to see the columns.' });
    const rows = table.rows.map((r) => {
      const get = (f: keyof StaffRow) => (columns[f] >= 0 ? r[columns[f]] ?? "" : "");
      return { email: get("email").toLowerCase(), full_name: get("full_name"), role: get("role"), courses: get("courses"), teams: get("teams") };
    });
    return { rows, fileIssues };
  },

  async check(ctx, rows) {
    const byName = await courseIdsByName(ctx.workspaceId);
    const teamsByName = await teamIdsByName(ctx.workspaceId);
    const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
    const members = new Set(
      (await prisma.membership.findMany({ where: { workspaceId: ctx.workspaceId, status: "ACTIVE", user: { email: { in: emails } } }, select: { user: { select: { email: true } } } }))
        .map((m) => m.user.email.toLowerCase()),
    );
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.email.trim().toLowerCase(), (seen.get(r.email.trim().toLowerCase()) ?? 0) + 1);
    return rows.map((r) => {
      const issues: Issue[] = [];
      let action: RowAction = "create";
      const email = r.email.trim().toLowerCase();
      if (!email) issues.push({ field: "email", level: "error", message: "Enter an email address." });
      else if (!EMAIL_RE.test(email)) issues.push({ field: "email", level: "error", message: "That email address doesn't look right." });
      else if ((seen.get(email) ?? 0) > 1) issues.push({ field: "email", level: "error", message: "This email is on more than one row." });
      const role = roleOf(r.role);
      if (!role) issues.push({ field: "role", level: "error", message: 'Role can be "tutor" or "admin".' });
      else if (role === "ADMIN" && ctx.actorRole !== "OWNER" && ctx.actorRole !== "NEXA_ADMIN") issues.push({ field: "role", level: "error", message: "Only the owner can invite admins." });
      resolve(byName, r.courses, issues);
      resolveTeams(teamsByName, r.teams ?? "", issues);
      if (email && members.has(email)) {
        action = "skip";
        issues.push({ field: "email", level: "warning", message: "Already a member of this workspace." });
      }
      return { action, issues };
    });
  },

  async apply(ctx, row) {
    const issues: Issue[] = [];
    const courseIds = resolve(await courseIdsByName(ctx.workspaceId), row.data.courses, issues);
    const teamIds = resolveTeams(await teamIdsByName(ctx.workspaceId), row.data.teams ?? "", issues);
    if (issues.length) throw new UserError(issues[0].message);
    const role = roleOf(row.data.role);
    if (!role) throw new UserError('Role can be "tutor" or "admin".');
    const [r] = await createStaffInvitesFor(ctx.actor, ctx.workspaceId, { emails: [row.data.email], role, courseIds, teamIds });
    if (r.status === "ALREADY_MEMBER") return { outcome: "skipped", result: "Already a member" };
    const invite = await prisma.invite.findFirst({ where: { workspaceId: ctx.workspaceId, email: row.data.email.trim().toLowerCase(), kind: "STAFF", acceptedAt: null, revokedAt: null }, select: { id: true } });
    return { outcome: "done", result: r.status === "RESENT" ? "Invitation sent again" : "Invitation sent", undo: invite ? { inviteId: invite.id } : undefined };
  },

  async undo(ctx, raw) {
    const { inviteId } = raw as { inviteId: string };
    const r = await prisma.invite.updateMany({ where: { id: inviteId, workspaceId: ctx.workspaceId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return r.count ? { undone: true } : { undone: false, note: "the invitation was already accepted" };
  },
};
