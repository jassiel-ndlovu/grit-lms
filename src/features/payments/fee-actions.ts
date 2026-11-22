"use server";

/**
 * Gate 2 tutor-side actions (contract section 3). Permissions:
 * `payouts.connect`, `workspace.settings`, `fees.manage` (a tutor only on
 * courses they teach) and `fees.markOffsite`. The work is in ./fees.ts.
 * Behind BILLING=1 like the rest of billing.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertBillingEnabled, BillingError } from "@/features/billing/errors";
import { viewerActionClient } from "@/lib/safe-action";
import { canIn, requireViewer, ViewerError, type Viewer } from "@/lib/viewer";
import { can, needsScope } from "@/lib/viewer-core";
import { prisma } from "@/lib/db";

import { createFeeDiscountCode as createFeeDiscountCodeFor, deactivateFeeDiscountCode as deactivateFeeDiscountCodeFor } from "./fee-discounts";
import * as fees from "./fees";

async function staff(permission?: Parameters<typeof can>[1]) {
  assertBillingEnabled();
  const viewer = await requireViewer({ workspace: true, ...(permission ? { permission } : {}) });
  return { viewer, workspaceId: viewer.workspace!.id };
}

function actorOf(viewer: Viewer): fees.Actor {
  const role = viewer.persona === "admin" ? "NEXA_ADMIN" : ((viewer.membership?.role ?? "TUTOR") as fees.Actor["role"]);
  return { userId: viewer.user.id, role };
}

/** The viewer may manage fees on every course in `courseIds`; a course-less line needs unscoped fees.manage. */
async function assertFeeScope(viewer: Viewer, courseIds: Array<string | null | undefined>, permission: "fees.manage" | "fees.markOffsite" = "fees.manage") {
  if (!can(viewer, permission)) throw new ViewerError("FORBIDDEN");
  for (const courseId of courseIds) {
    if (courseId) {
      if (!(await canIn(viewer, permission, { courseId }))) throw new ViewerError("FORBIDDEN");
    } else if (needsScope(viewer, permission)) {
      throw new ViewerError("FORBIDDEN");
    }
  }
}

/**
 * A tutor (scoped fees) may only bill a learner who is on the course they
 * bill for. Owners and admins bill anyone in the workspace (fees.ts checks
 * the learner is in it).
 */
async function assertLearnerOnCourses(viewer: Viewer, learnerId: string | null | undefined, courseIds: Array<string | null | undefined>) {
  if (!learnerId || !needsScope(viewer, "fees.manage")) return;
  for (const courseId of courseIds) {
    if (!courseId) continue;
    const on = await prisma.enrollment.findFirst({ where: { learnerId, courseId, endedAt: null }, select: { id: true } });
    if (!on) throw new ViewerError("FORBIDDEN");
  }
}

async function invoiceCourses(invoiceId: string): Promise<Array<string | null>> {
  const lines = await prisma.invoiceLine.findMany({ where: { invoiceId }, select: { courseId: true } });
  return lines.length ? lines.map((l) => l.courseId) : [null];
}

const done = <T,>(r: T): T => {
  revalidatePath("/dashboard", "layout");
  return r;
};

const note = z.string().trim().min(3).max(500);

export const setPayoutMode = viewerActionClient
  .schema(z.object({ payoutMode: z.enum(["WORKSPACE", "PER_TUTOR"]) }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff("workspace.settings");
    return done(await fees.setPayoutMode(actorOf(viewer), workspaceId, parsedInput.payoutMode));
  });

export const resolvePayoutAccount = viewerActionClient
  .schema(z.object({ bankCode: z.string().min(1).max(20), accountNumber: z.string().min(6).max(24), idNumber: z.string().max(20).optional() }))
  .action(async ({ parsedInput }) => {
    await staff();
    return fees.resolvePayoutAccount(parsedInput);
  });

/**
 * WORKSPACE mode: the workspace's account (owner or admin, `payouts.connect`).
 * PER_TUTOR mode: the caller's own account; tutors may connect their own
 * here even without `payouts.connect` (design 01, section 6).
 */
