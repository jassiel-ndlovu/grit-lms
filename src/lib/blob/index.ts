/**
 * Intentionally empty.
 *
 * NOTE: a legacy `src/lib/blob.ts` still exists for legacy callers, so
 * resolving the bare path `@/lib/blob` would hit that file rather than
 * this barrel anyway. Always import from explicit subpaths instead:
 *
 *   import { courseCoverPath, BlobKind } from "@/lib/blob/paths";
 *   import { issueUploadToken, deleteBlob } from "@/lib/blob/server";
 *   import { uploadFile } from "@/lib/blob/client";
 *
 * This file should be deleted once `src/lib/blob.ts` is retired.
 */

export {};
