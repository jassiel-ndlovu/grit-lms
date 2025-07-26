import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { testId: string } }) {
  const data = await req.json();
  const updated = await prisma.test.update({ where: { id: params.testId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { testId: string } }) {
  await prisma.test.delete({ where: { id: params.testId } });
  return NextResponse.json({ message: "Deleted successfully" });
}
