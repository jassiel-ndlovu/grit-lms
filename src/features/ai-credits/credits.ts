/**
 * AI credits (#216 phase 1; owner decisions 22 Nov). Contract: billing.md,
 * "AI credits". Server only.
 *
 * Pools: INCLUDED (renewed each billing period from paid Pro and Plus
 * seats, lapses at the period's end; a trial gets a one-off amount), BOUGHT
 * (lasts) and PERSONAL (a tutor's own, used only if the organisation allows).
 * A person's allowance limits how much of the organisation's credits they
 * use each calendar month.
 *
 * Credits apply only with BILLING=1. A comped workspace's spending is
 * recorded but never refused. Spends take a per-workspace lock so two
 * marks never spend the same credits.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { isBillingEnabled } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";

import { AI_CREDITS, includedCreditsFor, pastWarning, planSpend, type Balances } from "./credits-math";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** The workspace's current included grant, made on first need. Null when it has none (comped, read-only, cancelled, or no period). */
export async function ensureIncludedGrant(db: Db, workspaceId: string, now: Date = new Date()): Promise<{ key: string; credits: number; expiresAt: Date | null } | null> {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { billingState: true, trialEndsAt: true } });
  let key: string;
  let credits: number;
  let expiresAt: Date | null;
  if (ws.billingState === "TRIAL") {
    if (ws.trialEndsAt && ws.trialEndsAt <= now) return null;
    key = "trial";
    credits = AI_CREDITS.trialCredits;
    expiresAt = ws.trialEndsAt;
  } else if (ws.billingState === "ACTIVE" || ws.billingState === "PAST_DUE") {
    const period = await db.billingPeriod.findFirst({ where: { workspaceId, start: { lte: now }, end: { gt: now } }, orderBy: { start: "desc" }, select: { id: true, end: true } });
    if (!period) return null;
    key = `period:${period.id}`;
    credits = includedCreditsFor(await db.seatCharge.findMany({ where: { billingPeriodId: period.id }, select: { tierKey: true } }));
    expiresAt = period.end;
  } else {
    return null;
  }
  const existing = await db.aiCreditEntry.findUnique({ where: { key: `included:${workspaceId}:${key}` }, select: { credits: true, expiresAt: true } });
  if (existing) return { key, credits: existing.credits, expiresAt: existing.expiresAt };
  await db.aiCreditEntry.createMany({
    data: [{ workspaceId, pool: "INCLUDED", kind: "GRANT", credits, periodKey: key, expiresAt, key: `included:${workspaceId}:${key}`, note: key === "trial" ? "Trial credits" : "Included with the subscription" }],
    skipDuplicates: true,
  });
  return { key, credits, expiresAt };
}

/** The allowance that applies to a member this month: theirs, else a team's (the largest), else a branch's, else the workspace default. */
async function allowanceFor(db: Db, workspaceId: string, userId: string): Promise<number | null> {
  const m = await db.membership.findFirst({ where: { workspaceId, userId, status: "ACTIVE" }, select: { id: true, branchIds: true, teams: { select: { teamId: true, team: { select: { branchId: true } } } } } });
  const rows = await db.aiCreditAllowance.findMany({ where: { workspaceId }, select: { targetType: true, targetId: true, monthlyCredits: true } });
  if (!rows.length) return null;
  const pick = (type: string, ids: string[]) => {
    const hits = rows.filter((r) => r.targetType === type && ids.includes(r.targetId)).map((r) => r.monthlyCredits);
    return hits.length ? Math.max(...hits) : null;
  };
  if (m) {
    const own = pick("MEMBERSHIP", [m.id]);
    if (own !== null) return own;
    const team = pick("TEAM", m.teams.map((t) => t.teamId));
    if (team !== null) return team;
    const branch = pick("BRANCH", [...m.branchIds, ...m.teams.map((t) => t.team.branchId).filter((b): b is string => !!b)]);
    if (branch !== null) return branch;
  }
  return pick("WORKSPACE_DEFAULT", [""]);
}

async function sum(db: Db, where: Prisma.AiCreditEntryWhereInput): Promise<number> {
  return (await db.aiCreditEntry.aggregate({ where, _sum: { credits: true } }))._sum.credits ?? 0;
}

/** Balances for a spender (or the workspace alone, with no userId). */
export async function balancesFor(db: Db, workspaceId: string, userId: string | null, now: Date = new Date()) {
  const grant = await ensureIncludedGrant(db, workspaceId, now);
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { aiPersonalCredits: true, billingState: true } });
  const [includedLeft, bought, boughtTotal, personal, usedThisMonth, allowance] = await Promise.all([
    grant ? sum(db, { workspaceId, pool: "INCLUDED", periodKey: grant.key }) : 0,
    sum(db, { workspaceId, pool: "BOUGHT" }),
    sum(db, { workspaceId, pool: "BOUGHT", credits: { gt: 0 } }),
    userId ? sum(db, { workspaceId, pool: "PERSONAL", userId }) : 0,
    userId ? -(await sum(db, { workspaceId, userId, kind: "SPEND", pool: { in: ["INCLUDED", "BOUGHT"] }, createdAt: { gte: monthStart(now) } })) : 0,
    userId ? allowanceFor(db, workspaceId, userId) : null,
  ]);
  const balances: Balances = {
    included: Math.max(0, includedLeft),
    bought: Math.max(0, bought),
    personal: Math.max(0, personal),
    allowanceLeft: allowance === null ? null : allowance - usedThisMonth,
    personalAllowed: ws.aiPersonalCredits,
  };
  const poolTotal = (grant?.credits ?? 0) + boughtTotal;
  return {
    balances, grant, comped: ws.billingState === "COMPED", usedThisMonth, allowance,
    poolTotal, poolLeft: balances.included + balances.bought,
    warning: pastWarning(poolTotal - (balances.included + balances.bought), poolTotal) || (allowance !== null && pastWarning(usedThisMonth, allowance)),
  };
}

