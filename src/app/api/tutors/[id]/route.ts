import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const updated = await prisma.tutor.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.tutor.delete({ where: { id: params.id } });
  return new NextResponse('Deleted', { status: 204 });
}
