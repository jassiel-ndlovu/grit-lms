import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const tutors = await prisma.tutor.findMany();
  return NextResponse.json(tutors);
}

export async function POST(req: Request) {
  const data = await req.json();
  const tutor = await prisma.tutor.create({ data });
  return NextResponse.json(tutor);
}
