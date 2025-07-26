import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "Course ID required" }, { status: 400 });

  const tests = await prisma.test.findMany({ where: { courseId } });
  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const newTest = await prisma.test.create({ data });
  return NextResponse.json(newTest);
}
