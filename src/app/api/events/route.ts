import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { message: "courseId is required" },
        { status: 400 }
      );
    }

    const events = await prisma.courseEvent.findMany({
      where: { courseId },
      include: {
        course: {
          include: {
            tutor: true
          }
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const event = await prisma.courseEvent.create({
      data: {
        title: body.title,
        type: body.type,
        description: body.description,
        duration: body.duration ?? null,
        location: body.location ?? null,
        date: new Date(body.date),
        link: body.link,
        courseId: body.courseId,
      },
    });

    return NextResponse.json(event);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Failed to create event" },
      { status: 500 }
    );
  }
}
