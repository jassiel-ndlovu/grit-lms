import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emitNotification } from "@/features/notifications/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { id } = await params;

  const submission = await prisma.submission.update({
    where: { id: id },
    data: {
      title: body.title,
      fileType: body.fileType,
      maxAttempts: body.maxAttempts,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });

  await emitNotification(
  {
    title: "Submission Updated",
    message: `The submission "${submission.title}" has been updated.`,
    link: `/dashboard/submissions/${submission.id}`,
    type: "SUBMISSION_UPDATED",
    courseId: submission.courseId,
  },
  { revalidate: false },
);

  return NextResponse.json(submission);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const submission = await prisma.submission.delete({ where: { id: id } });

  await emitNotification(
    {
      title: "Submission Deleted",
      message: `The submission "${submission.title}" has been removed.`,
      type: "SUBMISSION_DELETED",
      courseId: submission.courseId,
    },
    { revalidate: false },
  );

  return NextResponse.json({ success: true });
}
