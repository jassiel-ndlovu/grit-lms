/**
 * Creating a workspace (ux/01, section 3; design 01 and 03, section 6).
 * The signed-in user becomes its OWNER, and it starts a 14-day TRIAL with
 * no card: a Subscription row (billed to the owner's email) and the trial
 * caps (20 active students, 100 AI marks). Server only; takes the user so
 * scripts can test it.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import { getBillingConfig } from "@/features/billing/data";
import { BillingError } from "@/features/billing/errors";
import { prisma } from "@/lib/db";

/** Trial caps (design 03, section 6). */
export const TRIAL_CAPS = [
  { meter: "ACTIVE_STUDENTS", limitQuantity: 20 },
  { meter: "AI_MARKS", limitQuantity: 100 },
] as const;

/** How many workspaces one person may own, each with its own trial. */
export const MAX_OWNED_WORKSPACES = 3;

const DAY = 24 * 60 * 60 * 1000;

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Thandi's practice" or "Thandi's organisation". */
export function placeholderName(userName: string, kind: "SOLO" | "ORGANISATION"): string {
  const first = userName.trim().split(/\s+/)[0] || "My";
  return `${first}'s ${kind === "SOLO" ? "practice" : "organisation"}`.slice(0, 80);
}

/** URL-safe slug from the name, with a short random suffix so it is unique. */
export function slugFor(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createWorkspaceFor(
  user: { id: string; name: string; email: string; emailVerified: boolean },
  input: { kind: "SOLO" | "ORGANISATION"; name?: string; timezone?: string },
  now: Date = new Date(),
) {
  if (!user.emailVerified) throw new BillingError("FORBIDDEN", "Verify your email address first");
  const timezone = input.timezone ?? "Africa/Johannesburg";
  if (!isTimeZone(timezone)) throw new BillingError("FORBIDDEN", "Unknown time zone");
  const name = (input.name?.trim() || placeholderName(user.name, input.kind)).slice(0, 80);
  const owned = await prisma.membership.count({ where: { userId: user.id, role: "OWNER", status: "ACTIVE" } });
  if (owned >= MAX_OWNED_WORKSPACES) throw new BillingError("FORBIDDEN", `You can own up to ${MAX_OWNED_WORKSPACES} workspaces`);
  const config = await getBillingConfig();
  const trialEndsAt = new Date(now.getTime() + config.trialDays * DAY);

  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { kind: input.kind, name, slug: slugFor(name), timezone, billingState: "TRIAL", trialEndsAt },
      select: { id: true, slug: true, name: true, kind: true, trialEndsAt: true },
    });
    const m = await tx.membership.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" }, select: { id: true } });
    await tx.subscription.create({ data: { workspaceId: ws.id, billingEmail: user.email } });
    await tx.usageCap.createMany({ data: TRIAL_CAPS.map((c) => ({ workspaceId: ws.id, meter: c.meter, limitQuantity: c.limitQuantity, source: "TRIAL" as const })) });
    await tx.auditLog.create({
      data: { workspaceId: ws.id, actorUserId: user.id, action: "workspace.create", targetType: "Workspace", targetId: ws.id, data: { kind: input.kind, membershipId: m.id } },
    });
    return { workspaceId: ws.id, slug: ws.slug, name: ws.name, kind: ws.kind, trialEndsAt: ws.trialEndsAt!.toISOString() };
  }, { timeout: 30_000 });
}

/** Onboarding step 1 and workspace settings: the name and time zone. */
export async function updateWorkspaceProfileFor(actorUserId: string, workspaceId: string, input: { name?: string; timezone?: string }) {
  const data: { name?: string; timezone?: string } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) throw new BillingError("FORBIDDEN", "Names are 2 to 80 characters");
    data.name = name;
  }
  if (input.timezone !== undefined) {
    if (!isTimeZone(input.timezone)) throw new BillingError("FORBIDDEN", "Unknown time zone");
    data.timezone = input.timezone;
  }
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.update({ where: { id: workspaceId }, data, select: { id: true, name: true, timezone: true } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "workspace.profile", targetType: "Workspace", targetId: workspaceId, data } });
    return ws;
  }, { timeout: 30_000 });
}
