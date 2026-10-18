/**
 * /api/upload — legacy file upload used by `uploadFile` in `src/lib/blob.ts`
 * (the legacy assignment editor and submission portal). Requires a signed-in
 * user. New code uploads straight to Vercel Blob via /api/blob/upload-token,
 * which also gates each upload kind by role.
 *
 * DELETE is retired: its only caller (`deleteFile` from the old test-taking
 * components) is imported nowhere, and it let any caller delete any blob.
 *
 * TODO[chapter-3-cleanup]: drop this file with `src/lib/blob.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { gone, requireApiSession } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

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

/**
 * Retired — nothing deletes blobs through this URL any more.
 */
export function DELETE() {
  return gone("Blob deletion through this route is retired.");
}