function forcedParts(b: Balances, need: number): Array<{ pool: "INCLUDED" | "BOUGHT" | "PERSONAL"; credits: number }> {
  const plan = planSpend({ ...b, allowanceLeft: null }, need);
  if (plan.ok) return plan.parts;
  const parts: Array<{ pool: "INCLUDED" | "BOUGHT" | "PERSONAL"; credits: number }> = [];
  let left = need;
  for (const [pool, have] of [["INCLUDED", b.included], ["BOUGHT", b.bought], ["PERSONAL", b.personalAllowed ? b.personal : 0]] as const) {
    const n = Math.min(left, Math.max(0, have));
    if (n > 0) { parts.push({ pool, credits: n }); left -= n; }
  }
  if (left > 0) parts.push({ pool: "BOUGHT", credits: left });
  return parts;
}

export type SpendResult ={ ok: true; credits: number; metered: boolean } | { ok: false; reason: "ALLOWANCE" | "EMPTY"; message: string };

const REFUSED: Record<"ALLOWANCE" | "EMPTY", string> = {
  ALLOWANCE: "You've used your AI allowance for this month. Ask your manager for more.",
  EMPTY: "Your organisation's AI credits have run out. An owner or finance manager can buy more.",
};

/** Whether `credits` could be spent now, without spending them (for a check before an expensive call). */
export async function canSpend(workspaceId: string, userId: string, credits: number, now: Date = new Date()): Promise<SpendResult> {
  if (!isBillingEnabled()) return { ok: true, credits: 0, metered: false };
  const b = await balancesFor(prisma, workspaceId, userId, now);
  if (b.comped) return { ok: true, credits, metered: true };
  const plan = planSpend(b.balances, credits);
  return plan.ok ? { ok: true, credits, metered: true } : { ok: false, reason: plan.reason, message: REFUSED[plan.reason] };
}

/**
 * Spends credits for a finished AI call. With `force`, a shortfall is still
 * recorded (the call already happened and cost Nexa money), as a negative
 * balance in the last pool tried.
 */
export async function spendCredits(input: { workspaceId: string; userId: string; credits: number; feature: string; ref?: string; force?: boolean }, now: Date = new Date()): Promise<SpendResult> {
  if (!isBillingEnabled()) return { ok: true, credits: 0, metered: false };
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-credits:${input.workspaceId}`}))`;
    const b = await balancesFor(tx, input.workspaceId, input.userId, now);
    const base = { workspaceId: input.workspaceId, kind: "SPEND" as const, userId: input.userId, feature: input.feature, ref: input.ref ?? null };
    if (b.comped) {
      await tx.aiCreditEntry.create({ data: { ...base, pool: "INCLUDED", credits: -input.credits, periodKey: "comped" } });
      return { ok: true as const, credits: input.credits, metered: true };
    }
    const plan = planSpend(b.balances, input.credits);
    if (!plan.ok && !input.force) return { ok: false as const, reason: plan.reason, message: REFUSED[plan.reason] };
    // Forced (the call already happened): take what is there, ignoring the
    // allowance, and record the rest as a debt on bought credits, which the
    // next purchase repays (an included debt would vanish at renewal).
    const parts = plan.ok ? plan.parts : forcedParts(b.balances, input.credits);
    for (const p of parts) {
      await tx.aiCreditEntry.create({
        data: { ...base, pool: p.pool, credits: -p.credits, periodKey: p.pool === "INCLUDED" ? (b.grant?.key ?? null) : null, ...(p.pool === "PERSONAL" ? { userId: input.userId } : {}) },
      });
    }
    return { ok: true as const, credits: input.credits, metered: true };
  }, { timeout: 30_000 });
}

/* ------------------------- Management and admin -------------------------- */

