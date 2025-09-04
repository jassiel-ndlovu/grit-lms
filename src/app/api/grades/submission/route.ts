import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const entryId = searchParams.get("entryId");

  try {
    if (entryId && studentId) {
      const grades = await prisma.grade.findUnique({
        where: {
          studentId: studentId,
          submissionEntryId: entryId,
        },
      });

      return NextResponse.json(grades);
    }
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
