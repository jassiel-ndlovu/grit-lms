/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: fetch entries (optionally filtered by submissionId or studentId)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const submissionId = searchParams.get("submissionId");
  const studentId = searchParams.get("studentId");

  const where: any = {};
  const include: any = { student: true }

  if (submissionId && studentId) {
    const entry = await prisma.submissionEntry.findUnique({
      where: {
        submissionId_studentId: {
          submissionId,
          studentId,
        },
      },
      include: { student: true },
    });

    return NextResponse.json(entry);
  } else if (submissionId) where.submissionId = submissionId;
  else if (studentId) where.studentId = studentId;

  const entries = await prisma.submissionEntry.findMany({ where, include });

  return NextResponse.json(entries);
}

// POST: create a new entry
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const entry = await prisma.submissionEntry.create({ data });
    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
