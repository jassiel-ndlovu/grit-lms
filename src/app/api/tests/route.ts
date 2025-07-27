import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const tutorId = req.nextUrl.searchParams.get("tutorId");
  if (!tutorId) return NextResponse.json({ error: "Tutor ID required" }, { status: 400 });

  const tests = await prisma.test.findMany({
    where: {
      course: {
        tutorId: tutorId,
      },
    },
    include: {
      course: true,
      submissions: true,
      questions: true,
    },
  });
  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const newTest = await prisma.test.create({ data });
  return NextResponse.json(newTest);
}
