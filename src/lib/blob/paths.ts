/**
 * Typed path builders for Vercel Blob storage.
 *
 * Centralizing path generation here means:
 *   1. Storage layout is documented in code, not implicit in callers.
 *   2. Renaming a path scheme is a one-file change.
 *   3. Token endpoints can validate that a requested pathname matches an
 *      expected scheme before issuing an upload token.
 *
 * Layout:
 *   courses/<courseId>/cover/<sanitized-filename>
 *   courses/<courseId>/lessons/<lessonId>/attachments/<sanitized-filename>
 *   courses/<courseId>/lessons/<lessonId>/uploaded/<sanitized-filename>
 *   submissions/<submissionId>/<sanitized-filename>
 *   tests/<testId>/questions/<questionId>/<sanitized-filename>
 *   users/<userId>/avatar/<sanitized-filename>
 *
 * Random suffixes are added by Vercel Blob (`addRandomSuffix: true`), so
 * paths here don't need to be unique on their own.
 */

const SAFE_FILENAME = /[^a-zA-Z0-9._-]+/g;

export function sanitizeFilename(name: string): string {
  // Strip directory traversal, collapse unsafe characters to `-`, trim.
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(SAFE_FILENAME, "-").replace(/^-+|-+$/g, "") || "file";
}

export const BlobKind = {
  CourseCover: "course-cover",
  LessonAttachment: "lesson-attachment",
  LessonUpload: "lesson-upload",
  Submission: "submission",
  TestQuestionImage: "test-question-image",
  UserAvatar: "user-avatar",
} as const;

export type BlobKind = (typeof BlobKind)[keyof typeof BlobKind];

export function courseCoverPath(courseId: string, filename: string): string {
  return `courses/${courseId}/cover/${sanitizeFilename(filename)}`;
}

export function lessonAttachmentPath(
  courseId: string,
  lessonId: string,
  filename: string,
): string {
  return `courses/${courseId}/lessons/${lessonId}/attachments/${sanitizeFilename(filename)}`;
}

export function lessonUploadPath(
  courseId: string,
  lessonId: string,
  filename: string,
): string {
  return `courses/${courseId}/lessons/${lessonId}/uploaded/${sanitizeFilename(filename)}`;
}

export function submissionPath(submissionId: string, filename: string): string {
  return `submissions/${submissionId}/${sanitizeFilename(filename)}`;
}

export function testQuestionImagePath(
  testId: string,
  questionId: string,
  filename: string,
): string {
  return `tests/${testId}/questions/${questionId}/${sanitizeFilename(filename)}`;
}

export function userAvatarPath(userId: string, filename: string): string {
  return `users/${userId}/avatar/${sanitizeFilename(filename)}`;
}

/**
 * Validate that a pathname matches the expected scheme for a given kind.
 * Used by the upload-token endpoint to refuse forged paths.
 */
export function isValidPath(kind: BlobKind, pathname: string): boolean {
  switch (kind) {
    case BlobKind.CourseCover:
      return /^courses\/[^/]+\/cover\/[^/]+$/.test(pathname);
    case BlobKind.LessonAttachment:
      return /^courses\/[^/]+\/lessons\/[^/]+\/attachments\/[^/]+$/.test(
        pathname,
      );
    case BlobKind.LessonUpload:
      return /^courses\/[^/]+\/lessons\/[^/]+\/uploaded\/[^/]+$/.test(
        pathname,
      );
    case BlobKind.Submission:
      return /^submissions\/[^/]+\/[^/]+$/.test(pathname);
    case BlobKind.TestQuestionImage:
      return /^tests\/[^/]+\/questions\/[^/]+\/[^/]+$/.test(pathname);
    case BlobKind.UserAvatar:
      return /^users\/[^/]+\/avatar\/[^/]+$/.test(pathname);
    default:
      return false;
  }
}

/**
 * Allowed content types per blob kind. The server enforces this during
 * token issuance; clients should pass matching content-types or upload fails.
 */
export const ALLOWED_CONTENT_TYPES: Record<BlobKind, string[]> = {
  [BlobKind.CourseCover]: ["image/png", "image/jpeg", "image/webp"],
  [BlobKind.LessonAttachment]: [
    "image/*",
    "application/pdf",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
  ],
  [BlobKind.LessonUpload]: ["*/*"],
  [BlobKind.Submission]: ["*/*"],
  [BlobKind.TestQuestionImage]: ["image/png", "image/jpeg", "image/webp"],
  [BlobKind.UserAvatar]: ["image/png", "image/jpeg", "image/webp"],
};

/**
 * Maximum upload size in bytes per kind. The Vercel Blob client upload
 * token includes a `maximumSizeInBytes` constraint enforced at upload time.
 */
export const MAX_BYTES: Record<BlobKind, number> = {
  [BlobKind.CourseCover]: 10 * 1024 * 1024, // 10 MB
  [BlobKind.LessonAttachment]: 100 * 1024 * 1024, // 100 MB
  [BlobKind.LessonUpload]: 200 * 1024 * 1024, // 200 MB
  [BlobKind.Submission]: 200 * 1024 * 1024, // 200 MB
  [BlobKind.TestQuestionImage]: 5 * 1024 * 1024, // 5 MB
  [BlobKind.UserAvatar]: 2 * 1024 * 1024, // 2 MB
};
