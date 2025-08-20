import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();

  const submission = await prisma.submission.update({
    where: { id: params.id },
    data: {
      title: body.title,
      fileType: body.fileType,
      maxAttempts: body.maxAttempts,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });

  return NextResponse.json(submission);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await prisma.submission.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
