/**
 * Browser-side Blob upload helper.
 *
 * Calls the `/api/blob/upload-token` endpoint to obtain a signed upload URL,
 * then PUTs the file directly to Vercel Blob — bypassing the 4.5 MB
 * Vercel function body limit.
 *
 * Consumers should pass a typed BlobKind plus the result of one of the
 * path builders in ./paths. The token endpoint validates that the pathname
 * matches the scheme for the kind before issuing a token.
 *
 * This file imports `@vercel/blob/client` only — safe to ship to the browser.
 */

"use client";

import { upload } from "@vercel/blob/client";

import type { BlobKind } from "./paths";

export interface UploadFileArgs {
  /** Logical kind of upload — used to pick allowed types/sizes server-side. */
  kind: BlobKind;
  /** Full pathname produced by a builder in ./paths. */
  pathname: string;
  /** The file to upload. */
  file: File;
  /** Optional progress callback. Receives a fraction in [0, 1]. */
  onProgress?: (fraction: number) => void;
  /** Optional AbortSignal so callers can cancel uploads. */
  signal?: AbortSignal;
}

export interface UploadResult {
  /** Public URL of the uploaded blob — stable, persist this in your DB. */
  url: string;
  /** Final pathname after random-suffix, useful for `del()` if needed. */
  pathname: string;
  /** Reported MIME type. */
  contentType: string;
}

/**
 * Upload a file directly to Vercel Blob via a server-issued token.
 *
 * @example
 *   const { url } = await uploadFile({
 *     kind: BlobKind.CourseCover,
 *     pathname: courseCoverPath(courseId, file.name),
 *     file,
 *   });
 */
export async function uploadFile(args: UploadFileArgs): Promise<UploadResult> {
  const blob = await upload(args.pathname, args.file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload-token",
    clientPayload: JSON.stringify({ kind: args.kind }),
    onUploadProgress: args.onProgress
      ? (event) => args.onProgress!(event.percentage / 100)
      : undefined,
    abortSignal: args.signal,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType ?? args.file.type ?? "application/octet-stream",
  };
}
