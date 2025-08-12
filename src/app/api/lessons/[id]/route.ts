import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;
  const body = await req.json();

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: body.title,
      description: body.description,
      videoUrl: body.videoUrl,
      attachmentUrls: body.attachmentUrls 
      ? {
          deleteMany: {},
          create: (body.attachmentUrls as AppTypes.Attachment[]).map(({ url, title }) => ({ url, title })),
        }
      : undefined,
      order: body.order ?? 0,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;

  await prisma.lesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ success: true });
}
