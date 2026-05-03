/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ submissionId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { submissionId } = await params;

  try {
    const grades = await prisma.questionGrade.findMany({
      where: { testSubmissionId: submissionId },
    });
    return NextResponse.json(grades);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
