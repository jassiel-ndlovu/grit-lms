import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const grade = await prisma.grade.findUnique({ where: { id: id } });
    if (!grade) return NextResponse.json({ message: "Grade not found" }, { status: 404 });
    return NextResponse.json(grade);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to fetch grade" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const data = await req.json();
  try {
    const grade = await prisma.grade.update({ where: { id: id }, data });
    return NextResponse.json(grade);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to update grade" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.grade.delete({ where: { id: id } });
    return NextResponse.json({ message: "Grade deleted" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to delete grade" }, { status: 500 });
  }
}
