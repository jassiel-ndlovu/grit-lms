import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emitNotification } from "@/features/notifications/server";
import { eventChangeNotification } from "@/features/events/notify";

type Params = { 
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const event = await prisma.courseEvent.findUnique({
      where: { id: id },
    });
    if (!event) {
      return NextResponse.json({ message: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: Params
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const updated = await prisma.courseEvent.update({
      where: { id: id },
      data: {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      },
    });
    await emitNotification(eventChangeNotification("updated", updated), { revalidate: false });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { message: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: Params
) {
  const { id } = await params;

  try {
    const deleted = await prisma.courseEvent.delete({ where: { id: id } });
    await emitNotification(eventChangeNotification("deleted", deleted), { revalidate: false });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete event" },
      { status: 500 }
    );
  }
}
