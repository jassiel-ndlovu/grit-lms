import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!courseId) {
    const students = await prisma.student.findMany();
    return NextResponse.json(students);
  }

  if (courseId) {
    const students = await prisma.student.findMany({
      where: {
        courses: {
          some: {
            id: courseId,
          },
        },
      },
    });

    return NextResponse.json(students);
  }
}

export async function POST(req: Request) {
  const data = await req.json();
  const student = await prisma.student.create({ data });
  return NextResponse.json(student);
}
