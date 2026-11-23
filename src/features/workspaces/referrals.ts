/**
 * Parent and student referrals (Core, owner decision 22 Nov; #216 phase 1).
 *
 * A student or parent in a workspace gets one personal link. Following it
 * (GET /api/referrals/<code>) keeps the code in a cookie for 30 days and
 * opens the workspace's listed courses. When that family asks to join a
 * course there, the referral is recorded (REQUESTED); when staff approve, it
 * becomes JOINED. A student counts for one referrer per workspace: the
 * first. Rewards aren't decided yet: staff see who referred whom.
 * Server only.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/email/config";
import { UserError } from "@/lib/user-error";

type Tx = Prisma.TransactionClient;

export const REFERRAL_COOKIE = "nexa_ref";
export const REFERRAL_COOKIE_DAYS = 30;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** True when the user is an active learner in the workspace, or a parent of one. */
async function belongsAsFamily(userId: string, workspaceId: string): Promise<boolean> {
  const n = await prisma.learner.count({
    where: {
      workspaceId, status: "ACTIVE",
      OR: [{ userId }, { user: { guardedBy: { some: { guardianUserId: userId, status: "ACTIVE" } } } }],
    },
  });
  return n > 0;
}

/** The person's link for a workspace (made on first ask), and how it has done. */
export async function referralLinkFor(userId: string, workspaceId: string) {
  if (!(await belongsAsFamily(userId, workspaceId))) throw new UserError("Only students and parents in this workspace have a referral link.");
  let code = await prisma.referralCode.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { id: true, code: true } });
  if (!code) {
    for (let i = 0; i < 3 && !code; i++) {
      try {
        code = await prisma.referralCode.create({ data: { workspaceId, userId, code: newCode() }, select: { id: true, code: true } });
      } catch {
        code = await prisma.referralCode.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { id: true, code: true } });
      }
    }
  }
  if (!code) throw new Error("Could not make a referral code");
  const counts = await prisma.referral.groupBy({ by: ["status"], where: { codeId: code.id }, _count: true });
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return { code: code.code, url: absoluteUrl(`/api/referrals/${code.code}`), requested: n("REQUESTED") + n("JOINED"), joined: n("JOINED") };
}

/** What a link points at, for the redirect route. */
export async function referralTarget(code: string) {
  if (!/^[a-z0-9]{6,20}$/.test(code)) return null;
  return prisma.referralCode.findUnique({ where: { code }, select: { code: true, workspaceId: true } });
}

/**
 * Called inside requestToJoinFor's transaction. Records the referral when
 * the code belongs to the course's workspace, isn't the family's own, and
 * the student wasn't already credited there.
 */
export async function recordReferral(tx: Tx, input: { code: string | null | undefined; workspaceId: string; requesterUserId: string; studentUserId: string; joinRequestId: string }) {
  if (!input.code) return null;
  const code = await tx.referralCode.findUnique({ where: { code: input.code }, select: { id: true, userId: true, workspaceId: true } });
  if (!code || code.workspaceId !== input.workspaceId) return null;
  if (code.userId === input.requesterUserId || code.userId === input.studentUserId) return null;
  // Referring your own child doesn't count.
  const ownChild = await tx.guardianship.count({ where: { guardianUserId: code.userId, studentUserId: input.studentUserId, status: "ACTIVE" } });
  if (ownChild) return null;
  const already = await tx.learner.count({ where: { workspaceId: input.workspaceId, userId: input.studentUserId } });
  if (already) return null;
  const r = await tx.referral.createMany({
    data: [{ workspaceId: input.workspaceId, codeId: code.id, referrerUserId: code.userId, referredUserId: input.studentUserId, joinRequestId: input.joinRequestId }],
    skipDuplicates: true,
  });
  return r.count ? "REQUESTED" : null;
}

/**
 * Called when a join request is approved. Keyed by workspace and student,
 * not by request: a family that cancelled and asked again keeps the
 * credit for whoever referred them first.
 */
export async function markReferralJoined(tx: Tx, input: { workspaceId: string; studentUserId: string }, at: Date) {
  await tx.referral.updateMany({ where: { workspaceId: input.workspaceId, referredUserId: input.studentUserId, status: "REQUESTED" }, data: { status: "JOINED", joinedAt: at } });
}

/** The workspace's referrals for staff: who referred whom, newest first, with totals per referrer. */
export async function listReferralsFor(workspaceId: string) {
  const rows = await prisma.referral.findMany({
    where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 200,
    select: { status: true, createdAt: true, joinedAt: true, referrer: { select: { id: true, name: true } }, referred: { select: { name: true } } },
  });
  const totals = new Map<string, { referrerId: string; name: string; requested: number; joined: number }>();
  for (const r of rows) {
    const t = totals.get(r.referrer.id) ?? { referrerId: r.referrer.id, name: r.referrer.name, requested: 0, joined: 0 };
    t.requested++;
    if (r.status === "JOINED") t.joined++;
    totals.set(r.referrer.id, t);
  }
  return {
    referrals: rows.map((r) => ({ referrerName: r.referrer.name, referredName: r.referred.name, status: r.status, createdAt: r.createdAt.toISOString(), joinedAt: r.joinedAt?.toISOString() ?? null })),
    byReferrer: [...totals.values()].sort((a, b) => b.joined - a.joined || b.requested - a.requested),
  };
}
