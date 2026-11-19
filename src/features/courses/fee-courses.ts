/**
 * The courses a viewer may charge fees on, with the learners enrolled in
 * each: the course filter on the fees list and the "New fee" picker.
 * The scope matches A's listFeeInvoices and assertFeeScope: a tutor whose
 * fees.manage is scoped gets the courses they own or teach; owners and
 * admins get every course in the workspace. A's actions check again.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { needsScope } from "@/lib/viewer-core";
import type { Viewer } from "@/lib/viewer";

export type FeeCourse = {
  id: string;
  name: string;
  learners: Array<{ learnerId: string; name: string }>;
};

export async function feeCourses(viewer: Viewer): Promise<FeeCourse[]> {
  const workspaceId = viewer.workspace?.id;
  if (!workspaceId) return [];
  const membershipId = viewer.membership?.id;
  const scoped = needsScope(viewer, "fees.manage");
  if (scoped && !membershipId) return [];

  const rows = await prisma.course.findMany({
    where: {
      workspaceId,
      ...(scoped ? { OR: [{ ownerMembershipId: membershipId }, { staff: { some: { membershipId } } }] } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      enrollments: {
        where: { endedAt: null },
        select: { learnerId: true, learner: { select: { user: { select: { name: true, email: true } } } } },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    learners: c.enrollments
      .map((e) => ({ learnerId: e.learnerId, name: e.learner.user.name || e.learner.user.email }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