export const connectPayoutAccount = viewerActionClient
  .schema(z.object({
    bankCode: z.string().min(1).max(20),
    accountNumber: z.string().min(6).max(24),
    businessName: z.string().trim().min(2).max(100),
    idNumber: z.string().max(20).optional(),
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    const { payoutMode } = await fees.payoutSettingsFor(workspaceId);
    let membershipId: string | null = null;
    if (payoutMode === "PER_TUTOR") {
      if (!viewer.membership || viewer.membership.id.startsWith("legacy_")) throw new ViewerError("FORBIDDEN");
      membershipId = viewer.membership.id;
    } else if (!can(viewer, "payouts.connect")) {
      throw new ViewerError("FORBIDDEN");
    }
    return done(await fees.connectPayoutAccount(actorOf(viewer), { ...parsedInput, workspaceId, membershipId, contactEmail: viewer.user.email }));
  });

export const upsertFeeSchedule = viewerActionClient
  .schema(z.object({
    id: z.string().optional(),
    courseId: z.string().min(1),
    learnerId: z.string().nullable().optional(),
    kind: z.enum(["MONTHLY", "LESSON_PACK", "ONCE_OFF"]),
    amountCents: z.number().int().positive().max(100_000_000),
    lessonsInPack: z.number().int().positive().nullable().optional(),
    description: z.string().trim().min(1).max(200),
    billingDay: z.number().int().min(1).max(28).nullable().optional(),
    startsOn: z.string(),
    endsOn: z.string().nullable().optional(),
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    await assertFeeScope(viewer, [parsedInput.courseId]);
    await assertLearnerOnCourses(viewer, parsedInput.learnerId, [parsedInput.courseId]);
    return done(await fees.upsertFeeSchedule(actorOf(viewer), workspaceId, parsedInput));
  });

export const issueInvoice = viewerActionClient
  .schema(z.object({
    learnerId: z.string().min(1),
    lines: z.array(z.object({
      courseId: z.string().nullable().optional(),
      description: z.string().trim().min(1).max(200),
      quantity: z.number().int().positive().max(1000),
      unitAmountCents: z.number().int().positive().max(100_000_000),
    })).min(1).max(50),
    dueAt: z.string(),
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    await assertFeeScope(viewer, parsedInput.lines.map((l) => l.courseId));
    await assertLearnerOnCourses(viewer, parsedInput.learnerId, parsedInput.lines.map((l) => l.courseId));
    return done(await fees.issueInvoice(actorOf(viewer), workspaceId, parsedInput));
  });

export const voidInvoice = viewerActionClient
  .schema(z.object({ invoiceId: z.string().min(1), reason: note }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    await assertFeeScope(viewer, await invoiceCourses(parsedInput.invoiceId));
    return done(await fees.voidInvoice(actorOf(viewer), workspaceId, parsedInput));
  });

export const markInvoicePaidOffsite = viewerActionClient
  .schema(z.object({
    invoiceId: z.string().min(1),
    method: z.enum(["CASH", "EFT", "OTHER"]),
    amountCents: z.number().int().positive(),
    receivedOn: z.string(),
    reference: z.string().max(120).nullable().optional(),
    note,
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    await assertFeeScope(viewer, await invoiceCourses(parsedInput.invoiceId), "fees.markOffsite");
    return done(await fees.markInvoicePaidOffsite(actorOf(viewer), workspaceId, parsedInput));
  });

export const voidOffsitePayment = viewerActionClient
  .schema(z.object({ offsitePaymentId: z.string().min(1), reason: note }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await staff();
    const off = await prisma.offsitePayment.findUnique({ where: { id: parsedInput.offsitePaymentId }, select: { invoiceId: true } });
    if (!off?.invoiceId) throw new BillingError("NOT_FOUND", "Off-site payment not found");
    await assertFeeScope(viewer, await invoiceCourses(off.invoiceId), "fees.markOffsite");
    return done(await fees.voidOffsitePayment(actorOf(viewer), workspaceId, parsedInput));
  });

/* Discount codes on parent invoices (./fee-discounts.ts): owners and admins only, since the discount comes out of every payee's share. */
async function workspaceFeeManager() {
  const { viewer, workspaceId } = await staff("fees.manage");
  if (needsScope(viewer, "fees.manage")) throw new ViewerError("FORBIDDEN");
  return { viewer, workspaceId };
}

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Must be a date");

export const createFeeDiscountCode = viewerActionClient
  .schema(z.object({
    code: z.string().trim().min(3).max(32),
    description: z.string().trim().min(1).max(200),
    kind: z.enum(["PERCENT", "FIXED"]),
    percentBps: z.number().int().min(1).max(10_000).nullable().optional(),
    amountCents: z.number().int().positive().nullable().optional(),
    startsAt: isoDate,
    endsAt: isoDate.nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    durationPeriods: z.number().int().positive().nullable().optional(),
  }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await workspaceFeeManager();
    return done(await createFeeDiscountCodeFor(actorOf(viewer), workspaceId, parsedInput));
  });

export const deactivateFeeDiscountCode = viewerActionClient
  .schema(z.object({ id: z.string().min(1).max(64) }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await workspaceFeeManager();
    return done(await deactivateFeeDiscountCodeFor(actorOf(viewer), workspaceId, parsedInput));
  });
