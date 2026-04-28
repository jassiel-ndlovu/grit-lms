/**
 * Server-side Vercel Blob helpers.
 *
 * The primary export here is `issueUploadToken`, used by the
 * `/api/blob/upload-token` route to generate signed tokens for client
 * uploads. This is the only way to bypass the 4.5 MB Vercel function body
 * limit when uploading to Blob storage.
 *
 * `del()` is re-exported as a thin wrapper so callers don't have to know
 * about the underlying SDK module.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { z } from "zod";

import {
  ALLOWED_CONTENT_TYPES,
  BlobKind,
  MAX_BYTES,
  isValidPath,
} from "./paths";

/**
 * The clientPayload sent by the browser when requesting an upload token.
 * The token endpoint validates this before issuing a token.
 */
export const ClientPayloadSchema = z.object({
  kind: z.enum([
    BlobKind.CourseCover,
    BlobKind.LessonAttachment,
    BlobKind.LessonUpload,
    BlobKind.Submission,
    BlobKind.TestQuestionImage,
    BlobKind.UserAvatar,
  ]),
});
export type ClientPayload = z.infer<typeof ClientPayloadSchema>;

export interface IssueTokenOptions {
  body: HandleUploadBody;
  request: Request;
  /**
   * Authorize an upload. Throw to deny. Receives the parsed clientPayload
   * and the requested pathname. Use this to enforce role / ownership.
   */
  authorize: (args: {
    payload: ClientPayload;
    pathname: string;
  }) => Promise<{ tokenPayload?: string }>;
  /** Optional callback invoked after the upload completes. */
  onCompleted?: (args: {
    blobUrl: string;
    pathname: string;
    tokenPayload: string | null;
  }) => Promise<void>;
}

/**
 * Token endpoint logic. The /api/blob/upload-token route delegates to this.
 * Throws if the requested path is malformed or not allowed.
 */
export async function issueUploadToken(opts: IssueTokenOptions) {
  return handleUpload({
    body: opts.body,
    request: opts.request,
    onBeforeGenerateToken: async (pathname, clientPayloadJson) => {
      if (!clientPayloadJson) {
        throw new Error("Missing clientPayload");
      }
      const parsed = ClientPayloadSchema.safeParse(
        JSON.parse(clientPayloadJson),
      );
      if (!parsed.success) {
        throw new Error("Invalid clientPayload");
      }
      const payload = parsed.data;

      if (!isValidPath(payload.kind, pathname)) {
        throw new Error(`Pathname does not match scheme for kind=${payload.kind}`);
      }

      const { tokenPayload } = await opts.authorize({ payload, pathname });

      return {
        allowedContentTypes: ALLOWED_CONTENT_TYPES[payload.kind],
        maximumSizeInBytes: MAX_BYTES[payload.kind],
        addRandomSuffix: true,
        tokenPayload: tokenPayload ?? JSON.stringify({ kind: payload.kind }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (opts.onCompleted) {
        await opts.onCompleted({
          blobUrl: blob.url,
          pathname: blob.pathname,
          tokenPayload: tokenPayload ?? null,
        });
      }
    },
  });
}

/**
 * Delete a blob by URL. Safe to call from Server Actions.
 * Silently no-ops if the URL is empty or undefined to make cleanup paths
 * easier (e.g. "delete the old cover if there was one").
 */
export async function deleteBlob(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await del(url);
  } catch (e) {
    // Don't fail the parent operation if cleanup fails — just log.
    console.error("[blob] delete failed:", url, e);
  }
}
