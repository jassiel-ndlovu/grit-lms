/**
 * The study assistant's on and off switch for one student on one course
 * (owner, 24 Nov). Staff who may edit the course switch it; A's
 * features/study refuses a student who is switched off. A row in
 * StudyAssistantBlock is "off". The course-wide switch is the course's
 * Services.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";

/** Whether the viewer may switch it for this course's students. */
export async function maySwitchStudents(viewer: Viewer, courseId: string): Promise<boolean> {
  return viewer.persona === "staff" && (await canIn(viewer, "courses.edit", { courseId }));
}

export interface StudentSwitch {
  studentUserId: string;
  name: string;
  on: boolean;
}

/** The course's students now, by name, with whether the assistant is on for each. */
export async function studentSwitches(viewer: Viewer, courseId: string): Promise<StudentSwitch[]> {
  if (!(await maySwitchStudents(viewer, courseId))) throw new ViewerError("FORBIDDEN");
  const [enrolled, off] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, endedAt: null },
      select: { learner: { select: { userId: true, user: { select: { name: true } } } } },
    }),
    prisma.studyAssistantBlock.findMany({ where: { courseId }, select: { studentUserId: true } }),
  ]);
  const blocked = new Set(off.map((b) => b.studentUserId));
  return enrolled
    .map(({ learner: l }) => ({ studentUserId: l.userId, name: l.user.name, on: !blocked.has(l.userId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function isEnrolled(courseId: string, studentUserId: string): Promise<boolean> {
  return (await prisma.enrollment.count({ where: { courseId, endedAt: null, learner: { userId: studentUserId } } })) > 0;
}

/** Whether it's on for one student; null when the viewer may not switch it or the student has left. */
export async function studentSwitch(viewer: Viewer, courseId: string, studentUserId: string): Promise<boolean | null> {
  if (!(await maySwitchStudents(viewer, courseId)) || !(await isEnrolled(courseId, studentUserId))) return null;
  return (await prisma.studyAssistantBlock.count({ where: { courseId, studentUserId } })) === 0;
}

export async function setStudentSwitch(
  viewer: Viewer,
  input: { courseId: string; studentUserId: string; on: boolean },
): Promise<{ on: boolean }> {
  const { courseId, studentUserId, on } = input;
  if (!(await maySwitchStudents(viewer, courseId))) throw new ViewerError("FORBIDDEN");
  if (!(await isEnrolled(courseId, studentUserId))) throw new UserError("That student is no longer on this course.");
  await prisma.$transaction(async (tx) => {
    const changed = on
      ? await tx.studyAssistantBlock.deleteMany({ where: { courseId, studentUserId } })
      : await tx.studyAssistantBlock.createMany({
          data: [{ courseId, studentUserId, blockedById: viewer.user.id }],
          skipDuplicates: true,
        });
    if (changed.count === 0) return;
    await tx.auditLog.create({
      data: {
        workspaceId: viewer.workspace?.id ?? null,
        actorUserId: viewer.user.id,
        impersonatorUserId: viewer.impersonatedBy?.userId ?? null,
        action: on ? "study.student_on" : "study.student_off",
        targetType: "Course",
        targetId: courseId,
        data: { studentUserId },
      },
    });
  });
  return { on };
}
