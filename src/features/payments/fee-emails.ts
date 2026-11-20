/**
 * Who gets fee emails, and queueing them (design 04, section 5; design 01,
 * section 6): every active guardian of the student, else the student if
 * they are an adult who may see their own fees, else nobody (the tutor
 * collects off-site). One row per recipient and event.
 */

import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma";
import type { FeeTemplate, FeeTemplateData } from "@/lib/email/fee-templates";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";

type Db = Prisma.TransactionClient | typeof prisma;

export async function feePayers(db: Db, input: { studentUserId: string; learnerId: string }): Promise<Array<{ userId: string; email: string }>> {
  const guardians = await db.guardianship.findMany({
    where: { studentUserId: input.studentUserId, status: "ACTIVE" },
    select: { guardian: { select: { id: true, email: true } } },
  });
  if (guardians.length) return guardians.map((g) => ({ userId: g.guardian.id, email: g.guardian.email }));
  const learner = await db.learner.findUnique({ where: { id: input.learnerId }, select: { paymentVisible: true, isMinor: true, user: { select: { id: true, email: true } } } });
  if (learner?.paymentVisible && !learner.isMinor) return [{ userId: learner.user.id, email: learner.user.email }];
  return [];
}

type Who = { payeeName: string; studentName: string; day: (d: Date) => string };

export async function queueFeeEmail<T extends Exclude<FeeTemplate, "receipt">>(
  db: Db,
  input: { studentUserId: string; learnerId: string; workspaceId: string; payoutAccountId: string; template: T; event: string; data: (who: Who) => FeeTemplateData[T] },
): Promise<number> {
  const payers = await feePayers(db, input);
  if (payers.length === 0) return 0;
  const [ws, student, payee] = await Promise.all([
    db.workspace.findUnique({ where: { id: input.workspaceId }, select: { timezone: true } }),
    db.user.findUnique({ where: { id: input.studentUserId }, select: { name: true } }),
    db.payoutAccount.findUnique({ where: { id: input.payoutAccountId }, select: { businessName: true } }),
  ]);
  const tz = ws?.timezone ?? "Africa/Johannesburg";
  const day = (d: Date) => new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(d);
  const data = input.data({ payeeName: payee?.businessName ?? "Your tutor", studentName: student?.name ?? "your child", day });
  for (const p of payers) {
    await enqueueEmail(db, {
      key: `fees:${input.template}:${input.event}:${createHash("sha256").update(p.email.toLowerCase()).digest("hex").slice(0, 16)}`,
      template: `fees:${input.template}`,
      to: p.email,
      userId: p.userId,
      workspaceId: input.workspaceId,
      category: "BILLING",
      priority: "BILLING",
      data: data as Prisma.InputJsonValue,
    });
  }
  return payers.length;
}
