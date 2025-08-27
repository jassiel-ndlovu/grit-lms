/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const folder = formData.get("folder") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Construct file path: prepend folder if provided
  const filePath = folder ? `${folder}/${file.name}` : file.name;

  const { url } = await put(filePath, file, { 
    access: "public",
    addRandomSuffix: true, // still ensures uniqueness
  });
  
  return NextResponse.json({ url });
}

export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: "No file URL provided" },
        { status: 400 }
      );
    }

    await del(url); // Deletes from Vercel Blob
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}