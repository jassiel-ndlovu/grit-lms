/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const courseId = searchParams.get("courseId");
  const testSubId = searchParams.get("submissionId");
  const type = searchParams.get("type");

  try {
    let grades: any;

    if (testSubId && studentId) {
      grades = await prisma.grade.findUnique({
        where: {
          studentId: studentId,
          testSubmissionId: testSubId,
        },
      });
    } else {
      grades = await prisma.grade.findMany({
        where: {
          studentId: studentId || undefined,
          courseId: courseId || undefined,
          type: type || undefined,
        },
      });
    }

    return NextResponse.json(grades);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  try {
    const grade = await prisma.grade.create({ data });
    return NextResponse.json(grade, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to create grade" },
      { status: 500 }
    );
  }
}
