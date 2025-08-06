import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getToken } from 'next-auth/jwt';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req });
  const { params } = context;

  const id = (await params).id;

  if (!token || token.role !== 'TUTOR') {
    return new NextResponse('Unauthorized', { status: 403 });
  }

  const data = await req.json();

  const updated = await prisma.course.update({
    where: { id: id },
    data,
    include: {
      tutor: true,
      students: true,
      lessons: true,
      quizzes: true,
      tests: true,
      submissions: true,
      courseEvents: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req });
  const { params } =  context;

  const id = (await params).id;

  if (!token || token.role !== 'TUTOR') {
    return new NextResponse('Unauthorized', { status: 403 });
  }

  await prisma.course.delete({
    where: { id: id },
  });

  return new NextResponse('Deleted', { status: 204 });
}
