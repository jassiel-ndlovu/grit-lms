import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const data = await req.json();
  const { id } = await params;

  const updated = await prisma.test.update({
    where: { id: id },
    data: {
      ...data,
      questions: {
        deleteMany: {},
        create: data.questions.map((q: AppTypes.TestQuestion) => ({
          question: q.question,
          type: q.type,
          points: q.points,
          options: q.options,
          answer: q.answer,
        })),
      },
    },
  });

  await prisma.notification.create({
    data: {
      title: "Test Updated",
      message: `The test "${updated.title}" has been updated.`,
      link: `/dashboard/tests/${updated.id}`,
      type: "TEST_UPDATED",
      courseId: updated.courseId,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const test = await prisma.test.delete({ where: { id: id } });

  await prisma.notification.create({
    data: {
      title: "Test Deleted",
      message: `The test "${test.title}" has been removed.`,
      type: "TEST_DELETED",
      courseId: test.courseId,
    },
  });

  return NextResponse.json({ message: "Deleted successfully" });
}
