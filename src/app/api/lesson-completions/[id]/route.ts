/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const completion = await prisma.lessonCompletion.findUnique({
      where: { id: id },
      include: { student: true, lesson: true },
    });

    if (!completion) {
      return NextResponse.json(
        { message: "Lesson completion not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(completion);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to fetch lesson completion", error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { completedAt } = body;

    const updated = await prisma.lessonCompletion.update({
      where: { id: id },
      data: {
        ...(completedAt && { completedAt: new Date(completedAt) }),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to update lesson completion", error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.lessonCompletion.delete({
      where: { id: id },
    });

    return NextResponse.json(
      { message: "Lesson completion deleted successfully" },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to delete lesson completion", error: err.message },
      { status: 500 }
    );
  }
}
