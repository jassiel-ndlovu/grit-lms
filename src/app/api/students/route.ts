import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const students = await prisma.student.findMany();
  return NextResponse.json(students);
}

export async function POST(req: Request) {
  const data = await req.json();
  const student = await prisma.student.create({ data });
  return NextResponse.json(student);
}
