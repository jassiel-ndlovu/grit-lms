import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await req.json();
  const { id } = await params;
  
  const updated = await prisma.tutor.update({
    where: { id: id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await prisma.tutor.delete({ where: { id: id } });
  return new NextResponse('Deleted', { status: 204 });
}
