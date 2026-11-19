"use server";

/**
 * Billing actions (docs/revamp/contracts/billing.md, section 1). Behind the
 * BILLING flag. Built here: setCourseServices. The payment actions follow
 * once Paystack test keys exist.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { viewerActionClient } from "@/lib/safe-action";

import { BillingError } from "./errors";
import { addDays, applyServiceChange, billedTier, derivedTier, holdUntilFor, tierAbove } from "./pricing";
import { assertSwitchable, loadServiceChangeContext, requireCourseServicesAccess } from "./queries";

const keyList = z.array(z.string().min(1).max(64)).max(32);

export const setCourseServices = viewerActionClient
  .schema(z.object({ courseId: z.string().min(1), enable: keyList.default([]), disable: keyList.default([]) }))
  .action(async ({ parsedInput: { courseId, enable, disable } }) => {
    const { viewer, course } = await requireCourseServicesAccess(courseId);
    assertSwitchable([...enable, ...disable]);
    const ws = viewer.workspace!;
    const state = ws.billingState;
    if (state === "READ_ONLY" || state === "CANCELLED" || ws.readOnly) {
      throw new BillingError("READ_ONLY", "The workspace is read-only until the bill is paid");
    }

    const now = new Date();
    const before = derivedTier(course.enabledKeys);
    const after = derivedTier(applyServiceChange(course.enabledKeys, enable, disable));
    const billedNow = billedTier({ derived: before, holds: course.holds, override: course.override, at: now });
    if (state === "PAST_DUE" && tierAbove(after, billedNow)) {
      throw new BillingError("PAST_DUE", "Pay the overdue bill before raising a course's tier");
    }

    const ctx = await loadServiceChangeContext(course, state, now);
    const raised = !ctx.inTrial && tierAbove(after, before);
    const newHold = raised ? { tierKey: after, raisedAt: now, holdUntil: addDays(now, ctx.holdDays) } : null;

    await prisma.$transaction(async (tx) => {
      const rows = [
        ...enable.map((k) => ({ key: k, enabled: true })),
        ...disable.filter((k) => !enable.includes(k)).map((k) => ({ key: k, enabled: false })),
      ];
      for (const r of rows) {
        await tx.courseService.upsert({
          where: { courseId_serviceKey: { courseId, serviceKey: r.key } },
          create: {
            workspaceId: course.workspaceId, courseId, serviceKey: r.key, enabled: r.enabled,
            changedAt: now, changedByUserId: viewer.user.id,
          },
          update: { enabled: r.enabled, changedAt: now, changedByUserId: viewer.user.id },
        });
      }
      if (newHold) {
        await tx.courseTierHold.create({
          data: { workspaceId: course.workspaceId, courseId, raisedByUserId: viewer.user.id, ...newHold },
        });
      }
      await tx.auditLog.create({
        data: {
          workspaceId: course.workspaceId,
          actorUserId: viewer.user.id,
          impersonatorUserId: viewer.impersonatedBy?.userId ?? null,
          action: "billing.services.set",
          targetType: "Course",
          targetId: courseId,
          data: { enable, disable, derivedBefore: before, derivedAfter: after, holdUntil: newHold?.holdUntil.toISOString() ?? null },
        },
      });
    });

    const holds = newHold ? [...course.holds, newHold] : course.holds;
    const billed = billedTier({ derived: after, holds, override: course.override, at: now });
    revalidatePath("/dashboard", "layout");
    return {
      derivedTierKey: after,
      billedTierKey: billed,
      holdUntil: holdUntilFor({ billed, holds, at: now })?.toISOString() ?? null,
    };
  });
