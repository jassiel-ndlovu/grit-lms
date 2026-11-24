/** Server helpers for the enquiry pages: branches and staff to choose from. */

import "server-only";

import { prisma } from "@/lib/db";

export async function enquiryChoices(workspaceId: string) {
  const [branches, members] = await Promise.all([
    prisma.branch.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.membership.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, user: { select: { name: true } } } }),
  ]);
  return {
    branches,
    staff: members.map((m) => ({ membershipId: m.id, name: m.user.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
