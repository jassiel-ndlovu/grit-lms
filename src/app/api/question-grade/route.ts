/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const questionGrade = await prisma.questionGrade.create({ data });
    return NextResponse.json(questionGrade);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
