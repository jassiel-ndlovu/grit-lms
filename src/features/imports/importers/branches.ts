/**
 * Branches and teams from a CSV (#216 phase 3, bulk onboarding): one row
 * per team, with its branch, and optionally the team lead's email (someone
 * already in the organisation). Existing branches and teams are reused.
 * Run it before the staff import, whose "Teams" column then finds them.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";

import { mapHeaders } from "../csv";
import type { Importer, Issue, RowAction } from "../types";

export type BranchRow = { branch: string; team: string; lead_email: string };

const ALIASES: Record<keyof BranchRow, readonly string[]> = {
  branch: ["branch", "branch name", "campus", "centre", "center", "site", "location"],
  team: ["team", "team name", "department", "group", "subject team"],
  lead_email: ["team lead email", "lead email", "lead", "team lead", "head email", "hod email"],
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

export const branchesImporter: Importer<BranchRow> = {
  kind: "branches",
  title: "Branches and teams",
  template: {
    headers: ["Branch", "Team", "Team lead email"],
    examples: [
      ["Soweto", "Maths", "ayanda@example.com"],
      ["Soweto", "Languages", ""],
    ],
  },

  read(table) {
    const { columns } = mapHeaders(table.headers, ALIASES);
    const fileIssues: Issue[] = [];
    if (columns.branch < 0) fileIssues.push({ level: "error", message: 'The file needs a "Branch" column. Download the template to see the columns.' });
    const rows = table.rows.map((r) => {
      const get = (f: keyof BranchRow) => (columns[f] >= 0 ? r[columns[f]] ?? "" : "");
      return { branch: norm(get("branch")), team: norm(get("team")), lead_email: get("lead_email").trim().toLowerCase() };
    });
    return { rows, fileIssues };
  },

  async check(ctx, rows) {
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { kind: true } });
    const [branches, teams, members] = await Promise.all([
      prisma.branch.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } }),
      prisma.team.findMany({ where: { workspaceId: ctx.workspaceId }, select: { name: true, branch: { select: { name: true } } } }),
      prisma.membership.findMany({ where: { workspaceId: ctx.workspaceId, status: "ACTIVE", user: { email: { in: [...new Set(rows.map((r) => r.lead_email).filter(Boolean))] } } }, select: { user: { select: { email: true } } } }),
    ]);
    const memberEmails = new Set(members.map((m) => m.user.email.toLowerCase()));
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.branch.toLowerCase()}|${r.team.toLowerCase()}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return rows.map((r) => {
      const issues: Issue[] = [];
      let action: RowAction = "create";
      if (ws.kind !== "ORGANISATION") issues.push({ level: "error", message: "Branches are for organisations." });
      if (!r.branch) issues.push({ field: "branch", level: "error", message: "Enter the branch name." });
      else if (r.branch.length > 80) issues.push({ field: "branch", level: "error", message: "Branch names are at most 80 characters." });
      if (r.team.length > 80) issues.push({ field: "team", level: "error", message: "Team names are at most 80 characters." });
      if ((seen.get(`${r.branch.toLowerCase()}|${r.team.toLowerCase()}`) ?? 0) > 1) issues.push({ field: "team", level: "error", message: "This branch and team are on more than one row." });
      if (r.lead_email && !memberEmails.has(r.lead_email)) issues.push({ field: "lead_email", level: "warning", message: "Not in the organisation yet: the team is made without a lead. Invite them, then set the lead." });
      if (r.lead_email && !r.team) issues.push({ field: "lead_email", level: "warning", message: "A lead needs a team; it's ignored here." });
      const branchExists = branches.some((b) => b.name.toLowerCase() === r.branch.toLowerCase());
      const teamExists = !r.team || teams.some((t) => t.name.toLowerCase() === r.team.toLowerCase() && t.branch?.name.toLowerCase() === r.branch.toLowerCase());
      if (branchExists && teamExists) {
        action = r.lead_email && r.team && memberEmails.has(r.lead_email) ? "update" : "skip";
        if (action === "skip") issues.push({ level: "warning", message: "Already set up." });
      }
      return { action, issues };
    });
  },

  async apply(ctx, row) {
    const d = row.data;
    if (!d.branch) throw new UserError("Enter the branch name.");
    return prisma.$transaction(async (tx) => {
      let branch = await tx.branch.findFirst({ where: { workspaceId: ctx.workspaceId, name: { equals: d.branch, mode: "insensitive" } }, select: { id: true } });
      const branchCreated = !branch;
      branch ??= await tx.branch.create({ data: { workspaceId: ctx.workspaceId, name: d.branch }, select: { id: true } });
      let teamId: string | null = null;
      let teamCreated = false;
      if (d.team) {
        const team = await tx.team.findFirst({ where: { workspaceId: ctx.workspaceId, branchId: branch.id, name: { equals: d.team, mode: "insensitive" } }, select: { id: true } });
        teamCreated = !team;
        teamId = team?.id ?? (await tx.team.create({ data: { workspaceId: ctx.workspaceId, branchId: branch.id, name: d.team }, select: { id: true } })).id;
      }
      let lead = "";
      if (teamId && d.lead_email) {
        const m = await tx.membership.findFirst({ where: { workspaceId: ctx.workspaceId, status: "ACTIVE", user: { email: d.lead_email } }, select: { id: true } });
        if (m) {
          await tx.teamMember.upsert({ where: { teamId_membershipId: { teamId, membershipId: m.id } }, create: { teamId, membershipId: m.id, isLead: true }, update: { isLead: true } });
          lead = ", lead set";
        }
      }
      const what = [branchCreated ? "branch created" : null, teamCreated ? "team created" : null].filter(Boolean).join(", ") || "already there";
      return { outcome: "done" as const, result: `${what}${lead}`, undo: { branchId: branch.id, branchCreated, teamId, teamCreated } };
    });
  },

  async undo(ctx, raw) {
    const u = raw as { branchId: string; branchCreated: boolean; teamId: string | null; teamCreated: boolean };
    let undone = false;
    if (u.teamCreated && u.teamId) {
      const members = await prisma.teamMember.count({ where: { teamId: u.teamId, isLead: false } });
      const courses = await prisma.course.count({ where: { teamId: u.teamId } });
      if (members || courses) return { undone: false, note: "the team has members or courses now" };
      await prisma.team.deleteMany({ where: { id: u.teamId, workspaceId: ctx.workspaceId } });
      undone = true;
    }
    if (u.branchCreated) {
      if (await prisma.team.count({ where: { branchId: u.branchId } })) return { undone, note: undone ? undefined : "the branch has other teams now" };
      await prisma.branch.deleteMany({ where: { id: u.branchId, workspaceId: ctx.workspaceId } });
      undone = true;
    }
    return { undone };
  },
};