export async function setAllowanceFor(actor: { userId: string; workspaceId: string }, input: { targetType: "WORKSPACE_DEFAULT" | "BRANCH" | "TEAM" | "MEMBERSHIP"; targetId?: string; monthlyCredits: number | null }) {
  const targetId = input.targetType === "WORKSPACE_DEFAULT" ? "" : (input.targetId ?? "");
  if (input.targetType !== "WORKSPACE_DEFAULT") {
    const found =
      input.targetType === "BRANCH" ? await prisma.branch.count({ where: { id: targetId, workspaceId: actor.workspaceId } })
      : input.targetType === "TEAM" ? await prisma.team.count({ where: { id: targetId, workspaceId: actor.workspaceId } })
      : await prisma.membership.count({ where: { id: targetId, workspaceId: actor.workspaceId } });
    if (!found) throw new UserError("Not found in this organisation.");
  }
  const where = { workspaceId_targetType_targetId: { workspaceId: actor.workspaceId, targetType: input.targetType, targetId } };
  if (input.monthlyCredits === null) {
    await prisma.aiCreditAllowance.deleteMany({ where: { workspaceId: actor.workspaceId, targetType: input.targetType, targetId } });
  } else {
    if (!Number.isInteger(input.monthlyCredits) || input.monthlyCredits < 0 || input.monthlyCredits > 10_000_000) throw new UserError("Enter a whole number of credits.");
    await prisma.aiCreditAllowance.upsert({ where, create: { workspaceId: actor.workspaceId, targetType: input.targetType, targetId, monthlyCredits: input.monthlyCredits, updatedById: actor.userId }, update: { monthlyCredits: input.monthlyCredits, updatedById: actor.userId } });
  }
  await prisma.auditLog.create({ data: { workspaceId: actor.workspaceId, actorUserId: actor.userId, action: "ai.allowance", targetType: "AiCreditAllowance", targetId: `${input.targetType}:${targetId}`, data: { monthlyCredits: input.monthlyCredits } } });
  return { targetType: input.targetType, targetId, monthlyCredits: input.monthlyCredits };
}

export async function setPersonalCreditsFor(actor: { userId: string; workspaceId: string }, allowed: boolean) {
  await prisma.workspace.update({ where: { id: actor.workspaceId }, data: { aiPersonalCredits: allowed } });
  await prisma.auditLog.create({ data: { workspaceId: actor.workspaceId, actorUserId: actor.userId, action: "ai.personal_credits", targetType: "Workspace", targetId: actor.workspaceId, data: { allowed } } });
  return { allowed };
}

/** A Nexa admin gives credits (goodwill, or bought by EFT until card purchases go live in January). Bought credits last; personal ones go to one person. */
export async function grantCreditsFor(actor: { userId: string; impersonatorUserId: string | null }, input: { workspaceId: string; credits: number; pool: "BOUGHT" | "PERSONAL"; userId?: string; note: string }) {
  if (!Number.isInteger(input.credits) || input.credits === 0 || Math.abs(input.credits) > 10_000_000) throw new UserError("Enter a whole number of credits.");
  if (input.pool === "PERSONAL" && !input.userId) throw new UserError("Choose whose credits these are.");
  const e = await prisma.aiCreditEntry.create({
    data: { workspaceId: input.workspaceId, pool: input.pool, kind: input.credits > 0 ? "GRANT" : "ADJUST", credits: input.credits, userId: input.pool === "PERSONAL" ? input.userId : null, note: input.note, createdById: actor.userId },
    select: { id: true },
  });
  await prisma.auditLog.create({ data: { workspaceId: input.workspaceId, actorUserId: actor.userId, impersonatorUserId: actor.impersonatorUserId, action: "admin.ai.credits", targetType: "AiCreditEntry", targetId: e.id, data: { credits: input.credits, pool: input.pool, note: input.note } } });
  return { id: e.id };
}

/** For management: the pools, this month's use by person and feature, and the allowances. */
export async function creditReportFor(workspaceId: string, now: Date = new Date()) {
  const b = await balancesFor(prisma, workspaceId, null, now);
  const since = monthStart(now);
  const [byUser, byFeature, allowances] = await Promise.all([
    prisma.aiCreditEntry.groupBy({ by: ["userId"], where: { workspaceId, kind: "SPEND", createdAt: { gte: since } }, _sum: { credits: true } }),
    prisma.aiCreditEntry.groupBy({ by: ["feature"], where: { workspaceId, kind: "SPEND", createdAt: { gte: since } }, _sum: { credits: true } }),
    prisma.aiCreditAllowance.findMany({ where: { workspaceId }, select: { targetType: true, targetId: true, monthlyCredits: true } }),
  ]);
  const names = new Map((await prisma.user.findMany({ where: { id: { in: byUser.map((u) => u.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return {
    included: b.grant ? { credits: b.grant.credits, left: b.balances.included, renewsAt: b.grant.expiresAt?.toISOString() ?? null } : null,
    bought: b.balances.bought,
    comped: b.comped,
    warning: b.warning,
    thisMonth: {
      byPerson: byUser.map((u) => ({ userId: u.userId, name: u.userId ? (names.get(u.userId) ?? "Former member") : "Unknown", credits: -(u._sum.credits ?? 0) })).sort((a, c) => c.credits - a.credits),
      byFeature: byFeature.map((f) => ({ feature: f.feature ?? "other", credits: -(f._sum.credits ?? 0) })),
    },
    allowances,
    personalCreditsAllowed: (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { aiPersonalCredits: true } })).aiPersonalCredits,
    creditValueCents: AI_CREDITS.centsPerCredit,
  };
}
