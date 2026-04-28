/**
 * /api/blob/upload-token — issues signed upload tokens for client-side
 * Vercel Blob uploads.
 *
 * The browser POSTs a HandleUploadBody (produced by `upload()` from
 * @vercel/blob/client) along with a clientPayload describing the kind of
 * upload. This route verifies the session, role, and pathname, then returns
 * a signed token the browser uses to PUT the file directly to Blob.
 *
 * Authorization summary:
 *   - All uploads require a valid session.
 *   - course-cover, lesson-attachment, lesson-upload, test-question-image
 *     → TUTOR only.
 *   - submission → STUDENT only.
 *   - user-avatar → any logged-in user (uploads to their own folder).
 */

import { NextResponse } from "next/server";
import type { HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/lib/auth";
import { BlobKind } from "@/lib/blob/paths";
import { issueUploadToken, type ClientPayload } from "@/lib/blob/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await issueUploadToken({
      body,
      request,
      authorize: async ({ payload, pathname }) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("Not authenticated");
        }

        assertRoleAllowsKind(session.user.role, payload.kind);

        // For user-avatar, ensure the path targets the requester's own folder.
        if (payload.kind === BlobKind.UserAvatar) {
          const expectedPrefix = `users/${session.user.id}/avatar/`;
          if (!pathname.startsWith(expectedPrefix)) {
            throw new Error("Cannot upload avatar to another user's folder");
          }
        }

        return {
          tokenPayload: JSON.stringify({
            kind: payload.kind,
            userId: session.user.id,
          }),
        };
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload denied";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function assertRoleAllowsKind(role: string, kind: ClientPayload["kind"]): void {
  switch (kind) {
    case BlobKind.CourseCover:
    case BlobKind.LessonAttachment:
    case BlobKind.LessonUpload:
    case BlobKind.TestQuestionImage:
      if (role !== "TUTOR") {
        throw new Error("Tutor role required for this upload kind");
      }
      return;
    case BlobKind.Submission:
      if (role !== "STUDENT") {
        throw new Error("Student role required for submission uploads");
      }
      return;
    case BlobKind.UserAvatar:
      // Any authenticated user.
      return;
    default:
      throw new Error("Unknown upload kind");
  }
}
